import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

/* ===== Interfaces ===== */

interface Stats {
    courses: number
    modules: number
    students: number
    pre_inscriptions: number
    certificates: number
}

interface CourseRow {
    id: number
    name: string
    area: string | null
    module_count: number
    student_count: number
    pre_inscription_count: number
}

interface Props {
    stats: Stats
    courses: CourseRow[]
}

/* ===== Server ===== */

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const token = req.cookies.admin_token || ''
    if (!verifyToken(token)) {
        return { redirect: { destination: '/admin/login', permanent: false } }
    }

    try {
        const { rows: statsRows } = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM courses WHERE is_active = true)::int AS courses,
                (SELECT COUNT(*) FROM modules WHERE is_published = true)::int AS modules,
                (SELECT COUNT(*) FROM students)::int AS students,
                (SELECT COUNT(*) FROM pre_inscriptions WHERE convertido = false)::int AS pre_inscriptions,
                (SELECT COUNT(*) FROM certificates)::int AS certificates
        `)

        const { rows: courseRows } = await pool.query(`
            SELECT c.id, c.name, c.area,
                COUNT(DISTINCT m.id)::int AS module_count,
                COUNT(DISTINCT s.id)::int AS student_count,
                COUNT(DISTINCT pic.pre_inscription_id)::int AS pre_inscription_count
            FROM courses c
            LEFT JOIN modules m ON m.course_int_id = c.id AND m.is_published = true
            LEFT JOIN students s ON s.course_id = c.id
            LEFT JOIN pre_inscription_courses pic ON pic.course_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id, c.name, c.area
            ORDER BY pre_inscription_count DESC, c.name
        `)

        return {
            props: {
                stats: statsRows[0],
                courses: courseRows,
            },
        }
    } catch (e) {
        console.error('Admin dashboard error:', e)
        return {
            props: {
                stats: { courses: 0, modules: 0, students: 0, pre_inscriptions: 0, certificates: 0 },
                courses: [],
            },
        }
    }
}

/* ===== Component ===== */

const statCards: { key: keyof Stats; label: string; icon: string }[] = [
    { key: 'courses', label: 'Cursos ativos', icon: '📚' },
    { key: 'modules', label: 'Módulos publicados', icon: '📖' },
    { key: 'students', label: 'Alunos', icon: '🎓' },
    { key: 'pre_inscriptions', label: 'Pré-inscritos pendentes', icon: '📝' },
    { key: 'certificates', label: 'Certificados emitidos', icon: '🏆' },
]

export default function AdminDashboard({ stats, courses }: Props) {
    return (
        <>
            <Head>
                <title>Admin Dashboard — Kreativ Educação</title>
                <meta name="description" content="Painel administrativo Kreativ Educação" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/admin" className="logo">
                        Kreativ <span>Admin</span>
                    </Link>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Link href="/admin/pre-inscritos" className="btn btn-outline"
                            style={{ padding: '8px 16px', fontSize: '13px' }}>
                            Pre-inscritos
                        </Link>
                        <Link href="/" className="btn btn-outline"
                            style={{ padding: '8px 16px', fontSize: '13px' }}>
                            Portal
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Header */}
            <section style={{
                background: 'radial-gradient(ellipse at top, rgba(232,169,0,0.07) 0%, transparent 70%)',
                borderBottom: '1px solid var(--border)',
                padding: '48px 0 40px',
            }}>
                <div className="container">
                    <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800 }}>
                        Painel Administrativo
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>
                        Visao geral da plataforma Kreativ Educacao
                    </p>
                </div>
            </section>

            <main className="container" style={{ paddingBottom: '60px' }}>

                {/* Stats Grid */}
                <section style={{ paddingTop: '40px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: '16px',
                    }}>
                        {statCards.map((sc) => (
                            <div key={sc.key} style={{
                                background: 'var(--bg2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '24px 20px',
                                textAlign: 'center',
                                transition: 'border-color 0.2s',
                            }}>
                                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{sc.icon}</div>
                                <div style={{
                                    fontSize: '32px',
                                    fontWeight: 800,
                                    color: 'var(--gold)',
                                    lineHeight: 1.1,
                                    marginBottom: '6px',
                                }}>
                                    {stats[sc.key]}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {sc.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Courses Table */}
                <section style={{ paddingTop: '48px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
                        Cursos Ativos
                    </h2>

                    {courses.length === 0 ? (
                        <div style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '40px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                        }}>
                            Nenhum curso ativo encontrado.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'separate',
                                borderSpacing: 0,
                                background: 'var(--bg2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                overflow: 'hidden',
                                fontSize: '14px',
                            }}>
                                <thead>
                                    <tr>
                                        {['Curso', 'Area', 'Modulos', 'Alunos', 'Pre-inscritos', 'Acoes'].map((h) => (
                                            <th key={h} style={{
                                                textAlign: 'left',
                                                padding: '14px 16px',
                                                borderBottom: '1px solid var(--border)',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {courses.map((c, i) => (
                                        <tr key={c.id} style={{
                                            borderBottom: i < courses.length - 1 ? '1px solid var(--border)' : 'none',
                                        }}>
                                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                                                {c.name}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                {c.area ? (
                                                    <span className="tag">{c.area}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>--</span>
                                                )}
                                            </td>
                                            <td style={{
                                                padding: '14px 16px',
                                                fontWeight: 600,
                                                color: c.module_count > 0 ? 'var(--gold)' : 'var(--text-muted)',
                                            }}>
                                                {c.module_count}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                {c.student_count}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                {c.pre_inscription_count}
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <Link
                                                    href={`/admin/curso/${c.id}`}
                                                    style={{
                                                        color: 'var(--gold)',
                                                        textDecoration: 'none',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    Gerenciar &rarr;
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </>
    )
}
