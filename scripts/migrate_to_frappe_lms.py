#!/usr/bin/env python3
"""
migrate_to_frappe_lms.py — Migração de dados do PostgreSQL → Frappe LMS

Migra os dados existentes do banco kreativ_edu (PostgreSQL) para o
Frappe LMS via REST API.

ORDEM DE EXECUÇÃO:
  1. Configure .env.frappe com FRAPPE_API_KEY e FRAPPE_API_SECRET
  2. Garanta que o Frappe LMS está rodando (docker compose -f docker-compose.frappe.yml up -d)
  3. Execute: python3 scripts/migrate_to_frappe_lms.py

DADOS MIGRADOS:
  - Cursos (courses → LMS Course)
  - Módulos (modules → LMS Chapter + LMS Lesson)
  - Alunos ativos (students → Frappe User + LMS Enrollment)
  - Pré-inscritos (pre_inscriptions → Frappe User, sem matrícula)
  - Quizzes (quiz_questions → LMS Quiz + LMS Quiz Question)
"""

import os
import sys
import json
import time
import psycopg2
import requests
from datetime import datetime
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------
load_dotenv(".env")
load_dotenv(".env.frappe", override=True)

PG_CONN = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname": os.getenv("POSTGRES_DB", "kreativ_edu"),
    "user": os.getenv("POSTGRES_USER", "kreativ_user"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

FRAPPE_URL   = os.getenv("FRAPPE_LMS_URL", "https://lms.extensionista.site")
FRAPPE_KEY   = os.getenv("FRAPPE_API_KEY", "")
FRAPPE_SECRET = os.getenv("FRAPPE_API_SECRET", "")

if not FRAPPE_KEY or not FRAPPE_SECRET:
    print("❌ FRAPPE_API_KEY e FRAPPE_API_SECRET são obrigatórios no .env.frappe")
    sys.exit(1)

HEADERS = {
    "Authorization": f"token {FRAPPE_KEY}:{FRAPPE_SECRET}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def frappe_post(doctype: str, data: dict) -> dict | None:
    """Cria um documento no Frappe LMS via REST API. Retorna None se já existir."""
    url = f"{FRAPPE_URL}/api/resource/{doctype}"
    try:
        resp = requests.post(url, headers=HEADERS, json=data, timeout=30)
        if resp.status_code == 200:
            return resp.json().get("data")
        elif resp.status_code == 409:
            print(f"   ⚠️  Já existe: {doctype} — {data.get('name', data.get('title', ''))}")
            return None
        else:
            print(f"   ❌ Erro {resp.status_code} ao criar {doctype}: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"   ❌ Exceção ao criar {doctype}: {e}")
        return None


def frappe_get(doctype: str, filters: dict = None) -> list:
    """Lista documentos do Frappe LMS."""
    url = f"{FRAPPE_URL}/api/resource/{doctype}"
    params = {"limit_page_length": 500}
    if filters:
        params["filters"] = json.dumps(filters)
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        if resp.status_code == 200:
            return resp.json().get("data", [])
        return []
    except Exception:
        return []


# ---------------------------------------------------------------------------
# ETAPA 1 — Migrar Cursos
# ---------------------------------------------------------------------------
def migrate_courses(cur) -> dict:
    """Migra courses → LMS Course. Retorna mapeamento {pg_id: frappe_name}."""
    print("\n📚 [1/5] Migrando Cursos...")
    cur.execute("SELECT id, title, description, created_at FROM courses ORDER BY id")
    courses = cur.fetchall()
    mapping = {}

    for c in courses:
        cid, title, desc, created = c
        slug = title.lower().replace(" ", "-").replace("/", "-")[:50]

        data = {
            "course_name": title[:140],
            "short_introduction": (desc or "")[:255],
            "description": desc or "",
            "published": 1,
            "paid_course": 0,
        }

        result = frappe_post("LMS Course", data)
        if result:
            mapping[cid] = result["name"]
            print(f"   ✅ Curso criado: {title}")
        else:
            # Tentar buscar pelo nome se já existe
            existing = frappe_get("LMS Course", {"course_name": title})
            if existing:
                mapping[cid] = existing[0]["name"]
                print(f"   ↩️  Curso reutilizado: {title}")

        time.sleep(0.2)  # throttle gentil na API

    print(f"   Total cursos mapeados: {len(mapping)}/{len(courses)}")
    return mapping


# ---------------------------------------------------------------------------
# ETAPA 2 — Migrar Módulos (→ Chapter + Lesson)
# ---------------------------------------------------------------------------
def migrate_modules(cur, course_map: dict) -> dict:
    """Migra modules → LMS Chapter + LMS Lesson. Retorna mapeamento {pg_id: lesson_name}."""
    print("\n📖 [2/5] Migrando Módulos...")
    cur.execute("""
        SELECT id, course_int_id, title, content_text, module_number
        FROM modules
        ORDER BY course_int_id, module_number
    """)
    modules = cur.fetchall()
    lesson_map = {}

    current_course = None
    chapter_name = None

    for m in modules:
        mid, course_id, title, content, mod_num = m
        frappe_course = course_map.get(course_id)
        if not frappe_course:
            print(f"   ⚠️  Módulo {title}: curso PG ID {course_id} não encontrado no mapeamento")
            continue

        # Criar Chapter apenas quando o curso muda
        if current_course != frappe_course:
            chapter_data = {
                "chapter_name": f"Módulos — {frappe_course}",
                "course": frappe_course,
            }
            ch = frappe_post("Course Chapter", chapter_data)
            if ch:
                chapter_name = ch["name"]
            else:
                existing_ch = frappe_get("Course Chapter", {"course": frappe_course})
                chapter_name = existing_ch[0]["name"] if existing_ch else None
            current_course = frappe_course

        if not chapter_name:
            print(f"   ❌ Sem capítulo para o módulo {title}")
            continue

        # Criar Lesson
        lesson_data = {
            "title": title[:140],
            "chapter": chapter_name,
            "content": content or "",
            "course": frappe_course,
        }

        lesson = frappe_post("Course Lesson", lesson_data)
        if lesson:
            lesson_map[mid] = lesson["name"]
            print(f"   ✅ Módulo: {title} → Lição no Frappe")
        else:
            existing_l = frappe_get("Course Lesson", {"title": title, "chapter": chapter_name})
            if existing_l:
                lesson_map[mid] = existing_l[0]["name"]

        time.sleep(0.2)

    print(f"   Total módulos migrados: {len(lesson_map)}/{len(modules)}")
    return lesson_map


# ---------------------------------------------------------------------------
# ETAPA 3 — Migrar Alunos Ativos
# ---------------------------------------------------------------------------
def migrate_students(cur, course_map: dict):
    """Migra students → Frappe User + LMS Enrollment."""
    print("\n👥 [3/5] Migrando Alunos Ativos...")
    cur.execute("""
        SELECT s.phone, s.name, s.email, s.course_id, s.created_at
        FROM students s
        ORDER BY s.created_at
    """)
    students = cur.fetchall()

    for phone, name, email, course_id, created in students:
        # Email fallback: usar telefone como domínio interno se não tiver email real
        safe_email = email if email and "@" in email else f"{phone.replace('+','').replace(' ','')}@aluno.kreativ.edu.br"

        user_data = {
            "email": safe_email,
            "first_name": (name or "Aluno").split()[0],
            "last_name": " ".join((name or "Aluno").split()[1:]) or "Kreativ",
            "send_welcome_email": 0,
            "role_profile_name": "LMS Student",
            "enabled": 1,
        }

        user = frappe_post("User", user_data)
        user_email = safe_email

        # Matricular no curso
        frappe_course = course_map.get(course_id)
        if frappe_course:
            enroll_data = {
                "student": user_email,
                "course": frappe_course,
                "enrollment_date": (created or datetime.now()).strftime("%Y-%m-%d"),
            }
            frappe_post("LMS Enrollment", enroll_data)
            print(f"   ✅ Aluno: {name or phone} → matriculado em {frappe_course}")
        else:
            print(f"   ⚠️  Aluno {name or phone}: curso não mapeado ({course_id})")

        time.sleep(0.2)

    print(f"   Total alunos processados: {len(students)}")


# ---------------------------------------------------------------------------
# ETAPA 4 — Migrar Pré-inscritos (sem matrícula)
# ---------------------------------------------------------------------------
def migrate_pre_inscriptions(cur):
    """Migra pre_inscriptions → Frappe User (sem LMS Enrollment)."""
    print("\n📋 [4/5] Migrando Pré-inscritos...")
    cur.execute("""
        SELECT DISTINCT phone, name, email
        FROM pre_inscriptions
        WHERE phone IS NOT NULL
        LIMIT 508
    """)
    pre = cur.fetchall()

    created = 0
    for phone, name, email in pre:
        safe_email = email if email and "@" in email else f"pre_{phone.replace('+','').replace(' ','')}@preinscrito.kreativ.edu.br"

        user_data = {
            "email": safe_email,
            "first_name": (name or "Interessado").split()[0],
            "last_name": " ".join((name or "Interessado").split()[1:]) or "Pré-inscrito",
            "send_welcome_email": 0,
            "enabled": 0,  # desativado até matrícula formal
        }

        result = frappe_post("User", user_data)
        if result:
            created += 1

        time.sleep(0.1)

    print(f"   Pré-inscritos criados: {created}/{len(pre)}")


# ---------------------------------------------------------------------------
# ETAPA 5 — Migrar Quizzes
# ---------------------------------------------------------------------------
def migrate_quizzes(cur, lesson_map: dict):
    """Migra quiz_questions → LMS Quiz + LMS Quiz Question."""
    print("\n🧠 [5/5] Migrando Quizzes...")
    cur.execute("""
        SELECT id, module_id, questions
        FROM quiz_questions
        WHERE questions IS NOT NULL
        ORDER BY module_id
    """)
    quizzes = cur.fetchall()

    for qid, module_id, questions_json in quizzes:
        lesson_name = lesson_map.get(module_id)
        if not lesson_name:
            print(f"   ⚠️  Quiz {qid}: módulo {module_id} não encontrado")
            continue

        questions = questions_json if isinstance(questions_json, list) else []

        # Criar Quiz
        quiz_data = {
            "title": f"Quiz — Módulo {module_id}",
            "passing_percentage": 70,
        }
        quiz = frappe_post("LMS Quiz", quiz_data)
        quiz_name = quiz["name"] if quiz else None

        if not quiz_name:
            existing = frappe_get("LMS Quiz", {"title": f"Quiz — Módulo {module_id}"})
            quiz_name = existing[0]["name"] if existing else None

        if quiz_name:
            # Criar perguntas
            for q in questions:
                q_data = {
                    "quiz": quiz_name,
                    "question": q.get("question", "Pergunta sem texto")[:500],
                    "type": "Single Correct Answer",
                    "options": [
                        {"option": opt, "is_correct": (opt == q.get("correct_answer"))}
                        for opt in q.get("options", [])
                    ],
                }
                frappe_post("LMS Quiz Question", q_data)
                time.sleep(0.1)

            print(f"   ✅ Quiz do módulo {module_id}: {len(questions)} questões")

    print(f"   Total quizzes processados: {len(quizzes)}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print(" Kreativ Educação — Migração PostgreSQL → Frappe LMS")
    print(f" Destino: {FRAPPE_URL}")
    print("=" * 60)

    # Verificar acesso ao Frappe
    test = requests.get(f"{FRAPPE_URL}/api/method/ping", headers=HEADERS, timeout=10)
    if test.status_code != 200:
        print(f"❌ Frappe LMS inacessível em {FRAPPE_URL} (status {test.status_code})")
        print("   Verifique se os containers estão rodando e as credenciais estão corretas.")
        sys.exit(1)
    print(f"✅ Frappe LMS acessível\n")

    # Conectar ao PostgreSQL
    try:
        conn = psycopg2.connect(**PG_CONN)
        cur = conn.cursor()
        print(f"✅ PostgreSQL conectado: {PG_CONN['dbname']}@{PG_CONN['host']}\n")
    except Exception as e:
        print(f"❌ Falha ao conectar no PostgreSQL: {e}")
        sys.exit(1)

    # Executar migrações em ordem
    try:
        course_map = migrate_courses(cur)
        lesson_map = migrate_modules(cur, course_map)
        migrate_students(cur, course_map)
        migrate_pre_inscriptions(cur)
        migrate_quizzes(cur, lesson_map)

        print("\n" + "=" * 60)
        print(" ✅ Migração CONCLUÍDA com sucesso!")
        print("=" * 60)
        print(f"\n Cursos mapeados: {len(course_map)}")
        print(f" Lições mapeadas:  {len(lesson_map)}")
        print(f"\n Acesse o Frappe LMS para verificar os dados:")
        print(f"   {FRAPPE_URL}/lms")
        print()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
