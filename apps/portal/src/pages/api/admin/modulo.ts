import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const { course_int_id, module_number, title, description, keyword, blocks, quiz_questions, evaluation_rubric, is_published } = req.body

        // Also set content_text as concatenation of text blocks for legacy compatibility
        const textBlocks = (blocks || []).filter((b: any) => b.type === 'text' && b.content).map((b: any) => b.content)
        const content_text = textBlocks.join('\n\n---\n\n')

        const { rows } = await pool.query(`
            INSERT INTO modules (course_int_id, module_number, title, description, keyword, content_text, blocks, quiz_questions, evaluation_rubric, is_published)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
            RETURNING id
        `, [course_int_id, module_number, title, description || null, keyword || null, content_text || null,
            JSON.stringify(blocks || []), JSON.stringify(quiz_questions || []),
            evaluation_rubric || null, is_published !== false])

        return res.status(201).json({ ok: true, id: rows[0].id })
    } catch (e: any) {
        return res.status(500).json({ error: e.message || 'Erro ao criar modulo' })
    }
}
