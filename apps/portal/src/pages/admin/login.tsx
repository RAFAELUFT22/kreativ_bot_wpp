import { useState } from 'react'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { verifyToken } from '@/lib/auth'

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const token = req.cookies.admin_token || ''
    if (verifyToken(token)) return { redirect: { destination: '/admin', permanent: false } }
    return { props: {} }
}

export default function AdminLogin() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        })
        if (res.ok) {
            window.location.href = '/admin'
        } else {
            setError('Senha incorreta')
            setLoading(false)
        }
    }

    return (
        <>
            <Head>
                <title>Admin — Kreativ Educação</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>
            <div className="centered" style={{ minHeight: '100vh' }}>
                <div style={{ fontSize: '48px' }}>🔐</div>
                <h2>Acesso Admin</h2>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px' }}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Senha de administrador"
                        style={{
                            padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                            background: 'var(--bg2)', color: 'var(--text)', fontSize: '14px', outline: 'none',
                        }}
                    />
                    {error && <div style={{ color: '#e86432', fontSize: '13px' }}>{error}</div>}
                    <button type="submit" className="btn btn-gold" disabled={loading}
                        style={{ justifyContent: 'center' }}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </>
    )
}
