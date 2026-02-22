# Kreativ Educação — Design: ToolJet Admin + Metabase Analytics
> **Data:** 2026-02-22
> **Status:** Aprovado — aguardando implementação
> **Autor:** Sessão de brainstorming Claude Sonnet 4.6

---

## 1. Visão Geral

| Ferramenta | Propósito | URL | Estado atual |
|---|---|---|---|
| **ToolJet** | Admin CRUD (conteúdo, alunos, operações) | https://admin.extensionista.site | Rodando, data sources configuradas, zero apps |
| **Metabase** | Analytics / KPIs (leitura) | https://dash.extensionista.site | Rodando, conectado, só dashboard de amostra |

**Princípio:** ToolJet opera (escreve), Metabase observa (lê).

---

## 2. ToolJet — App "Kreativ Admin"

### 2.1 Estrutura

Um único app com 3 abas e RBAC via grupos do ToolJet EE-LTS.

```
App: "Kreativ Admin"
  ├── [Aba 1] Conteúdo    → grupos: admin, conteudo
  ├── [Aba 2] Alunos      → grupos: admin, tutor
  └── [Aba 3] Admin       → grupo: admin (Rafael only)
```

### 2.2 RBAC — Grupos

| Grupo | Aba Conteúdo | Aba Alunos | Aba Admin |
|---|---|---|---|
| `admin` (Rafael) | ✅ | ✅ | ✅ |
| `tutor` | ❌ | ✅ | ❌ |
| `conteudo` | ✅ | ❌ | ❌ |

*Criar grupos via ToolJet → Settings → Workspace → Groups. Inicialmente convidar só Rafael.*

### 2.3 Aba Conteúdo (PRIORIDADE)

**Layout:**
```
┌──────────────┬───────────────────────────────────────────────┐
│  Cursos      │  Módulos do Curso Selecionado                 │
│              │  N°  Título              Publicado  Ações      │
│  Agronegócio │  1   Introdução          ✅          [Editar]  │
│  IA no Dia a │  2   Documentação Rural  📝          [Editar]  │
│  Alimentação │  3   Comercialização     📝          [Editar]  │
└──────────────┴───────────────────────────────────────────────┘
```

**Modal de edição** (abre ao clicar [Editar]):
- `Título` — Text Input
- `Conteúdo` — Rich Text Editor (ou Textarea para markdown)
- `Rubrica de Avaliação` — Textarea
- `Publicado` — Toggle
- Botões: [Cancelar] [Salvar]

### 2.4 Aba Alunos

**Layout:**
```
[ Buscar por nome ou telefone... ]

Nome      Telefone        Curso           Módulo  Score  Último Quiz
Aluno     556399374165    Agronegócio     2       78     15/02/2026  [Ver]
...
```

**Modal do aluno** (ao clicar [Ver]):
- Dados do aluno (nome, telefone, portal_token)
- Tabela de `enrollment_progress` (módulo, status, score, feedback, data)
- Botão [Resetar Progresso] → chama N8N `admin_reset_student`

### 2.5 Aba Admin (Rafael only)

Seções:
1. **Cadastrar/Editar Aluno** → form → N8N `admin_upsert_student`
2. **Cadastrar Curso** → form → N8N `admin_upsert_course`
3. **Cadastrar Módulo** → form → N8N `admin_upsert_module`

---

## 3. ToolJet — Queries SQL

### Query 1: Listar Cursos

```sql
SELECT id, name, description, created_at
FROM courses
ORDER BY name ASC
```
*Tipo: Run Query. Popula o seletor de curso (lista lateral esquerda).*

---

### Query 2: Listar Módulos do Curso Selecionado

```sql
SELECT
  m.id,
  m.module_number,
  m.title,
  m.is_published,
  LENGTH(m.content_text) AS chars_content,
  m.course_int_id
FROM modules m
WHERE m.course_int_id = {{courseSelector.value}}
ORDER BY m.module_number ASC
```
*`courseSelector.value` = id do curso selecionado (Integer).*
*Disparar: On Change do seletor de curso.*

---

### Query 3: Carregar Módulo para Edição

```sql
SELECT
  id,
  module_number,
  title,
  content_text,
  evaluation_rubric,
  is_published,
  course_int_id
FROM modules
WHERE id = {{modulesTable.selectedRow.id}}
LIMIT 1
```
*Disparar: On Row Click na tabela de módulos.*

---

### Query 4: Salvar Edição do Módulo

