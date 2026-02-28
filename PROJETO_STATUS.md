# Kreativ Educação — Status do Projeto
> Documento atualizado a cada commit. Referência principal para continuidade de qualquer agente IA.

---

## 🗓️ Última Atualização
**Data:** 2026-02-28 (v0.4.2)
**Versão:** v0.4.2 — Smoke test E2E completo + Chatwoot handoff validado
**Repo:** https://github.com/RAFAELUFT22/kreativ_bot_v2.git
**VPS:** extensionista.site (Hostinger, 7.8GB RAM, 1 vCPU, 48GB disco)

---

## ✅ O Que Funciona AGORA

### Stack em Produção (14 containers ativos)
| Serviço | URL | Status |
|---------|-----|--------|
| PostgreSQL + pgvector | interno: `kreativ_postgres:5432` | ✅ Ativo |
| Redis | interno: `kreativ_redis:6379` | ✅ Ativo |
| N8N | https://n8n.extensionista.site | ✅ Ativo |
| Evolution API v2.2.3 | https://evolution.extensionista.site | ✅ Ativo |
| Typebot Builder | https://typebot.extensionista.site | ✅ Ativo |
| Typebot Viewer | https://bot.extensionista.site | ✅ Ativo |
| Chatwoot v3.15 | https://suporte.extensionista.site | ✅ Ativo |
| MinIO | https://files.extensionista.site | ✅ Ativo |
| ToolJet | https://admin.extensionista.site | ✅ Ativo |
| Metabase | https://dash.extensionista.site | ✅ Ativo |
| Portal Next.js | https://portal.extensionista.site | ✅ Ativo |
| Postfix (SMTP) | interno: `kreativ_postfix:25` | ✅ Ativo |

### Fluxo WhatsApp → Bot (Funcionando)
```
WhatsApp do Aluno
    ↓ mensagem
Evolution API v2.2.3 (instância: europs — integração: WHATSAPP-BUSINESS / Cloud API)
    ↓ triggerType: "all" → Typebot
Typebot "Kreativ Educacao" (kreativ-educacao)
    ↓ Webhook blocks server-side (type: "Webhook" capital W)
N8N Unified API (kreativ-unified-api)
    ↓ action routing
PostgreSQL kreativ_edu
    ↓ resposta JSON
Typebot → mensagens de texto → Evolution API → WhatsApp
```

### 🚀 N8N Async — v0.4.0 (2026-02-22)
Os 3 paths de IA do ULTIMATE foram modernizados para resposta assíncrona via `respondToWebhook` + Evolution direct send:

| Action | Latência antes | Latência depois | Padrão |
|---|---|---|---|
| `ai_tutor` | 5-30s (bloqueava Typebot) | **0.53s** ✅ | respondToWebhook → DeepSeek inline → Evolution |
| `submit_quiz` | 5-30s (bloqueava Typebot) | **0.49s** ✅ | respondToWebhook → DeepSeek → PostgreSQL → Evolution |
| `get_module` | 5-15s (bloqueava Typebot) | **0.37s** ✅ | PostgreSQL → respondToWebhook(title+content) → DeepSeek → Evolution |

Aluno recebe resposta imediata do bot ("Analisando...") e depois recebe a resposta da IA diretamente no WhatsApp.

### 🛠️ Gestão de Alunos (Admin) — v0.3.6
- **Painel ToolJet**: Design e plano de implementação criados. App "Kreativ Admin" (3 abas: Conteúdo, Alunos, Admin) pronto para configuração.
- **API Administrativa**: Ações `admin_upsert_student` e `admin_reset_student` implementadas no N8N.
- **Metabase**: Design de dashboard "Kreativ — Visão Operacional" (5 cards KPI) criado. Aguardando implementação.

### AI Tutor RAG (v3)
- Busca semântica ativa via `document_chunks` + pgvector.
- Contexto do módulo + top 5 chunks injetados no prompt do DeepSeek.
- `scripts/ingest_embeddings.py` disponível para popular novos conteúdos.

### Bot Typebot (ID: vnp6x9bqwrx54b2pct5dhqlb)
- **Slug:** kreativ-educacao
- **Viewer URL:** https://bot.extensionista.site/kreativ-educacao
- **11 grupos:** Start → Catraca → Menu → Módulo → Quiz → Quiz-Fail → Progresso → Tutor Humano → AI Tutor → Certificado → Modo Humano
- **Variáveis pré-preenchidas pelo Evolution:** `remoteJid`, `pushName`, `instanceName`, `serverUrl`

