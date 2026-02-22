# ToolJet Admin + Metabase Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configurar o ToolJet "Kreativ Admin" (3 abas, RBAC, 7 queries) e o Metabase dashboard "Kreativ — Visão Operacional" (5 cards KPI), incluindo migration da tabela `ai_usage_log`.

**Architecture:** Execução sequencial de configuração de infra (migration SQL) → analytics (Metabase) → admin CRUD (ToolJet). A maioria das tarefas é UI-based (cliques em interface web). Código/scripts apenas na Task 1 (migration) e Task 8 (N8N). Design completo em `docs/plans/2026-02-22-tooljet-metabase-design.md`.

**Tech Stack:** PostgreSQL 15 (kreativ_edu), ToolJet EE-LTS (admin.extensionista.site), Metabase (dash.extensionista.site), N8N (n8n.extensionista.site), Docker (kreativ_postgres container).

---

## Referências críticas

Antes de executar qualquer tarefa, leia:
- `docs/plans/2026-02-22-tooljet-metabase-design.md` — design completo com SQL, layouts e JSON
- `init-scripts/01-init-dbs.sql` — schema kreativ_edu (tabelas: courses, modules, students, enrollment_progress, document_chunks)
- `.env` — `POSTGRES_PASSWORD`, `TOOLJET_SECRET_KEY`, `EVOLUTION_API_KEY`

**URLs de acesso:**
- ToolJet: https://admin.extensionista.site
- Metabase: https://dash.extensionista.site
- N8N: https://n8n.extensionista.site
- PostgreSQL interno: `kreativ_postgres:5432`, database `kreativ_edu`, user `kreativ_user`

---

## Task 1: Migration — Criar tabela `ai_usage_log`

> Pré-requisito para Metabase Card 5. Executar antes de qualquer coisa.

**Files:**
- Create: `/tmp/migration_ai_usage_log.sql` (temporário, no VPS)

**Step 1: Criar o arquivo de migration no VPS**

```bash
cat > /tmp/migration_ai_usage_log.sql << 'EOF'
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

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_event ON ai_usage_log (event_type, created_at DESC);
EOF
```

**Step 2: Copiar o arquivo para o container e executar**

```bash
docker cp /tmp/migration_ai_usage_log.sql kreativ_postgres:/tmp/migration_ai_usage_log.sql

docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -f /tmp/migration_ai_usage_log.sql
```

Saída esperada:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
```

**Step 3: Verificar que a tabela foi criada**

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "\d ai_usage_log"
```

Saída esperada: tabela com colunas `id, phone, event_type, model, prompt_tokens, completion_tokens, duration_ms, created_at`.

**Step 4: Commit**

```bash
# Não há arquivos de código para commitar nesta task (migration é idempotente).
# Opcional: registrar no log
echo "Migration ai_usage_log executada em $(date)" >> /tmp/migration_log.txt
```

---

## Task 2: Metabase — Conectar banco e criar dashboard

> Acessar https://dash.extensionista.site

**Step 1: Verificar conexão com kreativ_edu**

1. Acesse https://dash.extensionista.site → login como admin
2. Vá em: **Admin** → **Databases**
3. Verifique se existe database `kreativ_edu`:
   - Host: `kreativ_postgres`
   - Port: `5432`
   - Database: `kreativ_edu`
   - User: `kreativ_user`

Se não existir, clique **Add database**:
- Type: `PostgreSQL`
- Name: `kreativ_edu`
- Host: `kreativ_postgres`
- Port: `5432`
- Database: `kreativ_edu`
- Username: `kreativ_user`
- Password: valor de `POSTGRES_PASSWORD` no `.env`

**Step 2: Testar conexão**

Clique **Save** → aguardar "Connection established successfully". Se falhar, verificar que o container `kreativ_postgres` está UP:
```bash
docker ps | grep kreativ_postgres
```

**Step 3: Criar o dashboard**

1. Na home do Metabase, clique **+ New** → **Dashboard**
2. Nome: `Kreativ — Visão Operacional`
3. Salve o dashboard vazio (você vai adicionar os cards nos próximos steps)

---

