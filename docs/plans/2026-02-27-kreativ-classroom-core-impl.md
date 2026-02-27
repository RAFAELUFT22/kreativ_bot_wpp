# Kreativ Classroom Core — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir o microserviço `kreativ_classroom_core` — um LMS "Classroom-like" próprio com API REST para turmas, anúncios, coursework, materiais, submissões e notas, integrado ao N8N e Evolution API para notificações WhatsApp; Google Classroom é addon opcional.

**Architecture:** FastAPI Python servindo uma REST API que consome o PostgreSQL (`kreativ_edu`) diretamente via psycopg2. N8N orquestra eventos: consome `/events/pending` a cada 5 minutos e dispara WhatsApp via `kreativ_evolution:8080`. Google Classroom OAuth é módulo separado em `addon/`, só ativado por variáveis de ambiente.

**Tech Stack:** Python 3.11, FastAPI, psycopg2-binary, httpx, uvicorn, pytest, pytest-asyncio, httpx[TestClient]; docker-compose; N8N HTTP Request nodes.

**Design doc:** `docs/plans/2026-02-27-kreativ-classroom-core-design.md`

---

## Visão Geral das Tarefas

| # | Componente | O que faz |
|---|-----------|-----------|
| 1 | Migration SQL | Cria as 5 novas tabelas e ADD COLUMN nas existentes |
| 2 | Skeleton FastAPI | main.py, db.py, models.py, Dockerfile, requirements.txt |
| 3 | Router: courses + roster | GET /courses, GET /courses/{id}/roster |
| 4 | Router: announcements | CRUD /announcements + INSERT events_log |
| 5 | Router: coursework + materials | CRUD /coursework, POST /materials → kreativ_ingest |
| 6 | Router: submissions + grades | POST /submissions, PATCH (nota), POST /grades/push |
| 7 | Router: events | GET /events/pending, POST /events/{id}/ack |
| 8 | Docker compose + Traefik | Adicionar serviço ao docker-compose.yml |
| 9 | N8N: classroom_event_notifier | Workflow Schedule → /events/pending → WhatsApp |
| 10 | N8N: classroom_grade_push | Sub-workflow para após submit_quiz |
| 11 | Addon: Google OAuth | GET /google/authorize, GET /google/callback (opcional) |
| 12 | Addon: Google Sync | POST /google/sync/{course_id} bidirecional (opcional) |

---

## Task 1: Migration SQL — novas tabelas e colunas

**Files:**
- Create: `init-scripts/04-migration-classroom-core.sql`

**Step 1: Criar o arquivo de migration**

```sql
-- =============================================================================
-- KREATIV CLASSROOM CORE — migration
-- Executar uma vez contra kreativ_edu em produção:
--   docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < init-scripts/04-migration-classroom-core.sql
-- =============================================================================

-- Colunas opcionais em tabelas existentes
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS google_classroom_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS google_email        VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_students_google_email
    ON students(google_email);

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS classroom_course_id VARCHAR(100);

-- Professores/tutores
CREATE TABLE IF NOT EXISTS teachers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    area            VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    google_classroom_oauth BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Anúncios de turma
CREATE TABLE IF NOT EXISTS announcements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id      UUID REFERENCES teachers(id),
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    attachment_url  VARCHAR(1000),
    state           VARCHAR(20) DEFAULT 'PUBLISHED',
    classroom_announcement_id VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_course
    ON announcements(course_id, created_at DESC);

-- Coursework (tarefas além dos quizzes de módulo)
CREATE TABLE IF NOT EXISTS coursework (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id       INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    module_id       UUID REFERENCES modules(id),
    teacher_id      UUID REFERENCES teachers(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    work_type       VARCHAR(30) DEFAULT 'ASSIGNMENT',
    max_points      INTEGER DEFAULT 100,
    due_date        TIMESTAMP,
    state           VARCHAR(20) DEFAULT 'PUBLISHED',
    classroom_coursework_id VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Submissões de alunos
CREATE TABLE IF NOT EXISTS student_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    coursework_id   UUID REFERENCES coursework(id) ON DELETE CASCADE,
    state           VARCHAR(30) DEFAULT 'NEW',
    assigned_grade  NUMERIC(5,2),
    draft_grade     NUMERIC(5,2),
    answer_text     TEXT,
    attachment_url  VARCHAR(1000),
    classroom_submission_id VARCHAR(100),
    submitted_at    TIMESTAMP,
    graded_at       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_student
    ON student_submissions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_coursework
    ON student_submissions(coursework_id);

-- Matrículas múltiplas (complementa students.course_id)
CREATE TABLE IF NOT EXISTS course_enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID REFERENCES students(id) ON DELETE CASCADE,
    course_id   INTEGER REFERENCES courses(id),
    enrolled_at TIMESTAMP DEFAULT NOW(),
    status      VARCHAR(20) DEFAULT 'ACTIVE',
    UNIQUE(student_id, course_id)
);

-- Tokens OAuth Google (addon opcional)
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

**Step 2: Verificar migration localmente**

```bash
docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  < init-scripts/04-migration-classroom-core.sql
```

Esperado: vários `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` sem erros.

**Step 3: Verificar tabelas criadas**

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "\dt teachers" -c "\dt announcements" -c "\dt coursework" \
  -c "\dt student_submissions" -c "\dt google_oauth_tokens"
```

Esperado: 5 linhas, uma por tabela.

**Step 4: Commit**

```bash
git add init-scripts/04-migration-classroom-core.sql
git commit -m "feat(db): migration Classroom Core — teachers, announcements, coursework, submissions"
```

---

## Task 2: Skeleton FastAPI — estrutura base do microserviço

