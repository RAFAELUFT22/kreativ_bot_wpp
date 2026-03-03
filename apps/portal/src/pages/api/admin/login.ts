import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyPassword, createToken } from '@/lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { password } = req.body
    if (!verifyPassword(password)) return res.status(401).json({ error: 'Senha incorreta' })
    const token = createToken()
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`)
    return res.status(200).json({ ok: true })
}
