# Kreativ Educação v0.5 — "Tutor Intelligence" — Design Doc

> **Data:** 2026-02-27
> **Status:** Aprovado — pronto para implementação
> **Versão:** v0.5.0

---

## Contexto

508 pré-inscritos no banco, 502 com WhatsApp válido, 0 convertidos.
O sistema tem a infraestrutura pronta (Typebot, N8N, PostgreSQL, Chatwoot, kreativ_ingest).
Esta versão ativa os leads, enriquece o contexto do AI tutor, organiza os times de tutores humanos e desacopla o provider de LLM.

---

## Demanda real (pré-inscrições)

| Posição | Curso | Interessados | Lote de ativação |
|---------|-------|-------------|-----------------|
| 1º | Gestão Financeira para Empreendimentos | 210 | Lote 1 |
| 2º | Boas Práticas na Produção e Manipulação de Alimentos | 89 | Lote 2 |
| 3º | Organização da Produção para o Mercado | 83 | Lote 2 |
| 4º | Inteligência Artificial e Inclusão Digital | 78 | Lote 3 |
| 5º+ | Demais cursos | ~48 | Lote 4 |

**Perfil dos leads:**
- 70% Feminino, 87% Tocantins
- Disponibilidade: Seg-Sex Noite (125), Fins de Semana Tarde (107), Seg-Sex Tarde (84)

---

## Seção 1 — Arquitetura Geral

```
pre_inscriptions (502 tel_valido, 0 convertidos)
        │
        ▼
[N8N: Campaign Batch]          ← NOVO
        │  lotes de 10, delay 5s, prioridade por demanda
        ▼
Evolution API → WhatsApp (mensagem personalizada por curso)
        │  lead responde
        ▼
Typebot: Grupo "Onboarding"    ← NOVO (build_typebot.py)
        │  check_preinscription → confirma interesse → onboard_student
        ▼
Bot principal (menu existente)
        │
        ├── get_student_context (sub-workflow)  ← NOVO
        │       └── learning_profile derivado de quiz scores
        │
        ├── AI Tutor → llm-router (sub-workflow)  ← NOVO
        │       └── DeepSeek | OpenRouter | Ollama (plugável via .env)
        │
        └── request_human → chatwoot-team-router  ← NOVO
                └── roteamento por área + turno → time correto
```

**Novos componentes:**

| # | Componente | Tipo | Status |
|---|-----------|------|--------|
| 1 | Campaign Batch Workflow | N8N workflow | Novo |
| 2 | Grupo Onboarding no Typebot | build_typebot.py | Novo |
| 3 | Action `check_preinscription` | ULTIMATE | Novo |
| 4 | Action `onboard_student` | ULTIMATE | Novo |
| 5 | Action `admin_upload_material` | ULTIMATE | Novo |
| 6 | Sub-workflow `get_student_context` | N8N sub | Novo |
| 7 | Sub-workflow `llm-router` | N8N sub | Novo |
| 8 | Sub-workflow `chatwoot-team-router` | N8N sub | Refactor |
| 9 | Content Panel (aba Conteúdo) | ToolJet | Novo |
| 10 | Endpoint `/process-text` | kreativ_ingest | Novo |

---

## Seção 2 — Content Panel (ToolJet + NotebookLM + kreativ_ingest)

### 2.1 ToolJet — aba "Conteúdo"

Formulário para cadastro de curso/módulo:
- Campos: nome, área, módulos, `routing_labels` (JSONB, ex: `["financeiro","turno-noite"]`)
- Query PG: INSERT/UPDATE em `courses` + `modules`
- Upload de PDF/DOCX: RunJS → FileReader → base64 → HTTP POST → N8N `admin_upload_material`

**Geração de prompts NotebookLM:**
- Botão "Gerar Prompts NotebookLM" por módulo
- N8N chama DeepSeek/llm-router → gera 5 prompts estruturados baseados nos objetivos do módulo
- ToolJet exibe os prompts prontos para copiar

**Importação de resultado NotebookLM:**
- Gestor cola markdown/texto exportado do NotebookLM
- HTTP POST → N8N: `admin_import_notebooklm`
- kreativ_ingest: `/process-text` (endpoint novo) → chunks → embeddings → `document_chunks`
- `metadata.source = "notebooklm"`

### 2.2 Fluxo de upload de material

```
ToolJet (RunJS: base64)
  └── POST N8N: admin_upload_material
        └── POST kreativ_ingest: /process
              ├── pdfplumber → chunks (500 chars, overlap 50)
              ├── OpenRouter text-embedding-3-small → 1536 dims
              ├── INSERT document_chunks (module_id, chunk_index, content, embedding, metadata)
              └── UPDATE modules SET media_urls = array_append(...)
```

### 2.3 Schema: campo `routing_labels` em `courses`

```sql
ALTER TABLE courses ADD COLUMN routing_labels JSONB DEFAULT '[]';
-- ex: ["financeiro", "turno-noite", "presencial-to"]
```

---

## Seção 3 — Campaign de Ativação + Onboarding

