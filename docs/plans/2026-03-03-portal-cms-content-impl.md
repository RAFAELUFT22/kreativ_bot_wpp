# Portal CMS + Content Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin area in the Portal Next.js app for managing courses/modules/pre-inscriptions, and generate course content for the top 8 courses without content.

**Architecture:** New `/admin/*` pages in the existing Next.js 14 portal (pages router). Auth via ADMIN_PASSWORD in .env with HMAC-SHA256 cookie. API Routes for mutations. Content generated as SQL seed following Khan Academy mastery-based learning pattern.

**Tech Stack:** Next.js 14 (pages router), pg Pool (direct PostgreSQL), CSS variables (existing design system), TypeScript

---

## Task 1: Auth — API Route + Login Page

**Files:**
- Create: `apps/portal/src/pages/api/admin/login.ts`
- Create: `apps/portal/src/lib/auth.ts`
- Create: `apps/portal/src/pages/admin/login.tsx`

**Step 1: Create the auth utility**

Create `apps/portal/src/lib/auth.ts`:

```typescript
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
```

**Step 2: Create the login API route**

Create `apps/portal/src/pages/api/admin/login.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyPassword, createToken } from '@/lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const { password } = req.body
    if (!verifyPassword(password)) return res.status(401).json({ error: 'Senha incorreta' })
    const token = createToken()
    res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`)
    return res.status(200).json({ ok: true })
}
```

**Step 3: Create the login page**

Create `apps/portal/src/pages/admin/login.tsx`:

```typescript
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
```

**Step 4: Test manually**

Add `ADMIN_PASSWORD=kreativ2026` to `.env` (or `.env.example`).

Run: `cd apps/portal && npm run dev`
Visit: `http://localhost:3000/admin/login`
Expected: Login form renders. Wrong password shows error. Correct password redirects to /admin.

**Step 5: Commit**

```bash
git add apps/portal/src/lib/auth.ts apps/portal/src/pages/api/admin/login.ts apps/portal/src/pages/admin/login.tsx
git commit -m "feat(admin): add auth utility and login page"
```

---

## Task 2: Admin Dashboard Page

**Files:**
- Create: `apps/portal/src/lib/db.ts`
- Create: `apps/portal/src/pages/admin/index.tsx`

**Step 1: Extract shared db pool**

Create `apps/portal/src/lib/db.ts` — single Pool instance shared across pages:

```typescript
import { Pool } from 'pg'

const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kreativ_edu',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
})

export default pool
```

**Step 2: Create admin dashboard**

Create `apps/portal/src/pages/admin/index.tsx`:

```typescript
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

interface Stats {
    courses: number
    modules: number
    students: number
    preInscriptions: number
    certificates: number
}

interface CourseRow {
    id: number
    name: string
    area: string
    module_count: number
    student_count: number
    pre_inscription_count: number
}

interface Props {
    stats: Stats
    courses: CourseRow[]
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const token = req.cookies.admin_token || ''
    if (!verifyToken(token)) return { redirect: { destination: '/admin/login', permanent: false } }

    const [statsRes, coursesRes] = await Promise.all([
        pool.query(`
            SELECT
                (SELECT COUNT(*) FROM courses WHERE is_active = true)::int as courses,
                (SELECT COUNT(*) FROM modules WHERE is_published = true)::int as modules,
                (SELECT COUNT(*) FROM students)::int as students,
                (SELECT COUNT(*) FROM pre_inscriptions WHERE convertido = false)::int as pre_inscriptions,
                (SELECT COUNT(*) FROM certificates)::int as certificates
        `),
        pool.query(`
            SELECT c.id, c.name, c.area,
                COUNT(DISTINCT m.id)::int as module_count,
                COUNT(DISTINCT s.id)::int as student_count,
                COUNT(DISTINCT pic.pre_inscription_id)::int as pre_inscription_count
            FROM courses c
            LEFT JOIN modules m ON m.course_int_id = c.id AND m.is_published = true
            LEFT JOIN students s ON s.course_id = c.id
            LEFT JOIN pre_inscription_courses pic ON pic.course_id = c.id
            WHERE c.is_active = true
            GROUP BY c.id, c.name, c.area
            ORDER BY pre_inscription_count DESC, c.name
        `)
    ])

    return {
        props: {
            stats: statsRes.rows[0],
            courses: coursesRes.rows,
        }
    }
}

export default function AdminDashboard({ stats, courses }: Props) {
    const statCards = [
        { label: 'Cursos Ativos', value: stats.courses, icon: '📚' },
        { label: 'Módulos Publicados', value: stats.modules, icon: '📖' },
        { label: 'Alunos Matriculados', value: stats.students, icon: '🎓' },
        { label: 'Pré-inscritos Pendentes', value: stats.preInscriptions, icon: '📋' },
        { label: 'Certificados Emitidos', value: stats.certificates, icon: '🏆' },
    ]

    return (
        <>
            <Head>
                <title>Admin Dashboard — Kreativ Educação</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
            </Head>

            <nav className="navbar">
                <div className="navbar-inner">
                    <Link href="/admin" className="logo">Kreativ <span>Admin</span></Link>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Link href="/admin/pre-inscritos" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
                            Pré-inscritos
                        </Link>
                        <Link href="/" className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
                            Portal
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '40px' }}>
                    {statCards.map((s) => (
                        <div key={s.label} style={{
                            background: 'var(--bg2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--gold)' }}>{s.value}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Courses Table */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Cursos</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Curso</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Área</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Módulos</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Alunos</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Pré-inscritos</th>
                                <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map((c) => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>{c.name}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                        <span className="tag">{c.area}</span>
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: c.module_count > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                                        {c.module_count}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{c.student_count}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{c.pre_inscription_count}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                        <Link href={`/admin/curso/${c.id}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '13px' }}>
                                            Gerenciar →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </>
    )
}
```

**Step 3: Test manually**

Visit: `http://localhost:3000/admin` (should redirect to login if not authed).
Login, then verify dashboard shows stats and course table.

