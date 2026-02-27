# Kreativ Classroom Core — Design Doc

> **Data:** 2026-02-27
> **Status:** Aprovado — pronto para implementação
> **Versão:** v1.0
> **Substitui:** 2026-02-27-google-classroom-integration-design.md (descartado)

---

## Contexto e Pivô de Arquitetura

O design anterior posicionava o **Google Classroom como fonte de verdade**, com o Kreativ como
reflexo. Este documento reverte essa relação:

> **Kreativ é a fonte de verdade.** O Google Classroom é um canal de sincronização
> opcional — um "addon" que professores podem ativar, não o núcleo do sistema.

O objetivo é **recriar o modelo de gestão do Classroom** (turmas, anúncios, materiais,
coursework, submissões, notas) internamente no Kreativ, com WhatsApp como interface
do aluno e um painel web/ToolJet como interface do professor.

Referência de validação: Pipedream, Pabbly e viaSocket já conectam Google Classroom
com WhatsApp Cloud API nesse sentido — prova que o fluxo é estável e aceito pelas
políticas de ambas as plataformas.

---

## Objetivos

| # | Objetivo | Direção |
|---|----------|---------|
| 1 | Recriar modelo de gestão pedagógica do Classroom | Schema próprio no Kreativ |
| 2 | WhatsApp como interface do aluno | Typebot + N8N → `kreativ_classroom_core` |
| 3 | Notificar alunos em eventos pedagógicos | `kreativ_classroom_core` → Evolution API |
| 4 | Google Classroom como addon opcional | Sync bidirecional quando professor autorizar |

---

## Seção 1 — Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  Professor                                                       │
│  ToolJet / painel web  ←→  kreativ_classroom_core :8090         │
│  (cria turmas, posta materiais, anúncios, corrige submissões)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST API interna
                           ▼
          ┌────────────────────────────────────┐
          │  kreativ_classroom_core  (NOVO)     │
          │  FastAPI · Python                   │
          │                                     │
          │  /courses        /announcements     │
          │  /coursework     /materials         │
          │  /submissions    /grades            │
          │  /roster         /sync/classroom    │ ← addon Google
          └──────┬──────────┬──────────────────┘
                 │          │
                 │          │ novos materiais (PDF)
                 │          ▼
                 │   kreativ_ingest :8000
                 │   PDF → MinIO → pgvector
                 │
                 │ events (anúncios, notas, coursework)
                 ▼
          N8N  ──────────────────→  Evolution API :8080
          (orquestra)               (WhatsApp → aluno)

          ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
          │  Google Classroom API  (opcional)  │
          │  ativado por professor via OAuth   │
          │  sync bidirecional quando ativo    │
          └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

**Princípio central:** N8N orquestra tudo. Alunos interagem exclusivamente via WhatsApp.
Professores gerenciam via painel (ToolJet ou interface web). Google Classroom é um nó
adicional e desligável, não uma dependência.

---

## Seção 2 — Modelo de Dados "Classroom-like"

### 2.1 Tabelas existentes que mapeiam para conceitos do Classroom

| Conceito Classroom | Tabela Kreativ existente | Observação |
|-------------------|--------------------------|------------|
| `Course` | `courses` | id INTEGER, name, slug, area |
| `CourseWork` | `modules` | module_number, title, quiz_questions |
| `StudentSubmission` | `students.scores` JSONB | `{"module_1": 85, ...}` |
| `CourseMaterial` | `document_chunks` + `modules.content_text` | RAG pipeline |
| `Certificate` | `certificates` | já existente |
| `Roster` | `students.course_id` | FK para courses |

Essas tabelas **não mudam** — o Classroom Core consome a estrutura já existente.

### 2.2 Novas tabelas necessárias

#### `teachers` — professores/tutores do sistema

```sql
CREATE TABLE IF NOT EXISTS teachers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),                 -- WhatsApp do professor
    area            VARCHAR(100),                -- "financeiro", "agro", etc.
    is_active       BOOLEAN DEFAULT TRUE,
    -- addon Google Classroom (opcional)
    google_classroom_oauth BOOLEAN DEFAULT FALSE, -- se ativou a integração
    created_at      TIMESTAMP DEFAULT NOW()
);
```