## Task 3: Metabase — Cards 1 e 2 (Big Numbers)

**Step 1: Criar Card 1 — "Alunos Ativos Hoje"**

1. Abra o dashboard → **+ Add** → **Question**
2. Clique **Native query** (SQL nativo)
3. Selecione database: `kreativ_edu`
4. Cole o SQL:
   ```sql
   SELECT COUNT(DISTINCT student_id) AS alunos_ativos_hoje
   FROM enrollment_progress
   WHERE completed_at >= CURRENT_DATE
   ```
5. Clique **Visualize** → selecione tipo **Number** (Big Number)
6. Edite o label para: `Alunos Ativos Hoje`
7. Salve como: `Card 1 — Alunos Ativos Hoje`
8. Clique **Add to dashboard** → selecione `Kreativ — Visão Operacional`

**Step 2: Criar Card 2 — "Alunos Ativos Esta Semana"**

Repita o processo do Step 1 com o SQL:
```sql
SELECT COUNT(DISTINCT student_id) AS alunos_ativos_semana
FROM enrollment_progress
WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'
```
- Label: `Alunos Ativos Esta Semana`
- Tipo: **Number** (Big Number)
- Salve como: `Card 2 — Alunos Ativos Esta Semana`
- Adicione ao dashboard

**Step 3: Posicionar os dois cards lado a lado**

No dashboard, arraste os cards para ficarem lado a lado na linha superior.

---

## Task 4: Metabase — Cards 3 e 4 (Bar Charts)

**Step 1: Criar Card 3 — "Distribuição por Módulo"**

1. No dashboard → **+ Add** → **Question** → **Native query** → `kreativ_edu`
2. SQL:
   ```sql
   SELECT
     CONCAT('Módulo ', s.current_module) AS modulo,
     COUNT(*) AS alunos
   FROM students s
   GROUP BY s.current_module
   ORDER BY s.current_module
   ```
3. Clique **Visualize** → selecione tipo **Bar**
4. Configurar: X = `modulo`, Y = `alunos`
5. Título: `Distribuição por Módulo`
6. Salve como: `Card 3 — Funil de Aprendizado`
7. Adicione ao dashboard

**Step 2: Criar Card 4 — "Score Médio por Módulo"**

1. Nova question → Native query → `kreativ_edu`
2. SQL:
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
3. Tipo: **Bar**
4. Configurar: X = `modulo`, Y = `score_medio`
5. Título: `Score Médio por Módulo (últimos 30 dias)`
6. Salve como: `Card 4 — Score Médio por Módulo`
7. Adicione ao dashboard

---

## Task 5: Metabase — Card 5 (AI Tutor Usage)

> Depende da Task 1 (tabela `ai_usage_log` precisa existir).

**Step 1: Criar Card 5 — "Chamadas AI Tutor (14 dias)"**

1. Nova question → Native query → `kreativ_edu`
2. SQL:
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
3. Clique **Visualize** → selecione tipo **Line**
4. Configurar: X = `dia`, Y = `chamadas`
5. Título: `Chamadas AI Tutor (14 dias)`
6. Salve como: `Card 5 — Uso do AI Tutor`
7. Adicione ao dashboard

**Step 2: Verificar dashboard completo**

Abra https://dash.extensionista.site e confirme que o dashboard mostra 5 cards:
- 2 Big Numbers no topo
- 2 Bar Charts no meio
- 1 Line Chart na base

Se a tabela `ai_usage_log` estiver vazia (zero rows), o Card 5 vai mostrar "No results" — isso é esperado antes de qualquer chamada de AI Tutor.

---

## Task 6: ToolJet — Data Source + Criar App

> Acessar https://admin.extensionista.site

**Step 1: Verificar Data Source PostgreSQL**

1. Acesse https://admin.extensionista.site → login como admin
2. Vá em: **Data Sources** (menu lateral ou configurações)
3. Verifique se existe uma fonte `postgresql` (ou similar) apontando para kreativ_edu:
   - Host: `kreativ_postgres`
   - Port: `5432`
   - Database: `kreativ_edu`
   - User: `kreativ_user`
   - Password: valor de `POSTGRES_PASSWORD` do `.env`

