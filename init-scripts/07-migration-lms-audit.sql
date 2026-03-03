-- =============================================================================
-- MIGRATION 07: LMS Audit — Schema gaps + blocks JSONB + module_sessions
-- Aplicar: docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu \
--          < init-scripts/07-migration-lms-audit.sql
-- =============================================================================

BEGIN;

-- 1. students: enrollment_date (backfill from created_at)
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMP;
UPDATE students SET enrollment_date = created_at WHERE enrollment_date IS NULL;

-- 2. modules: keyword, audio_url, blocks JSONB
-- blocks schema: [{"order":1,"type":"text|video|audio|pdf|image|divider",
--                  "content":"markdown...", "url":"https://...", "caption":"label"}]
ALTER TABLE modules ADD COLUMN IF NOT EXISTS keyword VARCHAR(100);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS audio_url VARCHAR(1000);
ALTER TABLE modules ADD COLUMN IF NOT EXISTS blocks JSONB;

-- keyword UNIQUE constraint (only if not already present)
DO $$ BEGIN
  ALTER TABLE modules ADD CONSTRAINT modules_keyword_unique UNIQUE (keyword);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. certificates: course_int_id INTEGER FK (course_id is VARCHAR in production)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS course_int_id INTEGER REFERENCES courses(id);
UPDATE certificates SET course_int_id = course_id::int
  WHERE course_id IS NOT NULL AND course_id ~ '^\d+$' AND course_int_id IS NULL;

-- 4. Missing indexes (flagged by audit)
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_module ON document_chunks(module_id);

-- 5. CHECK constraints on status fields
DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT chk_attendance_status
    CHECK (attendance_status IN ('bot', 'human', 'pending'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE handoff_control ADD CONSTRAINT chk_handoff_status
    CHECK (status IN ('bot', 'human'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. module_sessions: block-level progress tracking
CREATE TABLE IF NOT EXISTS module_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id),
    current_block INTEGER DEFAULT 0,
    state VARCHAR(20) DEFAULT 'active'
      CHECK (state IN ('active', 'paused', 'completed')),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(student_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_module_sessions_student ON module_sessions(student_id);

COMMIT;
