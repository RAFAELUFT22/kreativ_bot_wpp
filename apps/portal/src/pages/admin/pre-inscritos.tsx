import { useState } from 'react'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

/* ===== Interfaces ===== */

interface PreInscription {
    id: string
    nome_completo: string
    telefone_whatsapp: string
    cidade: string | null
    estado: string | null
    convertido: boolean
    review_required: boolean
    cursos_interesse: string[] | null
    cursos_ids: number[] | null
}

interface Course {
    id: number
    name: string
}

interface Stats {
    total: number
    convertidos: number
    pendentes: number
}

interface Props {
    preInscriptions: PreInscription[]
    courses: Course[]
    stats: Stats
    totalCount: number
    currentPage: number
    filters: {
        nome: string
        curso: string
        status: string
    }
}

/* ===== Server ===== */

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
    const token = req.cookies.admin_token || ''
    if (!verifyToken(token)) {
        return { redirect: { destination: '/admin/login', permanent: false } }
    }

    const page = Math.max(1, parseInt(query.page as string, 10) || 1)
    const nome = (query.nome as string) || ''
    const curso = (query.curso as string) || ''
    const status = (query.status as string) || ''
    const perPage = 20
    const offset = (page - 1) * perPage

    // Derive boolean for status filter
    const statusBool: boolean | null =
        status === 'convertido' ? true : status === 'pendente' ? false : null

    try {
        // Stats query
        const { rows: statsRows } = await pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE convertido = true)::int AS convertidos,
                COUNT(*) FILTER (WHERE convertido = false)::int AS pendentes
            FROM pre_inscriptions
        `)

        // Main query with filters
        const { rows: piRows } = await pool.query(`
            SELECT pi.id, pi.nome_completo, pi.telefone_whatsapp, pi.cidade, pi.estado,
                   pi.convertido, pi.review_required,
                   array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as cursos_interesse,
                   array_agg(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL) as cursos_ids
            FROM pre_inscriptions pi
            LEFT JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
            LEFT JOIN courses c ON c.id = pic.course_id
            WHERE ($1::text IS NULL OR pi.nome_completo ILIKE '%' || $1 || '%')
              AND ($2::int IS NULL OR pic.course_id = $2)
              AND ($3::boolean IS NULL OR pi.convertido = $3)
            GROUP BY pi.id
            ORDER BY pi.convertido ASC, pi.data_primeira_inscricao DESC NULLS LAST
            LIMIT $4 OFFSET $5
        `, [
            nome || null,
            curso ? parseInt(curso, 10) : null,
            statusBool,
            perPage,
            offset,
        ])

        // Count query (same WHERE, no LIMIT)
        const { rows: countRows } = await pool.query(`
            SELECT COUNT(DISTINCT pi.id)::int AS total
            FROM pre_inscriptions pi
            LEFT JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
            WHERE ($1::text IS NULL OR pi.nome_completo ILIKE '%' || $1 || '%')
              AND ($2::int IS NULL OR pic.course_id = $2)
              AND ($3::boolean IS NULL OR pi.convertido = $3)
        `, [
            nome || null,
            curso ? parseInt(curso, 10) : null,
            statusBool,
        ])

        // Courses list for filter + matricular dropdown
        const { rows: courseRows } = await pool.query(
            'SELECT id, name FROM courses WHERE is_active = true ORDER BY name'
        )

        return {
            props: {
                preInscriptions: piRows,
                courses: courseRows,
                stats: statsRows[0],
                totalCount: countRows[0].total,
                currentPage: page,
                filters: { nome, curso, status },
            },
        }
    } catch (e) {
        console.error('Pre-inscritos page error:', e)
        return {
            props: {
                preInscriptions: [],
                courses: [],
                stats: { total: 0, convertidos: 0, pendentes: 0 },
                totalCount: 0,
                currentPage: 1,
                filters: { nome: '', curso: '', status: '' },
            },
        }
    }
}

/* ===== Component ===== */

export default function PreInscritos({ preInscriptions, courses, stats, totalCount, currentPage, filters }: Props) {
    const router = useRouter()
    const perPage = 20
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

    // Filter form state
    const [filterNome, setFilterNome] = useState(filters.nome)
    const [filterCurso, setFilterCurso] = useState(filters.curso)
    const [filterStatus, setFilterStatus] = useState(filters.status)

    // Per-row state: selected course for matricular
    const [selectedCourses, setSelectedCourses] = useState<Record<string, number>>({})
    const [loadingRows, setLoadingRows] = useState<Record<string, boolean>>({})

    function handleFilter(e: React.FormEvent) {
        e.preventDefault()
        const params: Record<string, string> = {}
        if (filterNome) params.nome = filterNome
        if (filterCurso) params.curso = filterCurso
        if (filterStatus) params.status = filterStatus
        router.push({ pathname: '/admin/pre-inscritos', query: params })
    }

    function goToPage(page: number) {
        const params: Record<string, string> = { page: String(page) }
        if (filters.nome) params.nome = filters.nome
        if (filters.curso) params.curso = filters.curso
        if (filters.status) params.status = filters.status
        router.push({ pathname: '/admin/pre-inscritos', query: params })
    }

    async function handleMatricular(preInscriptionId: string) {
        const courseId = selectedCourses[preInscriptionId]
        if (!courseId) return alert('Selecione um curso para matricular.')

        setLoadingRows((prev) => ({ ...prev, [preInscriptionId]: true }))
        try {
            const res = await fetch('/api/admin/matricular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pre_inscription_id: preInscriptionId, course_id: courseId }),
            })
            if (!res.ok) {
                const data = await res.json()
                alert(data.error || 'Erro ao matricular')
            } else {
                router.replace(router.asPath)
            }
        } catch {
            alert('Erro de rede ao matricular')
        } finally {
            setLoadingRows((prev) => ({ ...prev, [preInscriptionId]: false }))
        }
    }

    return (
        <>
            <Head>
                <title>Pre-inscritos — Kreativ Admin</title>
                <meta name="description" content="Gerenciar pre-inscricoes" />
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
                        <Link href="/admin" className="btn btn-outline"
                            style={{ padding: '8px 16px', fontSize: '13px' }}>
                            Dashboard
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
                        Pre-inscritos
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>
                        Gerenciar pre-inscricoes e matriculas
                    </p>
                </div>
            </section>

            <main className="container" style={{ paddingBottom: '60px' }}>

                {/* Stats Bar */}
                <section style={{ paddingTop: '40px' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '16px',
                    }}>
                        {[
                            { label: 'Total', value: stats.total, color: 'var(--text)' },
                            { label: 'Convertidos', value: stats.convertidos, color: '#7dcf7d' },
                            { label: 'Pendentes', value: stats.pendentes, color: 'var(--gold)' },
                        ].map((s) => (
                            <div key={s.label} style={{
                                background: 'var(--bg2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '24px 20px',
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    fontSize: '32px',
                                    fontWeight: 800,
                                    color: s.color,
                                    lineHeight: 1.1,
                                    marginBottom: '6px',
                                }}>
                                    {s.value}
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Filter Bar */}
                <section style={{ paddingTop: '32px' }}>
                    <form onSubmit={handleFilter} style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                    }}>
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                Nome
                            </label>
                            <input
                                className="admin-input"
                                type="text"
                                placeholder="Buscar por nome..."
                                value={filterNome}
                                onChange={(e) => setFilterNome(e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                Curso
                            </label>
                            <select
                                className="admin-select"
                                value={filterCurso}
                                onChange={(e) => setFilterCurso(e.target.value)}
                            >
                                <option value="">Todos os cursos</option>
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                Status
                            </label>
                            <select
                                className="admin-select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="">Todos</option>
                                <option value="pendente">Pendente</option>
                                <option value="convertido">Convertido</option>
                            </select>
                        </div>
                        <button type="submit" className="btn btn-gold" style={{ padding: '10px 24px' }}>
                            Filtrar
                        </button>
                    </form>
                </section>

                {/* Table */}
                <section style={{ paddingTop: '32px' }}>
                    {preInscriptions.length === 0 ? (
                        <div style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '40px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                        }}>
                            Nenhum pre-inscrito encontrado.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Telefone</th>
                                        <th>Cidade</th>
                                        <th>Cursos de Interesse</th>
                                        <th>Status</th>
                                        <th>Acoes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preInscriptions.map((pi) => (
                                        <tr key={pi.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {pi.nome_completo}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {pi.telefone_whatsapp}
                                            </td>
                                            <td>
                                                {pi.cidade && pi.estado
                                                    ? `${pi.cidade}/${pi.estado}`
                                                    : pi.cidade || pi.estado || (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>--</span>
                                                    )}
                                            </td>
                                            <td>
                                                {pi.cursos_interesse && pi.cursos_interesse.length > 0
                                                    ? pi.cursos_interesse.join(', ')
                                                    : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>--</span>
                                                }
                                            </td>
                                            <td>
                                                <span className={`admin-badge ${pi.convertido ? 'success' : 'warning'}`}>
                                                    {pi.convertido ? 'Convertido' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td>
                                                {!pi.convertido ? (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <select
                                                            className="admin-select"
                                                            style={{ fontSize: '13px', padding: '6px 10px' }}
                                                            value={selectedCourses[pi.id] || ''}
                                                            onChange={(e) => setSelectedCourses((prev) => ({
                                                                ...prev,
                                                                [pi.id]: parseInt(e.target.value, 10),
                                                            }))}
                                                        >
                                                            <option value="">Curso...</option>
                                                            {courses.map((c) => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            className="btn btn-gold"
                                                            style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                                                            disabled={loadingRows[pi.id] || false}
                                                            onClick={() => handleMatricular(pi.id)}
                                                        >
                                                            {loadingRows[pi.id] ? 'Salvando...' : 'Matricular'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>--</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Pagination */}
                {totalPages > 1 && (
                    <section style={{
                        paddingTop: '32px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '16px',
                    }}>
                        <button
                            className="btn btn-outline"
                            style={{ padding: '8px 20px', fontSize: '13px' }}
                            disabled={currentPage <= 1}
                            onClick={() => goToPage(currentPage - 1)}
                        >
                            Anterior
                        </button>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                            Pagina {currentPage} de {totalPages}
                        </span>
                        <button
                            className="btn btn-outline"
                            style={{ padding: '8px 20px', fontSize: '13px' }}
                            disabled={currentPage >= totalPages}
                            onClick={() => goToPage(currentPage + 1)}
                        >
                            Proxima
                        </button>
                    </section>
                )}
            </main>
        </>
    )
}