Se não existir, clique **Add data source** → **PostgreSQL**:
- Name: `Kreativ PostgreSQL`
- Host: `kreativ_postgres` (**IMPORTANTE**: não usar `localhost` nem `postgres`)
- Port: `5432`
- Database: `kreativ_edu`
- Username: `kreativ_user`
- Password: do `.env`

**Step 2: Testar a conexão**

Clique **Test Connection** → aguardar "Connection successful". Se falhar com erro IPv6, verifique que o hostname é `kreativ_postgres` (nome do container Docker, não IP).

**Step 3: Criar o App**

1. Vá em: **Apps** → **+ Create new app**
2. Nome: `Kreativ Admin`
3. O editor abre. Você vai ter 3 abas na top navigation (ver próximas tasks).

**Step 4: Criar Constant para webhook secret**

1. Vá em: **Settings** → **Workspace Constants**
2. Clique **+ Add constant**:
   - Name: `ADMIN_WEBHOOK_SECRET`
   - Value: valor de `N8N_API_KEY` ou um token secreto para proteger chamadas N8N
3. Salve

---

## Task 7: ToolJet — Criar as 7 Queries

> Dentro do app `Kreativ Admin`, vá em **Queries** (painel inferior).

**Step 1: Query 1 — Listar Cursos**

1. Clique **+ Add query** → **PostgreSQL** (selecione a fonte configurada)
2. Name: `listCursos`
3. Query type: **SQL**
4. SQL:
   ```sql
   SELECT id, name, description, created_at
   FROM courses
   ORDER BY name ASC
   ```
5. **Run on page load**: ✅ (ligar)
6. Salve

**Step 2: Query 2 — Listar Módulos do Curso Selecionado**

1. **+ Add query** → **PostgreSQL**
2. Name: `listModulos`
3. SQL:
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
4. **Run on page load**: ❌ (vai ser disparada pelo onChange do seletor)
5. Salve

**Step 3: Query 3 — Carregar Módulo para Edição**

1. **+ Add query** → **PostgreSQL**
2. Name: `loadModulo`
3. SQL:
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
4. **Run on page load**: ❌ (disparada ao clicar na linha da tabela)
5. Salve

**Step 4: Query 4 — Salvar Edição do Módulo**

1. **+ Add query** → **PostgreSQL**
2. Name: `saveModulo`
3. SQL:
   ```sql
   UPDATE modules
   SET
     title             = '{{moduleTitle.value}}',
     content_text      = '{{moduleContent.value}}',
     evaluation_rubric = '{{moduleRubric.value}}',
     is_published      = {{modulePublished.value}}
   WHERE id = '{{moduleId.value}}'
   ```
4. **Run on page load**: ❌
5. Salve

**Step 5: Query 5 — Listar Alunos com Progresso**

1. **+ Add query** → **PostgreSQL**
2. Name: `listAlunos`
3. SQL:
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
4. **Run on page load**: ✅
5. Salve

**Step 6: Query 6 — Histórico de Quiz do Aluno**

1. **+ Add query** → **PostgreSQL**
2. Name: `histQuiz`
3. SQL:
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
4. **Run on page load**: ❌
5. Salve

**Step 7: Query 7 — Resetar Progresso via N8N**

