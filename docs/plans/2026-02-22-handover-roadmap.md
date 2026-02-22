# Kreativ Educação — Handover & Roadmap Técnico
> **Para o próximo agente:** Leia este documento INTEIRO antes de tocar qualquer código.
> **Data de geração:** 2026-02-22
> **Sessão que gerou este doc:** Limpeza do repo + Fase 1 estabilização (9 commits)

---

## 0. INCIDENTE CRÍTICO + CORREÇÕES (22/02/2026 — Sessão 2 com Claude)

### 0.1 O que o Gemini fez de errado
O Gemini (sessão anterior) **destruiu dois workflows de produção** ao substituí-los por skeletons:
- `60-kreativ-api-ultimate.json`: 43 nós → 4 nós (apenas Webhook + Normalizar + AI Tutor proxy + Responder)
- `20-ai-router-v3-redis-rag.json`: 13 nós → 12 nós + sintaxe Go template inválida (`{{ .DEEPSEEK_API_KEY }}`)
- Ambos foram desativados em produção

O Gemini também criou `scripts/ingest_embeddings.py` (útil para RAG, mantido).

### 0.2 Correções aplicadas nesta sessão (Claude, commit 5fb2c98)

**a) Restauração dos workflows (commits b8eab4f)**
- Restaurados via `git checkout HEAD~2` e re-implantados via N8N API PUT
- Todos os 5 workflows reativados:  ULTIMATE, AI Router V3, WhatsApp Router, Chatwoot Bot, Error Handler

**b) Fix do sub-workflow AI Router V3 (commit 7ee3be2)**
- Adicionado `Execute Workflow Trigger` — N8N atual exige este nó em sub-workflows chamados via `executeWorkflow`
- Corrigido `Transformer` para suportar ambos os modos (executeWorkflow vs Webhook direto)
- Substituído `Respond to Router` (respondToWebhook → falha em contexto executeWorkflow) por Code node passthrough
- AI Tutor testado e funcionando: DeepSeek responde com contexto real do aluno

**c) Fix do bug Progress: Calcular (commit 5fb2c98)**
- `if (!row.name)` → `if (!row.phone)` — o aluno teste tem `name=NULL`, causava falso "Aluno não encontrado"
- `get_progress` agora retorna corretamente: `{ module=2, pct=0%, course_name=Agronegócio... }`

### 0.3 Estado pós-sessão (smoke tests OK)
```
✅ check_student → { status=bot, module=2, course=Agronegócio }
✅ get_progress  → { module=2, pct=0% }
✅ Payload inválido → HTTP 400
✅ AI Tutor → resposta contextual DeepSeek em ~5s
✅ get_module → retorna dados do módulo + quiz gerado
```

### 0.4 Workflows ativos em produção (5/5)
```
✅ SoB5evP9aOmj6hLA — Kreativ: Unified API Router (v1.1 - ULTIMATE) — 43 nós
✅ 5caL67H387euTxan — Kreativ: AI Adaptive Router V3 (Redis Memory + RAG) — 14 nós
✅ a0RywHWeY5kfgzGT — Kreativ: AI Tutor V3 (RAG - FINAL) — WhatsApp Router
✅ y92mEtPP4nK1p037 — Kreativ: Chatwoot → Retomar Bot & Treinamento
✅ mFwiM2dZyKeEgKk6 — 99-Global-Error-Handler
```

---

## 1. O QUE FOI FEITO HOJE (22/02/2026)

