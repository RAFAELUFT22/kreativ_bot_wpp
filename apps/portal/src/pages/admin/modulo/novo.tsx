import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

/* ===== Types ===== */

type BlockType = 'text' | 'video' | 'audio' | 'pdf' | 'image'

interface Block {
    order: number
    type: BlockType
    content?: string
    url?: string
    caption?: string
}

type QuizType = 'multiple_choice' | 'discursive'

interface QuizOption {
    value: string
}

interface QuizQuestion {
    type: QuizType
    question: string
    options?: QuizOption[]
    correct_answer?: string
}

interface Props {
    courseId: number | null
    courseName: string | null
    suggestedModuleNumber: number
}

/* ===== Server ===== */

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
    const token = req.cookies.admin_token || ''
    if (!verifyToken(token)) {
        return { redirect: { destination: '/admin/login', permanent: false } }
    }

    const courseIdParam = query.course_id as string | undefined
    if (!courseIdParam) {
        // Allow creating module without course pre-selected, but we still require auth
        return {
            props: {
                courseId: null,
                courseName: null,
                suggestedModuleNumber: 1,
            },
        }
    }

    const courseId = parseInt(courseIdParam, 10)
    if (Number.isNaN(courseId)) {
        return {
            props: {
                courseId: null,
                courseName: null,
                suggestedModuleNumber: 1,
            },
        }
    }

    try {
        const [courseRes, maxModuleRes] = await Promise.all([
            pool.query('SELECT id, name FROM courses WHERE id = $1', [courseId]),
            pool.query('SELECT COALESCE(MAX(module_number), 0) AS max_num FROM modules WHERE course_int_id = $1', [
                courseId,
            ]),
        ])

        const courseRow = courseRes.rows[0]
        const nextNumber = (maxModuleRes.rows[0]?.max_num || 0) + 1

        return {
            props: {
                courseId,
                courseName: courseRow ? courseRow.name : null,
                suggestedModuleNumber: nextNumber,
            },
        }
    } catch (e) {
        console.error('New module page error:', e)
        return {
            props: {
                courseId,
                courseName: null,
                suggestedModuleNumber: 1,
            },
        }
    }
}

/* ===== Component ===== */

