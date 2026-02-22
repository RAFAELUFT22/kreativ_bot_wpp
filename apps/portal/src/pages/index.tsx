import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Pool } from 'pg'

interface Module {
    id: string
    title: string
    description: string
    module_number: number
    course_name: string
}

interface Props {
    modules: Module[]
    error?: string
}

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

export const getServerSideProps: GetServerSideProps = async () => {
    try {
        const { rows } = await pool.query(`
      SELECT m.id, m.title, m.description, m.module_number,
        COALESCE(c.name, m.course_id) as course_name
      FROM modules m
      LEFT JOIN courses c ON c.id::text = m.course_id
      ORDER BY m.module_number ASC
      LIMIT 50
    `)
        return { props: { modules: rows } }
    } catch (e) {
        return { props: { modules: [], error: 'Erro ao carregar módulos.' } }
    }
}

export default function Home({ modules, error }: Props) {
    return (
        <>
            <Head>
                <title>Kreativ Educação — Portal do Aluno</title>
                <meta name="description" content="Acesse seus módulos e certificados na Kreativ Educação" />
                <link rel="icon" href="/favicon.ico" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            <nav className="navbar">
                <div className="navbar-inner">
                    <div className="logo">Kreativ <span>Portal do Aluno</span></div>
                    <a className="btn btn-gold" href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || '556399374165'}`} style={{ padding: '8px 16px', fontSize: '13px' }}>
                        💬 Falar com Tutor
                    </a>
                </div>
            </nav>

            <section className="hero">
                <div className="container">
                    <h1>Sua jornada de <em>aprendizado</em> começa aqui</h1>
                    <p>Acesse seus módulos, acompanhe seu progresso e obtenha seus certificados.</p>
                </div>
            </section>

            <main className="container" style={{ paddingBottom: '60px' }}>
                {error && (
                    <div className="centered" style={{ minHeight: '200px' }}>
                        <h2>⚠️ Erro</h2>
                        <p>{error}</p>
                    </div>
                )}

                {modules.length === 0 && !error && (
                    <div className="centered" style={{ minHeight: '300px' }}>
                        <div style={{ fontSize: '48px' }}>📚</div>
                        <h2>Nenhum módulo ainda</h2>
                        <p>Os módulos serão disponibilizados em breve. Fique ligado!</p>
                        <a className="btn btn-gold" href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || '556399374165'}`}>Notifique-me via WhatsApp</a>
                    </div>
                )}

                {modules.length > 0 && (
                    <>
                        <div style={{ padding: '40px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                                📖 Módulos Disponíveis
                                <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                                    {modules.length} módulo{modules.length !== 1 ? 's' : ''}
                                </span>
                            </h2>
                        </div>
                        <div className="cards two-col">
                            {modules.map((mod) => (
                                <Link key={mod.id} href={`/modulo/${mod.id}`} className="card">
                                    <div className="card-badge">📘 Módulo {mod.module_number}</div>
                                    <h2>{mod.title}</h2>
                                    <p>{mod.description || 'Clique para acessar o conteúdo deste módulo.'}</p>
                                    <div className="card-footer">
                                        <span style={{ color: 'var(--gold)', fontSize: '13px' }}>Ver módulo →</span>
                                        {mod.course_name && <span className="tag">{mod.course_name}</span>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </>
    )
}