#### `announcements` — anúncios de turma

```sql
CREATE TABLE IF NOT EXISTS announcements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      UUID REFERENCES teachers(id),
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    attachment_url  VARCHAR(1000),          -- link MinIO ou externo
    state           VARCHAR(20) DEFAULT 'PUBLISHED',  -- DRAFT | PUBLISHED
    -- addon Google Classroom
    classroom_announcement_id VARCHAR(100), -- ID no Google Classroom (se sincronizado)
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_course
    ON announcements(course_id, created_at DESC);
```

#### `coursework` — tarefas/atividades além dos quizzes dos módulos

```sql
CREATE TABLE IF NOT EXISTS coursework (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    module_id       UUID REFERENCES modules(id),    -- vínculo opcional
    teacher_id      UUID REFERENCES teachers(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    work_type       VARCHAR(30) DEFAULT 'ASSIGNMENT',  -- ASSIGNMENT | SHORT_ANSWER_QUESTION | MULTIPLE_CHOICE_QUESTION
    max_points      INTEGER DEFAULT 100,
    due_date        TIMESTAMP,
    state           VARCHAR(20) DEFAULT 'PUBLISHED',
    -- addon Google Classroom
    classroom_coursework_id VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

#### `student_submissions` — entregas dos alunos (complementa `students.scores`)

```sql
CREATE TABLE IF NOT EXISTS student_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    coursework_id   UUID REFERENCES coursework(id) ON DELETE CASCADE,
    state           VARCHAR(30) DEFAULT 'NEW',
    -- NEW | CREATED | TURNED_IN | RETURNED | RECLAIMED_BY_STUDENT
    assigned_grade  NUMERIC(5,2),
    draft_grade     NUMERIC(5,2),
    answer_text     TEXT,                          -- resposta livre
    attachment_url  VARCHAR(1000),                 -- arquivo enviado
    -- addon Google Classroom
    classroom_submission_id VARCHAR(100),
    submitted_at    TIMESTAMP,
    graded_at       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_student
    ON student_submissions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_coursework
    ON student_submissions(coursework_id);
```

#### `course_enrollments` — matrícula formal (complementa `students.course_id`)

```sql
-- students.course_id cobre o caso de 1 curso ativo.
-- Para múltiplos cursos simultâneos ou histórico:
CREATE TABLE IF NOT EXISTS course_enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID REFERENCES students(id) ON DELETE CASCADE,
    course_id   INTEGER REFERENCES courses(id),
    enrolled_at TIMESTAMP DEFAULT NOW(),
    status      VARCHAR(20) DEFAULT 'ACTIVE',    -- ACTIVE | INACTIVE | COMPLETED
    UNIQUE(student_id, course_id)
);
```

#### `google_oauth_tokens` — addon opcional, apenas para professores que ativam sync

```sql
CREATE TABLE IF NOT EXISTS google_oauth_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id      UUID REFERENCES teachers(id) ON DELETE CASCADE,
    professor_email VARCHAR(255) UNIQUE NOT NULL,
    access_token    TEXT NOT NULL,
    refresh_token   TEXT NOT NULL,
    token_expiry    TIMESTAMP NOT NULL,
    scopes          TEXT[] NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

> **Nota:** Esta tabela só é populada quando o professor clica em "Conectar Google Classroom"
> no painel. O sistema funciona plenamente sem ela.

### 2.3 Colunas adicionadas em tabelas existentes

```sql
-- students: identificador Google (opcional, addon)
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS google_classroom_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS google_email        VARCHAR(255);

-- courses: ID no Google Classroom (opcional, addon)
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS classroom_course_id VARCHAR(100);
```

---

## Seção 3 — API do `kreativ_classroom_core`

O microserviço expõe uma REST API que espelha o modelo conceitual do Google Classroom,
mas consome exclusivamente o banco Kreativ.

### 3.1 Endpoints core (sempre disponíveis)