export default function NewModulePage({ courseId, courseName, suggestedModuleNumber }: Props) {
    const router = useRouter()

    const [localCourseId, setLocalCourseId] = useState<number | ''>(courseId || '')
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [keyword, setKeyword] = useState('')
    const [moduleNumber, setModuleNumber] = useState<number | ''>(suggestedModuleNumber || 1)
    const [isPublished, setIsPublished] = useState<boolean>(true)
    const [blocks, setBlocks] = useState<Block[]>([
        { order: 1, type: 'text', content: '' },
        { order: 2, type: 'text', content: '' },
        { order: 3, type: 'text', content: '' },
    ])
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
    const [evaluationRubric, setEvaluationRubric] = useState('')

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function updateBlock(index: number, patch: Partial<Block>) {
        setBlocks((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], ...patch }
            return next.map((b, i) => ({ ...b, order: i + 1 }))
        })
    }

    function addBlock() {
        setBlocks((prev) => [
            ...prev,
            { order: prev.length + 1, type: 'text', content: '' },
        ])
    }

    function removeBlock(index: number) {
        setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i + 1 })))
    }

    function moveBlock(index: number, direction: -1 | 1) {
        setBlocks((prev) => {
            const target = index + direction
            if (target < 0 || target >= prev.length) return prev
            const next = [...prev]
            const temp = next[index]
            next[index] = next[target]
            next[target] = temp
            return next.map((b, i) => ({ ...b, order: i + 1 }))
        })
    }

    function updateQuizQuestion(index: number, patch: Partial<QuizQuestion>) {
        setQuizQuestions((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], ...patch }
            return next
        })
    }

    function updateQuizOption(qIndex: number, optIndex: number, value: string) {
        setQuizQuestions((prev) => {
            const next = [...prev]
            const q = next[qIndex]
            const options = q.options ? [...q.options] : []
            options[optIndex] = { value }
            next[qIndex] = { ...q, options }
            return next
        })
    }

    function addQuizQuestion(type: QuizType) {
        setQuizQuestions((prev) => [
            ...prev,
            type === 'multiple_choice'
                ? { type, question: '', options: [{ value: '' }, { value: '' }, { value: '' }], correct_answer: '' }
                : { type, question: '' },
        ])
    }

    function removeQuizQuestion(index: number) {
        setQuizQuestions((prev) => prev.filter((_, i) => i !== index))
    }

    function addQuizOption(qIndex: number) {
        setQuizQuestions((prev) => {
            const next = [...prev]
            const q = next[qIndex]
            const options = q.options ? [...q.options] : []
            options.push({ value: '' })
            next[qIndex] = { ...q, options }
            return next
        })
    }

    function removeQuizOption(qIndex: number, optIndex: number) {
        setQuizQuestions((prev) => {
            const next = [...prev]
            const q = next[qIndex]
            const options = (q.options || []).filter((_, i) => i !== optIndex)
            next[qIndex] = { ...q, options }
            return next
        })
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (!localCourseId) {
            setError('Selecione um curso (course_id) para criar o modulo.')
            return
        }
        if (!title.trim() || !moduleNumber) {
            setError('Titulo e numero do modulo sao obrigatorios.')
            return
        }

        setSaving(true)
        setError('')
        try {
            const res = await fetch('/api/admin/modulo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_int_id: localCourseId,
                    module_number: moduleNumber,
                    title: title.trim(),
                    description: description || null,
                    keyword: keyword || null,
                    is_published: isPublished,
                    blocks,
                    quiz_questions: quizQuestions,
                    evaluation_rubric: evaluationRubric || null,
                }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(data.error || 'Erro ao criar modulo.')
                setSaving(false)
                return
            }

            // After creating, go back to course page if possible
            router.push(`/admin/curso/${localCourseId}`)
        } catch {
            setError('Erro de rede ao salvar.')
            setSaving(false)
        }
    }

    return (
        <>
            <Head>
                <title>Novo modulo — Kreativ Admin</title>
                <meta name="description" content="Criar novo modulo" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
                    rel="stylesheet"
                />
            </Head>

            {/* Navbar */}
            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/admin" className="logo">
                        Kreativ <span>Admin</span>
                    </Link>
                    {localCourseId && (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                            <Link
                                href={`/admin/curso/${localCourseId}`}
                                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                            >
                                &larr; Voltar para curso
                            </Link>
                        </div>
                    )}
                </div>
            </nav>

            {/* Header */}
            <section
                style={{
                    background: 'radial-gradient(ellipse at top, rgba(232,169,0,0.07) 0%, transparent 70%)',
                    borderBottom: '1px solid var(--border)',
                    padding: '40px 0 32px',
                }}
            >
                <div className="container">
                    <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, marginBottom: '8px' }}>
                        Novo modulo
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        {courseId ? (
                            <>
                                Curso: {courseName || `#${courseId}`} — modulo sugerido {suggestedModuleNumber}
                            </>
                        ) : (
                            'Selecione o curso e preencha os dados do novo modulo.'
                        )}
                    </p>
                </div>
            </section>

            <main className="container" style={{ padding: '32px 0 60px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Meta */}
                    <section
                        style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '24px 20px',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                            Informacoes basicas
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    ID do curso (course_int_id)
                                </label>
                                <input
                                    className="admin-input"
                                    type="number"
                                    min={1}
                                    value={localCourseId}
                                    onChange={(e) =>
                                        setLocalCourseId(e.target.value ? parseInt(e.target.value, 10) : '')
                                    }
                                    placeholder="ex: 11"
                                />
                            </div>
                            <div>
                                <label
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Numero do modulo
                                </label>
                                <input
                                    className="admin-input"
                                    type="number"
                                    min={1}
                                    value={moduleNumber}
                                    onChange={(e) =>
                                        setModuleNumber(e.target.value ? parseInt(e.target.value, 10) : '')
                                    }
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                            <div>
                                <label
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Titulo
                                </label>
                                <input
                                    className="admin-input"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Nome do modulo"
                                />
                                <label
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'block',
                                        marginTop: '12px',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Descricao curta
                                </label>
                                <textarea
                                    className="admin-textarea"
                                    style={{ minHeight: 80 }}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Resumo curto do modulo..."
                                />
                            </div>
                            <div>
                                <label
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'block',
                                        marginBottom: '4px',
                                    }}
                                >
                                    Keyword (para WhatsApp / roteamento)
                                </label>
                                <input
                                    className="admin-input"
                                    type="text"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="ex: seguranca_alimentar"
                                />
                                <label className="admin-toggle" style={{ marginTop: '16px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isPublished}
                                        onChange={(e) => setIsPublished(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>Modulo publicado</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Blocks editor */}
                    <section
                        style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '24px 20px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px',
                            }}
                        >
                            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Blocos de conteudo</h2>
                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={addBlock}
                            >
                                + Adicionar bloco
                            </button>
                        </div>

                        {blocks.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Nenhum bloco. Clique em &quot;Adicionar bloco&quot;.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {blocks.map((b, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            background: 'rgba(13,17,23,0.7)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                    }}
                                                >
                                                    Bloco {index + 1}
                                                </span>
                                                <select
                                                    className="admin-select"
                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                    value={b.type}
                                                    onChange={(e) =>
                                                        updateBlock(index, { type: e.target.value as BlockType })
                                                    }
                                                >
                                                    <option value="text">Texto</option>
                                                    <option value="video">Video</option>
                                                    <option value="audio">Audio</option>
                                                    <option value="pdf">PDF</option>
                                                    <option value="image">Imagem</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                    disabled={index === 0}
                                                    onClick={() => moveBlock(index, -1)}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                                    disabled={index === blocks.length - 1}
                                                    onClick={() => moveBlock(index, 1)}
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '11px',
                                                        color: '#e86432',
                                                        borderColor: '#e86432',
                                                    }}
                                                    onClick={() => removeBlock(index)}
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        </div>

                                        {b.type === 'text' ? (
                                            <textarea
                                                className="admin-textarea"
                                                style={{ minHeight: 140 }}
                                                value={b.content || ''}
                                                onChange={(e) => updateBlock(index, { content: e.target.value })}
                                                placeholder="Conteudo em texto (markdown simples permitido)..."
                                            />
                                        ) : (
                                            <>
                                                <input
                                                    className="admin-input"
                                                    type="text"
                                                    value={b.url || ''}
                                                    onChange={(e) => updateBlock(index, { url: e.target.value })}
                                                    placeholder={
                                                        b.type === 'video'
                                                            ? 'URL do video (YouTube, etc)'
                                                            : b.type === 'audio'
                                                            ? 'URL do audio (mp3, etc)'
                                                            : b.type === 'pdf'
                                                            ? 'URL do PDF'
                                                            : 'URL da imagem'
                                                    }
                                                    style={{ marginBottom: '8px' }}
                                                />
                                                <input
                                                    className="admin-input"
                                                    type="text"
                                                    value={b.caption || ''}
                                                    onChange={(e) => updateBlock(index, { caption: e.target.value })}
                                                    placeholder="Legenda opcional"
                                                />
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Quiz editor */}
                    <section
                        style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '24px 20px',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px',
                            }}
                        >
                            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Quiz / Avaliacao</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    onClick={() => addQuizQuestion('multiple_choice')}
                                >
                                    + Multipla escolha
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                    onClick={() => addQuizQuestion('discursive')}
                                >
                                    + Discursiva
                                </button>
                            </div>
                        </div>

                        {quizQuestions.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Nenhuma pergunta adicionada. Use os botoes acima para criar o quiz.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {quizQuestions.map((q, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            background: 'rgba(13,17,23,0.7)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                }}
                                            >
                                                Pergunta {index + 1} —{' '}
                                                {q.type === 'multiple_choice' ? 'Multipla escolha' : 'Discursiva'}
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-outline"
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '11px',
                                                    color: '#e86432',
                                                    borderColor: '#e86432',
                                                }}
                                                onClick={() => removeQuizQuestion(index)}
                                            >
                                                Remover
                                            </button>
                                        </div>
                                        <textarea
                                            className="admin-textarea"
                                            style={{ minHeight: 80, marginBottom: '8px' }}
                                            value={q.question}
                                            onChange={(e) =>
                                                updateQuizQuestion(index, { question: e.target.value })
                                            }
                                            placeholder="Enunciado da pergunta..."
                                        />

                                        {q.type === 'multiple_choice' && (
                                            <div style={{ marginTop: '8px' }}>
                                                <div
                                                    style={{
                                                        fontSize: '12px',
                                                        color: 'var(--text-muted)',
                                                        fontWeight: 600,
                                                        marginBottom: '6px',
                                                    }}
                                                >
                                                    Opcoes
                                                </div>
                                                {(q.options || []).map((opt, optIndex) => (
                                                    <div
                                                        key={optIndex}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            marginBottom: '6px',
                                                        }}
                                                    >
                                                        <input
                                                            className="admin-input"
                                                            type="text"
                                                            value={opt.value}
                                                            onChange={(e) =>
                                                                updateQuizOption(index, optIndex, e.target.value)
                                                            }
                                                            placeholder={`Opcao ${optIndex + 1}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{
                                                                padding: '4px 8px',
                                                                fontSize: '11px',
                                                                color: '#e86432',
                                                                borderColor: '#e86432',
                                                            }}
                                                            onClick={() => removeQuizOption(index, optIndex)}
                                                        >
                                                            x
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    className="btn btn-outline"
                                                    style={{ padding: '4px 8px', fontSize: '11px', marginTop: '4px' }}
                                                    onClick={() => addQuizOption(index)}
                                                >
                                                    + Opcao
                                                </button>
                                                <div style={{ marginTop: '10px' }}>
                                                    <label
                                                        style={{
                                                            fontSize: '12px',
                                                            color: 'var(--text-muted)',
                                                            fontWeight: 600,
                                                            display: 'block',
                                                            marginBottom: '4px',
                                                        }}
                                                    >
                                                        Resposta correta (copiar exatamente o texto da opcao correta)
                                                    </label>
                                                    <input
                                                        className="admin-input"
                                                        type="text"
                                                        value={q.correct_answer || ''}
                                                        onChange={(e) =>
                                                            updateQuizQuestion(index, {
                                                                correct_answer: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Rubric */}
                    <section
                        style={{
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '24px 20px',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
                            Rubrica de avaliacao
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                            Explique em linguagem simples o que voce espera que o aluno demonstre apos concluir este
                            modulo (criterios de aprovacao, exemplos de boas respostas etc.).
                        </p>
                        <textarea
                            className="admin-textarea"
                            style={{ minHeight: 120 }}
                            value={evaluationRubric}
                            onChange={(e) => setEvaluationRubric(e.target.value)}
                            placeholder="Exemplo: O aluno deve ser capaz de explicar com suas palavras o conceito central, dar pelo menos um exemplo pratico da propria realidade e indicar um proximo passo concreto..."
                        />
                    </section>

                    {/* Footer actions */}
                    <section
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '8px',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                type="submit"
                                className="btn btn-gold"
                                disabled={saving}
                                style={{ paddingInline: '24px' }}
                            >
                                {saving ? 'Salvando...' : 'Criar modulo'}
                            </button>
                        </div>
                        {error && (
                            <div style={{ color: '#e86432', fontSize: '13px', maxWidth: '360px', textAlign: 'right' }}>
                                {error}
                            </div>
                        )}
                    </section>
                </form>
            </main>
        </>
    )
}