### N8N — Unified API ULTIMATE (Workflow ID: SoB5evP9aOmj6hLA)
- **Webhook path:** `kreativ-unified-api`
- **Actions suportados:** `check_student`, `get_module`, `submit_quiz`, `get_progress`, `request_human`, `ai_tutor`, `emit_certificate`, `admin_upsert_student`, `admin_reset_student`, `admin_upsert_course`, `admin_upsert_module`
- **Arquivo:** `n8n-workflows/60-kreativ-api-ultimate.json`
- **Status:** Ativo com 3 paths async (ai_tutor, submit_quiz, get_module). Smoke test E2E concluído em 2026-02-28.

### Banco de Dados (kreativ_edu)
| Tabela | Registros |
|--------|-----------|
| courses | 21 |
| modules | 11 |
| students | 5 |
| pre_inscriptions | 508 |

---

## ⚠️ Problemas Conhecidos / Próximas Correções

### ✅ RESOLVIDO — Botões interativos WhatsApp (Fase 3A)
**Solução aplicada:** `scripts/build_typebot.py` gera blocos de texto com sintaxe `[buttons]` no lugar de Choice Input.
Evolution API detecta a tag `[buttons]` e envia como mensagem interativa da **Meta Cloud API** (integração: WHATSAPP-BUSINESS).
Quando o aluno toca um botão, `interactive.button_reply.title` é capturado pelo Typebot como variável `conversation`.
Condições `Contains` no Typebot roteiam pelo título: "Meu Módulo", "Progresso", "Suporte", etc.

### ✅ RESOLVIDO — Integração Cloud API Meta
A instância `europs` da Evolution API v2.2.3 está configurada com `integration: "WHATSAPP-BUSINESS"` (Cloud API Meta), **não Baileys**.
Referência de setup: `scripts/create_instance_meta.sh` e `docs/GUIA_WHATSAPP_CLOUD_API.md`.

---

## 📁 Arquivos Críticos do Projeto

### Configuração
| Arquivo | Propósito |
|---------|-----------|
| `.env` | Todas as credenciais (não commitado) |
| `docker-compose.yml` | Stack completa (14 serviços) |
| `init-scripts/01-init-dbs.sql` | Schema original PostgreSQL |
| `init-scripts/02-migration-courses.sql` | Migration courses aplicada |
| `init-scripts/05-migration-handoff-chatwoot.sql` | handoff_control + training_memory |
| `docs/GUIA_WHATSAPP_CLOUD_API.md` | **NOVO** — Guia oficial Meta Cloud API (2025/26) |

### Scripts Ativos (usar estes, não os deprecados)
| Script | Propósito |
|--------|-----------|
| `scripts/build_typebot.py` | **PRINCIPAL** — reconstrói e publica o bot Typebot via DB injection |
| `scripts/02-seed-modules-tds.sql` | Seed de módulos TDS |
| `scripts/05-seed-content-ia.sql` | Seed de conteúdo IA |

### N8N Workflows Ativos (estes são os que importar)
| Arquivo | ID N8N | Propósito |
|---------|--------|-----------|
| `n8n-workflows/60-kreativ-api.json` | tOGGjrzk3ZImsK81 | **Unified API** (inclui Handoff Humano funcional) |
| `n8n-workflows/06-enroll-student.json` | krpsi0uW7fMhxj5T | Cadastrar aluno |
| `n8n-workflows/y92mEtPP4nK1p037` | y92mEtPP4nK1p037 | **Retomar Bot & Treinamento** (Chatwoot Webhook) |
| `n8n-workflows/12-emit-certificate.json` | — | Emitir certificado |
| `n8n-workflows/05-update-chatwoot-label.json` | 9SQfSnUNWOc3SKFT | Labels Chatwoot |
| `n8n-workflows/07-dashboard.json` | QVrgXdevaAwnykPn | Dashboard HTML |
| `n8n-workflows/08-inatividade.json` | FDkc4gh7kp6hKZ3E | Lembrete inatividade |
| `n8n-workflows/09-relatorio-semanal.json` | HCnfOkbtviheBGBk | Relatório semanal |

### N8N Workflows Ativos (v0.4.2 — 2026-02-28)
| Arquivo | ID N8N | Status | Propósito |
|---------|--------|--------|-----------|
| `n8n-workflows/60-kreativ-api-ultimate.json` | `SoB5evP9aOmj6hLA` | **ACTIVE** | Unified API ULTIMATE (10 actions, async, ai_tutor inline) |
| `n8n-workflows/10-chatwoot-retomar-bot.json` | `y92mEtPP4nK1p037` | **ACTIVE** | Chatwoot → Retomar Bot & Treinamento |
| `n8n-workflows/99-global-error-handler.json` | `mFwiM2dZyKeEgKk6` | **ACTIVE** | Global Error Handler |

