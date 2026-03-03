-- =============================================================================
-- TIER 1 FIXES — Schema gaps + race condition fix
-- Aplicar: docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu \
--          < init-scripts/06-migration-tier1-fixes.sql
-- =============================================================================

BEGIN;

-- 1. Campos faltantes em modules
ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS media_urls         TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS evaluation_rubric  TEXT,
    ADD COLUMN IF NOT EXISTS is_published       BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP DEFAULT NOW();

-- 2. Campo faltante em students
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS portal_token       VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_students_portal_token
    ON students(portal_token);

-- 3. Fix race condition: criar sequence para courses.id
--    Inicia no próximo ID após o MAX existente.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'courses_id_seq') THEN
        EXECUTE format(
            'CREATE SEQUENCE courses_id_seq START WITH %s',
            (SELECT COALESCE(MAX(id), 0) + 1 FROM courses)
        );
        ALTER TABLE courses ALTER COLUMN id SET DEFAULT nextval('courses_id_seq');
        PERFORM setval('courses_id_seq', (SELECT COALESCE(MAX(id), 0) FROM courses), true);
    END IF;
END $$;

-- 4. Extensão unaccent para slug validation
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 5. Função helper para gerar slugs URL-safe a partir de nomes com acentos
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(
                unaccent(trim(input_text)),
                '[^a-zA-Z0-9\s-]', '', 'g'   -- remove caracteres especiais
            ),
            '\s+', '-', 'g'                    -- espaços → hífens
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
