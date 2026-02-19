# AGENTS.md — Guia para Agentes de IA Continuarem o Desenvolvimento

> Este arquivo existe para que um novo agente (Claude Code, Antigravity, Cursor, etc.)
> entenda o estado atual do sistema e saiba exatamente como continuar o desenvolvimento.

---

## 1. O Que É Este Projeto

**Kreativ Educação** — sistema de educação conversacional via WhatsApp.

Alunos recebem módulos de conteúdo e avaliações generativas diretamente no WhatsApp.
Um bot (BuilderBot) e orquestradores IA (N8N + DeepSeek) conduzem a trilha. Quando o aluno pede ajuda,
é transferido para um tutor humano (Chatwoot).

**VPS**: Hostinger, IP `187.77.46.37`, 7.8GB RAM, 1 vCPU
**Domínio principal**: `extensionista.site`
**Painel de deploy**: Coolify em `http://187.77.46.37:8000`

---

## 2. Arquitetura Atual (Estado em 19/02/2026 - Pós-Otimização Redis)

```
WhatsApp ─► Evolution API ─► N8N Router (Redis Cache/Limit) ──► BuilderBot ──► responde aluno
                                     │                           │
                                     ├─► AI Router V3 (Redis) ───┤
                                     │      (Sliding Window)     │
                                     └─► Chatwoot (se 'human') ──┘
```

### Serviços em produção (Docker Compose)

| Serviço | Container | Porta interna | Papel Crítico |
|---|---|---|---|
| PostgreSQL | `kreativ_postgres` | 5432 | Fonte da Verdade (Long-Term Memory) |
| Redis | `kreativ_redis` | 6379 | Sessão, Cache de Estado e Rate Limit (RAM) |
| Evolution API | `kreativ_evolution` | 8080 | Gateway WhatsApp |
| N8N | `kreativ_n8n` | 5678 | Orquestrador de Agentes e Webhooks |
| BuilderBot | `kreativ_builderbot` | 3008 | Relay de Mensagens e Fluxos Estruturados |

---

## 3. Fluxo de Mensagem & Otimizações Recentes

### Estratégia de Cache (Redis)
1. **WhatsApp Router (`WbDAVxu7OwCTttRF`)**:
   - Antes de tocar no PostgreSQL, verifica `session:{phone}:status` no Redis.
   - Aplica **Rate Limit** de 3 segundos por mensagem via Redis `INCR`.
   - Se o cache expirar (24h), busca no DB e repopula o Redis.

2. **AI Router V3 (`5caL67H387euTxan`)**:
   - Mantém uma **Janela Deslizante de Memória** (últimas 20 mensagens) no Redis (`chat_history:{phone}`).
   - Combina essa memória curta com exemplos de tom de voz (RLHF) do PostgreSQL.

3. **Chatwoot Events (`y92mEtPP4nK1p037`)**:
   - Ao resolver um ticket, o N8N atualiza simultaneamente o PostgreSQL (`attendance_status='bot'`) e o Redis para resposta instantânea.

---

## 4. Avaliação Generativa (Pivot de Arquitetura)

**Antigo**: Quizzes determinísticos (Múltipla escolha A, B, C).
**Novo**: A IA atua como Tutor e Avaliador.
- Tabela `modules`: Coluna `evaluation_rubric` (TEXT) substituiu `quiz_questions`.
- O BuilderBot delega a conversa para a IA, que avalia se a resposta do aluno atende à rubrica.
- A aprovação é feita via Function Calling (ou ferramenta MCP) disparando o webhook `save-progress`.

---

## 5. Workflows N8N Ativos (Principais)

| ID | Nome | Webhook Path | Função |
|---|---|---|---|
| `WbDAVxu7OwCTttRF` | WhatsApp Router | `/webhook/whatsapp` | Roteador com Redis (Cache + Limit) |
| `5caL67H387euTxan` | AI Router V3 | `/webhook/ai-tutor-v3` | Tutor com Memória no Redis |
| `oDg2TF7C0ne12fFg` | get-student-module | `/webhook/get-student-module` | Retorna conteúdo + rubrica |
| `tULwBOlfOnCuk586` | Save Progress | `/webhook/save-progress` | Salva nota e libera próximo módulo |
| `y92mEtPP4nK1p037` | Chatwoot Events | `/webhook/chatwoot-events` | Sync de estado Bot/Human |
| `cj1N7ZPVoDxlI7Sk` | Lead Scoring | `/webhook/lead-scoring` | Pontuação de engajamento no CRM |

---

## 6. Banco de Dados & Comandos Úteis

**Conectar**: `docker exec -it kreativ_postgres psql -U kreativ_user -d kreativ_edu`

**Limpar histórico de chat (Redis)**:
`docker exec kreativ_redis redis-cli DEL chat_history:{phone}`

**Reset de aluno**:
```sql
UPDATE students SET current_module = 1, completed_modules = '{}', lead_score = 0, attendance_status = 'bot' WHERE phone = 'PHONE';
```

---

## 7. Status do Roadmap

- [x] **Infra & Integrações Base** (Evolution, Chatwoot, N8N, Postgres)
- [x] **Redis Optimization Layer** (Rate limit, Session caching)
- [x] **Generative Evaluation** (Rubricas IA em vez de Quizzes)
- [x] **Sliding Window Memory** (Contexto de chat persistente via Redis)
- [ ] **RAGFlow** (Base de conhecimento para material didático denso)
- [ ] **ToolJet Admin V2** (Interface para edição de rubricas)

---

## 8. Guia de Manutenção (Para o Próximo Agente)

1. **Deploy de Workflows**: Ao alterar JSONs locais, use:
   `docker exec -e N8N_API_KEY="..." kreativ_n8n node /tmp/wf_p0/deploy.js`
2. **Logs**:
   - N8N: `docker logs kreativ_n8n`
   - BuilderBot: `docker logs kreativ_builderbot`
3. **Persistência**: Sempre que adicionar uma nova lógica no N8N que mude o estado do aluno, atualize o cache do Redis para evitar inconsistências.