Workflows LEGADO (inativos, não necessários):
| Arquivo | ID N8N | Nota |
|---------|--------|------|
| `10-whatsapp-router-active.json` | `a0RywHWeY5kfgzGT` | Substituído pelo ULTIMATE |
| `20-ai-router-v3-redis-rag.json` | `5caL67H387euTxan` | ai_tutor agora inline no ULTIMATE |

### Arquivos DEPRECATED (não usar, manter apenas para referência)
- Qualquer `n8n-workflows/` não listado acima
- `scripts/*.js` — scripts de teste/debug das sessões anteriores
- `*.sql` (raiz) — SQLs de fix já aplicados

---

## 🔑 Credenciais Importantes (resumo — detalhes no .env)

| Serviço | Credencial | Valor |
|---------|-----------|-------|
| Typebot API Key | `LqkFiNhRjg1p2W3nNkgLpxPM` | Para scripts |
| Typebot Bot ID | `vnp6x9bqwrx54b2pct5dhqlb` | Bot principal |
| Typebot Pub ID | `cmlvjfr7v000ipc1giknwf999` | PublicTypebot |
| N8N Workflow ID ULTIMATE | `SoB5evP9aOmj6hLA` | Unified API (atual) |
| Evolution Instance | `europs` | WhatsApp instance |
| Chatwoot Account | `2` | Account ID |
| Chatwoot Inbox | `1` | WhatsApp inbox |
| DB Student Test | `556399374165` | Rafael Luciano |

---

## 🛣️ Roadmap de Próximas Etapas

### ✅ CONCLUÍDO — Smoke Test E2E (2026-02-28)
Migration `init-scripts/05-migration-handoff-chatwoot.sql` criada e aplicada:
- `handoff_control` — rastreia estado bot/human por telefone (referenciada em 3 workflows)
- `training_memory` — pares Q&A capturados de tutores humanos no Chatwoot

Smoke test via webhook N8N (todas as actions testadas com sucesso):
| Action | Status | Latência | Resultado |
|--------|--------|----------|-----------|
| `check_student` | 200 | 0.6s | Aluno encontrado, dados corretos |
| `get_module` | 200 | 5.3s | Módulo retornado + quiz async gerado |
| `get_progress` | 200 | 0.5s | Progresso retornado corretamente |
| `ai_tutor` | 200 | 4.4-5.5s (async) | DeepSeek respondeu + WhatsApp enviado via Evolution |
| `request_human` | 200 | ~1s | handoff_control=human, sessão criada, Chatwoot notificado |

Bugs encontrados (não-blockers):
- `request_human`: campo `reason` salvo como `undefined` no support_sessions (bug de passagem de dados no N8N)
- Task runner N8N intermitentemente instável (se recupera sozinho)

### Pendentes IMEDIATOS
- [ ] **Task 6:** Atualizar `scripts/build_typebot.py` — remover `responseVariableMapping` do `ai_tutor` e simplificar `submit_quiz` + `get_module`

### Fase 4A — ToolJet + Metabase (Próxima sessão)
Plano detalhado: `docs/plans/2026-02-22-tooljet-metabase-impl.md`
- [ ] **TAREFA 1:** Migration SQL `ai_usage_log` (1 comando docker exec)
- [ ] **TAREFA 2-5:** Metabase: 5 cards KPI no dashboard "Kreativ — Visão Operacional"
- [ ] **TAREFA 6-11:** ToolJet: App "Kreativ Admin" (3 abas, 7 queries, RBAC grupos)
- [ ] **TAREFA 12:** N8N: nó "AI Tutor: Log Usage" no ULTIMATE (após Task 6 acima)
- [ ] **TAREFA 13:** Smoke tests end-to-end

### Fase 4B — RAG: Ingestão de Conteúdo
- [ ] Executar `scripts/ingest_embeddings.py` para popular `document_chunks` (tabela existe, `ai_tutor` já faz busca vetorial)

### Fase 4C — Dívida Técnica N8N (Baixa prioridade)
- [ ] Migrar `ai_tutor` para AI Agent nativo + Window Buffer Memory (plano: `docs/plans/2026-02-22-n8n-async-redesign.md`) — melhoria de UX, não blocker

### Fase 5 — Produto Final
- [ ] Onboarding de novos alunos (cadastro via WhatsApp)
- [ ] Portal do aluno funcional com certificados PDF
- [ ] Deploy em número WhatsApp produção

---

## 🔧 Como Retomar o Desenvolvimento

### Setup inicial (novo ambiente)
```bash
git clone https://github.com/RAFAELUFT22/kreativ_bot_v2.git
cd kreativ_bot_v2
cp .env.example .env  # editar com credenciais reais
docker compose up -d
```

