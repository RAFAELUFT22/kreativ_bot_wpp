# Kreativ: Limpeza do Repositório + Fase 1 Estabilização

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limpar o repositório de ~150 arquivos temporários e estabilizar os workflows N8N da Fase 1 (Error Handler, fallback amigável, validação de payload, fix AI Tutor e fix list_reply).

**Architecture:** Limpeza via `git rm` + `.gitignore` reforçado, depois modificação dos arquivos JSON dos workflows N8N e push via API do N8N. Nenhum código de aplicação é alterado nesta fase.

**Tech Stack:** Git, Bash, N8N REST API (`https://n8n.extensionista.site`), PostgreSQL (`kreativ_postgres:5432`), Evolution API v2.2.3, Python 3.

---

## Contexto Obrigatório

Antes de qualquer task, confirme o `.env` do projeto:
```bash
cat /root/ideias_app/.env | grep -E "N8N_API_KEY|EVOLUTION_API_KEY|N8N_URL" | head -5
```

Variáveis que serão usadas ao longo do plano:
- `N8N_URL=https://n8n.extensionista.site`
- `N8N_API_KEY=<valor do .env>`
- `EVOLUTION_URL=https://evolution.extensionista.site`
- `EVOLUTION_KEY=<valor do .env>`
- `EVOLUTION_INSTANCE=europs`

---

## Task 1: Limpeza da Raiz do Repositório

**Files:**
- Modify: `/root/ideias_app/.gitignore`
- Delete: ~80 arquivos `.txt`, `.py`, `.sql`, `.json`, `.js` temporários na raiz

### Step 1: Deletar arquivos `.txt` de debug/output

```bash
cd /root/ideias_app

# Output de deploys
git rm -f deploy_output*.txt sim_*.txt debug_*.txt final_check*.txt \
  final_debug*.txt migration_output*.txt psql_output*.txt \
  check_out.txt b64_exec.txt n8n_data.txt n8n_logs*.txt \
  bot_logs.txt workflows_list.txt 2>/dev/null || true
```

Expected: lista de arquivos removidos do index git.

### Step 2: Deletar `.sql` de fix pontual

```bash
cd /root/ideias_app

git rm -f final_fix.sql final_fix_clean.sql fix_path.sql fix_sync.sql \
  fix_webhook_id.sql fix_webhook_name.sql restore_admin.sql \
  restore_admin_v2.sql update_wf.sql 2>/dev/null || true
```

### Step 3: Deletar scripts `.py` temporários da raiz

```bash
cd /root/ideias_app

git rm -f activate_resume.py check_executions.py check_pause.py \
  check_resume.py test_branch.py test_handoff.py trigger_chatwoot.py \
  update_n8n.py verify_full_cycle.py gerar_sql_import.py \
  import_preinscricoes.py 2>/dev/null || true
```

### Step 4: Deletar outputs `.json` e arquivos JS avulsos

```bash
cd /root/ideias_app

git rm -f arquivo_saida.json wf_out.json last_exec.json \
  workflow_from_api.json n8n-workflow-whatsapp-bot.json \
  kreativ_edu_typebot.json typebot-kreativ-test.json typebot-pizza-test.json \
  patch_handoff_response.js query_n8n.js push_workflows.js \
  package.json package-lock.json 2>/dev/null || true
```

### Step 5: Deletar scripts de instalação e docs redundantes da raiz

```bash
cd /root/ideias_app

git rm -f create_instance.sh create_instance_meta.sh setup-github.sh \
  guia_ptbr.md AGENTS.md README_TESTS.md TYPEBOT_SETUP.md \
  GUIA_META_WEBHOOK.md GUIA_PERSISTENCIA.md arquitetura_visual.html \
  "Implementing AI Orchestration Systems.md" 2>/dev/null || true
```

### Step 6: Deletar o diretório `fluxos_n8n/` (workflows TDS legados)

```bash
cd /root/ideias_app
git rm -rf fluxos_n8n/ 2>/dev/null || true
```

### Step 7: Verificar o que restou na raiz

```bash
ls /root/ideias_app/*.{txt,py,sql,json,js,sh,html,md} 2>/dev/null | \
  grep -v -E "(ROADMAP|PROJETO_STATUS|ARCHITECTURE_OVERVIEW|HANDOVER_NOTES)" | \
  grep -v ".env.example"
```

Expected: saída vazia (nenhum arquivo indesejado restante).

### Step 8: Commit

