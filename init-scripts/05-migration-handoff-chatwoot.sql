-- =============================================================================
-- Migration 05: Tabelas para integração Chatwoot (handoff bot↔humano)
-- Idempotente — seguro re-executar.
-- Aplicar:
--   docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu \
--     < init-scripts/05-migration-handoff-chatwoot.sql
-- =============================================================================

-- 1. handoff_control — rastreia estado bot/human por telefone
-- Referenciada em:
--   n8n-workflows/60-kreativ-api-ultimate.json (node "Human: Atualizar DB")
--   n8n-workflows/10-chatwoot-retomar-bot.json (nodes de status check + update)
--   n8n-workflows/04-request-human-support.json (node "Pausar bot e criar sessão")
CREATE TABLE IF NOT EXISTS handoff_control (
    phone         TEXT PRIMARY KEY,
    status        TEXT DEFAULT 'bot',          -- 'bot' | 'human'
    assigned_to   TEXT,                        -- tutor atribuído (futuro)
    last_handoff  TIMESTAMPTZ DEFAULT NOW(),
    metadata      JSONB
);

-- 2. training_memory — pares Q&A capturados de tutores humanos no Chatwoot
-- Referenciada em:
--   n8n-workflows/10-chatwoot-retomar-bot.json (node "save-memory")
--   scripts/04-analytics-kpis.sql (BLOCO 12)
CREATE TABLE IF NOT EXISTS training_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    student_phone   TEXT,
    course_id       TEXT,
    module_number   INTEGER,
    conv_id         INTEGER,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Coluna conv_id pode não existir se tabela foi criada sem ela
ALTER TABLE training_memory ADD COLUMN IF NOT EXISTS conv_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_training_memory_phone
    ON training_memory(student_phone);
CREATE INDEX IF NOT EXISTS idx_training_memory_course
    ON training_memory(course_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_memory_conv
    ON training_memory(conv_id) WHERE conv_id IS NOT NULL;