### Reconstruir o bot Typebot após mudanças
```bash
python3 scripts/build_typebot.py
```

### Testar o fluxo end-to-end
```bash
curl -s -X POST "https://bot.extensionista.site/api/v1/typebots/kreativ-educacao/startChat" 
  -H "Content-Type: application/json" 
  -d '{"prefilledVariables":{"remoteJid":"556399374165@s.whatsapp.net","pushName":"Rafael"}}'
```

### Testar N8N Unified API
```bash
curl -s -X POST "https://n8n.extensionista.site/webhook/kreativ-unified-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"check_student","phone":"556399374165@s.whatsapp.net"}'
```

### Verificar latência async (deve retornar em < 1s)
```bash
time curl -s -X POST "https://n8n.extensionista.site/webhook/kreativ-unified-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"ai_tutor","phone":"556399374165","message":"Olá"}'
```

### Resetar sessões Typebot travadas
```bash
docker exec kreativ_postgres psql -U kreativ_user -d typebot_db -c 
  "DELETE FROM "ChatSession" WHERE state->>'currentBlockId' LIKE 'b_g%';"
```

---

## 🧠 Lições Aprendidas (CRÍTICO — não repetir estes erros)

### Typebot v6 — Regras de Ouro
1. **`"Webhook"` (capital W)** = server-side HTTP request (Typebot chama N8N). USAR ESTE.
2. **`"webhook"` (lowercase)** = client-side listener, retorna `listenForWebhook`. NÃO USAR com Evolution v2.2.3.
3. **API PATCH rejeita `"Webhook"` capital W** → usar `scripts/build_typebot.py` que faz DB injection direta.
4. **Headers em webhook options PRECISAM de `id` field:** `{"id": "h_ct", "key": "...", "value": "..."}`
5. **`bodyPath` usa prefixo `data.`:** `"data.status"` não `"status"` — Typebot envolve a resposta em `{data: ...}`
6. **`responseVariableMapping` usa `variableId` + `bodyPath`** (não `variableName` + `dataPath`)
7. **`remoteJid`** DEVE estar na lista de variáveis do bot para Evolution poder pré-preenchê-la
8. **Evolution pré-preenche via `startChat`:** `remoteJid`, `pushName`, `instanceName`, `serverUrl`, `ownerJid`

### Evolution API v2.2.3 — Regras de Ouro
1. **Não suporta `listenForWebhook`** em `clientSideActions` — ignora silenciosamente
2. **`TYPEBOT_API_VERSION=latest`** → chama `POST /api/v1/typebots/{slug}/startChat`
3. **Para continuar sessão:** `POST /api/v1/sessions/{sessionId}/continueChat`
4. **Formato remoteJid:** `556399374165@s.whatsapp.net` — N8N normaliza com `replace(/\D/g,'')`
5. **Botões interativos:** Suportados via **WhatsApp Cloud API** nativamente. Sintaxe `[buttons]` ou `[list]` no texto é processada pela Evolution e enviada como mensagens interativas oficiais da Meta.

### N8N — Regras de Ouro
1. **Ghost workflows** com `active=true` no DB bloqueiam registro de webhooks — limpar com SQL
2. **`responseMode: responseNode`** mantém conexão aberta até o Responder node disparar
3. **Webhook node com `webhookId` + `isFullPath:true`** gera path simples e estável
4. **Formato de telefone:** aceitar `@s.whatsapp.net` e normalizar com regex

### PostgreSQL — Regras de Ouro
1. **`modules.course_id` é VARCHAR(100)** — NÃO usar para joins
2. **`modules.course_int_id` é INTEGER FK** → courses.id — SEMPRE usar este
3. **Hostname `postgres` resolve para IPv6** na rede kreativ_net — USAR `kreativ_postgres`
4. **typebot_db** é banco separado no mesmo container PostgreSQL

---

## 📊 Arquitetura Resumida

```
WhatsApp (número: +55 63 9937-4165 — teste)
    ↕ Whatsapp Cloud API (Configurado no painel da  Evolution API)
Evolution API v2.2.3
    ↕ Typebot integration (triggerType: all)
Typebot Viewer (https://bot.extensionista.site)
    ↕ Webhook blocks server-side (type: "Webhook" capital W)
N8N Unified API (/webhook/kreativ-unified-api)
    ↕ PostgreSQL kreativ_edu
    ↕ DeepSeek API (quiz evaluation, ai_tutor)
    ↕ Chatwoot (human handoff)
    ↕ MinIO (certificados PDF)

Parallel flows:
Evolution API → Chatwoot (atendimento humano)
N8N crons → inatividade + relatório semanal
Portal Next.js → /aluno/[token] + /certificado/[id]
```
