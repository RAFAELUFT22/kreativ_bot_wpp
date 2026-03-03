# Kreativ Educacao — CLAUDE.md

## Architecture
WhatsApp -> Evolution API v2.2.3 -> Typebot v6 -> N8N -> PostgreSQL+pgvector
Portal: Next.js 14 (SSR, pages router) at portal.extensionista.site
AI: DeepSeek via HTTP Request (LangChain nodes NOT available in this N8N instance)
RAG: pgvector 1536 dims + kreativ_ingest microservice (FastAPI)

## Key Commands
- Deploy stack: `docker compose up -d`
- Rebuild portal: `docker compose build portal && docker compose up -d portal`
- Apply migration: `docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < init-scripts/XX-migration.sql`
- Rebuild Typebot: `python3 scripts/build_typebot.py`
- Smoke test: `bash scripts/smoke_test_lms.sh`
- Health check: `bash scripts/health_check.sh`

## Database Rules
- Host: `kreativ_postgres` (NOT "postgres" — resolves IPv6 and fails)
- DB: kreativ_edu | User: kreativ_user
- `modules.course_int_id` (INTEGER FK) is canonical — `course_id` (VARCHAR) is legacy
- `students.course_id` is INTEGER (converted from VARCHAR in migration 02)
- `certificates.course_id` is VARCHAR — use `course_int_id` INTEGER for JOINs
- `students.completed_modules` is INTEGER[] | `students.scores` is JSONB
- `modules.blocks` is JSONB: `[{order, type, content/url, caption}]`
- `modules.keyword` is UNIQUE VARCHAR (for WhatsApp intent routing)

## N8N Rules
- Unified API webhook: `POST /webhook/kreativ-unified-api`
- Actions: check_student, get_module, get_progress, submit_quiz, ai_tutor, emit_certificate, request_human, enroll_student, admin_*
- Expression syntax inside query field: `{{ expr }}` (NO leading `=`)
- `={{ expr }}` with leading = is for field-level values only
- PostgreSQL hostname: `kreativ_postgres` (not "postgres")
- Boolean IF nodes v2+: use operator `number larger 0` explicitly
- Evolution internal URL: `http://kreativ_evolution:8080` (not 8081)

## Typebot Rules
- `"Webhook"` (capital W) = server-side HTTP request = WORKS
- `"webhook"` (lowercase) = client-side listener = BREAKS (Evolution ignores)
- PATCH API rejects Webhook via Zod validation — use DB injection (`build_typebot.py`)
- Bot ID: `vnp6x9bqwrx54b2pct5dhqlb`
- Public ID: `cmlvjfr7v000ipc1giknwf999`
- `options.webhook` needs `id` field; each header needs `id`
- `bodyPath` uses `data.` prefix (Typebot wraps response as `{data: <body>}`)
- `responseVariableMapping` uses `variableId` (not `variableName`)

## Portal (apps/portal)
- Next.js 14 with standalone output, pages router
- Direct pg Pool connection in getServerSideProps (no API layer)
- HOSTNAME=0.0.0.0 MANDATORY in docker-compose (Traefik routing)
- blocks JSONB rendering: uses blocks when available, falls back to media_urls+content_text
- Chatwoot widget: set NEXT_PUBLIC_CHATWOOT_TOKEN in .env

## Testing
- Test student: phone=556399374165
- Portal token: check DB with `SELECT portal_token FROM students WHERE phone LIKE '%4165%'`
- Smoke test: `bash scripts/smoke_test_lms.sh`
- N8N test: `curl -X POST .../webhook/kreativ-unified-api -d '{"action":"check_student","phone":"556399374165"}'`