```
Turmas
  GET  /courses                       lista cursos ativos
  GET  /courses/{course_id}/roster    alunos matriculados

Anúncios
  GET  /courses/{course_id}/announcements          lista (desc by created_at)
  POST /courses/{course_id}/announcements          cria anúncio
  GET  /courses/{course_id}/announcements/{id}     detalhe

Coursework (tarefas)
  GET  /courses/{course_id}/coursework             lista tarefas
  POST /courses/{course_id}/coursework             cria tarefa
  GET  /courses/{course_id}/coursework/{id}        detalhe

Materiais
  POST /courses/{course_id}/materials              upload → delega a kreativ_ingest
  GET  /courses/{course_id}/materials              lista (de modules + document_chunks)

Submissões
  GET  /courses/{course_id}/coursework/{cwid}/submissions        lista
  POST /courses/{course_id}/coursework/{cwid}/submissions        aluno entrega
  PATCH /courses/{course_id}/coursework/{cwid}/submissions/{id}  professor corrige/devolve

Notas
  POST /grades/push   { student_phone, course_id, module_number, score }
                      → atualiza students.scores + student_submissions.assigned_grade

Eventos (consumido pelo N8N para notificações WhatsApp)
  GET  /events/pending   lista eventos não notificados
                         (novo anúncio, nota lançada, material publicado)
  POST /events/{id}/ack  marca evento como notificado
```

### 3.2 Endpoints addon Google Classroom (só disponíveis se professor ativou OAuth)

```
OAuth
  GET  /google/authorize?teacher_id=X   redireciona para Google OAuth
  GET  /google/callback                 troca code por tokens → google_oauth_tokens

Sync bidirecional
  POST /google/sync/{course_id}
    → puxa do Google: novos alunos, novos materiais, anúncios (Classroom → Kreativ)
    → empurra para o Google: novos anúncios Kreativ, notas (Kreativ → Classroom)

  POST /google/grades/push
    → espelha nota Kreativ de volta para StudentSubmission no Google Classroom
```

---

## Seção 4 — Fluxo de Eventos e Notificações WhatsApp

O N8N é o único responsável por disparar mensagens no WhatsApp. O `kreativ_classroom_core`
apenas **registra eventos** e os expõe via `/events/pending`.

### 4.1 Tabela `events_log` (já existente, reutilizada)

```sql
-- event_type novos (inseridos por kreativ_classroom_core):
-- "announcement_published"  → payload: { course_id, title, body }
-- "coursework_published"    → payload: { course_id, title, due_date }
-- "material_published"      → payload: { course_id, module_id, filename }
-- "grade_returned"          → payload: { student_id, course_id, score, module_number }
```

### 4.2 Workflow N8N: `classroom_event_notifier`

```
[Schedule Trigger: */5 * * * *]  ← a cada 5 minutos
    │
    ▼
[HTTP Request: GET kreativ_classroom_core:8090/events/pending]
    │
    ├── Para "announcement_published":
    │     └─ [PG: SELECT students WHERE course_id = X AND phone IS NOT NULL]
    │           └─ [HTTP: POST kreativ_evolution:8080/message/sendText/europs]
    │                { number: "55{phone}", text: "📢 *{course}*: {title}\n{body[:200]}" }
    │
    ├── Para "coursework_published":
    │     └─ [HTTP: Evolution] → "📝 Nova atividade em *{course}*: {title}. Prazo: {due_date}"
    │
    ├── Para "material_published":
    │     └─ [HTTP: Evolution] → "📚 Novo material em *{course}*: {filename}. Já disponível!"
    │
    └── Para "grade_returned":
          └─ [HTTP: Evolution] → "✅ Nota lançada no módulo {N}: {score}/100"

    └─ [HTTP Request: POST /events/{id}/ack]  ← marca como notificado
```

### 4.3 Mensagens WhatsApp por evento

| Evento | Mensagem |
|--------|---------|
| Novo anúncio | `📢 *{course_name}*\n\n{announcement_title}\n{body[:200]}` |
| Nova tarefa | `📝 Nova atividade em *{course_name}*: {title}\nPrazo: {due_date}` |
| Novo material | `📚 Material novo em *{course_name}*!\n{filename} já disponível para o tutor IA.` |
| Nota lançada | `✅ Sua nota no módulo {N} foi lançada: *{score}/100*` |
| Certificado disponível | `🎓 Parabéns! Seu certificado de *{course_name}* está disponível.` |