1. **+ Add query** → **Run JavaScript**
2. Name: `resetStudent`
3. Código:
   ```javascript
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
4. **Run on page load**: ❌
5. Salve

---

## Task 8: ToolJet — Aba Conteúdo (Layout)

> Dentro do app `Kreativ Admin`, construir o layout da aba principal.

**Step 1: Adicionar Page "Conteúdo"**

1. No editor do app, vá em **Pages** (menu lateral esquerdo)
2. Renomeie a página padrão para `Conteúdo`
3. Adicione mais 2 páginas: `Alunos` e `Admin`

**Step 2: Adicionar Tab Navigation**

1. Na página `Conteúdo`, arraste um componente **Tabs** para o topo
2. Configure as abas: `Conteúdo | Alunos | Admin`
3. Vincule cada aba à página correspondente via **onClick** → navegação de página

**Step 3: Layout — Seção Conteúdo**

Arraste os componentes na área de conteúdo (drag-and-drop):

**Coluna esquerda (~25% de largura) — Seletor de Curso:**
1. Arraste um **Select** (dropdown)
   - Name: `courseSelector`
   - Label: `Curso`
   - Data: `{{listCursos.data}}`
   - Display key: `name`
   - Value key: `id`
   - **onChange**: disparar query `listModulos`

**Coluna direita (~75% de largura) — Tabela de Módulos:**
1. Arraste uma **Table**
   - Name: `modulesTable`
   - Data: `{{listModulos.data}}`
   - Colunas: `module_number` (N°), `title` (Título), `is_published` (Publicado)
   - Coluna `is_published`: tipo **Badge** (verde=true, cinza=false)
   - **onRowClicked**: disparar query `loadModulo` + abrir modal de edição

**Step 4: Modal de Edição do Módulo**

1. Arraste um componente **Modal**
   - Name: `editModuloModal`
   - Title: `Editar Módulo`
2. Dentro do modal, adicione:
   - **Text Input**: Name `moduleTitle`, Label `Título`, Default `{{loadModulo.data[0].title}}`
   - **Textarea**: Name `moduleContent`, Label `Conteúdo`, Default `{{loadModulo.data[0].content_text}}`, Height: 200px
   - **Textarea**: Name `moduleRubric`, Label `Rubrica de Avaliação`, Default `{{loadModulo.data[0].evaluation_rubric}}`
   - **Toggle**: Name `modulePublished`, Label `Publicado`, Default `{{loadModulo.data[0].is_published}}`
   - **Text Input** (hidden/disabled): Name `moduleId`, Default `{{loadModulo.data[0].id}}`
   - **Button** `Cancelar`: onClick → fechar modal
   - **Button** `Salvar`:
     - onClick → disparar `saveModulo`
     - Após sucesso: fechar modal + re-run `listModulos`

**Step 5: Verificar aba Conteúdo**

1. Clique **Preview** no ToolJet
2. Selecione um curso no dropdown → tabela de módulos aparece
3. Clique numa linha → modal abre com dados do módulo
4. Edite o título → Salvar → verificar que a tabela atualiza

---

## Task 9: ToolJet — Aba Alunos (Layout)

**Step 1: Layout da aba Alunos**

Na página `Alunos`, adicione:

1. **Text Input** no topo:
   - Name: `searchInput`
   - Placeholder: `Buscar por nome ou telefone...`
   - **onChange**: disparar query `listAlunos`

2. **Table** abaixo:
   - Name: `studentsTable`
   - Data: `{{listAlunos.data}}`
   - Colunas: `name` (Nome), `phone` (Telefone), `course_name` (Curso), `current_module` (Módulo), `ultimo_score` (Score), `ultimo_quiz` (Último Quiz)
   - **onRowClicked**: disparar query `histQuiz` + abrir modal do aluno

**Step 2: Modal do Aluno**

1. Arraste um **Modal**
   - Name: `studentModal`
   - Title: `{{studentsTable.selectedRow.name}}`
2. Dentro do modal:
   - **Text** com dados básicos: `Telefone: {{studentsTable.selectedRow.phone}}`
   - **Text**: `Token: {{studentsTable.selectedRow.portal_token}}`
   - **Table**:
     - Name: `histQuizTable`
     - Data: `{{histQuiz.data}}`
     - Colunas: `module_number`, `status`, `score`, `ai_feedback`, `completed_at`
   - **Button** `Resetar Progresso`:
     - Color: vermelho
     - onClick → disparar `resetStudent`
     - Adicionar confirmação: "Tem certeza? Isso apaga todo o progresso do aluno."
   - **Button** `Fechar`: onClick → fechar modal

**Step 3: Verificar aba Alunos**

1. Clique **Preview**
2. Busque pelo telefone do aluno de teste (`556399374165`)
3. Clique na linha → modal abre com histórico de quizzes
4. Botão "Resetar" deve exibir confirmação

---

## Task 10: ToolJet — Aba Admin (Formulários)

**Step 1: Seção "Cadastrar/Editar Aluno"**

Na página `Admin`, adicione um **Container** com título "Cadastrar/Editar Aluno":

Campos:
- **Text Input**: Name `adminPhone`, Label `Telefone (com DDI, ex: 5563...)`
- **Text Input**: Name `adminName`, Label `Nome do Aluno`
- **Select**: Name `adminCourseId`, Label `Curso`, Data: `{{listCursos.data}}`, Display key: `name`, Value key: `id`
- **Number Input**: Name `adminModuleNum`, Label `Módulo Atual`, Default: `1`
- **Button** `Salvar Aluno`:
  - onClick → **Run JavaScript** inline:
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer {{constants.ADMIN_WEBHOOK_SECRET}}' },
      body: JSON.stringify({
        action: 'admin_upsert_student',
        phone: adminPhone.value,
        name: adminName.value,
        course_id: adminCourseId.value,
        current_module: adminModuleNum.value
      })
    });
    return r.json();
    ```