```sql
UPDATE modules
SET
  title             = '{{moduleTitle.value}}',
  content_text      = '{{moduleContent.value}}',
  evaluation_rubric = '{{moduleRubric.value}}',
  is_published      = {{modulePublished.value}}
WHERE id = '{{moduleId.value}}'
```
*Disparar: On Click do botão [Salvar] no modal.*
*Após sucesso: fechar modal + re-run Query 2.*

---

### Query 5: Listar Alunos com Progresso

```sql
SELECT
  s.id,
  COALESCE(s.name, 'Sem nome') AS name,
  s.phone,
  c.name AS course_name,
  s.current_module,
  COALESCE(ep_last.score, 0) AS ultimo_score,
  ep_last.completed_at AS ultimo_quiz,
  s.portal_token
FROM students s
LEFT JOIN courses c ON c.id = s.course_id
LEFT JOIN LATERAL (
  SELECT score, completed_at
  FROM enrollment_progress ep
  WHERE ep.student_id = s.id
  ORDER BY ep.completed_at DESC NULLS LAST
  LIMIT 1
) ep_last ON TRUE
WHERE
  s.phone ILIKE '%' || {{searchInput.value}} || '%'
  OR COALESCE(s.name, '') ILIKE '%' || {{searchInput.value}} || '%'
ORDER BY s.created_at DESC
```
*`searchInput.value` = campo de busca. Disparar: On Change do campo de busca.*

---

### Query 6: Histórico de Quiz do Aluno (modal)

```sql
SELECT
  ep.module_number,
  ep.status,
  ep.score,
  ep.ai_feedback,
  ep.completed_at
FROM enrollment_progress ep
WHERE ep.student_id = '{{studentsTable.selectedRow.id}}'
ORDER BY ep.completed_at DESC NULLS LAST
```
*Disparar: On Row Click na tabela de alunos.*

---

### Query 7: Resetar Progresso (via N8N API)

```javascript
// RunJS query no ToolJet
const response = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer {{constants.ADMIN_WEBHOOK_SECRET}}'
  },
  body: JSON.stringify({
    action: 'admin_reset_student',
    phone: studentsTable.selectedRow.phone
  })
});
const data = await response.json();
return data;
```
*`constants.ADMIN_WEBHOOK_SECRET` = variável de ambiente no ToolJet (não hardcode).*

---

## 4. ToolJet — Configuração da Data Source PostgreSQL

A data source `postgresql` já existe. Verificar se aponta para `kreativ_edu`:

| Campo | Valor |
|---|---|
| Host | `kreativ_postgres` |
| Port | `5432` |
| Database | `kreativ_edu` |
| User | `kreativ_user` |
| Password | Ver `.env → POSTGRES_PASSWORD` |

**IMPORTANTE:** usar hostname `kreativ_postgres` (não `postgres` nem `localhost`).

---

## 5. Metabase — Dashboard "Kreativ — Visão Operacional"

### 5.1 Estrutura do Dashboard

```
Dashboard: "Kreativ — Visão Operacional"
│
├── Card 1: Alunos Ativos Hoje         (Big Number)
├── Card 2: Alunos Ativos Esta Semana  (Big Number)
├── Card 3: Funil de Aprendizado       (Bar Chart)
├── Card 4: Score Médio por Módulo     (Bar Chart)
└── Card 5: Uso do AI Tutor (14 dias)  (Line Chart + Table)
```

---

### 5.2 Queries Metabase

**Card 1 — Alunos Ativos Hoje**
```sql
SELECT COUNT(DISTINCT student_id) AS alunos_ativos_hoje
FROM enrollment_progress
WHERE completed_at >= CURRENT_DATE
```
*Tipo: Big Number. Label: "Alunos Ativos Hoje"*

---

**Card 2 — Alunos Ativos Esta Semana**
```sql
SELECT COUNT(DISTINCT student_id) AS alunos_ativos_semana
FROM enrollment_progress
WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'
```
*Tipo: Big Number. Label: "Alunos Ativos Esta Semana"*

---

**Card 3 — Funil de Aprendizado**
```sql
SELECT
  CONCAT('Módulo ', s.current_module) AS modulo,
  COUNT(*) AS alunos
FROM students s
GROUP BY s.current_module
ORDER BY s.current_module
```
*Tipo: Bar Chart. X = modulo, Y = alunos. Título: "Distribuição por Módulo"*

---

