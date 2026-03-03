#!/usr/bin/env bash
# =============================================================================
# setup_frappe_lms.sh — Inicialização do Frappe LMS para Kreativ Educação
#
# ORDEM DE EXECUÇÃO:
#   1. Certifique-se que o .env.frappe existe e está preenchido
#   2. Execute: bash scripts/setup_frappe_lms.sh
#   3. Depois: docker compose -f docker-compose.frappe.yml up -d
#
# O script:
#   - Sobe apenas os serviços de infra (MariaDB + Redis)
#   - Aguarda o MariaDB estar saudável
#   - Cria o site Frappe com bench new-site
#   - Instala o app lms
#   - Gera API Key para o N8N
#   - Exibe as credenciais geradas
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Carregar .env.frappe
if [ -f "$PROJECT_DIR/.env.frappe" ]; then
  export $(grep -v '^#' "$PROJECT_DIR/.env.frappe" | xargs)
else
  echo "❌ Arquivo .env.frappe não encontrado!"
  echo "   Copie: cp .env.frappe.example .env.frappe"
  echo "   Edite com suas senhas antes de continuar."
  exit 1
fi

SITE_NAME="${FRAPPE_SITE_NAME:-lms.extensionista.site}"
ADMIN_PASS="${FRAPPE_ADMIN_PASSWORD}"
DB_ROOT_PASS="${MARIADB_ROOT_PASSWORD}"

echo "============================================="
echo " Frappe LMS — Setup Kreativ Educação"
echo " Site: $SITE_NAME"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# ETAPA 1 — Subir infra base (MariaDB + Redis)
# ---------------------------------------------------------------------------
echo "⏳ [1/5] Subindo MariaDB e Redis..."
docker compose -f "$PROJECT_DIR/docker-compose.frappe.yml" \
  up -d frappe_mariadb frappe_redis_queue frappe_redis_socketio frappe_configurator frappe_backend

echo "⏳ Aguardando MariaDB ficar saudável (até 60s)..."
TIMEOUT=60
COUNT=0
until docker exec kreativ_frappe_mariadb healthcheck.sh --connect --innodb_initialized 2>/dev/null; do
  sleep 3
  COUNT=$((COUNT + 3))
  if [ $COUNT -ge $TIMEOUT ]; then
    echo "❌ MariaDB não iniciou em ${TIMEOUT}s. Verifique logs:"
    echo "   docker logs kreativ_frappe_mariadb"
    exit 1
  fi
  echo "   Aguardando... (${COUNT}s/${TIMEOUT}s)"
done
echo "✅ MariaDB pronto!"
echo ""

# Corrige permissões do volume herdado do host (root)
docker exec -u root kreativ_frappe_backend chown -R frappe:frappe /home/frappe/frappe-bench/sites

# ---------------------------------------------------------------------------
# ETAPA 2 — Criar o site Frappe (bench new-site)
# ---------------------------------------------------------------------------
echo "⏳ [2/5] Criando site Frappe LMS: $SITE_NAME"
echo "   (Este processo leva 2-5 minutos na primeira execução)"

docker exec -w /home/frappe/frappe-bench/sites kreativ_frappe_backend bash -c \
  "ls -1 ../apps > apps.txt && bench new-site \
    --force \
    --db-host kreativ_frappe_mariadb \
    --db-root-password '$DB_ROOT_PASS' \
    --admin-password '$ADMIN_PASS' \
    --no-mariadb-socket \
    '$SITE_NAME'" || {
      echo "⚠️  Site já pode existir. Continuando..."
    }

echo "✅ Site criado!"
echo ""

# ---------------------------------------------------------------------------
# ETAPA 3 — Instalar o app LMS
# ---------------------------------------------------------------------------
echo "⏳ [3/5] Instalando app 'lms' no site..."
docker exec -w /home/frappe/frappe-bench/sites kreativ_frappe_backend bash -c \
  "bench --site '$SITE_NAME' clear-cache && bench --site '$SITE_NAME' install-app lms"

echo "✅ App LMS instalado!"
echo ""

# ---------------------------------------------------------------------------
# ETAPA 4 — Configurações para integração com N8N (CORS + API)
# ---------------------------------------------------------------------------
echo "⏳ [4/5] Configurando CORS e API REST..."
docker exec -w /home/frappe/frappe-bench kreativ_frappe_backend bash -c \
  "bench --site $SITE_NAME set-config allow_cors 1 && \
   bench --site $SITE_NAME set-config cors_origin '*' && \
   bench --site $SITE_NAME enable-scheduler && \
   bench --site $SITE_NAME set-maintenance-mode off"

echo "✅ Configurações aplicadas!"
echo ""

# ---------------------------------------------------------------------------
# ETAPA 5 — Gerar API Key para o N8N
# ---------------------------------------------------------------------------
echo "⏳ [5/5] Gerando API Key para integração N8N..."

API_RESULT=$(docker exec -w /home/frappe/frappe-bench/sites kreativ_frappe_backend bash -c \
  "bench --site '$SITE_NAME' execute frappe.core.doctype.user.user.generate_keys \
    --args '[\"Administrator\"]' 2>/dev/null" || echo "ERROR")

echo ""
echo "============================================="
echo " ✅ Setup Frappe LMS CONCLUÍDO!"
echo "============================================="
echo ""
echo " 🌐 Portal:  https://$SITE_NAME"
echo " 👤 Admin:   Administrator"
echo " 🔑 Senha:   $ADMIN_PASS (guarde em local seguro)"
echo ""
echo " 📋 PRÓXIMOS PASSOS:"
echo "   1. Subir todos os serviços Frappe:"
echo "      docker compose -f docker-compose.frappe.yml up -d"
echo ""
echo "   2. Acesse https://$SITE_NAME e faça login"
echo ""
echo "   3. Para gerar API Key do N8N:"
echo "      → No Frappe: Menu Superior > Usuário > Minha Conta > API Access"
echo "      → Clique em 'Gerar Chaves'"
echo "      → Copie API Key + API Secret para o .env.frappe"
echo ""
echo "   4. No N8N, instale o community node:"
echo "      → Settings > Community Nodes > Install"
echo "      → Pacote: n8n-nodes-frappe-lms"
echo ""
echo "   5. Execute a migração de dados:"
echo "      python3 scripts/migrate_to_frappe_lms.py"
echo ""
echo "============================================="
