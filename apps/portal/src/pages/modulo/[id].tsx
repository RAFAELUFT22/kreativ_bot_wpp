import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Pool } from 'pg'

interface Module {
    id: string
    title: string
    description: string
    content_text: string
    module_number: number
    course_id: string
    course_int_id: number
    course_name: string
    media_urls: string[]
}

interface Props {
    module: Module | null
    prevId: string | null
    nextId: string | null
}

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

function getYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/)
    return match ? match[1] : null
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const id = params?.id as string
    try {
        const { rows } = await pool.query(`
            SELECT m.*,
                COALESCE(c.name, m.course_id) as course_name
            FROM modules m
            LEFT JOIN courses c ON c.id = m.course_int_id
            WHERE m.id = $1
        `, [id])

        if (!rows.length) return { props: { module: null, prevId: null, nextId: null } }

        const mod = rows[0]

        // Buscar módulos vizinhos pelo course_int_id (mais confiável que course_id VARCHAR)
        const courseKey = mod.course_int_id || mod.course_id
        const siblingQuery = mod.course_int_id
            ? `SELECT id, module_number FROM modules WHERE course_int_id = $1 AND is_published = TRUE ORDER BY module_number`
            : `SELECT id, module_number FROM modules WHERE course_id = $1 ORDER BY module_number`

        const { rows: siblings } = await pool.query(siblingQuery, [courseKey])

        const idx = siblings.findIndex((s: any) => s.id === id)
        const prevId = idx > 0 ? siblings[idx - 1].id : null
        const nextId = idx < siblings.length - 1 ? siblings[idx + 1].id : null

        return { props: { module: mod, prevId, nextId } }
    } catch (e) {
        return { props: { module: null, prevId: null, nextId: null } }
    }
}

export default function ModulePage({ module: mod, prevId, nextId }: Props) {
    if (!mod) {
        return (
            <div className="centered">
                <div style={{ fontSize: '48px' }}>😔</div>
                <h2>Módulo não encontrado</h2>
                <p>Este módulo não existe ou foi removido.</p>
                <Link href="/" className="btn btn-gold">← Voltar ao início</Link>
            </div>
        )
    }

    // Detectar vídeo YouTube no primeiro item de media_urls
    const mediaUrls: string[] = mod.media_urls || []
    const youtubeId = mediaUrls.length > 0 ? getYoutubeId(mediaUrls[0]) : null

    return (
        <>
            <Head>
                <title>{mod.title} — Kreativ Educação</title>
                <meta name="description" content={mod.description || mod.title} />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/" className="logo">Kreativ <span>Portal</span></Link>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Módulo {mod.module_number}</span>
                </div>
            </nav>

            <main className="container">
                <div className="module-header">
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {mod.course_name && <span className="tag">{mod.course_name}</span>}
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Módulo {mod.module_number}</span>
                    </div>
                    <h1>{mod.title}</h1>
                    {mod.description && (
                        <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>{mod.description}</p>
                    )}
                </div>

                {/* Vídeo YouTube se disponível */}
                {youtubeId && (
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{
                            position: 'relative', paddingBottom: '56.25%', height: 0,
                            borderRadius: 'var(--radius)', overflow: 'hidden',
                            border: '1px solid var(--border)',
                        }}>
                            <iframe
                                src={`https://www.youtube.com/embed/${youtubeId}`}
                                title="Vídeo do módulo"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            />
                        </div>
                    </div>
                )}

                <div className="module-body">
                    {mod.content_text ? (
                        <div dangerouslySetInnerHTML={{ __html: mod.content_text.replace(/\n/g, '<br />') }} />
                    ) : (
                        <div className="centered" style={{ minHeight: '200px' }}>
                            <p>Conteúdo em preparação. Acesse pelo WhatsApp para a versão completa.</p>
                        </div>
                    )}
                </div>

                {/* CTA Quiz */}
                <div style={{
                    margin: '32px 0',
                    padding: '24px 28px',
                    background: 'var(--gold-soft)',
                    border: '1px solid rgba(232,169,0,0.3)',
                    borderRadius: 'var(--radius)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>📝 Pronto para o quiz?</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                            Envie <strong style={{ color: 'var(--gold)' }}>QUIZ</strong> pelo WhatsApp para responder as perguntas e avançar para o próximo módulo.
                        </div>
                    </div>
                    <a
                        className="btn btn-gold"
                        href="https://wa.me/556399374165?text=QUIZ"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        Fazer Quiz →
                    </a>
                </div>

                <div className="module-nav">
                    {prevId ? (
                        <Link href={`/modulo/${prevId}`} className="btn btn-outline">← Módulo anterior</Link>
                    ) : (
                        <Link href="/" className="btn btn-outline">← Início</Link>
                    )}
                    {nextId && (
                        <Link href={`/modulo/${nextId}`} className="btn btn-gold">Próximo módulo →</Link>
                    )}
                </div>
            </main>
        </>
    )
}
