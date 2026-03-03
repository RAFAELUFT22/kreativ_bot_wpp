# ROADMAP — Kreativ Educação: Próximos Passos de Implementação

> Atualizado em: 03/03/2026 (v2.0 — Migração Frappe LMS Planejada)

---

## Arquitetura v2.0 — Nova Stack Alvo

```
WhatsApp → Evolution API (Cloud API Meta)
               ↓ Webhook direto
              N8N (Conversation Engine)
         ↗ Frappe LMS (cursos, progresso, portal)
        ↗  PostgreSQL + pgvector (RAG, histórico)
       ↗   Redis (sessões de conversa)
      ↗    DeepSeek (AI Tutor, quiz)
     ↗     Chatwoot (suporte humano)
    ↗      MinIO (certificados)
```

**O que muda:** Portal Next.js e Typebot são substituídos pelo **Frappe LMS** e **N8N Conversation Engine**

---

## Fases Concluídas (Legado v0.4.2) ✅

- Fase 1 — Infra Base (PostgreSQL, Redis, MinIO, Evolution)
- Fase 2b — WhatsApp via Evolution API (Cloud API Meta, instância `europs`)
- Fase 3 — Fluxo de boas-vindas + menu WhatsApp (via Typebot)
- Fase 5 — Módulos + Quiz (PostgreSQL)
- Fase 7 — ToolJet Admin Panel
- Fase 8 — Chatwoot Handoff Humano
- Fase 9 — Scoring + Labels Chatwoot
- Fase 10 — Certificados automáticos
- Fase 11 — Metabase Analytics
- Fase 12 — Portal Next.js (legado, será substituído)
- Fase N8N Async — latência < 1s para ai_tutor, submit_quiz, get_module

---

## MIGRAÇÃO v2.0 — Fases Pendentes

---

### FASE M1 — Deploy Frappe LMS ✅ CONCLUÍDO
- **Status:** Disponível em `https://lms.extensionista.site`
- **Arquivos:** `docker-compose.frappe.yml`, `scripts/setup_frappe_lms.sh`, `.env.frappe`
- **Build:** Assets compilados com build-time de 4GB RAM e sincronizados manualmente via volume compartilhado.
- **Admin:** Administrator / sSeWM9kqVaY4IdpTEHcf

**Próximos passos (M1.1) ✅ CONCLUÍDO:**
- [x] Gerar API Key em: LMS → Usuário → API Access
- [x] Atualizar `.env.frappe` (e `.env` raiz) com `FRAPPE_API_KEY` e `FRAPPE_API_SECRET`

---

### FASE M2 — Integração N8N ↔ Frappe LMS (Em Andamento)
- [x] Geração de API Key/Secret para o Administrator via CLI
- [x] Configuração de variáveis de ambiente no `.env` e `.env.frappe`
- [x] Teste de conectividade REST API via Curl
- [x] Instalação do nó da comunidade `n8n-nodes-frappe-lms` no container N8N
- [x] Correção de Carregamento de Nós Comunitários (Variáveis de Ambiente)
- [ ] Conexão do fluxo de conversa Evolution → N8N → Frappe (M2.5)

---

## FASE M3 — Automação & Enriquecimento de Conteúdo (EM ANDAMENTO)
**Objetivo:** Criar um pipeline de "fábrica de cursos" usando Web Scraping e IA.

- [x] Configuração de Idioma (pt-BR) em todo o portal (M3.1)
- [ ] Script de Scraping → JSON (M3.2)
- [ ] Script de Injeção de Dados no Frappe (M3.3)
- [ ] Suporte a Quizzes e Avaliações Dinâmicas (M3.4)

---

### FASE M3 — N8N Conversation Engine (substitui Typebot)

**Arquivos criados:**
- `n8n-workflows/70-wpp-conversation-engine.json` — Workflow completo

**Passos:**
1. [ ] Importar `70-wpp-conversation-engine.json` no N8N
2. [ ] Configurar variáveis de ambiente N8N: `EVOLUTION_API_KEY`, `FRAPPE_LMS_URL`
3. [ ] Testar em ambiente staging (conta WhatsApp de teste)
4. [ ] Após validação: `bash scripts/configure_evolution_direct.sh`
   - ⚠️ Este passo desativa o Typebot
   - Rollback disponível: `bash scripts/rollback_to_typebot.sh`
5. [ ] Monitorar execuções no N8N por 24h

---

### FASE M4 — Guia de Cursos e Migração de Dados

**Arquivos criados:**
- `docs/GUIA_CRIACAO_CURSOS_FRAPPE.md` — Guia completo para professores

**Passos:**
- [ ] Popularizar pelo menos 3 cursos no Frappe LMS via interface
- [ ] Executar: `python3 scripts/migrate_to_frappe_lms.py`
  - Migra 21 cursos, 11 módulos, 5 alunos, 508 pré-inscritos

---

### FASE M5 — Descomissionamento Legado

**Passos (após validação completa da v2.0):**
- [ ] Parar containers `kreativ_typebot_builder` e `kreativ_typebot_viewer`
- [ ] Parar container `kreativ_portal` (Next.js)
- [ ] Redirecionar DNS `portal.extensionista.site` → `lms.extensionista.site`
- [ ] Arquivar scripts `scripts/build_typebot.py` como LEGADO

---

## Fases Pendentes do Legado (manter paralelamente)

### FASE 3B — Quiz DeepSeek (continuar usando no Unified API)
**Status:** Pendente — avaliar se Frappe LMS quiz + DeepSeek resolve o caso

### FASE 4 — RAG (Embeddings)
**Passos:** Executar `scripts/ingest_embeddings.py` após migrar conteúdo para o Frappe LMS
- Usar conteúdo das lições Frappe como fonte dos embeddings

### FASE 6 — Voice Integration
**Passos:** Evolution API → N8N (download áudio) → Whisper (transcrição) → resposta TTS

---

## Resumo de Prioridades

| Prioridade | Fase | Status |
|---|---|---|
| 🔴 CRÍTICO | M1 — Deploy Frappe LMS | Planejado (scripts prontos) |
| 🔴 CRÍTICO | M2 — N8N ↔ Frappe Bridge | Planejado |
| 🟢 CONCLUÍDO | M3 — Automação & Enriquecimento | Fábrica de Cursos Ativada (v4.0) |
| 🟠 ALTA | M4 — Guia Cursos + Migração dados | Guia pronto, script criado |
| 🟡 MÉDIA | M5 — Descomissionar Typebot + Portal | Após M1-M4 validados |
| 🟡 MÉDIA | 4 — RAG Embeddings | Após M4 |
| 🟡 MÉDIA | 6 — Voice Integration | Fase independente |

---

## Estimativa Total

**2-3 semanas** de desenvolvimento progressivo com sistema legado em produção durante a transição.
