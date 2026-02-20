import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Pool } from 'pg'

interface ModuleStatus {
    id: string
    module_number: number
    title: string
    description: string
    is_published: boolean
}

interface Certificate {
    id: string
    verification_code: string
    issued_at: string
    module_name: string | null
    score_final: number | null
}

interface StudentData {
    name: string
    phone: string
    course_name: string
    course_id: number | null
    current_module: number
    completed_modules: number[]
    lead_score: number
    attendance_status: string
}

interface Props {
    student: StudentData | null
    modules: ModuleStatus[]
    certificates: Certificate[]
    token: string
}

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const token = params?.token as string

    try {
        // Buscar aluno pelo token
        const { rows: studentRows } = await pool.query(`
            SELECT s.name, s.phone, s.current_module,
                   COALESCE(s.completed_modules, '{}') as completed_modules,
                   s.lead_score, s.attendance_status, s.course_id,
                   COALESCE(c.name, 'Kreativ Educação') as course_name
            FROM students s
            LEFT JOIN courses c ON c.id = s.course_id
            WHERE s.portal_token = $1
            LIMIT 1
        `, [token])

        if (!studentRows.length) {
            return { notFound: true }
        }

        const student = studentRows[0]

        // Buscar módulos do curso do aluno
        let modules: ModuleStatus[] = []
        if (student.course_id) {
            const { rows: moduleRows } = await pool.query(`
                SELECT id, module_number, title, description, is_published
                FROM modules
                WHERE course_int_id = $1 AND is_published = TRUE
                ORDER BY module_number ASC
            `, [student.course_id])
            modules = moduleRows
        }

        // Buscar certificados do aluno
        const { rows: certRows } = await pool.query(`
            SELECT c.id, c.verification_code,
                   to_char(c.issued_at, 'DD/MM/YYYY') as issued_at,
                   c.module_name, c.score_final
            FROM certificates c
            JOIN students s ON s.id = c.student_id
            WHERE s.portal_token = $1
            ORDER BY c.issued_at DESC
        `, [token])

        return {
            props: {
                student: {
                    name: student.name || 'Aluno(a)',
                    phone: student.phone,
                    course_name: student.course_name,
                    course_id: student.course_id,
                    current_module: student.current_module || 1,
                    completed_modules: student.completed_modules || [],
                    lead_score: student.lead_score || 0,
                    attendance_status: student.attendance_status || 'bot',
                },
                modules,
                certificates: certRows,
                token,
            }
        }
    } catch (e) {
        console.error('Dashboard error:', e)
        return { notFound: true }
    }
}

function ProgressBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>{value} de {max} módulos concluídos</span>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{pct}%</span>
            </div>
            <div className="progress-wrap">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

