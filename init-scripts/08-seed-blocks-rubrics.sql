-- =============================================================================
-- SEED 08: Populate blocks JSONB from existing content_text + media_urls
-- Also fills evaluation_rubric for modules missing it.
-- Aplicar: docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu \
--          < init-scripts/08-seed-blocks-rubrics.sql
-- =============================================================================

BEGIN;

-- 1. Build blocks JSONB from content_text + media_urls for published modules
--    Each module gets at least one text block from content_text.
--    Media URLs are typed by extension and appended in order.
UPDATE modules
SET blocks = (
    -- Start with text block from content_text
    CASE WHEN content_text IS NOT NULL AND content_text != ''
    THEN jsonb_build_array(
        jsonb_build_object('order', 1, 'type', 'text', 'content', content_text)
    )
    ELSE '[]'::jsonb
    END
    ||
    -- Append media blocks from media_urls array (if any)
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'order', 2 + (idx - 1),
                'type', CASE
                    WHEN url ~* '\.(mp3|wav|ogg|m4a)$' THEN 'audio'
                    WHEN url ~* '\.(pdf)$'              THEN 'pdf'
                    WHEN url ~* 'youtu'                 THEN 'video'
                    WHEN url ~* '\.(jpg|jpeg|png|webp|gif)$' THEN 'image'
                    ELSE 'text'
                END,
                'url', url,
                'caption', ''
            ) ORDER BY idx
        )
        FROM unnest(media_urls) WITH ORDINALITY AS t(url, idx)
        ),
        '[]'::jsonb
    )
)
WHERE is_published = TRUE AND blocks IS NULL;

-- 2. Fill evaluation_rubric for module on course 23 (test module, only one missing)
UPDATE modules
SET evaluation_rubric = 'O aluno deve demonstrar compreensao basica do conteudo apresentado, citando pelo menos um conceito central com suas proprias palavras.'
WHERE course_int_id = 23 AND evaluation_rubric IS NULL;

COMMIT;