**Card 4 — Score Médio por Módulo**
```sql
SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  ROUND(AVG(score)::numeric, 1) AS score_medio,
  COUNT(*) AS tentativas
FROM enrollment_progress
WHERE score IS NOT NULL
  AND completed_at >= NOW() - INTERVAL '30 days'
GROUP BY module_number
ORDER BY module_number
```
*Tipo: Bar Chart. Título: "Score Médio por Módulo (últimos 30 dias)"*

---

**Card 5 — Uso do AI Tutor**
```sql
SELECT
  DATE(created_at) AS dia,
  COUNT(*) AS chamadas,
  SUM(prompt_tokens) AS tokens_prompt,
  SUM(completion_tokens) AS tokens_resposta,
  ROUND(AVG(duration_ms)::numeric / 1000, 1) AS tempo_medio_s
FROM ai_usage_log
WHERE event_type = 'ai_tutor'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC
```
*Tipo: Line Chart (eixo Y = chamadas, eixo X = dia). Título: "Chamadas AI Tutor (14 dias)"*

**Nota:** Este card requer a criação da tabela `ai_usage_log` (ver seção 6).

---

## 6. Tabela `ai_usage_log` (pré-requisito para Card 5)

### 6.1 Migration SQL

```sql
-- Executar em kreativ_edu
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             VARCHAR(20),
  event_type        VARCHAR(50),    -- 'ai_tutor', 'quiz_eval', 'quiz_gen'
  model             VARCHAR(100),
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_log_created ON ai_usage_log (created_at DESC);
CREATE INDEX idx_ai_usage_log_event ON ai_usage_log (event_type, created_at DESC);
```

```bash
# Executar:
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -f /tmp/migration_ai_usage_log.sql
```

### 6.2 Nó N8N de log (adicionado no ULTIMATE — path ai_tutor)

Após `AI Tutor: Enviar WhatsApp`, adicionar:

```json
{
  "name": "AI Tutor: Log Usage",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "operation": "executeQuery",
    "query": "INSERT INTO ai_usage_log (phone, event_type, model, prompt_tokens, completion_tokens, duration_ms) VALUES ('{{ $('AI Tutor: Extrair Input').first().json.phone }}', 'ai_tutor', 'deepseek/deepseek-chat', {{ $json.usage?.prompt_tokens || 0 }}, {{ $json.usage?.completion_tokens || 0 }}, 0)"
  },
  "continueOnFail": true
}
```

*`continueOnFail: true` — falha de log nunca quebra a experiência do aluno.*

---

## 7. Conexão Metabase → kreativ_edu

A conexão já foi configurada. Verificar via:
```
https://dash.extensionista.site → Admin → Databases
Database: kreativ_edu (PostgreSQL, kreativ_postgres:5432)
```

Se precisar reconfigurar:
| Campo | Valor |
|---|---|
| Type | PostgreSQL |
| Name | kreativ_edu |
| Host | `kreativ_postgres` |
| Port | `5432` |
| Database | `kreativ_edu` |
| User | `kreativ_user` |
| Password | Ver `.env → POSTGRES_PASSWORD` |

---

## 8. Ordem de Implementação

```
1. Migration: criar ai_usage_log (1 comando docker exec)
2. Metabase: criar os 5 cards + organizar dashboard (UI, ~20 min)
3. ToolJet: criar app "Kreativ Admin" + data source + 7 queries (UI, ~45 min)
4. ToolJet: construir layouts Aba Conteúdo (drag & drop, ~30 min)
5. ToolJet: construir layouts Aba Alunos (drag & drop, ~20 min)
6. ToolJet: criar grupos RBAC (admin, tutor, conteudo) + convidar usuários
7. N8N: adicionar nó "AI Tutor: Log Usage" no ULTIMATE (após Task 3 do plano async)
8. Testar end-to-end: editar módulo no ToolJet → verificar no PostgreSQL
9. Testar: abrir dashboard Metabase → confirmar dados aparecem
```

---

## 9. Referências

```
/root/ideias_app/docs/TOOLJET_DASHBOARD_BLUEPRINT.md     ← blueprint detalhado original
/root/ideias_app/init-scripts/01-init-dbs.sql            ← schema do kreativ_edu
/root/ideias_app/docker-compose.yml                      ← tooljet (linha ~334), metabase (~380)
/root/ideias_app/.env                                    ← POSTGRES_PASSWORD, TOOLJET_SECRET_KEY

ToolJet:   https://admin.extensionista.site
Metabase:  https://dash.extensionista.site
PostgreSQL host interno: kreativ_postgres:5432
Database:  kreativ_edu
Tabela-chave: modules (course_int_id INTEGER FK, não course_id VARCHAR)
```
