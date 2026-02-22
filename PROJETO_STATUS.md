# Kreativ Educação — Status do Projeto
> Documento atualizado a cada commit. Referência principal para continuidade de qualquer agente IA.

---

## 🗓️ Última Atualização
**Data:** 2026-02-22 (v0.4.0)
**Versão:** v0.4 — N8N Async + ToolJet/Metabase Planejados
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
Evolution API v2.2.3 (instância: europs)
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
- **Status:** Ativo com 3 paths async (ai_tutor, submit_quiz, get_module). Pending: Task 6 build_typebot.py + Task 7 smoke test final.

### Banco de Dados (kreativ_edu)
| Tabela | Registros |
|--------|-----------|
| courses | 21 |
| modules | 11 |
| students | 5 |
| pre_inscriptions | 508 |

---

## ⚠️ Problemas Conhecidos / Próximas Correções

### PROBLEMA 1 — Menus como texto (PRIORIDADE ALTA)
**Sintoma:** O Typebot envia os menus de escolha (Choice Input) como texto puro com emojis em vez de botões interativos do WhatsApp.
**Causa raiz:** Evolution API v2.2.3 (Baileys/unofficial) não suporta nativamente a renderização de botões interativos do WhatsApp Business API. O WhatsApp permite no máximo **3 botões** por mensagem interativa. O Typebot envia como texto simples.
**Soluções possíveis (em ordem de complexidade):**

#### Opção A — Usar sintaxe especial de botões do Evolution API (RÁPIDO)
A Evolution API v2 suporta botões via sintaxe `[buttons]` no texto:
```
[buttons]
[title]Título aqui[/title]
[description]Descrição[/description]
[reply]displayText: Opção 1, id: opt1[/reply]
[reply]displayText: Opção 2, id: opt2[/reply]
[reply]displayText: Opção 3, id: opt3[/reply]
[/buttons]
```
Configurar um bloco de texto Typebot com essa sintaxe em vez de Choice Input.

#### Opção B — Migrar para Cloud API Meta (CORRETO, MAS TRABALHOSO)
- Criar conta Meta Business + número oficial WhatsApp Business
- Migrar instância Evolution de Baileys → Cloud API (`"integration": "WHATSAPP-BUSINESS"`)
- Com Cloud API: botões interativos, listas (até 10 itens), templates aprovados
- **Requisitos:** META_JWT_TOKEN permanente (System User Token), META_NUMBER_ID, META_BUSINESS_ID
- Arquivo de referência: `scripts/create_instance_meta.sh` (já existente no repo)
- Endpoint webhook Meta: `POST /webhook/meta` com `WA_BUSINESS_TOKEN_WEBHOOK`

#### Opção C — Usar WhatsApp List Messages (MÉDIO)
Para menus maiores (como o menu principal com 4 opções), usar sintaxe `[list]` da Evolution API:
```
[list]
[title]Menu Principal[/title]
[description]O que deseja fazer?[/description]
[buttonText]Selecionar[/buttonText]
[menu]
[section]
title: Opções
[row]title: 📚 Módulo, rowId: mod[/row]
[row]title: 📊 Progresso, rowId: prog[/row]
[/section]
[/menu]
[/list]
```

### PROBLEMA 2 — Escolhas no WhatsApp (Choice Input)
**Sintoma:** Opções de múltipla escolha aparecem como texto com emojis em vez de botões interativos.
**Status:** Pendente correção via sintaxe `[buttons]` ou migração para Cloud API.

---

## 📁 Arquivos Críticos do Projeto

### Configuração
| Arquivo | Propósito |
|---------|-----------|
| `.env` | Todas as credenciais (não commitado) |
| `docker-compose.yml` | Stack completa (14 serviços) |
| `init-scripts/01-init-dbs.sql` | Schema original PostgreSQL |
| `init-scripts/02-migration-courses.sql` | Migration courses aplicada |
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

### N8N Workflows Ativos (CORRETO — v0.4.0)
| Arquivo | ID N8N | Propósito |
|---------|--------|-----------|
| `n8n-workflows/60-kreativ-api-ultimate.json` | `SoB5evP9aOmj6hLA` | **Unified API ULTIMATE** (principal, async) |
| `n8n-workflows/10-whatsapp-router-active.json` | `a0RywHWeY5kfgzGT` | WhatsApp Router |
| `n8n-workflows/20-ai-router-v3-redis-rag.json` | `5caL67H387euTxan` | AI Sub-workflow V3 (RAG) |
| `n8n-workflows/10-chatwoot-retomar-bot.json` | `y92mEtPP4nK1p037` | Chatwoot → Retomar Bot |
| `n8n-workflows/20-ai-tutor-v2-patched.json` | `a0RywHWeY5kfgzGT` | AI Adaptive Router |

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

### Pendentes IMEDIATOS (sessão atual)
- [ ] **Task 6:** Atualizar `scripts/build_typebot.py` — remover `responseVariableMapping` do `ai_tutor` e simplificar `submit_quiz` + `get_module` (plano: `docs/plans/2026-02-22-n8n-async-impl.md`)
- [ ] **Task 7:** Smoke test final + exportar `60-kreativ-api-ultimate.json` + push

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
5. **Botões interativos:** não suportados nativamente — usar sintaxe `[buttons]` ou `[list]` no texto

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