```bash
cd /root/ideias_app
git commit -m "$(cat <<'EOF'
chore: limpeza radical do repositório — remover ~150 arquivos temporários

Remove arquivos de debug/output, SQL de fix pontual, scripts Python
descartáveis, typebot legados, JS avulsos, fluxos_n8n/ (TDS) e docs
redundantes. Mantém apenas arquivos essenciais para funcionamento e
desenvolvimento conforme design doc 2026-02-22-repo-cleanup-design.md.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Limpeza dos `n8n-workflows/`

**Files:**
- Delete: ~35 workflows duplicados/teste/ad-hoc em `n8n-workflows/`
- Delete: 9 scripts JS/PY dentro de `n8n-workflows/`

### Step 1: Deletar workflows de teste (30-55)

```bash
cd /root/ideias_app

git rm -f \
  n8n-workflows/30-minimal-test.json \
  n8n-workflows/31-path-test.json \
  n8n-workflows/32-path-v2.json \
  n8n-workflows/33-half-router.json \
  n8n-workflows/34-postgres-static.json \
  n8n-workflows/35-clone-postgres.json \
  n8n-workflows/36-exec-test.json \
  n8n-workflows/37-code-only.json \
  n8n-workflows/38-fetch-debug.json \
  n8n-workflows/40-module-test.json \
  n8n-workflows/41-inject-test.json \
  n8n-workflows/50-fresh-test.json \
  n8n-workflows/51-check-student.json \
  n8n-workflows/52-get-module.json \
  n8n-workflows/53-submit-quiz.json \
  n8n-workflows/54-get-progress.json \
  n8n-workflows/55-request-human.json 2>/dev/null || true
```

### Step 2: Deletar versões duplicadas de workflows canônicos

```bash
cd /root/ideias_app

git rm -f \
  n8n-workflows/01-whatsapp-router.json \
  n8n-workflows/10-chatwoot-events-clean.json \
  n8n-workflows/20-ai-router.json \
  n8n-workflows/20-ai-router-v2.json \
  n8n-workflows/20-ai-router-v2-final.json \
  n8n-workflows/20-test-llm-latency.json \
  n8n-workflows/21-echo-test.json \
  n8n-workflows/99-test-adaptive.json 2>/dev/null || true
```

### Step 3: Deletar workflows ADMIN/fix/temp e duplicatas do 60

```bash
cd /root/ideias_app

git rm -f \
  n8n-workflows/ADMIN-FIX.json \
  n8n-workflows/ADMIN-ONLY-ROUTER.json \
  n8n-workflows/ADMIN-V3.json \
  n8n-workflows/fixed_router.json \
  n8n-workflows/fixed_router_final.json \
  n8n-workflows/fixed_router_v2.json \
  n8n-workflows/temp_update.json \
  n8n-workflows/mcp_auth.json \
  n8n-workflows/60-kreativ-api.json \
  n8n-workflows/60-kreativ-api-clean.json \
  n8n-workflows/60-kreativ-api-clean-v2.json \
  n8n-workflows/60-kreativ-api-v1.1-indented.json \
  n8n-workflows/60-kreativ-api-v1.2.json \
  n8n-workflows/60-kreativ-api-v1.2-clean.json 2>/dev/null || true
```

### Step 4: Deletar scripts JS/PY dentro de `n8n-workflows/`

```bash
cd /root/ideias_app

git rm -f \
  n8n-workflows/activate.js \
  n8n-workflows/activate_latest.js \
  n8n-workflows/check_net.js \
  n8n-workflows/deploy.js \
  n8n-workflows/deploy_p0.py \
  n8n-workflows/import-workflows.sh \
  n8n-workflows/redeploy.py \
  n8n-workflows/test_router.js \
  n8n-workflows/test_router_v2.js 2>/dev/null || true
```

### Step 5: Verificar resultado final de `n8n-workflows/`

```bash
ls /root/ideias_app/n8n-workflows/
```

Expected: apenas os 24 arquivos canônicos:
```
01-whatsapp-router-v2.json    11-lead-scoring.json
02-get-student-module.json    12-emit-certificate.json
03-submit-quiz-answer.json    13-mcp-server.json
04-request-human-support.json 14-tool-request-tutor.json
05-update-chatwoot-label.json 15-tool-save-progress.json
06-enroll-student.json        16-tool-resume-bot.json
07-dashboard.json             17-tool-emit-certificate.json
08-inatividade.json           18-save-progress-webhook.json
09-relatorio-semanal.json     19-resume-bot-webhook.json
10-chatwoot-events.json       20-ai-router-v3-pedagogical.json
                              21-quiz-handler.json
                              22-rag-ingestion.json
                              60-kreativ-api-v1.1.json
                              99-Global-Error-Handler.json
