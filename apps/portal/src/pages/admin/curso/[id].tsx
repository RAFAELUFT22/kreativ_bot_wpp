import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

/* ===== Interfaces ===== */

interface Course {
    id: number
    name: string
    slug: string
    area: string | null
    is_active: boolean
}

interface ModuleRow {
    id: number
    module_number: number
    title: string
    description: string | null
    keyword: string | null
    is_published: boolean
}

interface Props {
    course: Course
    modules: ModuleRow[]
}

/* ===== Server ===== */

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {
    const token = req.cookies.admin_token || ''
    if (!verifyToken(token)) {
        return { redirect: { destination: '/admin/login', permanent: false } }
    }

    const courseId = params?.id
    if (!courseId) {
        return { notFound: true }
    }

    try {
        const { rows: courseRows } = await pool.query(
            'SELECT id, name, slug, area, is_active FROM courses WHERE id = $1',
            [courseId]
        )

        if (courseRows.length === 0) {
            return { notFound: true }
        }

        const { rows: moduleRows } = await pool.query(
            `SELECT id, module_number, title, description, keyword, is_published
             FROM modules
             WHERE course_int_id = $1
             ORDER BY module_number`,
            [courseId]
        )

        return {
            props: {
                course: courseRows[0],
                modules: moduleRows,
            },
        }
    } catch (e) {
        console.error('Course detail error:', e)
        return { notFound: true }
    }
}

/* ===== Component ===== */

export default function CourseDetail({ course, modules }: Props) {
    return (
        <>
            <Head>
                <title>{course.name} — Kreativ Admin</title>
                <meta name="description" content={`Gerenciar curso: ${course.name}`} />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/admin" className="logo">
                        Kreativ <span>Admin</span>
                    </Link>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <Link href="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                            Dashboard
                        </Link>
                        <span>/</span>
                        <span style={{ color: 'var(--text)' }}>{course.name}</span>
                    </div>
                </div>
            </nav>

            {/* Course Header */}
            <section style={{
                background: 'radial-gradient(ellipse at top, rgba(232,169,0,0.07) 0%, transparent 70%)',
                borderBottom: '1px solid var(--border)',
                padding: '48px 0 40px',
            }}>
                <div className="container">
                    <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, marginBottom: '12px' }}>
                        {course.name}
                    </h1>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        {course.area && (
                            <span className="tag">{course.area}</span>
                        )}
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            slug: <code style={{ color: 'var(--text)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{course.slug}</code>
                        </span>
                        <span className={`admin-badge ${course.is_active ? 'success' : 'danger'}`}>
                            {course.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                </div>
            </section>

            <main className="container" style={{ paddingBottom: '60px' }}>

                {/* Actions bar */}
                <section style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '32px',
                    paddingBottom: '24px',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                        Modulos ({modules.length})
                    </h2>
                    <Link
                        href={`/admin/modulo/novo?course_id=${course.id}`}
                        className="btn btn-gold"
                        style={{ fontSize: '13px' }}
                    >
                        + Novo Modulo
                    </Link>
                </section>

                {/* Modules table or empty state */}
                {modules.length === 0 ? (
                    <div style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '60px 40px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                    }}>
                        Nenhum modulo criado. Clique em &lsquo;Novo Modulo&rsquo; para comecar.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Titulo</th>
                                    <th>Keyword</th>
                                    <th>Status</th>
                                    <th>Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {modules.map((m) => (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--gold)' }}>
                                            {m.module_number}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>
                                            {m.title}
                                        </td>
                                        <td>
                                            {m.keyword ? (
                                                <code style={{
                                                    background: 'rgba(255,255,255,0.06)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '12px',
                                                }}>
                                                    {m.keyword}
                                                </code>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>--</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`admin-badge ${m.is_published ? 'success' : 'warning'}`}>
                                                {m.is_published ? 'Publicado' : 'Rascunho'}
                                            </span>
                                        </td>
                                        <td>
                                            <Link
                                                href={`/admin/modulo/${m.id}`}
                                                style={{
                                                    color: 'var(--gold)',
                                                    textDecoration: 'none',
                                                    fontSize: '13px',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                Editar &rarr;
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Back link */}
                <div style={{ paddingTop: '40px' }}>
                    <Link
                        href="/admin"
                        style={{
                            color: 'var(--text-muted)',
                            textDecoration: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            transition: 'color 0.2s',
                        }}
                    >
                        &larr; Voltar ao Dashboard
                    </Link>
                </div>
            </main>
        </>
    )
}