### 3.1 N8N: Campaign Batch Workflow

```
Trigger: manual (ToolJet) ou cron semanal
    │
Query PG: leads não contatados
  SELECT pi.*, c.name as curso_nome
  FROM pre_inscriptions pi
  JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
  JOIN courses c ON c.id = pic.course_id
  WHERE pi.telefone_valido = true
    AND pi.convertido = false
    AND pi.id NOT IN (SELECT pre_inscription_id FROM campaign_sends)
  ORDER BY c.id ASC
  LIMIT 50
    │
Split In Batches (10) → Wait 5s
    │
Mensagem personalizada:
  "Olá [nome_completo]! 👋
   Você se inscreveu no interesse pelo curso *[curso_nome]*.
   Temos vagas abertas e você está na lista de prioridade! 🎓
   [buttons: Sim, me matricular! | Saber mais | Agora não]"
    │
Evolution API: POST /message/sendText (instância: europs)
    │
INSERT INTO campaign_sends (pre_inscription_id, campaign_name, message_text)
```

### 3.2 Nova tabela: `campaign_sends`

```sql
CREATE TABLE campaign_sends (
    id                 SERIAL PRIMARY KEY,
    pre_inscription_id UUID REFERENCES pre_inscriptions(id),
    campaign_name      VARCHAR(100),
    sent_at            TIMESTAMPTZ DEFAULT NOW(),
    status             VARCHAR(20) DEFAULT 'sent'
    -- 'sent' | 'responded' | 'converted' | 'opted_out'
);
CREATE INDEX idx_campaign_sends_pi ON campaign_sends(pre_inscription_id);
CREATE INDEX idx_campaign_sends_status ON campaign_sends(status);
```

### 3.3 Typebot: Grupo "Onboarding" (build_typebot.py)

Desvio no bloco "Catraca" (após `check_student` retornar `student_found = false`):

```
Catraca
  ├── [student_found = true]  → Menu principal (fluxo atual)
  └── [student_found = false]
          └── N8N: check_preinscription
                ├── [pré-inscrito encontrado]
                │     → "Olá! Vi que você se inscreveu para [curso_nome].
                │        Vamos confirmar sua vaga? 🎓"
                │        [buttons: Sim! | Não por agora]
                │        Sim → N8N: onboard_student → Menu principal
                └── [não encontrado]
                      → "Que bom te ver! Para começar..."
                         → fluxo de cadastro manual
```

### 3.4 ULTIMATE: novas actions

**`check_preinscription`**
```
input:  { phone }
query:  SELECT pi.*, c.name as curso_nome, c.id as course_id, c.area,
               c.routing_labels
        FROM pre_inscriptions pi
        JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
        JOIN courses c ON c.id = pic.course_id
        WHERE pi.telefone_whatsapp LIKE '%' || normalize(phone) || '%'
          AND pi.convertido = false
        LIMIT 1
output: { found, pre_inscription_id, nome, curso_nome, course_id,
          disponibilidade, routing_labels }
```

**`onboard_student`**
```
input:  { phone, pre_inscription_id }
steps:
  1. SELECT dados completos de pre_inscriptions
  2. INSERT INTO students
       (phone, name, email, cpf, course_id,
        profile_data: { disponibilidade, estado, routing_labels })
  3. INSERT INTO enrollment_progress (student_id, course_id, current_module=1)
  4. UPDATE pre_inscriptions SET convertido=true, student_id=novo_id
  5. UPDATE campaign_sends SET status='converted'
     WHERE pre_inscription_id = $pre_inscription_id
output: { ok, student_id, course_name, module_1_title }
```

### 3.5 Schema: campo `profile_data` em `students`

```sql
ALTER TABLE students ADD COLUMN profile_data JSONB DEFAULT '{}';
-- ex: { "disponibilidade": "De Segunda a Sexta - Noite",
--       "estado": "TO",
--       "routing_labels": ["financeiro", "turno-noite"] }
```

### 3.6 Priorização da campanha

| Lote | Curso | Leads | Justificativa |
|------|-------|-------|---------------|
| 1 | Gestão Financeira | 210 | Maior demanda + stress test do RAG |
| 2 | Alimentos + Agro | 172 | Segunda maior base combinada |
| 3 | IA e Inclusão Digital | 78 | Alinhado com PBIA (gov) |
| 4 | Demais cursos | ~42 | Tail de interesse |

---

## Seção 4 — Chatwoot Teams + LLM Router Plugável

### 4.1 Times Chatwoot por área

| Time | Cobre | Leads potenciais |
|------|-------|-----------------|
| `time-financeiro` | Gestão Financeira, Educação Financeira, Crédito | ~212 |
| `time-alimentacao-agro` | Alimentos, Agronegócio, Produção, Extrativismo | ~176 |
| `time-tecnologia` | IA e Inclusão Digital, Audiovisual | ~105 |
| `time-geral` | Demais cursos + fallback | ~15 |

**Labels de turno** (derivadas de `profile_data.disponibilidade`):

