-- =============================================================================
-- MIGRAÇÃO: portal_token em students + module_name em certificates
-- Permite acesso ao dashboard pessoal sem senha via link único por aluno.
-- Aplicar: docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < scripts/06-migration-student-token.sql
-- =============================================================================

BEGIN;

-- Adicionar portal_token na tabela students
ALTER TABLE students ADD COLUMN IF NOT EXISTS portal_token UUID DEFAULT gen_random_uuid();

-- Gerar token para alunos já existentes (por segurança, mesmo que DEFAULT já cubra novos)
UPDATE students SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- Índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_students_token ON students(portal_token);

-- Adicionar campos de módulo na tabela certificates (para exibição no portal sem JOIN extra)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS module_number INTEGER;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS module_name  VARCHAR(255);

COMMIT;

-- Verificação pós-migration
SELECT
    count(*) FILTER (WHERE portal_token IS NOT NULL) AS alunos_com_token,
    count(*) AS total_alunos
FROM students;