```

### Step 6: Commit

```bash
cd /root/ideias_app
git commit -m "$(cat <<'EOF'
chore(n8n-workflows): remover ~35 workflows duplicados/teste/ad-hoc

Remove versões antigas (20-ai-router v1/v2), testes (30-55),
ad-hoc (ADMIN-*, fixed_router*, temp_*), duplicatas do 60-kreativ-api
e todos os scripts JS/PY dentro da pasta. Mantém 24 workflows canônicos.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Limpeza dos `scripts/` e `.gitignore` Reforçado

**Files:**
- Modify: `/root/ideias_app/.gitignore`
- Delete: scripts JS descartáveis em `scripts/`

### Step 1: Deletar scripts JS descartáveis de `scripts/`

Scripts a remover (deploy/test/ad-hoc, sem valor permanente):
```bash
cd /root/ideias_app

git rm -f \
  scripts/05-test-integration.js \
  scripts/activate_and_test.js \
  scripts/check_workflows.js \
  scripts/cleanup_workflows.js \
  scripts/deactivate_router.js \
  scripts/deploy_humansupport.js \
  scripts/deploy_router_v2.js \
  scripts/force_activate_test.js \
  scripts/list_workflows.js \
  scripts/list_workflows_auth.js \
  scripts/load_test_latency.js \
  scripts/load_test_simple.js \
  scripts/push_and_activate.js \
  scripts/refined_prompt.js \
  scripts/resolve_conflict.js \
  scripts/simulate_adaptive.js \
  scripts/test_openrouter.js \
  scripts/test_webhook.js \
  scripts/activate_router.py 2>/dev/null || true
```

Scripts que **ficam** em `scripts/`:
- `build_typebot.py` — CRÍTICO
- `validate_typebot_json.py`
- `generate_typebot_flow.py`
- `health_check.sh`
- `test_ecosystem.sh`
- `test_deepseek.js` — útil para debug Fase 1
- `*.sql` (02-07) — migrations e seeds

### Step 2: Reforçar o `.gitignore`

Adicionar ao final do `/root/ideias_app/.gitignore`:

```
# --- Kreativ: prevenir recontaminação ---

# Outputs de debug/deploy
deploy_output*.txt
sim_*.txt
debug_*.txt
*_output*.txt
*_logs*.txt
bot_logs.txt
check_out.txt
n8n_data.txt

# JSON de output (não são código)
wf_out.json
last_exec.json
arquivo_saida.json
workflow_from_api.json

# Scripts temporários de sessão
check_*.py
test_branch.py
trigger_*.py
activate_resume.py
update_n8n.py
verify_full_cycle.py

# Bloqueia scripts não-workflow em n8n-workflows/
n8n-workflows/*.js
n8n-workflows/*.py
n8n-workflows/*.sh

# Evitar typebot legados
typebot-*-test.json
```

### Step 3: Verificar `scripts/` resultado

```bash
ls /root/ideias_app/scripts/
```

Expected: apenas `build_typebot.py`, `validate_typebot_json.py`, `generate_typebot_flow.py`, `health_check.sh`, `test_ecosystem.sh`, `test_deepseek.js`, e os arquivos `.sql` (02-07).

### Step 4: Commit

