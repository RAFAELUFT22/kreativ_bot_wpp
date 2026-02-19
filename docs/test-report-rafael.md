# Relatório de Testes E2E — Kreativ Educação
**Data:** 2026-02-19  
**Usuário:** Rafael Luciano — `556399374165`

---

## Estado Inicial do Aluno
| Campo | Valor |
|-------|-------|
| phone | 556399374165 |
| attendance_status | human (travado) |
| current_module | 4 |
| completed_modules | {1,2,3} |
| scores | module_1: 100, module_2: 100, module_3: 100 |
| lead_score | 0 |

---

## Resultados dos Testes

### ✅ T1 — save-progress (MCP Webhook)
- **Endpoint:** `POST /webhook/save-progress`
- **Input:** `{phone, moduleId:4, score:85, completed:true}`
- **Resultado DB:** `scores` atualizado (`module_4: 85`), `completed_modules` inclui `4`, `current_module` avançou para `5`
- **⚠️ Problema:** Webhook não retorna resposta HTTP (hang). O node `respondToWebhook` não dispara. A lógica de dados funciona corretamente.

### ✅ T2 — resume-bot (MCP Webhook)
- **Endpoint:** `POST /webhook/resume-bot`
- **Input:** `{phone, message:"Teste retomada!"}`
- **Resultado:** Retornou `{"success":true}`, DB alterou `attendance_status` de `human` → `bot`
- **WhatsApp:** Mensagem de retomada enviada via Evolution API ✅

### ✅ T3 — request-human-support
- **Endpoint:** `POST /webhook/request-human-support`
- **Input:** `{phone, reason:"Teste de suporte humano"}`
- **Resultado DB:** `attendance_status` alterado para `human` ✅
- **⚠️ Problema:** Resposta HTTP vazia (sem body JSON), mas exit code 0

### ⚠️ T4 — emit-certificate
- **Endpoint:** `POST /webhook/emit-certificate`
- **Input:** `{phone, moduleNumber:5}`
- **Resultado:** Timeout (> 20s sem resposta)
- **🔴 Problema:** Workflow pode estar falhando silenciosamente. Possíveis causas: MinIO upload falha, template HTML falta, ou node `respondToWebhook` não é alcançado

### ⚠️ T5 — get-student-module
- **Endpoint:** `POST /webhook/get-student-module`
- **Input:** `{phone}`
- **Resultado:** Timeout (> 15s sem resposta)
- **🔴 Problema:** Workflow pode ter issue na query SQL ou no `respondToWebhook`

### ❌ T6 — WhatsApp Router (Simulação)
- **Endpoint:** `POST /webhook/whatsapp`
- **Input:** Simulação de mensagem "oi" de Rafael
- **Resultado:** Timeout (> 15s sem resposta)
- **Nota:** Endpoint não retorna resposta (fire-and-forget design). Difícil validar via wget. Precisa teste real via WhatsApp.

### ❌ T7 — Lead Scoring
- **Resultado:** `lead_score = 0` mesmo com 4 módulos concluídos
- **🔴 Problema:** Workflow de Lead Scoring não parece ser acionado automaticamente. Pode ser disparado apenas via trigger interno do N8N que não responde a APIs externas.

---

## Problemas Identificados

| # | Severidade | Problema | Causa Provável | Solução Proposta |
|---|-----------|---------|----------------|-----------------|
| 1 | 🔴 Alta | Webhooks save-progress, emit-certificate e get-student-module não retornam resposta HTTP | Node `respondToWebhook` não alcançado (workflow para no SQL/HTTP) | Adicionar `continueOnFail: true` em todos os steps intermediários e verificar configuração do `responseMode` |
| 2 | 🔴 Alta | emit-certificate timeout completo | Possível falha no upload para MinIO ou na geração HTML | Verificar se MinIO está acessível, se o bucket `materiais` existe, e se o template está correto |
| 3 | 🔴 Alta | get-student-module timeout | Query SQL pode estar falhando (join com modules ou esquema incorreto) | Revisar a query SQL no workflow e testar separadamente |
| 4 | 🟡 Média | lead_score = 0 após 4 módulos | Lead Scoring workflow não é disparado por webhooks externos | Conectar Lead Scoring como sub-workflow do save-progress, ou adicionar chamada explícita |
| 5 | 🟡 Média | Módulos duplicados (module_number 1,2,3 tem 2 registros cada) | Dois courses/datasets misturados no DB | Filtrar por `course_id` correto ou limpar registros duplicados |
| 6 | 🟡 Média | `attendance_status` fica travado em `human` | Chatwoot resolution webhook pode não estar configurado corretamente | Verificar webhook Chatwoot → N8N `conversation_status_changed` e testar resolução manual |
| 7 | 🟢 Baixa | Stale `docker exec` processes causam N8N resource exhaustion | Processos pendentes acumulam conexões | Implementar timeout em todos os scripts de teste |

---

## Próximos Passos (Prioridade)

1. **[P0]** Corrigir workflows com `respondToWebhook` que não dispara (T1, T4, T5)
2. **[P0]** Investigar e corrigir `emit-certificate` (verificar MinIO, template, query)
3. **[P0]** Investigar e corrigir `get-student-module` (verificar query SQL)
4. **[P1]** Conectar Lead Scoring ao fluxo de save-progress
5. **[P1]** Limpar módulos duplicados no DB
6. **[P2]** Configurar/verificar webhook Chatwoot para auto-resolução
7. **[P2]** Teste real via WhatsApp (enviar "oi" pelo app)
