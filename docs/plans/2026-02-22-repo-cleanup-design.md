# Design: Limpeza Radical do Repositório Kreativ

**Data:** 2026-02-22
**Abordagem:** B — Limpeza Radical (manter apenas essenciais)
**Estratégia git:** Commit único de limpeza (sem reescrita de histórico)

---

## Motivação

O repositório acumulou ~150 arquivos temporários durante o desenvolvimento iterativo:
arquivos de debug/output, SQL de fix pontual, scripts Python descartáveis, versões
duplicadas de workflows N8N e scripts JS avulsos. Esses arquivos não têm valor
permanente e dificultam a navegação e a colaboração futura.

---

## Estrutura Final (o que FICA)

```
ideias_app/
├── docker-compose.yml
├── .env.example
├── .gitignore                         ← reforçado
├── ROADMAP.md
├── PROJETO_STATUS.md
├── ARCHITECTURE_OVERVIEW.md
├── HANDOVER_NOTES.md
│
├── init-scripts/                      ← schema completo do banco
│   ├── 01-init-dbs.sql
│   ├── 02-migration-courses.sql
│   ├── 02-seed-modules.sql
│   └── migration_generative_evaluation.sql
│
├── scripts/                           ← scripts de desenvolvimento
│   ├── build_typebot.py               ← CRÍTICO: reconstrói bot via DB injection
│   ├── validate_typebot_json.py
│   ├── health_check.sh
│   ├── test_ecosystem.sh
│   ├── 02-seed-modules-tds.sql
│   ├── 03-migration-tds-modules.sql
│   ├── 04-analytics-kpis.sql
│   ├── 05-seed-content-ia.sql
│   ├── 06-migration-student-token.sql
│   └── 07-migration-training-memory.sql
│
├── apps/                              ← código das aplicações (intacto)
│   ├── portal/
│   ├── web/
│   ├── builderbot/
│   ├── evolution/
│   └── certificate-template/
│
├── n8n-workflows/                     ← apenas workflows canônicos
│   ├── 01-whatsapp-router-v2.json
│   ├── 02-get-student-module.json
│   ├── 03-submit-quiz-answer.json
│   ├── 04-request-human-support.json
│   ├── 05-update-chatwoot-label.json
│   ├── 06-enroll-student.json
│   ├── 07-dashboard.json
│   ├── 08-inatividade.json
│   ├── 09-relatorio-semanal.json
│   ├── 10-chatwoot-events.json
│   ├── 11-lead-scoring.json
│   ├── 12-emit-certificate.json
│   ├── 13-mcp-server.json
│   ├── 14-tool-request-tutor.json
│   ├── 15-tool-save-progress.json
│   ├── 16-tool-resume-bot.json
│   ├── 17-tool-emit-certificate.json
│   ├── 18-save-progress-webhook.json
│   ├── 19-resume-bot-webhook.json
│   ├── 20-ai-router-v3-pedagogical.json
│   ├── 21-quiz-handler.json
│   ├── 22-rag-ingestion.json
│   ├── 60-kreativ-api-v1.1.json       ← Unified API ativo em produção
│   └── 99-Global-Error-Handler.json
│
└── docs/
    ├── plans/                         ← este arquivo e futuros design docs
    ├── GUIA_WHATSAPP_CLOUD_API.md
    ├── GUIA_GERADOR_IA.md
    └── TOOLJET_DASHBOARD_BLUEPRINT.md
```

---

## O que SAI

| Categoria | Padrão | Qtd. estimada |
|---|---|---|
| `.txt` debug/output | `deploy_output_*.txt`, `sim_*.txt`, `debug_*.txt`, `*_logs*.txt` | ~80 |
| `.sql` fix pontual | `final_fix*.sql`, `fix_*.sql`, `restore_admin*.sql`, `update_wf.sql` | 9 |
| `.py` temporários na raiz | `check_*.py`, `test_*.py`, `activate_*.py`, `trigger_*.py` | 10 |
| `.json` outputs | `arquivo_saida.json`, `wf_out.json`, `last_exec.json`, `workflow_from_api.json` | 6 |
| Typebot legados | `kreativ_edu_typebot.json`, `typebot-*.json` | 3 |
| JS avulsos | `patch_handoff_response.js`, `query_n8n.js`, `push_workflows.js` | 3 |
| `package.json` + `package-lock.json` | raiz | 2 |
| `fluxos_n8n/` inteiro | workflows TDS legados | 1 dir |
| Workflows duplicados | `ADMIN-*.json`, `fixed_router*.json`, `20-ai-router.json`, `20-ai-router-v2*.json`, `20-test-llm-latency.json`, `21-echo-test.json`, `30-41-*`, `50-55-*`, `60-kreativ-api*.json` (exceto v1.1), `99-test-adaptive.json`, `mcp_auth.json`, `temp_update.json` | ~35 |
| Scripts JS/PY em `n8n-workflows/` | `deploy.js`, `redeploy.py`, `test_router*.js`, etc. | 9 |
| Misc raiz | `b64_exec.txt`, `create_instance*.sh`, `setup-github.sh`, `guia_ptbr.md`, `workflows_list.txt`, `n8n_data.txt` | ~10 |
| Docs raiz redundantes | `AGENTS.md`, `README_TESTS.md`, `TYPEBOT_SETUP.md`, `GUIA_META_WEBHOOK.md`, `GUIA_PERSISTENCIA.md`, `Implementing AI Orchestration Systems.md`, `arquitetura_visual.html` | 7 |

---

## Adições ao .gitignore

```gitignore
# Debug outputs (previne recontaminação)
deploy_output*.txt
sim_*.txt
debug_*.txt
*_output*.txt
*_logs*.txt
bot_logs.txt
check_out.txt
n8n_data.txt
wf_out.json
last_exec.json
arquivo_saida.json

# Scripts temporários de sessão
check_*.py
test_branch.py
trigger_*.py
activate_resume.py
update_n8n.py

# n8n-workflows: bloqueia scripts que não são workflows
n8n-workflows/*.js
n8n-workflows/*.py
n8n-workflows/*.sh
```

---

## Roadmap de Implementação (Fases)

Após a limpeza, a implementação segue o roadmap de 4 fases:

### Fase 1 — Estabilização (Imediato)
- Corrigir AI Tutor (Proxy Request / timeout DeepSeek)
- Corrigir gatilho `list_reply` (race condition webhook/Typebot)
- Adicionar rota de "consultar progresso" no Unified API Router
- Implementar Error Trigger + fallback amigável em todos os workflows principais

### Fase 2 — Segurança Arquitetural (Curto prazo)
- Validação de schema na entrada do Router (phone, action, body)
- Queries SQL em transações (BEGIN/COMMIT) para updates de progresso
- Authorization header em webhooks do ToolJet → N8N

### Fase 3 — AI Tutor + Quiz (Médio prazo)
- Boas-vindas contextualizadas (ler estado do aluno → prompt DeepSeek)
- Fechar fluxo de avaliação quiz (Typebot → N8N → DeepSeek → SQL)
- RAG: popular `document_chunks` com embeddings via pgvector

### Fase 4 — Observabilidade (Longo prazo)
- Dashboards KPI no ToolJet (progresso, tutoria, transbordo)
- Monitoramento infra (Uptime Kuma ou Grafana)
- Alertas WhatsApp/Telegram para falhas críticas