```bash
cd /root/ideias_app
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: limpar scripts/ descartáveis e reforçar .gitignore

Remove 19 scripts JS/PY de deploy/test ad-hoc de scripts/.
Adiciona padrões ao .gitignore para prevenir recontaminação futura
(deploy_output*.txt, sim_*.txt, check_*.py, n8n-workflows/*.js, etc.)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Ativar o 99-Global-Error-Handler no N8N

**Context:** O workflow `99-Global-Error-Handler.json` existe no repositório mas pode não estar ativo no N8N. Ele precisa estar ativo para receber eventos de erro dos outros workflows.

**Files:**
- Read: `n8n-workflows/99-Global-Error-Handler.json`

### Step 1: Checar se o Error Handler está ativo no N8N

```bash
source /root/ideias_app/.env
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs = json.load(sys.stdin)
for w in wfs.get('data', []):
    if 'Error' in w.get('name','') or '99' in w.get('name',''):
        print(f\"ID: {w['id']} | Name: {w['name']} | Active: {w['active']}\")
"
```

Expected: linha com o Error Handler e seu status.

### Step 2: Se não ativo, ativar via API

```bash
source /root/ideias_app/.env

# Substituir WF_ID pelo ID real obtido no Step 1
WF_ID="<id-do-error-handler>"

curl -s -X PATCH \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  "https://n8n.extensionista.site/api/v1/workflows/$WF_ID" | \
  python3 -c "import json,sys; w=json.load(sys.stdin); print('Active:', w.get('active'))"
```

Expected: `Active: True`

### Step 3: Configurar o Error Handler no workflow principal (60-kreativ-api-v1.1)

No N8N UI (`https://n8n.extensionista.site`):
1. Abrir `60-kreativ-api-v1.1` → Settings (ícone engrenagem)
2. Em **Error Workflow**, selecionar `99-Global-Error-Handler`
3. Salvar

Repetir para `10-chatwoot-events` e `20-ai-router-v3-pedagogical`.

### Step 4: Verificar configuração

```bash
source /root/ideias_app/.env
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs = json.load(sys.stdin)
for w in wfs.get('data', []):
    settings = w.get('settings', {})
    if settings.get('errorWorkflow'):
        print(f\"{w['name']}: errorWorkflow={settings['errorWorkflow']}\")
"
```

Expected: os 3 workflows principais listados com `errorWorkflow` preenchido.

---

## Task 5: Adicionar Fallback de Resposta Amigável no Unified API

**Problem:** Quando o `60-kreativ-api-v1.1` falha silenciosamente (node sem resposta, timeout, erro de query SQL), o Typebot fica aguardando sem receber retorno.

**Solution:** Modificar o nó `Responder Typebot` para ter um `continueOnFail: true` em nós críticos, e adicionar um nó de fallback que envia mensagem via Evolution API quando há erro.

**Files:**
- Modify: `n8n-workflows/60-kreativ-api-v1.1.json` (via N8N UI + export)

### Step 1: No N8N UI, abrir o workflow 60-kreativ-api-v1.1

URL: `https://n8n.extensionista.site`

### Step 2: Ativar "Continue On Fail" nos nós de DB

Para cada nó de PostgreSQL no workflow (Progress: Buscar DB, Quiz: Buscar Contexto, etc.):
1. Clicar no nó → Settings
2. Ativar **Continue On Fail**
3. Isso garante que uma falha de DB não silencia o workflow todo

### Step 3: Adicionar nó de fallback após "Responder Typebot"

Adicionar um nó **IF** depois do nó `Responder Typebot`:
- Condição: `{{ $json.error !== undefined }}`
- Branch `true`: nó **HTTP Request** chamando Evolution API:
  ```
  POST https://evolution.extensionista.site/message/sendText/europs
  Headers: apikey: <EVOLUTION_KEY>
  Body:
  {
    "number": "{{ $('Normalizar Input').item.json.phone }}",
    "text": "Ops! Encontrei uma instabilidade temporária. Por favor, tente novamente em instantes. 🙏"
  }
  ```

### Step 4: Exportar workflow atualizado e salvar no repo

```bash
source /root/ideias_app/.env

# Obter ID do workflow 60-kreativ-api-v1.1
WF_ID=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs=json.load(sys.stdin)
for w in wfs.get('data',[]):
    if '60' in w.get('name','') or 'kreativ-api' in w.get('name','').lower():
        print(w['id']); break
")
echo "Workflow ID: $WF_ID"

# Exportar JSON atualizado
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/$WF_ID" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-v1.1.json
```

### Step 5: Commit

```bash
cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-v1.1.json
git commit -m "$(cat <<'EOF'
feat(n8n): adicionar fallback amigável e continueOnFail no Unified API

Ativa continueOnFail nos nós PostgreSQL e adiciona fallback de mensagem
via Evolution API quando ocorre erro silencioso no workflow principal.
Garante que o aluno sempre recebe resposta, mesmo em falhas.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Validação de Payload na Entrada do Router

**Problem:** Se `phone`, `action` ou `body` chegam vazios/nulos no webhook do Unified API, os nós downstream falham de forma imprevisível.

**Solution:** Adicionar validação no nó `Normalizar Input` existente (nó Code em JavaScript).

**Files:**
- Modify: `n8n-workflows/60-kreativ-api-v1.1.json` (via N8N UI)

### Step 1: Abrir nó "Normalizar Input" no N8N UI

Localizar o nó **Normalizar Input** (nó Code logo após o Webhook).

### Step 2: Verificar o código atual do nó

Copiar o código atual para referência.

### Step 3: Adicionar validação no início do código

Adicionar no topo da função do nó Code:

```javascript
// Validação obrigatória de campos
const phone = $input.first().json?.body?.phone ||
              $input.first().json?.phone;
const action = $input.first().json?.body?.action ||
               $input.first().json?.action;

if (!phone) {
  throw new Error('Campo obrigatório ausente: phone');
}
if (!action) {
  throw new Error('Campo obrigatório ausente: action');
}

// Continuar com normalização existente...
```

### Step 4: Testar validação com payload inválido

```bash
source /root/ideias_app/.env

# Deve retornar erro (action ausente)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone": "556399374165"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
```

Expected: resposta de erro (não silêncio).

### Step 5: Testar com payload válido

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"phone": "556399374165", "action": "check_student"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
```

Expected: resposta JSON com dados do aluno.

### Step 6: Exportar e commitar

```bash
source /root/ideias_app/.env
WF_ID=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs=json.load(sys.stdin)
for w in wfs.get('data',[]):
    if 'kreativ-api' in w.get('name','').lower():
        print(w['id']); break
")
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/$WF_ID" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-v1.1.json

cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-v1.1.json
git commit -m "$(cat <<'EOF'
feat(n8n): validação de payload obrigatório no Unified API Router

Adiciona validação explícita de phone e action na entrada do router.
Erros agora são lançados com mensagem clara em vez de falhar silenciosamente.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Investigar e Corrigir "AI Tutor: Proxy Request"

**Problem:** O nó `AI Tutor: Proxy Request` retorna erro "Proxy Request" ao chamar o DeepSeek. Causas prováveis: timeout, payload malformado, ou autenticação.

**Files:**
- Read: `n8n-workflows/60-kreativ-api-v1.1.json`
- Test: `scripts/test_deepseek.js`

### Step 1: Testar DeepSeek diretamente

```bash
source /root/ideias_app/.env
node /root/ideias_app/scripts/test_deepseek.js
```

Expected: resposta JSON com `choices[0].message.content`.

Se falhar: verificar `DEEPSEEK_API_KEY` no `.env`.

### Step 2: Verificar configuração do nó no N8N UI

Abrir `60-kreativ-api-v1.1` → nó **AI Tutor: Proxy Request** → inspecionar:
- URL: deve ser `https://api.deepseek.com/v1/chat/completions`
- Method: POST
- Authentication: Header Auth com `Authorization: Bearer <key>`
- Timeout: verificar se está configurado (padrão N8N = 300s)

### Step 3: Se o problema for timeout — aumentar no nó

No nó HTTP Request do AI Tutor:
- Settings → **Timeout** → alterar para `60000` (60 segundos)

### Step 4: Se o problema for autenticação — corrigir credencial no N8N

No N8N UI: Settings → Credentials → localizar DeepSeek → verificar API Key.

Testar manualmente:
```bash
source /root/ideias_app/.env
curl -s -X POST \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Olá! Responda em 1 frase."}],
    "max_tokens": 50
  }' \
  "https://api.deepseek.com/v1/chat/completions" | python3 -m json.tool
```

Expected: `{"choices": [{"message": {"content": "..."}}]}`

### Step 5: Simular AI Tutor via webhook

```bash
source /root/ideias_app/.env
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "556399374165",
    "action": "ai_tutor",
    "message": "Explique o que é aprendizado ativo em 2 frases."
  }' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool
```

Expected: resposta com `response` do DeepSeek.

### Step 6: Exportar e commitar (após fix)

```bash
source /root/ideias_app/.env
WF_ID=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs=json.load(sys.stdin)
for w in wfs.get('data',[]):
    if 'kreativ-api' in w.get('name','').lower():
        print(w['id']); break
")
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/$WF_ID" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-v1.1.json

cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-v1.1.json
git commit -m "$(cat <<'EOF'
fix(n8n): corrigir AI Tutor Proxy Request — timeout e autenticação DeepSeek

Ajusta timeout do nó HTTP Request para 60s e verifica credencial da API.
AI Tutor agora responde corretamente sem erro de Proxy Request.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Investigar e Corrigir `list_reply` (Race Condition)

**Problem:** Quando o usuário seleciona um item de lista interativa no WhatsApp (tipo `list_reply`), o Typebot/N8N não reconhece na primeira tentativa.

**Root Cause Esperado:** O webhook recebe `message.listResponseMessage.singleSelectReply.selectedRowId` mas o fluxo espera `message.conversation` ou `message.extendedTextMessage.text`.

**Files:**
- Read: `n8n-workflows/10-chatwoot-events.json`
- Read: `n8n-workflows/01-whatsapp-router-v2.json`

### Step 1: Inspecionar payload real de um list_reply

No N8N, verificar execuções recentes do webhook que recebe mensagens WhatsApp. Buscar por uma execução com `list_reply`:

```bash
source /root/ideias_app/.env
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/executions?limit=20" | \
  python3 -c "
import json,sys
execs=json.load(sys.stdin)
for e in execs.get('data', []):
    print(e['id'], e['workflowId'], e.get('status'), e.get('startedAt','')[:19])
" | head -20
```

### Step 2: Extrair o payload de uma execução com list_reply

```bash
source /root/ideias_app/.env
# Substituir EXEC_ID pelo ID encontrado no Step 1
EXEC_ID="<exec-id>"
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/executions/$EXEC_ID" | \
  python3 -c "
import json,sys
e=json.load(sys.stdin)
data=e.get('data',{}).get('resultData',{}).get('runData',{})
webhook_node=list(data.keys())[0]
print(json.dumps(data[webhook_node][0]['data']['main'][0][0]['json'], indent=2, ensure_ascii=False)[:3000])
"
```

Expected: JSON com a estrutura real do payload `list_reply`.

### Step 3: No workflow 01-whatsapp-router-v2, adicionar extração de list_reply

No nó de normalização do router, adicionar:

```javascript
// Extrair texto de todos os tipos de mensagem WhatsApp
const msg = $input.first().json?.data?.message;
const text =
  msg?.conversation ||
  msg?.extendedTextMessage?.text ||
  msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||  // ← list_reply
  msg?.interactive?.button_reply?.title ||  // ← button_reply
  '';
```

### Step 4: Testar enviando um list_reply simulado

```bash
source /root/ideias_app/.env
# Simular payload de list_reply
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": {"remoteJid": "556399374165@s.whatsapp.net"},
      "message": {
        "listResponseMessage": {
          "singleSelectReply": {"selectedRowId": "modulo-1"}
        }
      }
    }
  }' \
  "https://n8n.extensionista.site/webhook/<id-do-webhook-router>"
