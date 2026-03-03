import crypto from 'crypto'

const SECRET = process.env.ADMIN_PASSWORD || ''
const MAX_AGE = 24 * 60 * 60 * 1000 // 24h

export function createToken(): string {
    const ts = Date.now().toString()
    const hmac = crypto.createHmac('sha256', SECRET).update(ts).digest('hex')
    return `${ts}:${hmac}`
}

export function verifyToken(token: string): boolean {
    if (!SECRET) return false
    const [ts, hmac] = token.split(':')
    if (!ts || !hmac) return false
    const age = Date.now() - parseInt(ts, 10)
    if (age > MAX_AGE || age < 0) return false
    const expected = crypto.createHmac('sha256', SECRET).update(ts).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))
}

export function verifyPassword(password: string): boolean {
    return SECRET.length > 0 && password === SECRET
}
