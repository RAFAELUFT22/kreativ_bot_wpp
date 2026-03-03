#!/usr/bin/env bash
# =============================================================================
# configure_evolution_direct.sh
# Reconecta a Evolution API para enviar webhooks DIRETAMENTE para o N8N
# (remove a integração Typebot, substitui pelo N8N Conversation Engine)
#
# SEGURANÇA: Execute APENAS após validar o workflow N8N 70-wpp-conversation-engine.json
# Faça o rollback com: bash scripts/rollback_to_typebot.sh
# =============================================================================

set -e

EVOLUTION_URL="${EVOLUTION_URL:-https://evolution.extensionista.site}"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY}"
INSTANCE="${EVOLUTION_INSTANCE:-europs}"
N8N_WEBHOOK="https://n8n.extensionista.site/webhook/wpp-conversation"

if [ -z "$EVOLUTION_API_KEY" ]; then
  # Tentar carregar do .env
  if [ -f ".env" ]; then
    export $(grep -v '^#' .env | grep EVOLUTION_API_KEY | xargs)
  fi
fi

if [ -z "$EVOLUTION_API_KEY" ]; then
  echo "❌ EVOLUTION_API_KEY não definida. Configure no .env ou como variável de ambiente."
  exit 1
fi

echo "============================================="
echo " Evolution API → N8N Direct (sem Typebot)"
echo " Instância: $INSTANCE"
echo " Webhook: $N8N_WEBHOOK"
echo "============================================="
echo ""
echo "⚠️  ATENÇÃO: Este script desativa a integração Typebot!"
echo "   O bot Typebot DEIXARÁ de receber mensagens após execução."
echo ""
read -p "Confirmar? (s/N): " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "⏳ [1/3] Desativando integração Typebot na instância..."
curl -s -X DELETE \
  "${EVOLUTION_URL}/typebot/stop/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool || true
echo ""

echo "⏳ [2/3] Configurando webhook direto para N8N..."
curl -s -X PUT \
  "${EVOLUTION_URL}/webhook/set/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": true,
    \"url\": \"${N8N_WEBHOOK}\",
    \"webhook_by_events\": false,
    \"webhook_base64\": false,
    \"events\": [\"MESSAGES_UPSERT\", \"MESSAGES_UPDATE\", \"QRCODE_UPDATED\", \"CONNECTION_UPDATE\"]
  }" | python3 -m json.tool
echo ""

echo "⏳ [3/3] Verificando configuração atual da instância..."
curl -s \
  "${EVOLUTION_URL}/instance/fetchInstances?instanceName=${INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  | python3 -m json.tool
echo ""

echo "============================================="
echo " ✅ Configuração concluída!"
echo ""
echo " 🔍 Para testar, envie 'oi' para o WhatsApp"
echo "    e acompanhe em:"
echo "    https://n8n.extensionista.site → Execuções"
echo ""
echo " 🔙 Para fazer rollback (retornar ao Typebot):"
echo "    bash scripts/rollback_to_typebot.sh"
echo "============================================="