> **Janela 24h:** O Evolution API gerencia a política de janela do WhatsApp Cloud API.
> Para alunos inativos há mais de 24h, o N8N deve usar uma mensagem de template
> pré-aprovada ou aguardar a próxima interação do aluno para abrir a janela.

---

## Seção 5 — Addon Google Classroom (módulo opcional)

Quando professor ativa a integração:

### 5.1 OAuth Flow (idêntico ao design anterior, mas opcional)

```
1. Professor acessa painel ToolJet → clica "Conectar Google Classroom"
2. Painel chama GET /google/authorize?teacher_id=<uuid>
3. kreativ_classroom_core redireciona para Google OAuth com escopos mínimos
4. Callback salva tokens em google_oauth_tokens
5. teachers.google_classroom_oauth = TRUE
```

**Escopos necessários apenas para o addon:**

| Escopo | Uso |
|--------|-----|
| `classroom.courses.readonly` | Listar turmas do professor |
| `classroom.rosters.readonly` | Importar alunos do Classroom |
| `classroom.coursework.materials.readonly` | Importar materiais do Classroom |
| `classroom.announcements.readonly` | Importar anúncios do Classroom |
| `classroom.coursework.students` | Espelhar notas de volta |
| `drive.readonly` | Download de PDFs dos materiais |

### 5.2 Sync bidirecional (`POST /google/sync/{course_id}`)

```
FASE 1 — Classroom → Kreativ (importação de dados externos):
  - courses.students.list()  → students (via google_email, phone como nullable)
  - courseWorkMaterials.list() → POST kreativ_ingest/process (PDF→pgvector)
  - announcements.list()     → INSERT announcements (se não existir)

FASE 2 — Kreativ → Classroom (espelhamento de dados próprios):
  - announcements WHERE classroom_announcement_id IS NULL
    → courses.announcements().create() → UPDATE classroom_announcement_id
  - student_submissions WHERE assigned_grade IS NOT NULL
      AND classroom_submission_id IS NOT NULL
    → studentSubmissions.patch(assignedGrade)
```

### 5.3 Mapeamento de turmas (operação única por professor)

```sql
-- Admin executa após listar turmas via GET /google/courses?teacher_id=X
UPDATE courses
SET classroom_course_id = '987654321'
WHERE id = 5;  -- Gestão Financeira
```

---

## Seção 6 — Container `kreativ_classroom_core`

### `docker-compose.yml` (fragmento)

```yaml
kreativ_classroom_core:
  build:
    context: ./services/classroom
    dockerfile: Dockerfile
  container_name: kreativ_classroom_core
  restart: unless-stopped
  environment:
    POSTGRES_HOST:     kreativ_postgres
    POSTGRES_DB:       kreativ_edu
    POSTGRES_USER:     ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    EVOLUTION_API_URL: http://kreativ_evolution:8080
    EVOLUTION_API_KEY: ${EVOLUTION_API_KEY}
    KREATIV_INGEST_URL: http://kreativ_ingest:8000
    # Addon Google Classroom (só necessário se professores ativarem)
    GOOGLE_CLIENT_ID:      ${GOOGLE_CLIENT_ID:-}
    GOOGLE_CLIENT_SECRET:  ${GOOGLE_CLIENT_SECRET:-}
    GOOGLE_REDIRECT_URI:   https://classroom.extensionista.site/google/callback
  networks:
    - kreativ_net
    - coolify
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.classroom-core.rule=Host(`classroom.extensionista.site`)"
    - "traefik.http.routers.classroom-core.entrypoints=https"
    - "traefik.http.routers.classroom-core.tls.certresolver=letsencrypt"
    - "traefik.http.services.classroom-core.loadbalancer.server.port=8090"
```

### Estrutura de arquivos

```
services/classroom/
├── Dockerfile
├── requirements.txt
│   # fastapi, uvicorn, psycopg2-binary, httpx, pydantic
│   # google-api-python-client, google-auth-oauthlib  ← só para addon
├── main.py          # app FastAPI, routers
├── models.py        # Pydantic schemas
├── db.py            # conexão psycopg2 + helpers
├── routers/
│   ├── courses.py       # GET /courses, /roster
│   ├── announcements.py # CRUD /announcements
│   ├── coursework.py    # CRUD /coursework
│   ├── materials.py     # POST /materials → kreativ_ingest
│   ├── submissions.py   # CRUD /submissions
│   ├── grades.py        # POST /grades/push
│   └── events.py        # GET /events/pending, POST /events/ack
└── addon/
    ├── google_auth.py   # OAuth flow
    └── google_sync.py   # sync bidirecional
```