**Step 2: Seção "Cadastrar Curso"**

Adicione um **Container** com título "Cadastrar Curso":
- **Text Input**: Name `newCourseName`, Label `Nome do Curso`
- **Textarea**: Name `newCourseDesc`, Label `Descrição`
- **Button** `Criar Curso`:
  - onClick → **Run JavaScript** inline:
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer {{constants.ADMIN_WEBHOOK_SECRET}}' },
      body: JSON.stringify({
        action: 'admin_upsert_course',
        name: newCourseName.value,
        description: newCourseDesc.value
      })
    });
    return r.json();
    ```

**Step 3: Seção "Cadastrar Módulo"**

Adicione um **Container** com título "Cadastrar Módulo":
- **Select**: Name `newModuleCourse`, Label `Curso`, Data: `{{listCursos.data}}`, Display key: `name`, Value key: `id`
- **Number Input**: Name `newModuleNum`, Label `Número do Módulo`
- **Text Input**: Name `newModuleTitle`, Label `Título`
- **Textarea**: Name `newModuleContent`, Label `Conteúdo (Markdown)`
- **Textarea**: Name `newModuleRubric`, Label `Rubrica de Avaliação`
- **Toggle**: Name `newModulePublished`, Label `Publicado`
- **Button** `Criar Módulo`:
  - onClick → **Run JavaScript** inline:
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer {{constants.ADMIN_WEBHOOK_SECRET}}' },
      body: JSON.stringify({
        action: 'admin_upsert_module',
        course_int_id: newModuleCourse.value,
        module_number: newModuleNum.value,
        title: newModuleTitle.value,
        content_text: newModuleContent.value,
        evaluation_rubric: newModuleRubric.value,
        is_published: newModulePublished.value
      })
    });
    return r.json();
    ```

---

## Task 11: ToolJet — RBAC (Grupos e Usuários)

> Acessar https://admin.extensionista.site → Settings

**Step 1: Criar grupos**

1. Vá em: **Settings** → **Workspace** → **Groups**
2. Clique **+ Create group** para cada grupo:
   - `admin` — acesso total (todas as abas)
   - `tutor` — apenas aba Alunos
   - `conteudo` — apenas aba Conteúdo

**Step 2: Configurar permissões por aba (Pages)**

Para o app `Kreativ Admin`, configure visibilidade de cada página por grupo:

1. Abra o app no editor
2. Para a página `Admin`:
   - Settings → Page visibility → Restrict to groups → `admin`
3. Para a página `Alunos`:
   - Restrict to groups → `admin`, `tutor`
4. Para a página `Conteúdo`:
   - Restrict to groups → `admin`, `conteudo`

**Step 3: Adicionar Rafael ao grupo admin**

1. **Settings** → **Users** → **Invite user** (se Rafael ainda não tiver conta)
2. Email do Rafael → após aceitar convite, vá em **Groups** → `admin` → **Add member**

**Step 4: Verificar RBAC**

1. Faça login com a conta do Rafael
2. Confirme que as 3 abas estão visíveis
3. Se houver outros usuários teste, verifique que cada grupo vê apenas suas abas

---

## Task 12: N8N — Adicionar nó "AI Tutor: Log Usage"