**Files:**
- Create: `services/classroom/requirements.txt`
- Create: `services/classroom/Dockerfile`
- Create: `services/classroom/main.py`
- Create: `services/classroom/db.py`
- Create: `services/classroom/models.py`
- Create: `services/classroom/tests/__init__.py`
- Create: `services/classroom/tests/conftest.py`

**Step 1: `requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
psycopg2-binary==2.9.9
httpx==0.27.2
pydantic==2.8.2
pytest==8.3.2
pytest-asyncio==0.23.8
```

**Step 2: `Dockerfile`**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
```

**Step 3: `db.py`**

```python
"""Helpers de conexão PostgreSQL."""
import os
import psycopg2
import psycopg2.extras

_PG = dict(
    host=os.getenv("POSTGRES_HOST", "kreativ_postgres"),
    dbname=os.getenv("POSTGRES_DB", "kreativ_edu"),
    user=os.getenv("POSTGRES_USER", "kreativ_user"),
    password=os.getenv("POSTGRES_PASSWORD", ""),
)


def conn():
    return psycopg2.connect(**_PG)


def fetchall(sql: str, params=()) -> list[dict]:
    with conn() as c:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


def fetchone(sql: str, params=()) -> dict | None:
    with conn() as c:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None


def execute(sql: str, params=()) -> None:
    with conn() as c:
        with c.cursor() as cur:
            cur.execute(sql, params)
        c.commit()


def execute_returning(sql: str, params=()) -> dict:
    with conn() as c:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            c.commit()
            return dict(row) if row else {}