function ModuleCard({ mod, completed, current }: { mod: ModuleStatus; completed: boolean; current: boolean }) {
    const locked = !completed && !current
    const icon = completed ? '✅' : current ? '▶️' : '🔒'

    const inner = (
        <div style={{
            background: 'var(--bg2)',
            border: `1px solid ${completed ? 'rgba(100,200,100,0.3)' : current ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            padding: '20px 24px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
            opacity: locked ? 0.5 : 1,
            transition: 'border-color 0.2s, transform 0.2s',
        }}>
            <span style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Módulo {mod.module_number}
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{mod.title}</div>
                {mod.description && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{mod.description}</div>
                )}
                {current && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gold)', fontWeight: 600 }}>
                        → Módulo atual — clique para ler o conteúdo
                    </div>
                )}
            </div>
        </div>
    )

    if (locked) {
        return <div style={{ cursor: 'not-allowed' }}>{inner}</div>
    }

    return (
        <Link href={`/modulo/${mod.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            className="module-card-link">
            {inner}
        </Link>
    )
}

export default function AlunoDashboard({ student, modules, certificates, token }: Props) {
    if (!student) {
        return (
            <div className="centered">
                <div style={{ fontSize: '48px' }}>🔑</div>
                <h2>Acesso não encontrado</h2>
                <p>Este link é inválido ou expirou. Entre em contato pelo WhatsApp.</p>
                <a className="btn btn-gold" href="https://wa.me/556399374165">Falar pelo WhatsApp</a>
            </div>
        )
    }

    const completedSet = new Set(student.completed_modules)
    const totalModules = modules.length
    const completedCount = student.completed_modules.filter(n => modules.some(m => m.module_number === n)).length
    const allDone = totalModules > 0 && completedCount >= totalModules

    return (
        <>
            <Head>
                <title>{student.name} — Painel do Aluno · Kreativ Educação</title>
                <meta name="description" content={`Painel pessoal de ${student.name} na Kreativ Educação`} />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
                <style>{`.module-card-link:hover > div { border-color: var(--gold) !important; transform: translateY(-2px); }`}</style>
            </Head>

            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/" className="logo">Kreativ <span>Portal do Aluno</span></Link>
                    <a
                        className="btn btn-gold"
                        href="https://wa.me/556399374165"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                        💬 Falar com Tutor
                    </a>
                </div>
            </nav>

            <section style={{
                background: 'radial-gradient(ellipse at top, rgba(232,169,0,0.07) 0%, transparent 70%)',
                borderBottom: '1px solid var(--border)',
                padding: '48px 0',
            }}>
                <div className="container">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'var(--gold-soft)', border: '2px solid var(--gold)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '22px', flexShrink: 0,
                        }}>
                            🎓
                        </div>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '2px' }}>Bem-vindo(a) de volta</div>
                            <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800 }}>{student.name}</h1>
                        </div>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
                        <span className="tag">{student.course_name}</span>
                        {student.attendance_status === 'human' && (
                            <span style={{ background: 'rgba(232,100,50,0.15)', color: '#e86432', padding: '2px 10px', borderRadius: '40px', fontSize: '12px' }}>
                                👤 Atendimento humano ativo
                            </span>
                        )}
                        {student.lead_score > 0 && (
                            <span style={{ background: 'rgba(232,169,0,0.12)', color: 'var(--gold)', padding: '2px 10px', borderRadius: '40px', fontSize: '12px' }}>
                                ⭐ {student.lead_score} pts
                            </span>
                        )}
                    </div>

                    {totalModules > 0 && (
                        <ProgressBar value={completedCount} max={totalModules} />
                    )}

                    {allDone && (
                        <div style={{
                            marginTop: '16px', padding: '12px 20px',
                            background: 'rgba(100,200,100,0.1)', border: '1px solid rgba(100,200,100,0.3)',
                            borderRadius: '8px', fontSize: '14px', color: '#7dcf7d',
                        }}>
                            🏆 Parabéns! Você concluiu todos os módulos do curso!
                        </div>
                    )}
                </div>
            </section>

            <main className="container" style={{ paddingBottom: '60px' }}>

                {/* Módulos */}
                {modules.length > 0 && (
                    <section style={{ paddingTop: '40px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
                            📚 Módulos do Curso
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {modules.map((mod) => {
                                const done = completedSet.has(mod.module_number)
                                const isCurrent = mod.module_number === student.current_module && !done
                                return (
                                    <ModuleCard
                                        key={mod.id}
                                        mod={mod}
                                        completed={done}
                                        current={isCurrent}
                                    />
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Certificados */}
                {certificates.length > 0 && (
                    <section style={{ paddingTop: '40px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
                            🏆 Meus Certificados
                        </h2>
                        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                            {certificates.map((cert) => (
                                <Link
                                    key={cert.id}
                                    href={`/certificado/${cert.verification_code}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div className="card" style={{ borderColor: 'rgba(232,169,0,0.3)' }}>
                                        <div className="card-badge">🏆 Certificado</div>
                                        <h2 style={{ fontSize: '16px' }}>
                                            {cert.module_name || student.course_name}
                                        </h2>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            Emitido em {cert.issued_at}
                                            {cert.score_final ? ` · Nota: ${cert.score_final}` : ''}
                                        </p>
                                        <div className="card-footer">
                                            <span style={{ color: 'var(--gold)', fontSize: '13px' }}>Ver certificado →</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cert.verification_code}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* CTA WhatsApp */}
                <section style={{
                    marginTop: '48px',
                    padding: '32px',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Aprendizado pelo WhatsApp</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px' }}>
                        Continue seu aprendizado pelo WhatsApp. Responda <strong>MODULO</strong> para acessar o próximo conteúdo
                        ou <strong>TUTOR</strong> para falar com um especialista.
                    </p>
                    <a
                        className="btn btn-gold"
                        href="https://wa.me/556399374165?text=OI"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Continuar no WhatsApp →
                    </a>
                </section>

            </main>
        </>
    )
}