**Step 4: Commit**

```bash
git add apps/portal/src/lib/db.ts apps/portal/src/pages/admin/index.tsx
git commit -m "feat(admin): dashboard page with stats and courses table"
```

---

## Task 3: Course Detail + Module List Page

**Files:**
- Create: `apps/portal/src/pages/admin/curso/[id].tsx`

**Step 1: Create course detail page**

Create `apps/portal/src/pages/admin/curso/[id].tsx`:

This page shows the course details and lists all its modules with links to edit each one. It also has a "Novo Módulo" button.

Key queries:
- `SELECT * FROM courses WHERE id = $1` — course info
- `SELECT * FROM modules WHERE course_int_id = $1 ORDER BY module_number` — modules list

Display:
- Course name, area, slug at top
- Table of modules: number, title, published status, actions (edit/delete)
- Button: "Novo Módulo" → links to `/admin/modulo/novo?course_id=X`

Auth check: same pattern — `verifyToken(req.cookies.admin_token)` → redirect to login if invalid.

**Step 2: Test manually**

Click "Gerenciar →" from dashboard for any course.
Expected: Course page loads with module list (empty for courses without content).

**Step 3: Commit**

```bash
git add apps/portal/src/pages/admin/curso/[id].tsx
git commit -m "feat(admin): course detail page with module list"
```

---

## Task 4: Module Editor Page (Create + Edit)

**Files:**
- Create: `apps/portal/src/pages/admin/modulo/[id].tsx`
- Create: `apps/portal/src/pages/admin/modulo/novo.tsx`
- Create: `apps/portal/src/pages/api/admin/modulo.ts`
- Create: `apps/portal/src/pages/api/admin/modulo/[id].ts`

**Step 1: Create module mutation API routes**

`apps/portal/src/pages/api/admin/modulo.ts` — POST (create module):

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { course_int_id, module_number, title, description, keyword, blocks, quiz_questions, evaluation_rubric, is_published } = req.body

    const { rows } = await pool.query(`
        INSERT INTO modules (course_int_id, module_number, title, description, keyword, blocks, quiz_questions, evaluation_rubric, is_published)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
        RETURNING id
    `, [course_int_id, module_number, title, description || null, keyword || null,
        JSON.stringify(blocks || []), JSON.stringify(quiz_questions || []),
        evaluation_rubric || null, is_published !== false])

    return res.status(201).json({ ok: true, id: rows[0].id })
}
```

`apps/portal/src/pages/api/admin/modulo/[id].ts` — PUT (update) and DELETE:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    const id = req.query.id as string

    if (req.method === 'PUT') {
        const { title, description, keyword, blocks, quiz_questions, evaluation_rubric, is_published, module_number } = req.body
        await pool.query(`
            UPDATE modules SET
                title = COALESCE($2, title),
                description = COALESCE($3, description),
                keyword = $4,
                blocks = $5::jsonb,
                quiz_questions = $6::jsonb,
                evaluation_rubric = $7,
                is_published = $8,
                module_number = COALESCE($9, module_number),
                updated_at = NOW()
            WHERE id = $1
        `, [id, title, description, keyword || null,
            JSON.stringify(blocks || []), JSON.stringify(quiz_questions || []),
            evaluation_rubric || null, is_published !== false, module_number])
        return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
        await pool.query('DELETE FROM modules WHERE id = $1', [id])
        return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
```