> Esta task depende da Task 3 do plano N8N async (`docs/plans/2026-02-22-n8n-async-impl.md`). Execute SOMENTE após a implementação async do ai_tutor estar completa (o nó "AI Tutor: Enviar WhatsApp" deve existir no path).

**Step 1: Verificar estado atual do ULTIMATE**

```bash
curl -s https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA \
  -H "X-N8N-API-KEY: $(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)" \
  | python3 -c "import sys,json; wf=json.load(sys.stdin); print([n['name'] for n in wf['nodes']])"
```

Confirme que o nó `AI Tutor: Enviar WhatsApp` existe. Se não existir, este passo depende primeiro da implementação do plano async.

**Step 2: Obter workflow atual**

```bash
cd /root/ideias_app
N8N_KEY=$(grep N8N_API_KEY .env | cut -d= -f2)
curl -s https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA \
  -H "X-N8N-API-KEY: $N8N_KEY" > /tmp/ultimate_current.json
echo "Nodes: $(python3 -c "import json; wf=json.load(open('/tmp/ultimate_current.json')); print(len(wf['nodes']))")"
```

**Step 3: Criar script de patch para adicionar o nó de log**

```bash
cat > /tmp/patch_ai_usage_log.py << 'PYEOF'
import json, uuid

with open('/tmp/ultimate_current.json') as f:
    wf = json.load(f)

nodes = wf['nodes']
connections = wf['connections']

# Encontrar o nó "AI Tutor: Enviar WhatsApp"
send_node = next((n for n in nodes if 'Enviar WhatsApp' in n['name'] and 'Tutor' in n['name']), None)
if not send_node:
    print("ERROR: Nó 'AI Tutor: Enviar WhatsApp' não encontrado!")
    print("Nodes disponíveis:", [n['name'] for n in nodes])
    exit(1)

print(f"Encontrado: {send_node['name']} na posição {send_node['position']}")

# Criar o nó de log
log_node = {
    "id": str(uuid.uuid4()),
    "name": "AI Tutor: Log Usage",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2.5,
    "position": [send_node['position'][0] + 200, send_node['position'][1]],
    "continueOnFail": True,
    "parameters": {
        "operation": "executeQuery",
        "query": (
            "INSERT INTO ai_usage_log (phone, event_type, model, prompt_tokens, completion_tokens, duration_ms) "
            "VALUES ("
            "'{{ $('\"'\"'AI Tutor: Extrair Input'\"'\"').first().json.phone }}', "
            "'ai_tutor', "
            "'deepseek/deepseek-chat', "
            "{{ $json.usage?.prompt_tokens || 0 }}, "
            "{{ $json.usage?.completion_tokens || 0 }}, "
            "0)"
        ),
        "options": {}
    },
    "credentials": {
        "postgres": {"id": "kreativ_postgres", "name": "Kreativ PostgreSQL"}
    }
}

nodes.append(log_node)

# Conectar: send_node → log_node (main output)
send_name = send_node['name']
if send_name not in connections:
    connections[send_name] = {"main": [[]]}
if not connections[send_name]["main"]:
    connections[send_name]["main"] = [[]]
connections[send_name]["main"][0].append({
    "node": log_node['name'],
    "type": "main",
    "index": 0
})

payload = {
    "name": wf.get("name", "ULTIMATE"),
    "nodes": nodes,
    "connections": connections,
    "settings": wf.get("settings", {})
}

with open('/tmp/ultimate_patched_log.json', 'w') as f:
    json.dump(payload, f, indent=2)

print(f"✅ Nó '{log_node['name']}' adicionado. Arquivo: /tmp/ultimate_patched_log.json")
PYEOF
python3 /tmp/patch_ai_usage_log.py
```

**Step 4: Fazer PUT do workflow atualizado**

```bash
N8N_KEY=$(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)
curl -s -X PUT https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA \
  -H "X-N8N-API-KEY: $N8N_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/ultimate_patched_log.json | python3 -c "
import sys, json
r = json.load(sys.stdin)
if 'id' in r:
    print('✅ Workflow atualizado. Nodes:', len(r['nodes']))
else:
    print('❌ Erro:', json.dumps(r, indent=2))
"
```