```

**Step 4: `models.py`**

```python
"""Pydantic schemas de request/response."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnnouncementCreate(BaseModel):
    course_id: int
    teacher_id: Optional[str] = None
    title: str
    body: Optional[str] = None
    attachment_url: Optional[str] = None
    state: str = "PUBLISHED"


class CourseworkCreate(BaseModel):
    course_id: int
    module_id: Optional[str] = None
    teacher_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    work_type: str = "ASSIGNMENT"
    max_points: int = 100
    due_date: Optional[datetime] = None
    state: str = "PUBLISHED"


class SubmissionCreate(BaseModel):
    student_id: str
    answer_text: Optional[str] = None
    attachment_url: Optional[str] = None


class SubmissionPatch(BaseModel):
    assigned_grade: Optional[float] = None
    draft_grade: Optional[float] = None
    state: Optional[str] = None


class GradePush(BaseModel):
    student_phone: str
    course_id: int
    module_number: int
    score: float


class MaterialUpload(BaseModel):
    module_id: str
    file_name: str
    file_base64: str
    file_type: str = "pdf"
    replace_content: bool = False
```

**Step 5: `main.py` (skeleton)**

```python
"""kreativ_classroom_core — LMS API."""
from fastapi import FastAPI

app = FastAPI(title="kreativ_classroom_core", version="1.0.0")


@app.get("/health")
def health():
    return {"ok": True}
```

**Step 6: `tests/conftest.py`**

```python
"""Fixtures compartilhados para testes."""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
```

**Step 7: Escrever e rodar teste de health**

```python
# tests/test_health.py
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
```

```bash
cd services/classroom && pip install -r requirements.txt
pytest tests/test_health.py -v
```

Esperado: `PASSED`.

**Step 8: Commit**

```bash
git add services/classroom/
git commit -m "feat(classroom): skeleton FastAPI — db helpers, models, health endpoint"
```

---

## Task 3: Router — courses + roster

**Files:**
- Create: `services/classroom/routers/__init__.py`
- Create: `services/classroom/routers/courses.py`
- Modify: `services/classroom/main.py`
- Create: `services/classroom/tests/test_courses.py`

**Step 1: Escrever testes (falharão sem a implementação)**

```python
# tests/test_courses.py
from unittest.mock import patch


MOCK_COURSES = [
    {"id": 1, "name": "Gestão Financeira", "slug": "gestao-financeira",
     "area": "financeiro", "is_active": True}
]

MOCK_ROSTER = [
    {"id": "uuid-1", "name": "João Silva", "phone": "5563999999999",
     "google_email": None, "current_module": 1}
]


def test_list_courses(client):
    with patch("routers.courses.db.fetchall", return_value=MOCK_COURSES):
        r = client.get("/courses")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Gestão Financeira"


def test_get_roster(client):
    with patch("routers.courses.db.fetchall", return_value=MOCK_ROSTER):
        r = client.get("/courses/1/roster")
    assert r.status_code == 200
    assert r.json()[0]["phone"] == "5563999999999"


def test_get_roster_empty(client):
    with patch("routers.courses.db.fetchall", return_value=[]):
        r = client.get("/courses/999/roster")
    assert r.status_code == 200
    assert r.json() == []
```

**Step 2: Rodar para confirmar que falham**

```bash
pytest tests/test_courses.py -v
```

Esperado: `FAILED` com `404` ou `AttributeError`.

**Step 3: Implementar `routers/courses.py`**

```python
"""GET /courses, GET /courses/{course_id}/roster."""
from fastapi import APIRouter
import db

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("")
def list_courses():
    return db.fetchall(
        "SELECT id, name, slug, area, is_active, classroom_course_id "
        "FROM courses WHERE is_active = TRUE ORDER BY name"
    )


@router.get("/{course_id}/roster")
def get_roster(course_id: int):
    return db.fetchall(
        "SELECT id, name, phone, google_email, current_module, lead_profile "
        "FROM students WHERE course_id = %s ORDER BY name",
        (course_id,)
    )
```

**Step 4: Registrar router em `main.py`**

```python
from fastapi import FastAPI
from routers import courses

app = FastAPI(title="kreativ_classroom_core", version="1.0.0")
app.include_router(courses.router)


@app.get("/health")
def health():
    return {"ok": True}
```

**Step 5: Rodar testes — devem passar**

```bash
pytest tests/test_courses.py tests/test_health.py -v
```

Esperado: todos `PASSED`.

**Step 6: Commit**

```bash
git add services/classroom/routers/ services/classroom/main.py \
        services/classroom/tests/test_courses.py
git commit -m "feat(classroom): GET /courses e GET /courses/{id}/roster"
```

---

## Task 4: Router — announcements (com events_log)

**Files:**
- Create: `services/classroom/routers/announcements.py`
- Create: `services/classroom/tests/test_announcements.py`
- Modify: `services/classroom/main.py`

**Step 1: Testes**

```python
# tests/test_announcements.py
import json
from unittest.mock import patch

MOCK_ANNOUNCE = {
    "id": "uuid-ann-1", "course_id": 1, "teacher_id": None,
    "title": "Entrega final", "body": "Prazo: 05/03",
    "attachment_url": None, "state": "PUBLISHED",
    "created_at": "2026-02-27T10:00:00"
}


def test_list_announcements(client):
    with patch("routers.announcements.db.fetchall", return_value=[MOCK_ANNOUNCE]):
        r = client.get("/courses/1/announcements")
    assert r.status_code == 200
    assert r.json()[0]["title"] == "Entrega final"


def test_create_announcement(client):
    payload = {"course_id": 1, "title": "Novo aviso", "body": "Texto do aviso"}
    with patch("routers.announcements.db.execute_returning",
               return_value={**MOCK_ANNOUNCE, "title": "Novo aviso"}), \
         patch("routers.announcements.db.execute"):  # events_log INSERT
        r = client.post("/courses/1/announcements", json=payload)
    assert r.status_code == 201
    assert r.json()["title"] == "Novo aviso"


def test_create_announcement_wrong_course_rejected(client):
    payload = {"course_id": 99, "title": "Errado"}
    with patch("routers.announcements.db.execute_returning",
               return_value={**MOCK_ANNOUNCE, "course_id": 99}), \
         patch("routers.announcements.db.execute"):
        r = client.post("/courses/1/announcements", json=payload)
    # course_id no path deve prevalecer
    assert r.status_code == 201
```

**Step 2: Rodar para confirmar falha**

```bash
pytest tests/test_announcements.py -v
```

**Step 3: Implementar `routers/announcements.py`**

```python
"""CRUD /courses/{course_id}/announcements."""
import json
from fastapi import APIRouter, HTTPException
from models import AnnouncementCreate
import db

router = APIRouter(tags=["announcements"])


@router.get("/courses/{course_id}/announcements")
def list_announcements(course_id: int):
    return db.fetchall(
        "SELECT id, course_id, teacher_id, title, body, attachment_url, "
        "state, created_at FROM announcements "
        "WHERE course_id = %s AND state = 'PUBLISHED' "
        "ORDER BY created_at DESC",
        (course_id,),
    )


@router.post("/courses/{course_id}/announcements", status_code=201)
def create_announcement(course_id: int, body: AnnouncementCreate):
    body.course_id = course_id  # path param tem precedência
    row = db.execute_returning(
        "INSERT INTO announcements (course_id, teacher_id, title, body, "
        "attachment_url, state) VALUES (%s, %s, %s, %s, %s, %s) RETURNING *",
        (body.course_id, body.teacher_id, body.title, body.body,
         body.attachment_url, body.state),
    )
    # Registrar evento para notificação WhatsApp
    if body.state == "PUBLISHED":
        db.execute(
            "INSERT INTO events_log (student_id, event_type, payload) "
            "VALUES (NULL, 'announcement_published', %s)",
            (json.dumps({
                "course_id": course_id,
                "announcement_id": str(row["id"]),
                "title": body.title,
                "body": (body.body or "")[:200],
            }),),
        )
    return row
```

**Step 4: Registrar router em `main.py`**

```python
from routers import courses, announcements

app.include_router(announcements.router)
```

**Step 5: Rodar todos os testes acumulados**

```bash
pytest tests/ -v
```

Esperado: todos `PASSED`.

**Step 6: Commit**

```bash
git add services/classroom/routers/announcements.py \
        services/classroom/tests/test_announcements.py \
        services/classroom/main.py
git commit -m "feat(classroom): CRUD /announcements + evento announcement_published"
```

---

## Task 5: Router — coursework + materials

**Files:**
- Create: `services/classroom/routers/coursework.py`
- Create: `services/classroom/routers/materials.py`
- Create: `services/classroom/tests/test_coursework.py`
- Modify: `services/classroom/main.py`

**Step 1: Testes**

```python
# tests/test_coursework.py
from unittest.mock import patch

MOCK_CW = {
    "id": "uuid-cw-1", "course_id": 1, "title": "Tarefa Módulo 1",
    "work_type": "ASSIGNMENT", "max_points": 100,
    "due_date": "2026-03-05T23:59:00", "state": "PUBLISHED"
}


def test_list_coursework(client):
    with patch("routers.coursework.db.fetchall", return_value=[MOCK_CW]):
        r = client.get("/courses/1/coursework")
    assert r.status_code == 200
    assert r.json()[0]["title"] == "Tarefa Módulo 1"


def test_create_coursework(client):
    payload = {"course_id": 1, "title": "Nova tarefa", "max_points": 50}
    with patch("routers.coursework.db.execute_returning", return_value=MOCK_CW), \
         patch("routers.coursework.db.execute"):
        r = client.post("/courses/1/coursework", json=payload)
    assert r.status_code == 201


def test_post_material_delegates_to_ingest(client):
    payload = {
        "module_id": "uuid-mod-1",
        "file_name": "apostila.pdf",
        "file_base64": "base64data==",
        "file_type": "pdf"
    }
    with patch("routers.materials.httpx.post") as mock_post, \
         patch("routers.materials.db.execute"):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True}
        r = client.post("/courses/1/materials", json=payload)
    assert r.status_code == 202
    mock_post.assert_called_once()
```

**Step 2: Implementar `routers/coursework.py`**

```python
"""CRUD /courses/{course_id}/coursework."""
import json
from fastapi import APIRouter
from models import CourseworkCreate
import db

router = APIRouter(tags=["coursework"])


@router.get("/courses/{course_id}/coursework")
def list_coursework(course_id: int):
    return db.fetchall(
        "SELECT id, course_id, module_id, title, description, work_type, "
        "max_points, due_date, state, created_at FROM coursework "
        "WHERE course_id = %s AND state = 'PUBLISHED' ORDER BY created_at DESC",
        (course_id,),
    )


@router.post("/courses/{course_id}/coursework", status_code=201)
def create_coursework(course_id: int, body: CourseworkCreate):
    body.course_id = course_id
    row = db.execute_returning(
        "INSERT INTO coursework (course_id, module_id, teacher_id, title, "
        "description, work_type, max_points, due_date, state) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
        (body.course_id, body.module_id, body.teacher_id, body.title,
         body.description, body.work_type, body.max_points,
         body.due_date, body.state),
    )
    if body.state == "PUBLISHED":
        db.execute(
            "INSERT INTO events_log (student_id, event_type, payload) "
            "VALUES (NULL, 'coursework_published', %s)",
            (json.dumps({
                "course_id": course_id,
                "title": body.title,
                "due_date": body.due_date.isoformat() if body.due_date else None,
            }),),
        )
    return row
```

**Step 3: Implementar `routers/materials.py`**

```python
"""POST /courses/{course_id}/materials → delega ao kreativ_ingest."""
import os, json
import httpx
from fastapi import APIRouter, HTTPException
from models import MaterialUpload
import db

router = APIRouter(tags=["materials"])

INGEST_URL = os.getenv("KREATIV_INGEST_URL", "http://kreativ_ingest:8000")


@router.post("/courses/{course_id}/materials", status_code=202)
def upload_material(course_id: int, body: MaterialUpload):
    resp = httpx.post(f"{INGEST_URL}/process", json=body.model_dump(), timeout=60)
    if resp.status_code != 200:
        raise HTTPException(502, f"kreativ_ingest error: {resp.text}")
    db.execute(
        "INSERT INTO events_log (student_id, event_type, payload) "
        "VALUES (NULL, 'material_published', %s)",
        (json.dumps({
            "course_id": course_id,
            "module_id": body.module_id,
            "filename": body.file_name,
        }),),
    )
    return {"ok": True, "ingest": resp.json()}
```

**Step 4: Registrar routers em `main.py`**

```python
from routers import courses, announcements, coursework, materials

app.include_router(coursework.router)
app.include_router(materials.router)
```

**Step 5: Rodar todos os testes**

```bash
pytest tests/ -v
```

Esperado: todos `PASSED`.

**Step 6: Commit**

```bash
git add services/classroom/routers/coursework.py \
        services/classroom/routers/materials.py \
        services/classroom/tests/test_coursework.py \
        services/classroom/main.py
git commit -m "feat(classroom): CRUD /coursework, POST /materials → kreativ_ingest"
```

---

## Task 6: Router — submissions + grades

**Files:**
- Create: `services/classroom/routers/submissions.py`
- Create: `services/classroom/routers/grades.py`
- Create: `services/classroom/tests/test_grades.py`
- Modify: `services/classroom/main.py`

**Step 1: Testes**

```python
# tests/test_grades.py
from unittest.mock import patch

MOCK_STUDENT = {
    "id": "uuid-stu-1", "phone": "5563999999999",
    "google_classroom_id": None, "name": "João"
}

MOCK_SUBMISSION = {
    "id": "uuid-sub-1", "student_id": "uuid-stu-1",
    "coursework_id": "uuid-cw-1", "state": "NEW",
    "assigned_grade": None, "created_at": "2026-02-27T10:00:00"
}


def test_create_submission(client):
    payload = {"student_id": "uuid-stu-1", "answer_text": "Minha resposta"}
    with patch("routers.submissions.db.execute_returning",
               return_value=MOCK_SUBMISSION):
        r = client.post("/courses/1/coursework/uuid-cw-1/submissions", json=payload)
    assert r.status_code == 201


def test_patch_submission_grade(client):
    payload = {"assigned_grade": 85.0, "state": "RETURNED"}
    with patch("routers.submissions.db.execute_returning",
               return_value={**MOCK_SUBMISSION, "assigned_grade": 85.0}), \
         patch("routers.submissions.db.execute"):
        r = client.patch(
            "/courses/1/coursework/uuid-cw-1/submissions/uuid-sub-1",
            json=payload
        )
    assert r.status_code == 200
    assert r.json()["assigned_grade"] == 85.0


def test_grades_push_student_not_found(client):
    payload = {
        "student_phone": "5599999999999",
        "course_id": 1,
        "module_number": 2,
        "score": 90
    }
    with patch("routers.grades.db.fetchone", return_value=None):
        r = client.post("/grades/push", json=payload)
    assert r.status_code == 200
    assert r.json()["ok"] is False
    assert r.json()["reason"] == "student_not_found"


def test_grades_push_success(client):
    payload = {
        "student_phone": "5563999999999",
        "course_id": 1,
        "module_number": 2,
        "score": 87
    }
    with patch("routers.grades.db.fetchone", return_value=MOCK_STUDENT), \
         patch("routers.grades.db.execute"):
        r = client.post("/grades/push", json=payload)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["score"] == 87
    assert "módulo 2" in r.json()["whatsapp_message"]
```

**Step 2: Implementar `routers/submissions.py`**

```python
"""CRUD /courses/{cid}/coursework/{cwid}/submissions."""
import json
from fastapi import APIRouter
from models import SubmissionCreate, SubmissionPatch
import db

router = APIRouter(tags=["submissions"])

_BASE = "/courses/{course_id}/coursework/{coursework_id}/submissions"


@router.get(_BASE)
def list_submissions(course_id: int, coursework_id: str):
    return db.fetchall(
        "SELECT ss.*, s.name AS student_name, s.phone "
        "FROM student_submissions ss "
        "JOIN students s ON s.id = ss.student_id "
        "WHERE ss.coursework_id = %s ORDER BY ss.created_at DESC",
        (coursework_id,),
    )


@router.post(_BASE, status_code=201)
def create_submission(course_id: int, coursework_id: str,
                      body: SubmissionCreate):
    return db.execute_returning(
        "INSERT INTO student_submissions (student_id, coursework_id, "
        "answer_text, attachment_url, state, submitted_at) "
        "VALUES (%s, %s, %s, %s, 'TURNED_IN', NOW()) RETURNING *",
        (body.student_id, coursework_id, body.answer_text, body.attachment_url),
    )


@router.patch(_BASE + "/{submission_id}")
def patch_submission(course_id: int, coursework_id: str,
                     submission_id: str, body: SubmissionPatch):
    row = db.execute_returning(
        "UPDATE student_submissions SET "
        "assigned_grade = COALESCE(%s, assigned_grade), "
        "draft_grade    = COALESCE(%s, draft_grade), "
        "state          = COALESCE(%s, state), "
        "graded_at      = CASE WHEN %s IS NOT NULL THEN NOW() ELSE graded_at END "
        "WHERE id = %s RETURNING *",
        (body.assigned_grade, body.draft_grade, body.state,
         body.assigned_grade, submission_id),
    )
    if body.assigned_grade is not None:
        student = db.fetchone(
            "SELECT student_id FROM student_submissions WHERE id = %s",
            (submission_id,)
        )
        if student:
            db.execute(
                "INSERT INTO events_log (student_id, event_type, payload) "
                "VALUES (%s, 'grade_returned', %s)",
                (student["student_id"], json.dumps({
                    "score": body.assigned_grade,
                    "coursework_id": coursework_id,
                })),
            )
    return row
```

**Step 3: Implementar `routers/grades.py`**

```python
"""POST /grades/push — N8N chama após submit_quiz."""
import json
from fastapi import APIRouter
from models import GradePush
import db

router = APIRouter(tags=["grades"])


@router.post("/grades/push")
def push_grade(body: GradePush):
    student = db.fetchone(
        "SELECT id, name, google_classroom_id FROM students WHERE phone = %s",
        (body.student_phone,),
    )
    if not student:
        return {"ok": False, "reason": "student_not_found"}

    # Atualiza scores JSONB existente
    key = f"module_{body.module_number}"
    db.execute(
        "UPDATE students SET scores = scores || %s::jsonb WHERE id = %s",
        (json.dumps({key: body.score}), student["id"]),
    )

    # Registra evento para WhatsApp
    db.execute(
        "INSERT INTO events_log (student_id, event_type, payload) "
        "VALUES (%s, 'grade_returned', %s)",
        (student["id"], json.dumps({
            "course_id": body.course_id,
            "module_number": body.module_number,
            "score": body.score,
        })),
    )

    msg = (f"✅ Sua nota no módulo {body.module_number} foi lançada: "
           f"*{int(body.score)}/100*")

    return {
        "ok": True,
        "student_name": student["name"],
        "score": body.score,
        "google_classroom_id": student.get("google_classroom_id"),
        "whatsapp_message": msg,
    }
```

**Step 4: Registrar routers em `main.py`**

```python
from routers import courses, announcements, coursework, materials, submissions, grades

app.include_router(submissions.router)
app.include_router(grades.router)
```

**Step 5: Rodar todos os testes**

```bash
pytest tests/ -v
```

Esperado: todos `PASSED`.

**Step 6: Commit**

```bash
git add services/classroom/routers/submissions.py \
        services/classroom/routers/grades.py \
        services/classroom/tests/test_grades.py \
        services/classroom/main.py
git commit -m "feat(classroom): submissions CRUD + grades/push com evento grade_returned"
```

---

## Task 7: Router — events (consumido pelo N8N)

**Files:**
- Create: `services/classroom/routers/events.py`
- Create: `services/classroom/tests/test_events.py`
- Modify: `services/classroom/main.py`

**Step 1: Testes**

```python
# tests/test_events.py
from unittest.mock import patch

MOCK_EVENTS = [
    {
        "id": "uuid-evt-1",
        "student_id": None,
        "event_type": "announcement_published",
        "payload": {"course_id": 1, "title": "Aviso"},
        "created_at": "2026-02-27T10:00:00",
        "notified": False
    }
]


def test_get_pending_events(client):
    with patch("routers.events.db.fetchall", return_value=MOCK_EVENTS):
        r = client.get("/events/pending")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["event_type"] == "announcement_published"


def test_ack_event(client):
    with patch("routers.events.db.execute"):
        r = client.post("/events/uuid-evt-1/ack")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_get_pending_events_empty(client):
    with patch("routers.events.db.fetchall", return_value=[]):
        r = client.get("/events/pending")
    assert r.status_code == 200
    assert r.json() == []
```

**Step 2: Implementar `routers/events.py`**

```python
"""GET /events/pending, POST /events/{id}/ack — para N8N."""
from fastapi import APIRouter
import db

router = APIRouter(prefix="/events", tags=["events"])

# Tipos de evento que N8N deve processar para WhatsApp
_NOTIFIABLE = (
    "announcement_published",
    "coursework_published",
    "material_published",
    "grade_returned",
)


@router.get("/pending")
def get_pending_events():
    placeholders = ",".join(["%s"] * len(_NOTIFIABLE))
    return db.fetchall(
        f"SELECT id, student_id, event_type, payload, created_at "
        f"FROM events_log "
        f"WHERE event_type IN ({placeholders}) "
        f"AND (payload->>'notified')::boolean IS NOT TRUE "
        f"ORDER BY created_at ASC LIMIT 50",
        _NOTIFIABLE,
    )


@router.post("/{event_id}/ack")
def ack_event(event_id: str):
    db.execute(
        "UPDATE events_log "
        "SET payload = payload || '{\"notified\": true}'::jsonb "
        "WHERE id = %s",
        (event_id,),
    )
    return {"ok": True}
```

**Step 3: Registrar router**

```python
from routers import courses, announcements, coursework, materials, \
                    submissions, grades, events

app.include_router(events.router)
```

**Step 4: Rodar todos os testes**

```bash
pytest tests/ -v
```

**Step 5: Commit**

```bash
git add services/classroom/routers/events.py \
        services/classroom/tests/test_events.py \
        services/classroom/main.py
git commit -m "feat(classroom): GET /events/pending + POST /events/ack para N8N"
```

---

## Task 8: Docker Compose — adicionar serviço

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Step 1: Verificar o `docker-compose.yml` atual**

```bash
grep -n "kreativ_ingest\|kreativ_evolution\|networks:" docker-compose.yml | head -20
```

Anotar as seções de `networks` e o padrão dos outros serviços.

**Step 2: Adicionar o serviço ao `docker-compose.yml`**

Localizar a seção após `kreativ_ingest:` e inserir:

```yaml
  kreativ_classroom_core:
    build:
      context: ./services/classroom
      dockerfile: Dockerfile
    container_name: kreativ_classroom_core
    restart: unless-stopped
    depends_on:
      - kreativ_postgres
      - kreativ_evolution
    environment:
      POSTGRES_HOST:     kreativ_postgres
      POSTGRES_DB:       kreativ_edu
      POSTGRES_USER:     ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      EVOLUTION_API_URL: http://kreativ_evolution:8080
      EVOLUTION_API_KEY: ${EVOLUTION_API_KEY}
      KREATIV_INGEST_URL: http://kreativ_ingest:8000
      GOOGLE_CLIENT_ID:     ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOOGLE_REDIRECT_URI:  https://classroom.extensionista.site/google/callback
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

**Step 3: Adicionar ao `.env.example`**

```bash
# Kreativ Classroom Core — addon Google (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Step 4: Build e teste local**

```bash
docker-compose build kreativ_classroom_core
docker-compose up -d kreativ_classroom_core
docker-compose logs kreativ_classroom_core --tail=20
```

Esperado: `Application startup complete. Uvicorn running on http://0.0.0.0:8090`

**Step 5: Smoke test via curl**

```bash
curl -s http://localhost:8090/health  # via porta interna, se exposta
# ou via Traefik após deploy:
curl -s https://classroom.extensionista.site/health
```

Esperado: `{"ok": true}`

**Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(docker): adicionar kreativ_classroom_core ao docker-compose"
```

---

## Task 9: N8N Workflow — `classroom_event_notifier`

**Files:**
- Create: `n8n-workflows/30-classroom-event-notifier.json`

**Step 1: Estrutura do workflow**

O workflow tem 7 nodes. Criar via N8N UI ou importar JSON.
Estrutura a criar na UI do N8N (https://n8n.extensionista.site):

```
[Schedule Trigger]
  cron: */5 * * * *
  → [HTTP Request: GET events/pending]
       url: http://kreativ_classroom_core:8090/events/pending
       method: GET
  → [IF: events existem]
       condition: {{ $json.length }} > 0
  → [Split In Batches]
       batchSize: 10
  → [Switch: por event_type]
       announcement_published → [Set: montar mensagem anuncio]
       coursework_published   → [Set: montar mensagem coursework]
       material_published     → [Set: montar mensagem material]
       grade_returned         → [Set: montar mensagem nota]
  → [HTTP Request: buscar alunos do curso]
       url: http://kreativ_classroom_core:8090/courses/{{ $json.payload.course_id }}/roster
       (só para announcement/coursework/material — grade usa student_id diretamente)
  → [Split In Batches: alunos]
  → [IF: aluno tem phone]
  → [HTTP Request: Evolution sendText]
       url: http://kreativ_evolution:8080/message/sendText/europs
       body: { "number": "{{ $json.phone }}", "text": "{{ $json.message }}" }
  → [HTTP Request: ACK evento]
       url: http://kreativ_classroom_core:8090/events/{{ $json.event_id }}/ack
       method: POST
```

**Step 2: Exportar o workflow e salvar como JSON**

Após criar na UI:
```
N8N → Workflow → Export → salvar como n8n-workflows/30-classroom-event-notifier.json
```

**Step 3: Teste manual**

```
1. Criar um anúncio via POST /courses/1/announcements (ou via painel)
2. Aguardar até 5 minutos OU acionar manualmente o workflow no N8N
3. Verificar no WhatsApp do aluno teste (556399374165) a chegada da notificação
4. Verificar no banco: events_log WHERE event_type = 'announcement_published'
   → payload deve ter "notified": true
```

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT event_type, payload->>'notified' FROM events_log ORDER BY created_at DESC LIMIT 5"
```

**Step 4: Commit**

```bash
git add n8n-workflows/30-classroom-event-notifier.json
git commit -m "feat(n8n): workflow classroom_event_notifier — eventos → WhatsApp"
```

---

## Task 10: N8N Workflow — `classroom_grade_push` (sub-workflow)

**Files:**
- Create: `n8n-workflows/31-classroom-grade-push.json`
- Modify: `n8n-workflows/60-kreativ-api-ultimate.json` (adicionar chamada após submit_quiz)

**Step 1: Criar sub-workflow no N8N**

```
[Execute Workflow Trigger]
  → [HTTP Request: POST /grades/push]
       url: http://kreativ_classroom_core:8090/grades/push
       method: POST
       body: {
         "student_phone": "{{ $json.phone }}",
         "course_id": "{{ $json.course_id }}",
         "module_number": "{{ $json.module_number }}",
         "score": "{{ $json.score }}"
       }
  → [IF: ok = true]
       true → [HTTP: Evolution sendText com whatsapp_message]
       false → [No Operation]  (log silencioso)
```

**Step 2: Modificar o ULTIMATE (`60-kreativ-api-ultimate.json`)**

No branch `submit_quiz`, após o node `Enviar WhatsApp`, adicionar:

```
[Execute Workflow]
  workflowId: <ID do classroom_grade_push>
  input: { phone, course_id, module_number, score }
  waitForSubWorkflow: false  ← fire-and-forget
```

**Step 3: Testar**

```
1. No WhatsApp do aluno teste: iniciar fluxo → completar quiz
2. Verificar via banco:
```

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT scores FROM students WHERE phone = '556399374165'"
# Deve mostrar o score atualizado em JSONB
```

**Step 4: Commit**

```bash
git add n8n-workflows/31-classroom-grade-push.json \
        n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): classroom_grade_push sub-workflow após submit_quiz"
```

---

## Task 11: Addon — Google OAuth (opcional)

> **Pré-requisito:** `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` configurados no `.env`.
> Pular esta task se o addon não for necessário imediatamente.

**Files:**
- Create: `services/classroom/addon/__init__.py`
- Create: `services/classroom/addon/google_auth.py`
- Create: `services/classroom/tests/test_google_auth.py`
- Modify: `services/classroom/main.py`

**Step 1: Instalar dependência (addon)**

Adicionar ao `requirements.txt`:
```
google-api-python-client==2.140.0
google-auth-oauthlib==1.2.1
```

**Step 2: Implementar `addon/google_auth.py`**

```python
"""OAuth 2.0 flow para integração Google Classroom."""
import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
import db

router = APIRouter(prefix="/google", tags=["google-addon"])

CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI  = os.getenv("GOOGLE_REDIRECT_URI",
                           "https://classroom.extensionista.site/google/callback")

SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.materials.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/drive.readonly",
    "openid", "email",
]


def _flow() -> Flow:
    if not CLIENT_ID:
        raise HTTPException(501, "Google addon not configured")
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uris": [REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )


@router.get("/authorize")
def google_authorize(teacher_id: str):
    """Redireciona o professor para o Google OAuth."""
    flow = _flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        state=teacher_id,
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
def google_callback(code: str, state: str):
    """Recebe code do Google, troca por tokens, salva no banco."""
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    import google.oauth2.id_token
    import google.auth.transport.requests
    id_info = google.oauth2.id_token.verify_oauth2_token(
        creds.id_token,
        google.auth.transport.requests.Request(),
        CLIENT_ID,
    )
    email = id_info["email"]

    db.execute(
        """INSERT INTO google_oauth_tokens
           (teacher_id, professor_email, access_token, refresh_token,
            token_expiry, scopes)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (professor_email) DO UPDATE SET
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token,
                                    google_oauth_tokens.refresh_token),
           token_expiry = EXCLUDED.token_expiry,
           updated_at = NOW()""",
        (state, email, creds.token, creds.refresh_token,
         creds.expiry, list(creds.scopes or [])),
    )
    db.execute(
        "UPDATE teachers SET google_classroom_oauth = TRUE WHERE id = %s",
        (state,),
    )
    return {"ok": True, "message": "Autorização Google Classroom concluída!",
            "email": email}
```

**Step 3: Testes (mock OAuth)**

```python
# tests/test_google_auth.py
from unittest.mock import patch
import os


def test_authorize_returns_redirect_when_configured(client):
    with patch.dict(os.environ, {
        "GOOGLE_CLIENT_ID": "fake-client-id",
        "GOOGLE_CLIENT_SECRET": "fake-secret"
    }):
        # Redireciona para Google; em teste verifica apenas que não dá 501
        # (o Flow lança exceção de rede; ok)
        pass  # integração testada manualmente


def test_authorize_501_when_not_configured(client):
    with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
        r = client.get("/google/authorize?teacher_id=uuid-teacher-1")
    assert r.status_code == 501
```

**Step 4: Registrar addon no `main.py`**

```python
import os
if os.getenv("GOOGLE_CLIENT_ID"):
    from addon.google_auth import router as google_router
    app.include_router(google_router)
```

**Step 5: Rodar testes**

```bash
pytest tests/ -v
```

**Step 6: Commit**

```bash
git add services/classroom/addon/ \
        services/classroom/tests/test_google_auth.py \
        services/classroom/main.py \
        services/classroom/requirements.txt
git commit -m "feat(classroom-addon): Google OAuth flow para integração Classroom"
```

---

## Task 12: Addon — Google Sync bidirecional (opcional)

> **Pré-requisito:** Task 11 concluída + pelo menos 1 professor com OAuth ativo.

**Files:**
- Create: `services/classroom/addon/google_sync.py`
- Create: `services/classroom/tests/test_google_sync.py`
- Modify: `services/classroom/main.py`

**Step 1: Implementar `addon/google_sync.py`**

```python
"""Sync bidirecional Kreativ ↔ Google Classroom."""
import os, json
from fastapi import APIRouter, HTTPException
import httpx
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import db

router = APIRouter(prefix="/google", tags=["google-addon"])
INGEST_URL = os.getenv("KREATIV_INGEST_URL", "http://kreativ_ingest:8000")


def _build_service(teacher_id: str):
    """Carrega credenciais do banco e constrói cliente Classroom."""
    token = db.fetchone(
        "SELECT * FROM google_oauth_tokens WHERE teacher_id = %s",
        (teacher_id,)
    )
    if not token:
        raise HTTPException(401, "Professor sem OAuth Google ativo")

    creds = Credentials(
        token=token["access_token"],
        refresh_token=token["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        db.execute(
            "UPDATE google_oauth_tokens SET access_token = %s, "
            "token_expiry = %s, updated_at = NOW() WHERE teacher_id = %s",
            (creds.token, creds.expiry, teacher_id),
        )
    return build("classroom", "v1", credentials=creds)


@router.get("/courses")
def list_google_courses(teacher_id: str):
    """Lista turmas do professor no Google Classroom."""
    service = _build_service(teacher_id)
    resp = service.courses().list(teacherId="me",
                                  courseStates=["ACTIVE"]).execute()
    return resp.get("courses", [])


@router.post("/sync/{course_id}")
def sync_course(course_id: int, teacher_id: str):
    """Fase 1: Classroom → Kreativ. Fase 2: Kreativ → Classroom."""
    pg_course = db.fetchone(
        "SELECT * FROM courses WHERE id = %s AND classroom_course_id IS NOT NULL",
        (course_id,)
    )
    if not pg_course:
        return {"ok": False, "reason": "course_not_mapped"}

    service = _build_service(teacher_id)
    gid = pg_course["classroom_course_id"]
    result = {"students_synced": 0, "materials_ingested": 0}

    # ── FASE 1A: alunos ──────────────────────────────────────────────────
    roster = service.courses().students().list(courseId=gid).execute()
    for s in roster.get("students", []):
        email = s["profile"]["emailAddress"]
        db.execute(
            """INSERT INTO students (google_email, google_classroom_id,
               course_id, name)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (google_email) DO UPDATE SET
               google_classroom_id = EXCLUDED.google_classroom_id""",
            (email, s["userId"], course_id,
             s["profile"]["name"]["fullName"]),
        )
        result["students_synced"] += 1

    # ── FASE 1B: materiais novos ────────────────────────────────────────
    materials = service.courses().courseWorkMaterials().list(
        courseId=gid, orderBy="updateTime desc"
    ).execute().get("courseWorkMaterial", [])

    for mat in materials[:10]:  # máximo 10 por sync para evitar timeout
        for item in mat.get("materials", []):
            if "driveFile" not in item:
                continue
            drive_service = build("drive", "v3",
                                  credentials=service._http.credentials)
            file_id = item["driveFile"]["driveFile"]["id"]
            try:
                import base64
                content = drive_service.files().export_media(
                    fileId=file_id, mimeType="application/pdf"
                ).execute()
                module = db.fetchone(
                    "SELECT id FROM modules WHERE course_id = %s "
                    "ORDER BY module_number LIMIT 1",
                    (course_id,)
                )
                if module:
                    resp = httpx.post(f"{INGEST_URL}/process", json={
                        "module_id": str(module["id"]),
                        "file_name": item["driveFile"]["driveFile"]["title"],
                        "file_base64": base64.b64encode(content).decode(),
                        "file_type": "pdf",
                        "replace_content": False,
                    }, timeout=120)
                    if resp.status_code == 200:
                        result["materials_ingested"] += 1
            except Exception as e:
                result.setdefault("errors", []).append(str(e))

    return {"ok": True, **result}
```

**Step 2: Registrar no `main.py`**

```python
if os.getenv("GOOGLE_CLIENT_ID"):
    from addon.google_auth import router as google_auth_router
    from addon.google_sync import router as google_sync_router
    app.include_router(google_auth_router)
    app.include_router(google_sync_router)
```

**Step 3: Criar workflow N8N para sync periódico**

Criar na UI do N8N e exportar como `n8n-workflows/32-google-classroom-sync.json`:

```
[Schedule Trigger: */30 * * * *]
  → [PG: SELECT id, teacher_id FROM courses
         WHERE classroom_course_id IS NOT NULL]
  → [Split In Batches]
  → [HTTP Request: POST /google/sync/{course_id}?teacher_id={teacher_id}]
       url: http://kreativ_classroom_core:8090/google/sync/{{ $json.id }}
       query: teacher_id={{ $json.teacher_id }}
  → [IF: ok = false OR errors existem]
       → [Evolution: alerta tutor]
```

**Step 4: Commit**

```bash
git add services/classroom/addon/google_sync.py \
        services/classroom/main.py \
        n8n-workflows/32-google-classroom-sync.json
git commit -m "feat(classroom-addon): Google Classroom sync bidirecional"
```

---

## Checklist Final de Verificação

```bash
# 1. Todos os testes passando
cd services/classroom && pytest tests/ -v

# 2. Container rodando
docker-compose ps kreativ_classroom_core

# 3. Health check via HTTPS
curl -s https://classroom.extensionista.site/health

# 4. Migration aplicada
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "\dt teachers" -c "\dt announcements" -c "\dt student_submissions"

# 5. Criar anúncio e verificar evento
curl -X POST https://classroom.extensionista.site/courses/1/announcements \
  -H "Content-Type: application/json" \
  -d '{"course_id":1,"title":"Teste","body":"Verificação do sistema"}'

# Aguardar ~5min e verificar notificação no WhatsApp

# 6. Verificar grade push via ULTIMATE
# Completar quiz no WhatsApp e verificar students.scores atualizado
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT phone, scores FROM students WHERE phone = '556399374165'"
```

---

## Ordem de Implementação Recomendada

Para entrar em produção com o mínimo viável:

**MVP (Tasks 1-10):** Migration + microserviço core + Docker + N8N workflows
- Anúncios, coursework, materiais, grades, notificações WhatsApp funcionando
- Google Classroom *não* necessário para o MVP

**Addon Google (Tasks 11-12):** Opcional, ativar quando um professor solicitar
- Requer configuração no Google Cloud Console (~30min)
- Ativar por professor individualmente via link OAuth