---

## Seção 7 — Workflows N8N (novos/modificados)

### Workflow A: `classroom_event_notifier` (novo)

Schedule a cada 5 minutos, consome `/events/pending`, dispara WhatsApp via Evolution.
(Descrito na Seção 4.2)

### Workflow B: `classroom_grade_push` (novo sub-workflow)

Chamado pelo ULTIMATE após `submit_quiz`:

```
[Execute Workflow Trigger]
    │  input: { student_phone, course_id, module_number, score }
    ▼
[HTTP Request: POST kreativ_classroom_core:8090/grades/push]
    │  → atualiza students.scores + INSERT student_submissions
    │  → INSERT events_log (grade_returned) → notificação via Workflow A
    │
    └── [IF teachers.google_classroom_oauth = TRUE para este course_id]
            └─ [HTTP: POST /google/grades/push]  ← addon, opcional
```

### Workflow C: `google_classroom_sync` (novo, addon)

Ativado apenas se `classroom_course_id IS NOT NULL`:

```
[Schedule Trigger: */30 * * * *]
    │
    ▼
[PG: SELECT id FROM courses WHERE classroom_course_id IS NOT NULL]
    │
    └─ FOR EACH course:
         [HTTP: POST kreativ_classroom_core:8090/google/sync/{course_id}]
         [IF errors] → [Evolution: alerta tutor]
```

---

## Seção 8 — Google Cloud Console (pré-requisitos, addon)

Necessário **somente** se algum professor quiser ativar a integração Google Classroom:

1. Criar projeto no Google Cloud Console
2. Habilitar: Google Classroom API + Google Drive API
3. OAuth Consent Screen → escopos da Seção 5.1
4. Credenciais OAuth 2.0 Web App:
   - Redirect URI: `https://classroom.extensionista.site/google/callback`
5. Copiar Client ID + Secret → `.env` (variáveis opcionais)

> **Para uso piloto (modo Testing):** sem verificação Google, apenas adicionar emails
> dos professores como "test users" no Console. Processo de verificação (~2 semanas)
> necessário apenas para apps com acesso a dados de terceiros em produção.

---

## Seção 9 — Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Aluno sem phone (veio do Google Classroom) | `phone` nullable até aluno interagir no WhatsApp; sem notificação WhatsApp enquanto phone = NULL |
| Professor revoga OAuth Google | Capturar 401 → `teachers.google_classroom_oauth = FALSE` → alerta tutor |
| Addon Google não configurado | `GOOGLE_CLIENT_ID` ausente → endpoints `/google/*` retornam 501 Not Implemented |
| Janela 24h WhatsApp para alunos inativos | N8N verifica `events_log.created_at` vs última mensagem do aluno; enfileira para próxima interação |
| Conflito de IDs ao importar alunos do Classroom | Match por `google_email`; se não encontrar, cria `student` com phone NULL |

---

## Seção 10 — Tabela de Decisões Revisada

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| **Fonte de verdade** | Kreativ (PostgreSQL) | Sistema independente, não requer conta Google |
| **Interface do aluno** | WhatsApp (Evolution + Typebot) | Já em produção, 502 leads com telefone válido |
| **Interface do professor** | ToolJet / painel web | Gerenciamento de turmas, anúncios, coursework |
| **Modelo de dados** | Inspirado no Google Classroom | Facilita futura sincronização bidirecional |
| **Google Classroom** | Addon opcional por professor | Não é dependência do core; ativado individualmente |
| **Notificações** | Evolution API (`kreativ_evolution:8080`) | Credenciais Cloud API já gerenciadas pelo Evolution |
| **Ingestão de materiais** | Delegar ao `kreativ_ingest` | Pipeline PDF→MinIO→pgvector já em produção |
| **Orquestração** | N8N exclusivamente | Consistente com o padrão existente da stack |
| **N8N + Google OAuth** | Não usa N8N para OAuth | N8N OAuth2 Generic não suporta escopos Classroom |