```

Expected: o texto `modulo-1` é extraído e roteado corretamente.

### Step 5: Exportar e commitar

```bash
source /root/ideias_app/.env
# Obter ID do workflow 01-whatsapp-router-v2
WF_ID=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs=json.load(sys.stdin)
for w in wfs.get('data',[]):
    if 'router' in w.get('name','').lower() or '01' in w.get('name',''):
        print(w['id']); break
")

curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/$WF_ID" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/01-whatsapp-router-v2.json

cd /root/ideias_app
git add n8n-workflows/01-whatsapp-router-v2.json
git commit -m "$(cat <<'EOF'
fix(n8n): suportar list_reply na extração de texto do WhatsApp Router

Adiciona extração de listResponseMessage.singleSelectReply.selectedRowId
ao normalizador de payload. list_reply agora é processado corretamente
na primeira tentativa, eliminando a race condition de estado.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Verificação Final da Fase 1

### Step 1: Confirmar repositório limpo

```bash
cd /root/ideias_app
git status
ls n8n-workflows/ | wc -l  # deve ser 24
ls *.txt 2>/dev/null | wc -l  # deve ser 0
ls *.py 2>/dev/null | wc -l   # deve ser 0 (exceto .env.example)
```

### Step 2: Confirmar que todos os workflows estão ativos no N8N

```bash
source /root/ideias_app/.env
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows" | \
  python3 -c "
import json,sys
wfs=json.load(sys.stdin)
for w in wfs.get('data',[]):
    status = '✅' if w['active'] else '⚠️ '
    print(f\"{status} {w['name']}\")
"
```

### Step 3: Ciclo completo de smoke test

```bash
source /root/ideias_app/.env

# 1. check_student
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"check_student"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool

# 2. get_module
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"get_module","module_id":1}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool

# 3. get_progress
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"get_progress"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool
```

Expected: todas as 3 chamadas retornam JSON válido com dados.

---

## Próximos Passos (Fase 2)

Após Fase 1 concluída, abrir novo plano para:
- `docs/plans/2026-02-22-fase2-seguranca.md`
- Itens: queries SQL em transações, Authorization nos webhooks ToolJet, segurança do Router
