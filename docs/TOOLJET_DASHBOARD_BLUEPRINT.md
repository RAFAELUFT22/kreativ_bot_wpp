# Blueprint: Student Management Dashboard (ToolJet)

This document provides the blueprint for building the administrative dashboard in ToolJet to manage students, courses, and modules in the Kreativ Educação ecosystem.

## 1. Data Sources Setup

### 1.1 PostgreSQL (Kreativ DB)
- **Name:** `Kreativ DB`
- **Host:** `kreativ_postgres`
- **Port:** `5432`
- **Database:** `kreativ_edu`
- **User:** `kreativ_user`
- **Password:** `O3ITwWNXcfqSEpclJBE32viQ`
- **SSL:** `Disabled`

### 1.2 REST API (Kreativ Unified API)
- **Name:** `Kreativ API`
- **Base URL:** `https://n8n.extensionista.site/webhook`
- **Headers:**
  - `Content-Type: application/json`

---

## 2. App: Student Management

### 2.1 Queries

#### `listarAlunos` (Kreativ DB)
```sql
SELECT s.id, s.phone, s.name, s.email, s.course_id, 
       c.name as course_name, s.current_module, 
       s.completed_modules, s.attendance_status, s.lead_score,
       to_char(s.created_at, 'DD/MM/YYYY') as data_cadastro
FROM students s
LEFT JOIN courses c ON c.id = s.course_id
WHERE s.phone ILIKE '%{{components.searchInput.value}}%'
   OR s.name ILIKE '%{{components.searchInput.value}}%'
ORDER BY s.created_at DESC LIMIT 100
```

#### `upsertStudent` (Kreativ API)
- **Method:** `POST`
- **Path:** `/kreativ-unified-api`
- **Body:**
```json
{
  "action": "admin_upsert_student",
  "phone": "{{components.phoneInput.value}}",
  "name": "{{components.nameInput.value}}",
  "course_id": {{components.courseSelect.value}}
}
```

#### `resetStudentProgress` (Kreativ API)
- **Method:** `POST`
- **Path:** `/kreativ-unified-api`
- **Body:**
```json
{
  "action": "admin_reset_student",
  "phone": "{{components.studentsTable.selectedRow.phone}}"
}
```

### 2.2 Components Layout
- **Container (Header):** Title "Gestão de Alunos" + Button "Novo Aluno" (opens Modal).
- **Search Bar (`searchInput`):** Text Input to filter students.
- **Students Table (`studentsTable`):**
  - Columns: Telefone, Nome, Curso, Módulo Atual, Status, Cadastro.
  - Action Buttons (Row):
    - ✏️ **Editar:** Opens modal with student data.
    - 🔄 **Resetar:** Triggers `resetStudentProgress`.
- **Upsert Modal:**
  - `nameInput`: Text Input.
  - `phoneInput`: Text Input.
  - `courseSelect`: Dropdown (Data source: `SELECT id as value, name as label FROM courses`).
  - **Save Button:** Triggers `upsertStudent`.

---

## 3. App: Course & Module Management

### 3.1 Queries

#### `listarCursos` (Kreativ DB)
```sql
SELECT id, name, area, is_active FROM courses ORDER BY name
```

#### `listarModulos` (Kreativ DB)
```sql
SELECT m.id, m.module_number, m.title, m.description, 
       m.content_text, m.is_published, m.passing_score
FROM modules m
WHERE m.course_int_id = {{components.courseTable.selectedRow.id}}
ORDER BY m.module_number
```

#### `updateModule` (Kreativ DB)
```sql
UPDATE modules SET
  title = '{{components.modTitle.value}}',
  description = '{{components.modDesc.value}}',
  content_text = '{{components.modContent.value}}',
  passing_score = {{components.modScore.value}},
  is_published = {{components.modPublished.value}},
  updated_at = NOW()
WHERE id = {{components.modulesTable.selectedRow.id}}
```

### 3.2 Components Layout
- **Tabs:** "Cursos" and "Conteúdo".
- **Course Table:** List of available courses.
- **Module Table (linked to Course):** Shows modules for the selected course.
- **Rich Text Editor:** For editing `content_text` of modules.
- **JSON Editor (optional):** For editing `quiz_questions` if stored as JSONB.

---

## 4. Implementation Steps in ToolJet

1. **Import Data Sources:** Configure PostgreSQL and n8n as described in Section 1.
2. **Create New App:** Start with "Gestão de Alunos".
3. **Build Queries:** Copy-paste the SQL and JSON bodies provided above.
4. **Drag & Drop UI:** Arrange components on the canvas and link them to the queries.
5. **Add Event Handlers:**
   - Table Row Click → Set Variable (selected student).
   - Button Click → Run Query → Show Toast (Success/Error) → Refresh Table.
6. **Preview & Deploy:** Test with number `5563999374165` to verify integration.