**Step 5: Reativar workflow (se necessário)**

```bash
N8N_KEY=$(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)
curl -s -X POST https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA/activate \
  -H "X-N8N-API-KEY: $N8N_KEY" | python3 -c "import sys,json; r=json.load(sys.stdin); print('Active:', r.get('active'))"
```

**Step 6: Exportar e commitar**

```bash
cd /root/ideias_app
N8N_KEY=$(grep N8N_API_KEY .env | cut -d= -f2)
curl -s https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA \
  -H "X-N8N-API-KEY: $N8N_KEY" > n8n-workflows/60-kreativ-api-ultimate.json

git add n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): add AI Tutor: Log Usage node para rastrear uso em ai_usage_log"
```

---

## Task 13: Smoke Test End-to-End

**Step 1: Testar edição de módulo no ToolJet**

1. Acesse https://admin.extensionista.site → App `Kreativ Admin`
2. Aba `Conteúdo` → selecione um curso
3. Clique em um módulo → modal de edição abre
4. Modifique o título → [Salvar]
5. Verifique via PostgreSQL que o dado foi persistido:
   ```bash
   docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
     -c "SELECT title, updated_at FROM modules ORDER BY updated_at DESC LIMIT 1"
   ```

**Step 2: Testar busca de aluno**

1. Aba `Alunos` → busque `556399374165`
2. Deve aparecer o aluno de teste
3. Clique → modal com histórico de quiz

**Step 3: Verificar Metabase com dados reais**

1. Acesse https://dash.extensionista.site
2. Abra o dashboard `Kreativ — Visão Operacional`
3. Cards 1-4 devem mostrar números (mesmo que baixos em desenvolvimento)
4. Card 5 ("Chamadas AI Tutor") vai mostrar dados quando o log node estiver ativo e houver chamadas

**Step 4: Testar log do AI Tutor (após Task 12)**

Envie uma mensagem WhatsApp ao bot (como aluno de teste) com uma pergunta ao tutor.
Após a resposta chegar, verifique:
```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT phone, event_type, model, prompt_tokens, completion_tokens, created_at FROM ai_usage_log ORDER BY created_at DESC LIMIT 5"
```
Deve aparecer uma linha com `event_type = 'ai_tutor'`.

---

## Ordem de Execução

```
Task 1  → Migration ai_usage_log      (bash, 2 min)
Task 2  → Metabase: conectar + criar dashboard (UI, 5 min)
Task 3  → Metabase: Cards 1 e 2       (UI, 10 min)
Task 4  → Metabase: Cards 3 e 4       (UI, 10 min)
Task 5  → Metabase: Card 5            (UI, 5 min)
Task 6  → ToolJet: Data source + App  (UI, 10 min)
Task 7  → ToolJet: 7 Queries          (UI, 20 min)
Task 8  → ToolJet: Aba Conteúdo       (UI, 30 min)
Task 9  → ToolJet: Aba Alunos         (UI, 20 min)
Task 10 → ToolJet: Aba Admin          (UI, 15 min)
Task 11 → ToolJet: RBAC grupos        (UI, 10 min)
Task 12 → N8N: Log Usage node         (bash + script, 10 min) ← após async impl
Task 13 → Smoke tests end-to-end      (20 min)
```

**Total estimado: ~2h 47min**

---

## Credenciais Necessárias

| Serviço | Onde encontrar |
|---|---|
| `POSTGRES_PASSWORD` | `/root/ideias_app/.env` |
| `N8N_API_KEY` | `/root/ideias_app/.env` |
| `EVOLUTION_API_KEY` | `/root/ideias_app/.env` (usado para constante `ADMIN_WEBHOOK_SECRET`) |
| ToolJet admin login | Criado na primeira vez que ToolJet foi acessado |
| Metabase admin login | Criado na primeira configuração do Metabase |

> **Dica:** Para verificar que `.env` tem as variáveis necessárias:
> ```bash
> grep -E 'POSTGRES_PASSWORD|N8N_API_KEY|EVOLUTION_API_KEY' /root/ideias_app/.env
> ```