**Step 2: Create the module editor page**

Create `apps/portal/src/pages/admin/modulo/[id].tsx`:

This is the main editor with:
- Form fields: title, description, module_number, keyword, is_published toggle
- **Blocks editor**: ordered list of blocks. Each block has type selector (text/video/audio/pdf/image) and content/url textarea. Add/remove/reorder buttons.
- **Quiz editor**: list of questions. Each question has type selector (multiple_choice/discursive), question text, options (for MC), correct answer (for MC). Add/remove buttons.
- **Rubrica textarea**: evaluation_rubric field
- Save button → PUT /api/admin/modulo/[id]
- Delete button → DELETE /api/admin/modulo/[id] with confirmation

Data fetching in `getServerSideProps`:
```sql
SELECT m.*, c.name as course_name
FROM modules m
LEFT JOIN courses c ON c.id = m.course_int_id
WHERE m.id = $1
```

**Step 3: Create the new module page**

Create `apps/portal/src/pages/admin/modulo/novo.tsx`:

Same editor but empty state. Query param `?course_id=X` pre-selects course.
On save → POST /api/admin/modulo → redirect to `/admin/curso/[course_id]`

**Step 4: Test manually**

- Create a new module for course 21 (Culinária Saudável)
- Add 3 text blocks and a quiz question
- Save and verify it appears in course detail page
- Edit the module, change title, verify persistence
- Delete the module, verify removal

**Step 5: Commit**

```bash
git add apps/portal/src/pages/api/admin/modulo.ts apps/portal/src/pages/api/admin/modulo/[id].ts apps/portal/src/pages/admin/modulo/[id].tsx apps/portal/src/pages/admin/modulo/novo.tsx
git commit -m "feat(admin): module editor with blocks and quiz CRUD"
```

---

## Task 5: Pre-inscriptions CRM Page

**Files:**
- Create: `apps/portal/src/pages/admin/pre-inscritos.tsx`
- Create: `apps/portal/src/pages/api/admin/matricular.ts`

**Step 1: Create the matricular API route**

`apps/portal/src/pages/api/admin/matricular.ts`:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken } from '@/lib/auth'
import pool from '@/lib/db'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!verifyToken(req.cookies.admin_token || '')) return res.status(401).json({ error: 'Unauthorized' })
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { pre_inscription_id, course_id } = req.body
    if (!pre_inscription_id || !course_id) return res.status(400).json({ error: 'Missing fields' })

    // Fetch pre-inscription data
    const { rows: piRows } = await pool.query(
        'SELECT nome_completo, telefone_whatsapp, email FROM pre_inscriptions WHERE id = $1',
        [pre_inscription_id]
    )
    if (!piRows.length) return res.status(404).json({ error: 'Pré-inscrição não encontrada' })
    const pi = piRows[0]

    // Check if student already exists by phone
    const { rows: existing } = await pool.query('SELECT id FROM students WHERE phone = $1', [pi.telefone_whatsapp])
    let studentId: string

    if (existing.length) {
        studentId = existing[0].id
        // Update course if needed
        await pool.query('UPDATE students SET course_id = $1 WHERE id = $2', [course_id, studentId])
    } else {
        const portalToken = crypto.randomUUID()
        const { rows: newStudent } = await pool.query(`
            INSERT INTO students (phone, name, email, course_id, current_module, portal_token)
            VALUES ($1, $2, $3, $4, 1, $5)
            RETURNING id
        `, [pi.telefone_whatsapp, pi.nome_completo, pi.email, course_id, portalToken])
        studentId = newStudent[0].id
    }

    // Mark pre-inscription as converted
    await pool.query(
        'UPDATE pre_inscriptions SET convertido = true, student_id = $1 WHERE id = $2',
        [studentId, pre_inscription_id]
    )

    return res.status(200).json({ ok: true, student_id: studentId })
}
```

**Step 2: Create pre-inscriptions page**

Create `apps/portal/src/pages/admin/pre-inscritos.tsx`:

Key features:
- Server-side query with pagination (20 per page, `?page=N`)
- Filter by: nome (ILIKE), cidade (ILIKE), course_id, convertido (true/false)
- Stats bar: total, convertidos, pendentes
- Table columns: nome, telefone, cidade, cursos de interesse (from pre_inscription_courses JOIN courses), status badge, "Matricular" button
- Matricular button opens inline dropdown to select course → POST /api/admin/matricular → refresh page

Query:
```sql
SELECT pi.id, pi.nome_completo, pi.telefone_whatsapp, pi.cidade, pi.estado,
       pi.convertido, pi.review_required,
       array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL) as cursos_interesse