| Disponibilidade | Label Chatwoot |
|----------------|---------------|
| De Segunda a Sexta - Noite | `turno-noite` |
| De Segunda a Sexta - Tarde | `turno-tarde` |
| De Segunda a Sexta - Manhã | `turno-manha` |
| Finais de Semana (qualquer) | `fim-de-semana` |
| Tempo Integral | `turno-integral` |

### 4.2 Sub-workflow `chatwoot-team-router`

```
input: { phone, message, student_context }
    │
Code node: resolver routing
  teamMap = {
    financeiro:  "time-financeiro",
    alimentacao: "time-alimentacao-agro",
    agro:        "time-alimentacao-agro",
    tecnologia:  "time-tecnologia",
    default:     "time-geral"
  }
  labels = [teamMap[area], label_turno, "modulo-"+module, "aguardando-tutor"]
    │
Chatwoot API: GET /teams → resolve team_id
    │
Chatwoot API: POST /conversations { inbox_id:1, contact_id, team_id, labels }
    │
Chatwoot API: POST /conversations/:id/messages { content: message }
    │
Evolution API: confirma ao aluno
  "Conectando com tutor de [área]. Um humano responde em breve! 🙋"
```

### 4.3 Sub-workflow `get_student_context`

```
input: { phone }
    │
Query PG:
  SELECT s.name, s.profile_data,
         c.name as course_name, c.area, c.routing_labels,
         ep.current_module, ep.progress_pct,
         (SELECT AVG(score) FROM quiz_results
          WHERE student_id = s.id) as avg_score
  FROM students s
  JOIN courses c ON c.id = s.course_id
  JOIN enrollment_progress ep ON ep.student_id = s.id
  WHERE s.phone = $phone
    │
Code node: derivar learning_profile
  >= 80% → "aprendiz avançado — desafie com perguntas extras"
  >= 60% → "ritmo regular — reforce conceitos-chave"
  <  60% → "precisa de suporte — seja mais didático e paciente"
  sem quizzes → "aluno novo — apresente o módulo com entusiasmo"
    │
output: { name, course_name, area, routing_labels,
          current_module, progress_pct, disponibilidade,
          learning_profile, avg_score }
```

### 4.4 Sub-workflow `llm-router`

```
Execute Workflow Trigger
  input: { system_prompt, user_message, temperature, max_tokens }
    │
Code node: provider = $env.LLM_PROVIDER
    │
Switch:
  ├── deepseek    → POST api.deepseek.com/v1/chat/completions
  ├── openrouter  → POST openrouter.ai/api/v1/chat/completions
  └── ollama      → POST kreativ_ollama:11434/api/chat
    │
Code node: normalizar resposta
  output: { response_text, tokens_used, provider, model }
```

**Novas variáveis `.env`:**
```bash
LLM_PROVIDER=deepseek           # deepseek | openrouter | ollama
OPENROUTER_MODEL=deepseek/deepseek-chat
OLLAMA_MODEL=qwen2.5:7b
```

**docker-compose — Ollama (desabilitado por padrão):**
```yaml
kreativ_ollama:
  image: ollama/ollama:latest
  profiles: ["ollama"]
  volumes:
    - ollama_data:/root/.ollama
  networks:
    - kreativ_net
```

Ativar no futuro: `docker compose --profile ollama up -d kreativ_ollama`

---

## ULTIMATE — Mapa final de actions

```
ULTIMATE (SoB5evP9aOmj6hLA)
  ├── check_student           existente
  ├── check_preinscription    NOVO  (Seção 3)
  ├── onboard_student         NOVO  (Seção 3)
  ├── get_module              existente → get_student_context → llm-router
  ├── submit_quiz             existente → get_student_context → llm-router
  ├── ai_tutor                existente → get_student_context → llm-router
  ├── get_progress            existente
  ├── request_human           refatorado → chatwoot-team-router (Seção 4)
  ├── emit_certificate        existente
  ├── admin_upsert_student    existente
  ├── admin_reset_student     existente
  ├── admin_upsert_course     existente
  ├── admin_upsert_module     existente
  ├── admin_upload_material   NOVO  (Seção 2)
  └── admin_import_notebooklm NOVO  (Seção 2)
```

---

## Ordem de implementação sugerida

1. **Migrations SQL** — `routing_labels`, `profile_data`, `campaign_sends` (30min)
2. **Sub-workflow `llm-router`** — desacopla LLM antes de tudo (45min)
3. **Sub-workflow `get_student_context`** — enriquece contexto (45min)
4. **Actions `check_preinscription` + `onboard_student`** no ULTIMATE (1h)
5. **Grupo Onboarding no Typebot** via build_typebot.py (1h)
6. **Sub-workflow `chatwoot-team-router`** (45min)
7. **Campaign Batch Workflow** — N8N novo (1h)
8. **ToolJet: aba Conteúdo** — form + upload + NotebookLM (2h)
9. **kreativ_ingest: `/process-text`** endpoint (30min)
10. **Smoke tests E2E** + envio do lote 1 (Gestão Financeira) (1h)
