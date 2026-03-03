import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Pool } from 'pg'

interface Props {
    certId: string
    studentName: string | null
    moduleName: string | null
    courseName: string | null
    date: string | null
    valid: boolean
    fromDb: boolean
}

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
    const certId = params?.id as string

    // Tentar buscar no banco de dados
    try {
        const { rows } = await pool.query(`
            SELECT
                cert.verification_code,
                cert.module_name,
                cert.score_final,
                to_char(cert.issued_at, 'DD "de" TMMonth "de" YYYY') as issued_at,
                s.name as student_name,
                c.name as course_name
            FROM certificates cert
            JOIN students s ON s.id = cert.student_id
            LEFT JOIN courses c ON c.id = COALESCE(cert.course_int_id, cert.course_id::int)
            WHERE cert.verification_code = $1
            LIMIT 1
        `, [certId])

        if (rows.length > 0) {
            const row = rows[0]
            return {
                props: {
                    certId,
                    studentName: row.student_name || null,
                    moduleName: row.module_name || null,
                    courseName: row.course_name || null,
                    date: row.issued_at || null,
                    valid: true,
                    fromDb: true,
                }
            }
        }
    } catch (e) {
        console.error('Certificate DB lookup error:', e)
    }

    // Certificado não encontrado no DB
    return {
        props: {
            certId,
            studentName: null,
            moduleName: null,
            courseName: null,
            date: null,
            valid: false,
            fromDb: false,
        }
    }
}

export default function CertificadoPage({ certId, studentName, moduleName, courseName, date, valid }: Props) {
    return (
        <>
            <Head>
                <title>Certificado {certId} — Kreativ Educação</title>
                <meta name="description" content={`Certificado de conclusão emitido pela Kreativ Educação — Código ${certId}`} />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/" className="logo">Kreativ <span>Certificados</span></Link>
                </div>
            </nav>

            <main className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                {valid ? (
                    <div className="cert-container">
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                        <p className="cert-title">Kreativ Educação</p>
                        <h1 className="cert-h1">Certificado de Conclusão</h1>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Certificamos que</p>
                        <div className="cert-name">{studentName || 'Aluno(a)'}</div>
                        <p className="cert-info">
                            {moduleName ? (
                                <>concluiu com êxito o módulo<br /><strong>{moduleName}</strong><br />do curso <strong>{courseName || 'Kreativ Educação'}</strong><br />em <strong>{date}</strong></>
                            ) : (
                                <>concluiu com êxito o curso<br /><strong>{courseName || 'Kreativ Educação'}</strong><br />em <strong>{date}</strong></>
                            )}
                        </p>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(232,169,0,0.1)', border: '1px solid var(--gold)',
                            padding: '8px 16px', borderRadius: '8px', color: 'var(--gold)', fontSize: '13px',
                        }}>
                            ✅ Certificado Autêntico — verificado na base de dados Kreativ
                        </div>
                        <div className="cert-id">
                            Código de autenticidade: <strong>{certId}</strong>
                        </div>
                    </div>
                ) : (
                    <div className="centered">
                        <div style={{ fontSize: '48px' }}>❌</div>
                        <h2>Certificado não encontrado</h2>
                        <p>
                            O código <strong>{certId}</strong> não foi encontrado na nossa base de dados.
                            Verifique se o link está correto ou entre em contato pelo WhatsApp.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Link href="/" className="btn btn-outline">← Início</Link>
                            <a href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_PHONE || '556399374165'}`} className="btn btn-gold">💬 Falar pelo WhatsApp</a>
                        </div>
                    </div>
                )}
            </main>
        </>
    )
}
