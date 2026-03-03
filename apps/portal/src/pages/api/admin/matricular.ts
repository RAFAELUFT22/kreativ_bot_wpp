import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { pre_inscription_id, course_id } = req.body
    if (!pre_inscription_id || !course_id) return res.status(400).json({ error: 'Missing fields' })

    try {
        const { rows: piRows } = await pool.query(
            'SELECT nome_completo, telefone_whatsapp, email FROM pre_inscriptions WHERE id = $1',
            [pre_inscription_id]
        )
        if (!piRows.length) return res.status(404).json({ error: 'Pré-inscrição não encontrada' })
        const pi = piRows[0]

        const { rows: existing } = await pool.query('SELECT id FROM students WHERE phone = $1', [pi.telefone_whatsapp])
        let studentId: string

        if (existing.length) {
            studentId = existing[0].id
            await pool.query('UPDATE students SET course_id = $1 WHERE id = $2', [course_id, studentId])
        } else {
            const portalToken = crypto.randomUUID()
            const { rows: newStudent } = await pool.query(
                'INSERT INTO students (phone, name, email, course_id, current_module, portal_token) VALUES ($1, $2, $3, $4, 1, $5) RETURNING id',
                [pi.telefone_whatsapp, pi.nome_completo, pi.email, course_id, portalToken]
            )
            studentId = newStudent[0].id
        }

        await pool.query(
            'UPDATE pre_inscriptions SET convertido = true, student_id = $1 WHERE id = $2',
            [studentId, pre_inscription_id]
        )

        return res.status(200).json({ ok: true, student_id: studentId })
    } catch (e) {
        console.error('Matricular error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