### 1.1 Limpeza do Repositório (commits 20b5da9 → 4257a9d)
- **~220 arquivos removidos** em 4 commits: deploy_output*.txt, sim_*.txt, SQLs de fix pontual, scripts .py temporários, fluxos_n8n/ (TDS legados), workflows duplicados/teste (30-55, ADMIN-*, fixed_router*), scripts JS em n8n-workflows/
- **.gitignore reforçado** com padrões que bloqueiam recontaminação (deploy_output*, sim_*.txt, check_*.py, n8n-workflows/*.js, etc.)
- **n8n-workflows/** agora tem 26 arquivos canônicos, todos exports reais de produção

### 1.2 Descoberta Crítica: Divergência Repo × Produção
O N8N tem **70 workflows** (a maioria deprecated/inativo). Os arquivos no repo eram snapshots antigos. Os workflows reais ativos são:

| Arquivo no Repo | ID N8N | Nome no N8N | Status |
|----------------|--------|-------------|--------|
| `60-kreativ-api-ultimate.json` | `SoB5evP9aOmj6hLA` | Kreativ: Unified API Router (v1.1 - ULTIMATE) | ✅ Ativo |
| `10-whatsapp-router-active.json` | `a0RywHWeY5kfgzGT` | Kreativ: AI Adaptive Router | ✅ Ativo |
| `20-ai-router-v3-redis-rag.json` | `5caL67H387euTxan` | Kreativ: AI Adaptive Router V3 (Redis Memory + RAG) | ✅ Ativo |
| `20-ai-adaptive-router.json` | `a0RywHWeY5kfgzGT` | Kreativ: AI Adaptive Router | ✅ Ativo |
| `10-chatwoot-retomar-bot.json` | `y92mEtPP4nK1p037` | Kreativ: Chatwoot → Retomar Bot & Treinamento | ✅ Ativo |
| `99-global-error-handler.json` | `mFwiM2dZyKeEgKk6` | 99-Global-Error-Handler | ✅ Ativo |

> **IMPORTANTE:** O "ULTIMATE" é a evolução do v1.1 que a Gemini criou. É O workflow de produção. Não confundir com os outros 4 clones inativos `v1.1 - Verified` (IDs: CUmejFfA7KIKfKvJ, Sr6bC9WbVXSdZfhP, GFBswlqCKBAHeiYq, tOGGjrzk3ZImsK81).

### 1.3 Fase 1 — Estabilização (commits 687c5b3 → 79ef2d4)

**Task 4 — Error Handler:**
- `99-global-error-handler.json` ativado, vinculado como `settings.errorWorkflow` nos 4 workflows principais
- O Error Handler chama DeepSeek para gerar plano de correção e notifica tutor via WhatsApp

**Tasks 5-6 — Validação + Fallback:**
- Nó `Normalizar Input` do ULTIMATE agora valida `phone` e `action` obrigatórios
- Payload inválido retorna HTTP 400 imediatamente com mensagem clara
- 11 nós PostgreSQL com `onError: continueRegularOutput` (evita silêncio em falha de DB)
- Novo nó `Responder Erro Validacao` conectado ao output de erro do Normalizar Input

**Tasks 7-8 — AI Tutor + list_reply:**
- `AI Tutor: Proxy Request` é um `executeWorkflow` que chama `5caL67H387euTxan` (sub-workflow)
- Timeout era **0ms** → ajustado para **120.000ms** em 4 nós DeepSeek (Generate Quiz, Avaliar Quiz, AI Tutor, OpenRouter)
- DeepSeek responde em ~2s, confirmado funcionando: retorna contexto real do aluno (Módulo 2, curso Agronegócio)
- WhatsApp Router (`a0RywHWeY5kfgzGT`) agora extrai texto de TODOS os tipos Evolution API:
  - `msg.conversation` — texto simples
  - `msg.extendedTextMessage?.text` — links/formatado
  - `msg.listResponseMessage?.singleSelectReply?.selectedRowId` — LIST REPLY ← **NOVO**
  - `msg.listResponseMessage?.title` — fallback list
  - `msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson` — nativeFlow
  - `msg.buttonsResponseMessage?.selectedDisplayText` — botões legados
  - `msg.templateButtonReplyMessage?.selectedId` — template button

---

## 2. ESTADO ATUAL DO SISTEMA (22/02/2026 — 23:00)

### 2.1 Infraestrutura (tudo ativo)
```
VPS: extensionista.site → 187.77.46.37 | Hostinger | 7.8GB RAM | 1 vCPU
Traefik: port 80/443 (entrypoints: http/https — NÃO web/websecure)
certresolver: letsencrypt | rede Docker: coolify

Serviços:
  kreativ_postgres:5432   → PostgreSQL 15 + pgvector 0.8.x
  kreativ_redis:6379      → Redis (usado pelo AI Router V3 para histórico)
  n8n                     → https://n8n.extensionista.site
  evolution_api (8081)    → https://evolution.extensionista.site
  typebot_builder         → https://typebot.extensionista.site
  typebot_viewer          → https://bot.extensionista.site
  chatwoot                → https://suporte.extensionista.site
  minio                   → https://files.extensionista.site
  tooljet                 → https://admin.extensionista.site
  metabase                → https://dash.extensionista.site
  portal (Next.js)        → https://portal.extensionista.site
  postfix                 → kreativ_postfix:25 (SMTP interno)
```

### 2.2 Fluxo WhatsApp → Resposta (atual)
```
Mensagem WhatsApp do aluno
    ↓
Evolution API v2.2.3 (instância: europs)
    ↓ integration com Typebot (triggerType: all)
Typebot Viewer (bot ID: vnp6x9bqwrx54b2pct5dhqlb)
    ↓ Webhook server-side (type: "Webhook" capital W — CRÍTICO)
N8N: POST /webhook/kreativ-unified-api (ULTIMATE — SoB5evP9aOmj6hLA)
    ↓ Switch por action
    ├── check_student → PostgreSQL students + enrollment_progress
    ├── get_module → PostgreSQL modules + DeepSeek (gera quiz)
    ├── get_progress → PostgreSQL enrollment_progress
    ├── submit_quiz → PostgreSQL + DeepSeek (avalia) — INCOMPLETO (ver Fase 2)
    ├── ai_tutor → executeWorkflow(5caL67H387euTxan) → DeepSeek + Redis history
    ├── request_human → Chatwoot (cria contato + conversa + label)
    ├── emit_certificate → PostgreSQL certificates + MinIO (URL)
    ├── rag_ingest → MinIO PDF → pgvector document_chunks
    ├── admin_upsert_student → gestão admin
    ├── admin_reset_student → gestão admin
    ├── admin_upsert_course → gestão admin
    └── admin_upsert_module → gestão admin
    ↓
Responder Typebot (respondToWebhook) → Typebot → Evolution → WhatsApp
```

### 2.3 Banco de Dados (kreativ_edu)

**Tabelas principais e estado:**
```sql
-- Aluno teste (único aluno no sistema até agora)
-- phone: 556399374165 | portal_token: 193e1ef6-02de-4866-b838-3f277453ac00
-- SEM nome cadastrado, SEM enrollment_progress registrado

-- Módulos disponíveis (via JOIN modules + courses)
-- Ver: SELECT m.title, m.module_number, c.title FROM modules m JOIN courses c ON m.course_int_id = c.id;
-- course_int_id é INTEGER FK para courses.id — SEMPRE usar este (course_id é VARCHAR, não usar para joins)

-- document_chunks: 23 registros
--   - 2 com source_file (modulo1, modulo2) sem embedding (NULL)
--   - ~21 com module_id = 7cc193b4 (módulo IA) com embedding preenchido
--   - Conteúdo: HTML de módulo IA para pequenos negócios
--   Estrutura: id(uuid), module_id(uuid), source_file(varchar), chunk_index(int),
--              content(text), embedding(vector), metadata(jsonb), created_at

-- enrollment_progress: colunas = id, student_id, course_id(int), module_number,
--                                 status, score, ai_feedback, completed_at
-- quiz_results: NÃO EXISTE — o Quiz: Atualizar Progresso usa enrollment_progress.score
--   Para submit_quiz funcionar: salvar em enrollment_progress (student_id + course_id + module_number)
```

**Regras de ouro do banco:**
- `modules.course_int_id` é INTEGER FK → courses.id — SEMPRE usar este
- `modules.course_id` é VARCHAR(100) — NÃO usar para joins
- `certificates.course_id` é VARCHAR(100) — JOIN: `c.id::text = cert.course_id`
- Hostname: `kreativ_postgres` (NÃO `postgres` — resolve IPv6 e falha silenciosamente)
- Banco separado: `typebot_db` no mesmo container PostgreSQL

### 2.4 Nós do ULTIMATE (60-kreativ-api-ultimate.json)
```
[webhook]          Webhook API           → path: kreativ-unified-api
[code]             Normalizar Input      → valida phone+action, normaliza formato
[switch]           Roteador de Ações     → 12 cases (check_student...admin_upsert_module)
[postgres]         Check: Buscar Aluno
[code]             Check: Formatar Resposta
[postgres]         Human: Atualizar DB
[httpRequest]      Human: Pausar Typebot → PUT /typebot/changeStatus/europs
[code]             Human: Finalizar
[postgres]         Module: Buscar Dados
[code]             Module: Prompt AI Quiz
[httpRequest]      Module: DeepSeek Generate Quiz  → timeout 120s ✅
[code]             Module: Finalizar Dados
[postgres]         Progress: Buscar DB
[code]             Progress: Calcular    → detecta not-found por !row.phone
[executeWorkflow]  AI Tutor: Proxy Request → chama 5caL67H387euTxan (sub-workflow)
[httpRequest]      RAG: Download PDF
[extractFromFile]  RAG: Extrair Texto
[httpRequest]      RAG: Ingerir no DB
[code]             Finalizar Ação
[respondToWebhook] Responder Typebot
[postgres]         Quiz: Buscar Contexto
[code]             Quiz: Prompt Avaliar
[httpRequest]      Quiz: DeepSeek Avaliar  → timeout 120s ✅
[code]             Quiz: Processar Resultado
[postgres]         Quiz: Atualizar Progresso → salva em enrollment_progress
[postgres]         Cert: Inserir DB
[code]             Cert: Formatar URL
[httpRequest]      Human: CW Search Contact → Chatwoot API
[if]               Human: IF Contact Exists
[httpRequest]      Human: CW Create Contact
[code]             Human: CW Merge Contact
[httpRequest]      Human: CW Check Conv
[if]               Human: IF Conv Exists
[httpRequest]      Human: CW Create Conv
[code]             Human: CW Merge Conv
[httpRequest]      Human: CW Send Msg
[httpRequest]      Human: CW Set Label
[respondToWebhook] Human: Respond Success
[postgres]         Admin: Upsert Student
[postgres]         Admin: Reset Student
[postgres]         Admin: Upsert Course
[postgres]         Admin: Upsert Module
[respondToWebhook] Responder Erro Validacao  → HTTP 400 para payloads inválidos
```

---

## 3. PRÓXIMAS FASES — ROADMAP DETALHADO

---

### FASE 2 — Segurança Arquitetural (PRÓXIMA SESSÃO)

#### 2.1 SQL em Transações (CONCLUÍDO)
**Onde corrigido:** No ULTIMATE, nós PostgreSQL das ações:
- `Quiz: Atualizar Progresso` — Adicionado BEGIN/COMMIT
- `Admin: Reset Student` — Adicionado BEGIN/COMMIT

#### 2.2 Authorization nos Webhooks ToolJet → N8N (CONCLUÍDO)
**Como corrigido:**
1. No ULTIMATE, no nó `Normalizar Input`, adicionada validação de `Authorization: Bearer <ADMIN_WEBHOOK_SECRET>`.

#### 2.3 Rate Limiting na Entrada (CONCLUÍDO)
**Solução:** Implementado via nó `Redis Rate Limit` (Code node) usando protocolo RESP direto. Max 5 chamadas/10s por telefone. Retorna 429 via `Responder Erro Validacao`.


---

### FASE 3B — Completar submit_quiz com Avaliação Real

**Estado atual:** O `Quiz: DeepSeek Avaliar` existe no ULTIMATE mas precisa verificar se o fluxo completo funciona end-to-end.

**Fluxo esperado do submit_quiz:**
```
Payload: { phone, action: "submit_quiz", answers: ["r1","r2","r3"], module_id }
    ↓
Quiz: Buscar Contexto  → SELECT content FROM document_chunks WHERE module_id = $1
    ↓
Quiz: Prompt Avaliar   → Code node: monta prompt para DeepSeek
    ↓
Quiz: DeepSeek Avaliar → POST api.deepseek.com (timeout 120s ✅)
    ↓
Quiz: Processar Resultado → Code node: extrai score + feedback da resposta DeepSeek
    ↓
Quiz: Atualizar Progresso → INSERT/UPDATE enrollment_progress
    ↓
Responder Typebot → { passed: bool, score: int, feedback: string, next_module: int }
```

**Verificar no ULTIMATE:**
1. O payload que chega em `Quiz: Buscar Contexto` — tem o module_id correto?
2. O prompt em `Quiz: Prompt Avaliar` — está bem estruturado para avaliação discursiva?
3. O parser em `Quiz: Processar Resultado` — extrai score como número (0-100)?
4. O UPDATE em `Quiz: Atualizar Progresso` — usa o ON CONFLICT correto?

**Testar com curl:**
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "phone": "556399374165",
    "action": "submit_quiz",
    "module_id": "<uuid do módulo>",
    "answers": [
      "A documentação rural é importante para formalizar a propriedade",
      "O CAR é o Cadastro Ambiental Rural",
      "O contrato de arrendamento deve ser registrado em cartório"
    ]
  }' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool
```

**Obter module_id:**
```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "SELECT id, title, module_number FROM modules ORDER BY module_number;"
```

---

### FASE 3C — RAG Funcional no ai_tutor

**Estado atual dos document_chunks:**
- 23 registros no total
- 2 com `source_file` preenchido MAS `embedding = NULL` (modulo1, modulo2)
- ~21 com `module_id = 7cc193b4-21f6-4e75-95f7-ef67a3651dc0` COM embedding (módulo IA)
- O AI Tutor atual **não usa** os document_chunks — responde puramente com contexto do aluno + histórico Redis

**Para ativar RAG:**

**Passo 1 — Popular embeddings dos módulos principais:**
```bash
# Ver conteúdo dos módulos
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT m.id, m.title, m.content FROM modules m ORDER BY m.module_number;"
```

**Passo 2 — Criar script de ingestão de embeddings (scripts/ingest_embeddings.py):**
```python
# Para cada módulo: dividir conteúdo em chunks de ~500 tokens
# Chamar POST /embeddings via DeepSeek ou OpenRouter
# Salvar em document_chunks com module_id + embedding vetorial
# Exemplo:
#   curl POST https://api.deepseek.com/v1/embeddings
#   { "model": "deepseek-embedding", "input": "chunk text" }
#   → embedding: [0.023, -0.041, ...]  (dimensão: verificar)
```

**Passo 3 — Modificar o sub-workflow `5caL67H387euTxan` (AI Router V3) para busca vetorial:**
No nó antes do DeepSeek, adicionar busca semântica:
```sql
SELECT content, metadata,
       1 - (embedding <=> $1::vector) as similarity
FROM document_chunks
WHERE module_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 3;
```

**Passo 4 — Injetar chunks relevantes no prompt do DeepSeek como contexto.**

**Verificar dimensão do embedding:**
```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT array_length(embedding::float[], 1) FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1;"
```

---

### FASE 4 — Completar emit_certificate

**Estado atual:** O `Cert: Inserir DB` e `Cert: Formatar URL` existem no ULTIMATE.

**Verificar:**
```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='certificates' ORDER BY ordinal_position;"
```

**Fluxo esperado:**
```
emit_certificate payload: { phone, action, module_id } ou { phone, action, course_id }
    ↓
Cert: Inserir DB → INSERT certificates (student_id, course_id, issued_at, certificate_url)
    ↓
Cert: Formatar URL → Code node: gerar URL https://portal.extensionista.site/certificado/<cert_id>
    ↓
Responder Typebot → { certificate_url: string, certificate_id: uuid }
```

**Template HTML do certificado:** `apps/certificate-template/` — verificar se existe.

---

### FASE 5 — Observabilidade

#### 5.1 Dashboard ToolJet (admin.extensionista.site)
KPIs a implementar:
- Alunos ativos (últimos 7 dias)
- Taxa de conclusão por módulo
- Tickets Chatwoot por semana
- Uso do AI Tutor (chamadas/dia)

**Queries SQL para os KPIs:**
```sql
-- Alunos ativos (últimas 24h via chat_hub_sessions ou events_log)
-- Taxa de conclusão
SELECT module_number,
       COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) * 100 as pct_complete
FROM enrollment_progress GROUP BY module_number ORDER BY module_number;
```

#### 5.2 Alertas Críticos (WhatsApp/Telegram)
O `99-global-error-handler.json` já notifica o tutor via WhatsApp quando ocorre erro.
Verificar se a notificação está chegando no número correto (Evolution instância `europs`).

**Para adicionar Telegram como backup:**
```javascript
// No 99-global-error-handler, adicionar nó HTTP Request para Telegram Bot API
POST https://api.telegram.org/bot<BOT_TOKEN>/sendMessage
{ "chat_id": "<ADMIN_CHAT_ID>", "text": "🚨 Erro Kreativ: <error_message>" }
```

#### 5.3 Uptime Monitoring
Adicionar Uptime Kuma como container extra no docker-compose.yml:
```yaml
uptime-kuma:
  image: louislam/uptime-kuma:1
  container_name: kreativ_uptime
  volumes:
    - ./data/uptime-kuma:/app/data
  labels:
    - traefik.enable=true
    - traefik.http.routers.uptime.rule=Host(`uptime.extensionista.site`)
    - traefik.http.routers.uptime.entrypoints=https
    - traefik.http.routers.uptime.tls.certresolver=letsencrypt
  networks:
    - coolify
```

---

## 4. COMANDOS DE DIAGNÓSTICO RÁPIDO

```bash
# === VERIFICAÇÕES DE SAÚDE ===

# 1. Todos os containers rodando?
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep kreativ

# 2. Workflows N8N ativos?
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows?limit=100" | \
  python3 -c "import json,sys; wfs=json.load(sys.stdin); [print(f'✅ {w[\"name\"]}') for w in wfs['data'] if w['active']]"

# 3. Smoke test Unified API
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"check_student"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool | head -10

# 4. AI Tutor funcionando?
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"ai_tutor","message":"Olá, qual é o próximo módulo?"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" --max-time 30 | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print('OK:', r.get('ok')); print(str(r.get('response',''))[:100])"

# 5. PostgreSQL acessível?
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "SELECT COUNT(*) FROM students;"

# 6. DeepSeek API respondendo?
export DEEPSEEK_API_KEY=$(grep '^DEEPSEEK_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -X POST -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" --max-time 15 \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Pong"}],"max_tokens":5}' \
  "https://api.deepseek.com/v1/chat/completions" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"

# 7. Payload inválido retorna 400?
curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
# Expected: 400

# 8. Estado do banco
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT 'students' as tbl, COUNT(*) FROM students UNION ALL
SELECT 'modules', COUNT(*) FROM modules UNION ALL
SELECT 'courses', COUNT(*) FROM courses UNION ALL
SELECT 'document_chunks', COUNT(*) FROM document_chunks UNION ALL
SELECT 'enrollment_progress', COUNT(*) FROM enrollment_progress UNION ALL
SELECT 'certificates', COUNT(*) FROM certificates;"
```

---

## 5. REGRAS DE OURO (NÃO ESQUECER)

### Typebot v6
- `"Webhook"` (capital W) = server-side HTTP → usa ESTE. `"webhook"` (minúsculo) = ignorado pela Evolution v2.2.3
- API PATCH rejeita capital-W → usar `scripts/build_typebot.py` (DB injection direta)
- `bodyPath` usa prefixo `data.`: ex `"data.status"` (Typebot wraps como `{data: <body>}`)
- `responseVariableMapping` usa `variableId` + `bodyPath` (não variableName)
- Bot ID: `vnp6x9bqwrx54b2pct5dhqlb` | PublicTypebot: `cmlvjfr7v000ipc1giknwf999`
- API Key Typebot: `LqkFiNhRjg1p2W3nNkgLpxPM` | Workspace: `cmlv5a2o50000p31fikol0jg5`

### N8N
- Webhook path ativo: `kreativ-unified-api` → sempre usar ULTIMATE (`SoB5evP9aOmj6hLA`)
- Exportar workflow depois de modificar UI: `curl -H "X-N8N-API-KEY: $KEY" .../workflows/<ID> | python3 -m json.tool > n8n-workflows/<file>.json`
- PUT do workflow via API: aceita apenas `name, nodes, connections, settings, staticData`
- Existem ~65 workflows inativos/deprecated — não ativar sem investigar
- Boolean logic IF nodes v2+: usar operator `number larger 0` explicitamente (não `> 0` em expression)
- Bot Resumption: workflow `y92mEtPP4nK1p037` → `POST /typebot/changeStatus/europs` (status: "opened")

### Evolution API
- Instância: `europs` | API Key: `.env → EVOLUTION_API_KEY`
- Endpoint para retomar sessão: `PUT /typebot/changeStatus/europs` body `{"status":"opened"}`
- Formato remoteJid: `556399374165@s.whatsapp.net`
- Para enviar mensagem direta (fallback): `POST /message/sendText/europs`

### PostgreSQL
- Hostname correto: `kreativ_postgres` (não `postgres`)
- `modules.course_int_id` é o FK correto para JOIN com courses
- `quiz_results` table NÃO EXISTE — usar `enrollment_progress` para score/status
- typebot_db é banco separado no mesmo container

---

## 6. ARQUIVOS CHAVE DO REPOSITÓRIO

```
/root/ideias_app/
├── docker-compose.yml              ← stack completa
├── .env                            ← credenciais (não commitado)
├── PROJETO_STATUS.md               ← estado do projeto (pode estar desatualizado vs este doc)
├── ROADMAP.md                      ← roadmap de alto nível
│
├── init-scripts/
│   ├── 01-init-dbs.sql             ← schema principal (CREATE TABLE)
│   ├── 02-migration-courses.sql
│   └── migration_generative_evaluation.sql
│
├── scripts/
│   ├── build_typebot.py            ← CRÍTICO: reconstrói bot via DB injection
│   ├── validate_typebot_json.py    ← valida JSON do Typebot antes de injetar
│   ├── test_deepseek.js            ← testa conectividade DeepSeek diretamente
│   └── *.sql                       ← migrations e seeds
│
├── n8n-workflows/                  ← 26 arquivos, todos exports reais de produção
│   ├── 60-kreativ-api-ultimate.json    ← PRINCIPAL (SoB5evP9aOmj6hLA)
│   ├── 10-whatsapp-router-active.json  ← router WhatsApp (a0RywHWeY5kfgzGT)
│   ├── 20-ai-router-v3-redis-rag.json  ← sub-workflow AI (5caL67H387euTxan)
│   ├── 10-chatwoot-retomar-bot.json    ← retoma bot (y92mEtPP4nK1p037)
│   └── 99-global-error-handler.json   ← error handler (mFwiM2dZyKeEgKk6)
│
├── apps/
│   ├── portal/                     ← Next.js portal do aluno
│   ├── web/
│   ├── builderbot/                 ← BuilderBot (NÃO no fluxo ativo — substituído pelo Typebot)
│   └── certificate-template/       ← template PDF de certificado
│
└── docs/
    ├── plans/
    │   ├── 2026-02-22-repo-cleanup-design.md   ← design da limpeza
    │   ├── 2026-02-22-cleanup-and-fase1.md     ← plano detalhado fase 1
    │   └── 2026-02-22-handover-roadmap.md      ← ESTE ARQUIVO
    ├── GUIA_WHATSAPP_CLOUD_API.md
    └── TOOLJET_DASHBOARD_BLUEPRINT.md
```

---

## 7. PRÓXIMA SESSÃO — SEQUÊNCIA RECOMENDADA

**ATENÇÃO**: Fase 2 (SQL transactions, auth, rate limiting) está marcada como CONCLUÍDO no doc
mas NÃO foi verificada nesta sessão — pode ser que o Gemini tenha aplicado apenas no skeleton
que foi descartado. Verificar se esses nós existem no ULTIMATE atual antes de assumir que estão OK.

```
1. Ler este doc (30s)
2. Rodar smoke test (comandos da seção 4) — confirmar tudo verde
3. git log --oneline -5
4. VERIFICAR Fase 2: existe nó 'Redis Rate Limit' no ULTIMATE? Existe validação auth no Normalizar Input?
5. Testar submit_quiz end-to-end (Fase 3B)
6. Popular embeddings dos módulos principais via scripts/ingest_embeddings.py (Fase 3C)
7. Atualizar este doc ao finalizar cada fase
```

**Checklist de início de sessão:**
- [ ] `docker ps | grep kreativ` — todos up?
- [ ] Smoke test check_student retorna dados do aluno?
- [ ] AI Tutor responde em < 30s?
- [ ] Payload inválido retorna 400?
- [ ] `git status` — repo limpo?
- [ ] **NOVO**: Verificar se Fase 2 foi realmente aplicada (Rate Limit, Auth, SQL transactions)

---

## 8. HISTÓRICO DE COMMITS DESTA SESSÃO

```
4257a9d chore(n8n-workflows): remover 01-whatsapp-router-v2.json stale
79ef2d4 fix(n8n): ajustar timeouts DeepSeek + suporte list_reply no WhatsApp Router
46becfd feat(n8n): validacao de payload obrigatorio + continueOnFail no Unified API ULTIMATE
6aabfbe chore(n8n-workflows): remover arquivos sobrescritos pelos exports reais de produção
687c5b3 feat(n8n): ativar Error Handler e vincular como errorWorkflow nos workflows principais
6d1a804 chore: limpar scripts/ descartáveis e reforçar .gitignore
ba36b1c chore(n8n-workflows): remover ~35 workflows duplicados/teste/ad-hoc
20b5da9 chore: limpeza radical do repositório — remover ~150 arquivos temporários
9c4ae96 docs: add implementation plan — repo cleanup + Fase 1 stabilization
a7e5473 docs: add repo cleanup design doc with 4-phase roadmap
```
