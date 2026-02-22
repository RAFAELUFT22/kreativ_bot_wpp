# Kreativ Educação — Status do Projeto
> Documento atualizado a cada commit. Referência principal para continuidade de qualquer agente IA.

---

## 🗓️ Última Atualização
**Data:** 2026-02-22 (v0.3.6)
**Versão:** v0.3 — Gestão de Alunos Admin & Estabilidade AI
**Repo:** https://github.com/RAFAELUFT212/kreativ_bot_v2.git
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

### 🛠️ Gestão de Alunos (Admin) — v0.3.6
- **Painel ToolJet**: Blueprint criado para gestão manual de alunos via `admin.extensionista.site`.
- **API Administrativa**: Novas ações `admin_upsert_student` e `admin_reset_student` implementadas no n8n.
- **Resumo**: Equipe interna agora pode matricular, editar e resetar progresso de alunos sem acesso direto ao DB.

### AI Tutor Sync (v3)
- O Tutor agora responde de forma **síncrona** ao Typebot.
- Fluxo: Typebot → Router → AI Tutor Workflow → Respond to Webhook → Router → Typebot.
- Isso elimina o loop de "aguarde" no WhatsApp e garante que a resposta do chat real apareça no balão do Typebot.

### Bot Typebot (ID: vnp6x9bqwrx54b2pct5dhqlb)
- **Slug:** kreativ-educacao
- **Viewer URL:** https://bot.extensionista.site/kreativ-educacao
- **11 grupos:** Start → Catraca → Menu → Módulo → Quiz → Quiz-Fail → Progresso → Tutor Humano → AI Tutor → Certificado → Modo Humano
- **Variáveis pré-preenchidas pelo Evolution:** `remoteJid`, `pushName`, `instanceName`, `serverUrl`

### N8N — Unified API (Workflow ID: tOGGjrzk3ZImsK81)
- **Webhook path:** `kreativ-unified-api`
- **Actions suportados:** `check_student`, `get_module`, `submit_quiz`, `get_progress`, `request_human`, `ai_tutor`, `emit_certificate`
- **Arquivo:** `n8n-workflows/60-kreativ-api.json`

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

### Arquivos DEPRECATED (não usar, manter apenas para referência)
- `n8n-workflows/ADMIN-*.json` — versões antigas do router
- `n8n-workflows/fixed_router*.json` — tentativas de debug
- `n8n-workflows/temp_update.json` — temporário
- `scripts/*.js` — scripts de teste/debug das sessões anteriores
- `*.sql` (raiz) — SQLs de fix aplicados, não necessários mais

---

## 🔑 Credenciais Importantes (resumo — detalhes no .env)

| Serviço | Credencial | Valor |
|---------|-----------|-------|
| Typebot API Key | `LqkFiNhRjg1p2W3nNkgLpxPM` | Para scripts |
| Typebot Bot ID | `vnp6x9bqwrx54b2pct5dhqlb` | Bot principal |
| Typebot Pub ID | `cmlvjfr7v000ipc1giknwf999` | PublicTypebot |
| N8N Workflow ID | `tOGGjrzk3ZImsK81` | Unified API |
| Evolution Instance | `europs` | WhatsApp instance |
| Chatwoot Account | `2` | Account ID |
| Chatwoot Inbox | `1` | WhatsApp inbox |
| DB Student Test | `556399374165` | Rafael Luciano |

---

## 🛣️ Roadmap de Próximas Etapas

### Fase 3A — Corrigir UX WhatsApp (Imediato, verificar se ja nao fez)
- [ ] **TAREFA 1:** Substituir Choice Input blocks no Typebot por blocos de texto com sintaxe `[buttons]` para Evolution API — max 3 botões por mensagem
- [ ] **TAREFA 2:** Para menu principal (4 opções), usar `[list]` ou dividir em 2 mensagens
- [ ] **TAREFA 3:** Reescrever `scripts/build_typebot.py` com `tx()` helper suportando sintaxe de botões
- [ ] **TAREFA 4:** Testar renderização de botões no WhatsApp real

### Fase 3B — Completar N8N Unified API (1-2 dias)
- [ ] **TAREFA 5:** Implementar `submit_quiz` com avaliação real via DeepSeek:
  - 3 perguntas discursivas → prompt para DeepSeek → score + feedback + passed
  - Salvar resultado em tabela `quiz_results`
- [ ] **TAREFA 6:** Corrigir `get_progress` com telefone normalizado
- [ ] **TAREFA 7:** Implementar `ai_tutor` com RAG (busca em `document_chunks`)
- [ ] **TAREFA 8:** Implementar `emit_certificate` com PDF via MinIO

### Fase 3C — Migrar para WhatsApp Cloud API (Opcional, ja usamos a api oficial mas estamos conectados na evolution api)
- [x ] **TAREFA 9:** Criar App Meta Business + número oficial
- [x ] **TAREFA 10:** Criar nova instância Evolution com `integration: WHATSAPP-BUSINESS`
- [x ] **TAREFA 11:** Configurar webhook `POST /webhook/meta` com token permanente
- [ x] **TAREFA 12:** Testar botões interativos nativos do WhatsApp Business API

### Fase 4 — RAG e Conteúdo (Avançado)
- [ ] **TAREFA 13:** Popular `document_chunks` com embeddings dos módulos
- [ ] **TAREFA 14:** Ativar busca semântica no `ai_tutor`
- [ ] **TAREFA 15:** Criar fluxo de ingestão de PDFs via MinIO

### Fase 5 — Produto Final
- [ ] **TAREFA 16:** Onboarding de novos alunos (cadastro via WhatsApp)
- [ ] **TAREFA 17:** Portal do aluno funcional com certificados
- [ ] **TAREFA 18:** Dashboard Metabase com KPIs
- [ ] **TAREFA 19:** Painel admin ToolJet para gestão de cursos
- [ ] **TAREFA 20:** Deploy em número WhatsApp produção (testar mensagens apenas com o numero 556399374156)

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
curl -s -X POST "https://n8n.extensionista.site/webhook/kreativ-unified-api" 
  -H "Content-Type: application/json" 
  -d '{"action":"check_student","phone":"556399374165@s.whatsapp.net"}'
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