FROM pre_inscriptions pi
LEFT JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
LEFT JOIN courses c ON c.id = pic.course_id
WHERE ($1::text IS NULL OR pi.nome_completo ILIKE '%' || $1 || '%')
  AND ($2::int IS NULL OR pic.course_id = $2)
  AND ($3::boolean IS NULL OR pi.convertido = $3)
GROUP BY pi.id
ORDER BY pi.data_primeira_inscricao DESC NULLS LAST
LIMIT 20 OFFSET $4
```

**Step 3: Test manually**

- Visit `/admin/pre-inscritos`
- Verify 508 pre-inscriptions load
- Filter by course, name
- Click "Matricular" for one → select course → verify student created in DB

**Step 4: Commit**

```bash
git add apps/portal/src/pages/admin/pre-inscritos.tsx apps/portal/src/pages/api/admin/matricular.ts
git commit -m "feat(admin): pre-inscriptions CRM page with matriculation"
```

---

## Task 6: Admin CSS Additions

**Files:**
- Modify: `apps/portal/src/styles/globals.css`

**Step 1: Add admin-specific CSS**

Append to `apps/portal/src/styles/globals.css`:

```css
/* ===== Admin ===== */
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th {
  text-align: left; padding: 12px 8px;
  color: var(--text-muted); font-weight: 600; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}
.admin-table td { padding: 12px 8px; border-bottom: 1px solid var(--border); }
.admin-table tr:hover td { background: rgba(255,255,255,0.02); }

.admin-input {
  padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--text); font-size: 14px; font-family: var(--font);
  outline: none; width: 100%; transition: border-color 0.2s;
}
.admin-input:focus { border-color: var(--gold); }

.admin-textarea {
  padding: 12px 14px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--text); font-size: 14px; font-family: var(--font);
  outline: none; width: 100%; min-height: 120px; resize: vertical;
  line-height: 1.6; transition: border-color 0.2s;
}
.admin-textarea:focus { border-color: var(--gold); }

.admin-select {
  padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--text); font-size: 14px; font-family: var(--font);
  outline: none; cursor: pointer;
}

.admin-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  cursor: pointer; font-size: 14px;
}

