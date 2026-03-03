import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    const id = req.query.id as string

    try {
        if (req.method === 'PUT') {
            const { title, description, keyword, blocks, quiz_questions, evaluation_rubric, is_published, module_number } = req.body
            const textBlocks = (blocks || []).filter((b: any) => b.type === 'text' && b.content).map((b: any) => b.content)
            const content_text = textBlocks.join('\n\n---\n\n')

            await pool.query(`
                UPDATE modules SET
                    title = COALESCE($2, title),
                    description = COALESCE($3, description),
                    keyword = $4,
                    content_text = $5,
                    blocks = $6::jsonb,
                    quiz_questions = $7::jsonb,
                    evaluation_rubric = $8,
                    is_published = $9,
                    module_number = COALESCE($10, module_number),
                    updated_at = NOW()
                WHERE id = $1
            `, [id, title, description, keyword || null, content_text || null,
                JSON.stringify(blocks || []), JSON.stringify(quiz_questions || []),
                evaluation_rubric || null, is_published !== false, module_number])
            return res.status(200).json({ ok: true })
        }

        if (req.method === 'DELETE') {
            await pool.query('DELETE FROM modules WHERE id = $1', [id])
            return res.status(200).json({ ok: true })
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (e: any) {
        return res.status(500).json({ error: e.message || 'Erro' })
    }
}