.admin-badge {
  display: inline-flex; padding: 2px 10px; border-radius: 40px;
  font-size: 11px; font-weight: 600;
}
.admin-badge.success { background: rgba(100,200,100,0.15); color: #7dcf7d; }
.admin-badge.warning { background: rgba(232,169,0,0.15); color: var(--gold); }
.admin-badge.danger { background: rgba(232,100,50,0.15); color: #e86432; }
.admin-badge.info { background: rgba(56,139,253,0.12); color: var(--accent); }
```

**Step 2: Commit**

```bash
git add apps/portal/src/styles/globals.css
git commit -m "feat(admin): add admin-specific CSS classes"
```

---

## Task 7: Generate Course Content — SQL Seed (8 courses × 3 modules)

**Files:**
- Create: `init-scripts/09-seed-content-top8.sql`

**Step 1: Write the SQL seed file**

Create `init-scripts/09-seed-content-top8.sql` with 24 module INSERTs.

Each module follows the Khan Academy pattern:
- 3 blocks JSONB (conceito, exemplo prático, dica prática) — real educational content in Portuguese
- quiz_questions JSONB with 3 MC + 1 discursive
- evaluation_rubric TEXT
- is_published = TRUE

**Content guidelines:**
- Language: Portuguese BR, informal/accessible (public: rural producers, small entrepreneurs, community workers)
- Each text block: 300-500 words
- Real-world examples from the Brazilian context (PAA, PNAE, MEI, PRONAF, SEBRAE, etc.)
- Quiz questions test comprehension and application, not memorization
- Rubric: empathetic, constructive evaluation criteria

**Important SQL notes:**
- Use `course_int_id` (INTEGER) — NOT `course_id` (VARCHAR)
- Use `ON CONFLICT (course_int_id, module_number) DO UPDATE` to be idempotent
- Set `content_text` as concatenation of all blocks' text content (for legacy compatibility)
- Generate a descriptive `keyword` per module (for WhatsApp routing)

**Structure per INSERT:**
```sql
INSERT INTO modules (course_int_id, module_number, title, description, keyword, content_text, blocks, quiz_questions, evaluation_rubric, is_published)
VALUES (
    <course_id>,
    <module_number>,
    '<title>',
    '<short description>',
    '<unique_keyword>',
    '<content_text fallback>',
    '<blocks JSONB>',
    '<quiz_questions JSONB>',
    '<evaluation_rubric>',
    TRUE
)
ON CONFLICT (course_int_id, module_number) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    keyword = EXCLUDED.keyword,
    content_text = EXCLUDED.content_text,
    blocks = EXCLUDED.blocks,
    quiz_questions = EXCLUDED.quiz_questions,
    evaluation_rubric = EXCLUDED.evaluation_rubric,
    is_published = EXCLUDED.is_published,
    updated_at = NOW();
```

**Courses to generate (in order):**

1. **Course 11** — Boas Práticas na Produção e Manipulação de Alimentos (89 pre-inscriptions)
   - M1: Segurança Alimentar — Conceitos Fundamentais (keyword: `seguranca_alimentar`)
   - M2: Higiene na Manipulação de Alimentos (keyword: `higiene_alimentos`)
   - M3: Controle de Qualidade e Boas Práticas (keyword: `controle_qualidade`)

2. **Course 7** — Organização da Produção para o Mercado (83 pre-inscriptions)
   - M1: Planejamento e Organização da Produção (keyword: `planejamento_producao`)
   - M2: Acesso a Mercados Locais e Regionais (keyword: `acesso_mercados`)
   - M3: Precificação e Estratégias de Venda (keyword: `precificacao_vendas`)

3. **Course 16** — Produção Audiovisual (27 pre-inscriptions)
   - M1: Fundamentos da Produção Audiovisual (keyword: `fundamentos_audiovisual`)
   - M2: Roteiro, Gravação e Produção (keyword: `roteiro_producao`)
   - M3: Edição, Publicação e Distribuição (keyword: `edicao_distribuicao`)

4. **Course 2** — Saúde e Bem-estar (22 pre-inscriptions)
   - M1: Saúde Preventiva no Ambiente de Trabalho (keyword: `saude_preventiva`)
   - M2: Alimentação Equilibrada e Qualidade de Vida (keyword: `alimentacao_equilibrada`)
   - M3: Saúde Mental e Produtividade (keyword: `saude_mental`)

5. **Course 1** — Administração e Gestão (16 pre-inscriptions)
   - M1: Fundamentos de Gestão para Pequenos Negócios (keyword: `fundamentos_gestao`)
   - M2: Planejamento Estratégico Simplificado (keyword: `planejamento_estrategico`)
   - M3: Gestão de Pessoas e Processos (keyword: `gestao_pessoas`)

6. **Course 13** — Desenvolvimento de Quintais Produtivos (6 pre-inscriptions)
   - M1: Planejamento do Quintal Produtivo (keyword: `quintal_planejamento`)
   - M2: Técnicas de Cultivo e Manejo (keyword: `cultivo_manejo`)
   - M3: Beneficiamento e Comercialização (keyword: `beneficiamento_venda`)

7. **Course 6** — Elaboração de Projetos para Captação de Recursos (2 pre-inscriptions)
   - M1: Fontes de Financiamento e Editais (keyword: `fontes_financiamento`)
   - M2: Elaboração do Projeto — Passo a Passo (keyword: `elaboracao_projetos`)
   - M3: Prestação de Contas e Monitoramento (keyword: `prestacao_contas`)

8. **Course 21** — Culinária Saudável (1 pre-inscription)
   - M1: Nutrição Básica e Escolha de Ingredientes (keyword: `nutricao_basica`)
   - M2: Técnicas de Preparo Saudável (keyword: `preparo_saudavel`)
   - M3: Cardápio Empreendedor — Da Cozinha ao Negócio (keyword: `cardapio_empreendedor`)

**Step 2: Apply migration**

Run:
```bash
docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < init-scripts/09-seed-content-top8.sql
```

Expected: 24 rows inserted/updated, no errors.

**Step 3: Verify in portal**

Visit `http://localhost:3000` — should now show 24 new published modules.
Visit `/admin` — module counts should update.

**Step 4: Commit**

```bash
git add init-scripts/09-seed-content-top8.sql
git commit -m "feat(content): generate 24 modules for top 8 courses — Khan Academy style"
```

---

## Task 8: Update Existing Courses (5 + 4 TDS modules)

**Files:**
- Modify: `init-scripts/09-seed-content-top8.sql` (add section for course 5 update)

**Step 1: Update course 5 (Gestão Financeira) modules**

Course 5 already has 3 modules from TDS seed, but their `content_text` is AI directives, not real content. Update them with proper blocks + quiz:

```sql
UPDATE modules SET
    blocks = '<proper blocks JSONB>',
    quiz_questions = '<hybrid quiz JSONB>',
    evaluation_rubric = '<rubric>',
    is_published = TRUE,
    updated_at = NOW()
WHERE course_int_id = 5 AND module_number = 1;
-- repeat for modules 2 and 3
```

Also update course 4 (Agronegócio) 3 TDS modules similarly.

**Step 2: Apply and verify**

```bash
docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < init-scripts/09-seed-content-top8.sql
```

**Step 3: Commit**

```bash
git add init-scripts/09-seed-content-top8.sql
git commit -m "feat(content): upgrade TDS modules with proper blocks and hybrid quizzes"
```

---

## Task 9: Docker Build + .env Update

**Files:**
- Modify: `.env.example` (add ADMIN_PASSWORD)
- Test: Docker build of portal

**Step 1: Add ADMIN_PASSWORD to .env.example**

Add line: `ADMIN_PASSWORD=change_me_in_production`

**Step 2: Test Docker build**

```bash
cd apps/portal && docker build -t kreativ-portal-test .
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Rebuild in compose**

```bash
docker compose build portal && docker compose up -d portal
```

Expected: Portal restarts, admin pages accessible at `https://portal.extensionista.site/admin/login`

**Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add ADMIN_PASSWORD to .env.example"
```

---

## Task 10: Final Verification Checklist

**Step 1: Verify all admin pages**

- [ ] `/admin/login` — renders, authenticates
- [ ] `/admin` — shows stats, courses table
- [ ] `/admin/curso/[id]` — shows course with module list
- [ ] `/admin/modulo/novo` — create module works
- [ ] `/admin/modulo/[id]` — edit module works (blocks + quiz)
- [ ] `/admin/pre-inscritos` — lists 508 pre-inscriptions, filters work
- [ ] Matricular button converts pre-inscription to student
- [ ] Unauthenticated access redirects to login

**Step 2: Verify generated content**

- [ ] 24 new modules visible on portal home
- [ ] Each module has 3 text blocks rendering correctly via ReactMarkdown
- [ ] Quiz questions stored correctly in DB
- [ ] Course 5 and 4 TDS modules updated with real content

**Step 3: Verify Docker build**

```bash
docker compose build portal && docker compose up -d portal
```

- [ ] No TypeScript build errors
- [ ] Portal accessible at production URL

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Portal CMS admin + 24 modules generated for top 10 courses"
```

---

## Summary

| Task | Description | Files | Est. Complexity |
|------|-------------|-------|:-:|
| 1 | Auth (login page + API + utility) | 3 new files | Medium |
| 2 | Admin Dashboard | 2 new files | Medium |
| 3 | Course Detail Page | 1 new file | Simple |
| 4 | Module Editor (create + edit + API) | 4 new files | High |
| 5 | Pre-inscriptions CRM + Matricular | 2 new files | Medium |
| 6 | Admin CSS | 1 modified file | Simple |
| 7 | Generate 24 modules SQL seed | 1 new file | High (content) |
| 8 | Update TDS modules | 1 modified file | Medium |
| 9 | Docker + .env | 1 modified file | Simple |
| 10 | Verification | - | Simple |

**Total: ~14 new files, ~2 modified files, 24 modules of educational content**
