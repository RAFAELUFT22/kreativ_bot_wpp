# Plano ToolJet — App "Kreativ Admin"
> Para: Sonar Pro (Comet) — agente de browser
> URL alvo: https://admin.extensionista.site
> Banco: kreativ_edu @ kreativ_postgres:5432 (PostgreSQL 15)
> Todas as queries foram testadas e validadas contra o schema real.

---

## CONTEXTO

Você vai criar o app **"Kreativ Admin"** no ToolJet. É um painel interno de gestão com 3 páginas (Conteúdo, Alunos, Admin) e 7 queries. O banco PostgreSQL já está rodando. Siga cada passo em ordem — a ordem importa.

**Login:** acesse https://admin.extensionista.site com o admin configurado inicialmente.

---

## FASE 1 — DATA SOURCE E CONFIGURAÇÕES INICIAIS

### Passo 1.1 — Verificar/Criar Data Source PostgreSQL

1. Faça login em https://admin.extensionista.site
2. No menu lateral esquerdo, procure e clique em **"Data sources"** (ícone de banco de dados ou cilindro)
3. Verifique se existe uma fonte de dados com nome que contenha "postgres" ou "kreativ"

**SE já existir uma fonte PostgreSQL:**
- Clique nela para abrir as configurações
- Confirme que os valores são:
  - Host: `kreativ_postgres`
  - Port: `5432`
  - Database: `kreativ_edu`
  - Username: `kreativ_user`
- Clique **"Test connection"** — deve aparecer "Connection successful"
- Se os valores estiverem corretos, passe para o Passo 1.2

**SE NÃO existir ou precisar criar:**
- Clique em **"+ Add data source"** (botão no canto superior direito ou dentro da lista)
- Na lista de tipos, procure e clique em **"PostgreSQL"**
- Preencha os campos:
  - **Name:** `Kreativ PostgreSQL`
  - **Host:** `kreativ_postgres`  ← CRÍTICO: não use "localhost" nem o IP
  - **Port:** `5432`
  - **Database:** `kreativ_edu`
  - **Username:** `kreativ_user`
  - **Password:** `[solicite ao operador o valor de POSTGRES_PASSWORD do arquivo .env]`
  - **SSL:** deixe desativado (toggle off)
- Clique **"Test connection"** → aguarde "Connection successful"
- Clique **"Save"**

### Passo 1.2 — Criar Workspace Constant (variável segura)

1. No menu lateral esquerdo, clique no ícone de **engrenagem (⚙)** ou "Settings"
2. Procure a opção **"Workspace constants"** ou "Constants" (pode estar em uma sub-seção)
3. Clique em **"+ Add constant"** ou **"Create constant"**
4. Preencha:
   - **Name:** `ADMIN_WEBHOOK_SECRET`
   - **Value:** `[solicite ao operador o valor de N8N_API_KEY do arquivo .env]`
5. Clique **"Save"** ou **"Create"**

---

## FASE 2 — CRIAR O APP E AS PÁGINAS

### Passo 2.1 — Criar o App

1. No menu lateral esquerdo, clique em **"Apps"** (ícone de grade ou aplicativos)
2. Clique em **"+ Create new app"** (botão azul ou destaque)
3. No campo de nome, escreva: `Kreativ Admin`
4. Clique **"Create"** ou **"Build"**
5. O editor visual do ToolJet abre (canvas de drag-and-drop no centro, painel de componentes à direita, queries na parte inferior)

### Passo 2.2 — Criar as 3 Páginas

1. No editor, procure o painel **"Pages"** no menu lateral esquerdo do editor (ícone de páginas ou documento)
2. Você vai ver uma página padrão (geralmente chamada "Page 1" ou "Home")
3. **Renomeie a página padrão:**
   - Clique com botão direito na página existente → **"Rename"**
   - Escreva: `Conteudo` (sem acento — evita problemas de encoding)
   - Pressione Enter para confirmar

4. **Adicione a segunda página:**
   - Clique no botão **"+"** ao lado da lista de páginas (ou "Add page")
   - Nome: `Alunos`
   - Confirme

5. **Adicione a terceira página:**
   - Clique no **"+"** novamente
   - Nome: `Admin`
   - Confirme

Você deve ver 3 páginas na lista: `Conteudo`, `Alunos`, `Admin`

---

## FASE 3 — CRIAR AS 7 QUERIES

> Clique no painel **"Queries"** na parte inferior do editor (aba ou painel expansível na base da tela)

### Query 1 — listCursos

1. Clique em **"+ Add query"** (ou "+" no painel de queries)
2. Selecione o tipo de fonte: **"Kreativ PostgreSQL"** (a data source que você criou)
3. Configure:
   - **Query name:** `listCursos`
   - **Tipo:** SQL (Query type = "SQL mode")
   - **SQL:**
     ```sql
     SELECT id, name, description, created_at
     FROM courses
     WHERE is_active = true
     ORDER BY name ASC
     ```
   - **Run this query on page load:** ✅ ATIVAR (toggle ON)
4. Clique **"Save"** (ou Ctrl+S)

### Query 2 — listModulos

1. **+ Add query** → **Kreativ PostgreSQL**
2. Configure:
   - **Name:** `listModulos`
   - **SQL:**
     ```sql
     SELECT
       m.id,
       m.module_number,
       m.title,
       m.is_published,
       LENGTH(COALESCE(m.content_text, '')) AS chars_content,
       m.course_int_id
     FROM modules m
     WHERE m.course_int_id = {{courseSelector.value}}
     ORDER BY m.module_number ASC
     ```
   - **Run on page load:** ❌ DESATIVAR (vai ser disparada pelo seletor de curso)
3. **Save**

   **Nota técnica:** `{{courseSelector.value}}` é o valor inteiro do curso selecionado. `course_int_id` é INTEGER no banco — compatível. O `courseSelector` será criado no layout da aba Conteúdo.

### Query 3 — loadModulo

1. **+ Add query** → **Kreativ PostgreSQL**
2. Configure:
   - **Name:** `loadModulo`
   - **SQL:**
     ```sql
     SELECT
       id::text,
       module_number,
       title,
       COALESCE(content_text, '') AS content_text,
       COALESCE(evaluation_rubric, '') AS evaluation_rubric,
       is_published,
       course_int_id
     FROM modules
     WHERE id = '{{modulesTable.selectedRow.data.id}}'
     LIMIT 1
     ```
   - **Run on page load:** ❌
3. **Save**

   **Nota:** `id::text` converte UUID para string (necessário para exibição correta no ToolJet). `modulesTable.selectedRow.data.id` é a sintaxe do ToolJet para acessar a linha clicada em uma tabela.

### Query 4 — saveModulo

1. **+ Add query** → **Kreativ PostgreSQL**
2. Configure:
   - **Name:** `saveModulo`
   - **SQL:**
     ```sql
     UPDATE modules
     SET
       title             = '{{moduleTitle.value}}',
       content_text      = '{{moduleContent.value}}',
       evaluation_rubric = '{{moduleRubric.value}}',
       is_published      = {{modulePublished.value}},
       updated_at        = NOW()
     WHERE id = '{{moduleId.value}}'
     ```
   - **Run on page load:** ❌
3. **Save**

   **Aviso de segurança (interno):** Este é um app interno de admin — SQL injection via campos de texto de conteúdo é risco baixo e aceitável. Em uma versão futura, usar queries parametrizadas.

### Query 5 — listAlunos

1. **+ Add query** → **Kreativ PostgreSQL**
2. Configure:
   - **Name:** `listAlunos`
   - **SQL:**
     ```sql
     SELECT
       s.id::text,
       COALESCE(s.name, 'Sem nome') AS name,
       s.phone,
       COALESCE(c.name, 'Sem curso') AS course_name,
       s.current_module,
       COALESCE(ep_last.score, 0) AS ultimo_score,
       TO_CHAR(ep_last.completed_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS ultimo_quiz,
       COALESCE(s.portal_token::text, '') AS portal_token
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
       ('{{searchInput.value}}' = ''
        OR s.phone ILIKE '%' || '{{searchInput.value}}' || '%'
        OR COALESCE(s.name, '') ILIKE '%' || '{{searchInput.value}}' || '%')
     ORDER BY s.created_at DESC
     ```
   - **Run on page load:** ✅ ATIVAR
3. **Save**

   **Notas:**
   - `portal_token::text` — cast de UUID para string para exibição
   - A condição `('{{searchInput.value}}' = '' OR ...)` garante que quando o campo estiver vazio, todos os alunos aparecem
   - `TO_CHAR` formata a data no padrão brasileiro

### Query 6 — histQuiz

1. **+ Add query** → **Kreativ PostgreSQL**
2. Configure:
   - **Name:** `histQuiz`
   - **SQL:**
     ```sql
     SELECT
       ep.module_number AS "Módulo",
       ep.status AS "Status",
       ep.score AS "Score",
       COALESCE(ep.ai_feedback, 'Sem feedback registrado') AS "Feedback IA",
       TO_CHAR(ep.completed_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "Data"
     FROM enrollment_progress ep
     WHERE ep.student_id = '{{studentsTable.selectedRow.data.id}}'
     ORDER BY ep.completed_at DESC NULLS LAST
     ```
   - **Run on page load:** ❌
3. **Save**

### Query 7 — resetStudent

1. **+ Add query**
2. Desta vez, selecione o tipo **"Run JavaScript"** (não PostgreSQL)
3. Configure:
   - **Name:** `resetStudent`
   - **Código JavaScript:**
     ```javascript
     const phone = studentsTable.selectedRow.data.phone;
     if (!phone) {
       return { error: 'Nenhum aluno selecionado' };
     }

     const response = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
       },
       body: JSON.stringify({
         action: 'admin_reset_student',
         phone: phone
       })
     });

     const data = await response.json();
     return data;
     ```
   - **Run on page load:** ❌
4. **Save**

---

## FASE 4 — LAYOUT DA PÁGINA "Conteudo"

> Certifique-se de estar na página **"Conteudo"** (clique nela no painel Pages)

### Passo 4.1 — Dropdown de seleção de Curso (coluna esquerda)

1. No painel de componentes (direita), procure **"Dropdown"** ou **"Select"**
2. Arraste para a parte superior esquerda do canvas (cerca de 20-25% da largura)
3. Clique no componente para selecioná-lo e configure no painel de propriedades:
   - **Component name:** `courseSelector`
   - **Label:** `Curso`
   - **Data source (options):** `{{listCursos.data}}`
   - **Display key (label):** `name`
   - **Value key:** `id`
   - **Default value:** deixe vazio
4. Em **"Events"** (aba de eventos do componente):
   - Adicione evento **"On change"**
   - Action: **"Run query"** → selecione `listModulos`

### Passo 4.2 — Tabela de Módulos (coluna direita)

1. Arraste um componente **"Table"** para a direita do dropdown (75% restantes da largura)
2. Configure:
   - **Component name:** `modulesTable`
   - **Data:** `{{listModulos.data}}`
3. Em **"Columns"** (configuração de colunas da tabela):
   - Remova colunas desnecessárias (id, course_int_id, chars_content)
   - Mantenha/adicione:
     - `module_number` → Label: `N°`
     - `title` → Label: `Título`
     - `is_published` → Label: `Publicado` → tipo: **Toggle** (ou Badge: verde para true, cinza para false)
4. Em **"Events"**:
   - Evento **"Row clicked"**:
     - Action 1: **"Run query"** → `loadModulo`
     - Action 2: **"Control component"** → componente: `editModuloModal` → ação: **"Open"**

### Passo 4.3 — Modal de Edição do Módulo

1. Arraste um componente **"Modal"** para qualquer lugar do canvas (ele fica oculto até ser ativado)
2. Configure o modal:
   - **Component name:** `editModuloModal`
   - **Title:** `Editar Módulo`
3. Clique dentro do modal para editá-lo. Arraste os seguintes componentes **dentro** do modal:

**Campo 1 — Título:**
- Componente: **"Text Input"**
- Name: `moduleTitle`
- Label: `Título`
- Default value: `{{loadModulo.data[0]?.title ?? ''}}`

**Campo 2 — Conteúdo:**
- Componente: **"Textarea"**
- Name: `moduleContent`
- Label: `Conteúdo do Módulo`
- Default value: `{{loadModulo.data[0]?.content_text ?? ''}}`
- Height: 200px (arraste a borda inferior para aumentar)

**Campo 3 — Rubrica:**
- Componente: **"Textarea"**
- Name: `moduleRubric`
- Label: `Rubrica de Avaliação`
- Default value: `{{loadModulo.data[0]?.evaluation_rubric ?? ''}}`
- Height: 100px

**Campo 4 — Publicado:**
- Componente: **"Toggle"**
- Name: `modulePublished`
- Label: `Publicado`
- Default value: `{{loadModulo.data[0]?.is_published ?? false}}`

**Campo 5 — ID oculto (necessário para o UPDATE):**
- Componente: **"Text Input"**
- Name: `moduleId`
- Label: `ID` (pode deixar visível para debug, ou ocultar)
- Default value: `{{loadModulo.data[0]?.id ?? ''}}`
- Visible: pode deixar `false` para ocultar do usuário final

**Botão Cancelar:**
- Componente: **"Button"**
- Text: `Cancelar`
- Variant: Secondary (cinza)
- Events → On click → **"Control component"** → `editModuloModal` → **"Close"**

**Botão Salvar:**
- Componente: **"Button"**
- Text: `Salvar`
- Variant: Primary (azul)
- Events → On click:
  - Action 1: **"Run query"** → `saveModulo`
  - Action 2 (on query success): **"Control component"** → `editModuloModal` → **"Close"**
  - Action 3 (on query success): **"Run query"** → `listModulos`

---

## FASE 5 — LAYOUT DA PÁGINA "Alunos"

> Clique em **"Alunos"** no painel Pages para trocar de página

### Passo 5.1 — Campo de busca

1. Arraste um componente **"Text Input"** para o topo do canvas
2. Configure:
   - **Name:** `searchInput`
   - **Label:** (deixe vazio ou escreva "Buscar")
   - **Placeholder:** `Buscar por nome ou telefone...`
   - **Default value:** `` (vazio)
3. Events → **"On change"** → **"Run query"** → `listAlunos`

### Passo 5.2 — Tabela de Alunos

1. Arraste um componente **"Table"** abaixo do campo de busca
2. Configure:
   - **Name:** `studentsTable`
   - **Data:** `{{listAlunos.data}}`
3. Colunas visíveis (configure em "Columns"):
   - `name` → Label: `Nome`
   - `phone` → Label: `Telefone`
   - `course_name` → Label: `Curso`
   - `current_module` → Label: `Módulo Atual`
   - `ultimo_score` → Label: `Último Score`
   - `ultimo_quiz` → Label: `Último Quiz`
   - Ocultar: `id`, `portal_token` (vai aparecer no modal)
4. Events → **"Row clicked"**:
   - Action 1: **"Run query"** → `histQuiz`
   - Action 2: **"Control component"** → `studentModal` → **"Open"**

### Passo 5.3 — Modal do Aluno

1. Arraste um componente **"Modal"** para o canvas (ficará oculto)
2. Configure:
   - **Name:** `studentModal`
   - **Title:** `{{studentsTable.selectedRow?.data?.name ?? 'Aluno'}}`

3. Dentro do modal, adicione:

**Texto informativo:**
- Componente: **"Text"** (ou "Label")
- Content: `Telefone: {{studentsTable.selectedRow?.data?.phone}}`

**Texto token:**
- Componente: **"Text"**
- Content: `Token Portal: {{studentsTable.selectedRow?.data?.portal_token}}`

**Tabela de histórico de quizzes:**
- Componente: **"Table"**
- Name: `histQuizTable`
- Data: `{{histQuiz.data}}`
- Colunas: todas as que retornarem (Módulo, Status, Score, Feedback IA, Data)

**Botão Resetar Progresso:**
- Componente: **"Button"**
- Text: `Resetar Progresso`
- Button style: Danger (vermelho) — pode estar em "Variant" → "Danger" ou selecionar cor vermelha
- Events → **"On click"**:
  - Action: **"Show alert"** → tipo: **"Confirm"** → message: `Tem certeza? Isso apaga todo o progresso do aluno e não pode ser desfeito.`
  - Após confirmação (On confirm): **"Run query"** → `resetStudent`

**Botão Fechar:**
- Componente: **"Button"**
- Text: `Fechar`
- Events → On click → **"Control component"** → `studentModal` → **"Close"**

---

## FASE 6 — LAYOUT DA PÁGINA "Admin"

> Clique em **"Admin"** no painel Pages

### Passo 6.1 — Container "Cadastrar/Editar Aluno"

1. Arraste um componente **"Container"** (ou "Card") para o canvas
2. Dentro do container, adicione os campos:

- **Text Input** — Name: `adminPhone`, Label: `Telefone (com DDI, ex: 5563999...)`
- **Text Input** — Name: `adminName`, Label: `Nome do Aluno`
- **Dropdown** — Name: `adminCourseId`, Label: `Curso`, Data: `{{listCursos.data}}`, Display key: `name`, Value key: `id`
- **Number Input** — Name: `adminModuleNum`, Label: `Módulo Atual`, Default: `1`

- **Button** — Text: `Salvar Aluno`
  - Events → On click → **"Run JavaScript"** (inline ou criar query separada):
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        action: 'admin_upsert_student',
        phone: adminPhone.value,
        name: adminName.value,
        course_id: adminCourseId.value,
        current_module: Number(adminModuleNum.value)
      })
    });
    const data = await r.json();
    if (data.id || data.phone) {
      alert('Aluno salvo com sucesso!');
    } else {
      alert('Erro: ' + JSON.stringify(data));
    }
    ```

### Passo 6.2 — Container "Cadastrar Curso"

1. Arraste outro **"Container"** abaixo do anterior
2. Campos dentro:

- **Text Input** — Name: `newCourseName`, Label: `Nome do Curso`
- **Textarea** — Name: `newCourseDesc`, Label: `Descrição`
- **Button** — Text: `Criar Curso`
  - On click → Run JavaScript:
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        action: 'admin_upsert_course',
        name: newCourseName.value,
        description: newCourseDesc.value
      })
    });
    const data = await r.json();
    alert(data.id ? 'Curso criado! ID: ' + data.id : 'Erro: ' + JSON.stringify(data));
    ```

### Passo 6.3 — Container "Cadastrar Módulo"

1. Arraste mais um **"Container"**
2. Campos dentro:

- **Dropdown** — Name: `newModuleCourse`, Label: `Curso`, Data: `{{listCursos.data}}`, Display: `name`, Value: `id`
- **Number Input** — Name: `newModuleNum`, Label: `Número do Módulo`
- **Text Input** — Name: `newModuleTitle`, Label: `Título do Módulo`
- **Textarea** — Name: `newModuleContent`, Label: `Conteúdo (texto ou Markdown)`, Height: 150px
- **Textarea** — Name: `newModuleRubric`, Label: `Rubrica de Avaliação`, Height: 80px
- **Toggle** — Name: `newModulePublished`, Label: `Publicar imediatamente`
- **Button** — Text: `Criar Módulo`
  - On click → Run JavaScript:
    ```javascript
    const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
      },
      body: JSON.stringify({
        action: 'admin_upsert_module',
        course_int_id: Number(newModuleCourse.value),
        module_number: Number(newModuleNum.value),
        title: newModuleTitle.value,
        content_text: newModuleContent.value,
        evaluation_rubric: newModuleRubric.value,
        is_published: newModulePublished.value
      })
    });
    const data = await r.json();
    alert(data.id ? 'Módulo criado!' : 'Erro: ' + JSON.stringify(data));
    ```

---

## FASE 7 — RBAC (Grupos e Permissões)

### Passo 7.1 — Criar Grupos

1. Clique no **ícone de engrenagem (⚙)** ou "Settings" no menu lateral
2. Procure **"Groups"** em "Workspace settings" ou similar
3. Crie os seguintes grupos (botão "Create group" ou "+" em Groups):
   - `admin` — descrição: Acesso total
   - `tutor` — descrição: Gerencia alunos
   - `conteudo` — descrição: Edita conteúdo de módulos

### Passo 7.2 — Configurar visibilidade por página no App

1. Volte ao editor do app "Kreativ Admin"
2. No painel Pages, clique na página **"Admin"**:
   - Procure opções de "Visibility" ou "Access control" ou "Page settings"
   - Restrinja para grupo: `admin`

3. Página **"Alunos"**:
   - Restrinja para grupos: `admin`, `tutor`

4. Página **"Conteudo"**:
   - Restrinja para grupos: `admin`, `conteudo`

### Passo 7.3 — Adicionar admin ao grupo "admin"

1. Em Settings → Groups → clique no grupo `admin`
2. Procure **"Add member"** ou **"Invite to group"**
3. Adicione o email do administrador principal (Rafael)

---

## FASE 8 — TESTAR O APP

### Passo 8.1 — Preview e teste básico

1. No editor, clique em **"Preview"** (botão no canto superior direito do editor, ícone de play ou "Preview")
2. Uma nova aba abre com o app em modo de visualização

**Teste na página Conteudo:**
1. O dropdown de cursos deve aparecer já populado com os cursos (listCursos carrega na inicialização)
2. Selecione o curso **"Agronegócio e Produção Rural"** no dropdown
3. A tabela deve mostrar 3 módulos: "Documentação e Formalização Rural", "Vendendo para o Governo (PAA e PNAE)", "Crédito Rural e Pronaf B"
4. Clique em qualquer linha — o modal de edição deve abrir com os dados do módulo
5. Clique "Cancelar" para fechar o modal

**Teste na página Alunos:**
1. A tabela deve mostrar os alunos cadastrados (6 alunos)
2. No campo de busca, digite `556399374165` — deve filtrar para mostrar o aluno Rafael Luciano
3. Clique na linha — o modal deve abrir mostrando histórico de quizzes

---

## CHECKLIST DE VERIFICAÇÃO FINAL

Antes de reportar conclusão, confirme cada item:

- [ ] Data source PostgreSQL conecta sem erro
- [ ] Workspace constant `ADMIN_WEBHOOK_SECRET` criada
- [ ] App "Kreativ Admin" criado com 3 páginas (Conteudo, Alunos, Admin)
- [ ] 7 queries criadas: listCursos, listModulos, loadModulo, saveModulo, listAlunos, histQuiz, resetStudent
- [ ] Página Conteudo: dropdown popula com cursos + tabela de módulos aparece ao selecionar
- [ ] Modal de edição abre ao clicar na linha da tabela de módulos
- [ ] Página Alunos: tabela popula com alunos + busca filtra corretamente
- [ ] Modal de aluno abre ao clicar na linha
- [ ] Página Admin: 3 containers com formulários visíveis
- [ ] Grupos RBAC criados (admin, tutor, conteudo)

**Se algum componente não encontrar os dados (mostra vazio ou erro):**
1. Verifique o nome do componente — deve ser exatamente como especificado (case-sensitive)
2. Verifique se a query está configurada para "run on page load" onde necessário
3. Abra o painel de queries e clique em "Run" manualmente para verificar se retorna dados


---

## FASE 9 — Upload de Arquivos e Pré-inscrições (adicionar após Fase 8)

### Passo 9.1 — Query 8: uploadModuleFile

1. No app "Kreativ Admin" → Queries → "+ Add query" → "Run JavaScript"
2. Name: `uploadModuleFile`
3. Código:
   ```javascript
   const file = filePickerModule.file;
   if (!file) return { error: 'Nenhum arquivo selecionado' };

   const reader = new FileReader();
   const base64 = await new Promise((resolve) => {
     reader.onload = (e) => resolve(e.target.result.split(',')[1]);
     reader.readAsDataURL(file);
   });

   const ext = file.name.split('.').pop().toLowerCase();
   const fileType = ext === 'pdf' ? 'pdf'
                  : ext === 'docx' ? 'docx'
                  : ['jpg','jpeg','png','webp'].includes(ext) ? 'image'
                  : 'pdf';

   const response = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       action: 'admin_upload_module_file',
       phone: '556399374165',
       module_id: loadModulo.data[0]?.id,
       file_name: file.name,
       file_base64: base64,
       file_type: fileType,
       replace_content: replaceContentToggle.value ?? true
     })
   });
   const data = await response.json();
   if (data.ok) {
     alert(`✅ Upload concluído! ${data.chunks_inserted || 0} chunks gerados.`);
   } else {
     alert('❌ Erro: ' + JSON.stringify(data));
   }
   return data;
   ```
4. Run on page load: NÃO
5. Save

### Passo 9.2 — Query 9: addVideoUrl

1. "+ Add query" → "Run JavaScript"
2. Name: `addVideoUrl`
3. Código:
   ```javascript
   const url = videoUrlInput.value;
   if (!url || !url.startsWith('http')) return { error: 'URL inválida' };
   const response = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       action: 'admin_upload_module_file',
       phone: '556399374165',
       module_id: loadModulo.data[0]?.id,
       file_name: url,
       file_base64: url,
       file_type: 'video_url'
     })
   });
   const data = await response.json();
   alert(data.ok ? '✅ URL adicionada!' : '❌ Erro: ' + JSON.stringify(data));
   return data;
   ```
4. Run on page load: NÃO
5. Save

### Passo 9.3 — Query 10: listPreInscricoes

1. "+ Add query" → "PostgreSQL" (Kreativ PostgreSQL)
2. Name: `listPreInscricoes`
3. SQL:
   ```sql
   SELECT
     pi.id::text,
     COALESCE(pi.nome_completo, 'Sem nome') AS name,
     pi.telefone_whatsapp AS phone,
     COALESCE(pi.cidade, '') AS cidade,
     COALESCE(pi.estado, '') AS estado,
     STRING_AGG(c.name, ', ') AS cursos_interesse,
     TO_CHAR(pi.data_primeira_inscricao AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS cadastrado_em
   FROM pre_inscriptions pi
   LEFT JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
   LEFT JOIN courses c ON c.id = pic.course_id
   WHERE pi.convertido = false
     AND pi.telefone_valido = true
     AND (
       '{{searchPreInput.value}}' = ''
       OR pi.nome_completo ILIKE '%' || '{{searchPreInput.value}}' || '%'
       OR pi.telefone_whatsapp ILIKE '%' || '{{searchPreInput.value}}' || '%'
       OR pi.cidade ILIKE '%' || '{{searchPreInput.value}}' || '%'
     )
   GROUP BY pi.id, pi.nome_completo, pi.telefone_whatsapp, pi.cidade, pi.estado, pi.data_primeira_inscricao
   ORDER BY pi.data_primeira_inscricao DESC
   LIMIT 100
   ```
4. Run on page load: SIM (quando na página Pré-inscrições)
5. Save

### Passo 9.4 — Seção de arquivos no modal "editModuloModal"

Dentro do modal `editModuloModal` (após o Toggle "Publicado"), adicione:

1. **Separador visual**: componente "Divider" ou Text com `---`
2. **Text**: Content = `📎 Arquivos do Módulo`
3. **Text** (lista atual): Content = `{{(loadModulo.data[0]?.media_urls || []).join('\n')}}`
4. **File Picker**: Name = `filePickerModule`, Accept = `.pdf,.docx,.jpg,.jpeg,.png`
5. **Toggle**: Name = `replaceContentToggle`, Label = `Substituir conteúdo de texto`, Default = `true`
6. **Button** "Fazer Upload":
   - onClick → Run query → `uploadModuleFile`
   - On success → Re-run `loadModulo`
7. **Text Input**: Name = `videoUrlInput`, Placeholder = `URL do YouTube ou Vimeo`
8. **Button** "Adicionar URL":
   - onClick → Run query → `addVideoUrl`
   - On success → Re-run `loadModulo`

### Passo 9.5 — Nova Página "Preinscricoes"

1. No editor, adicione uma 4ª página: `Preinscricoes`
2. Adicione:
   - **Text Input**: Name = `searchPreInput`, Placeholder = `Buscar por nome, telefone ou cidade...`, On change → Run `listPreInscricoes`
   - **Text** (contador): Content = `Total aguardando: {{listPreInscricoes.data?.length ?? 0}} (mostrando até 100)`
   - **Table**: Name = `preTable`, Data = `{{listPreInscricoes.data}}`
     - Colunas: name (Nome), phone (Telefone), cidade (Cidade), cursos_interesse (Cursos), cadastrado_em (Cadastro)
   - **Button** "Matricular Selecionado":
     - Visível apenas quando `{{preTable.selectedRow?.data?.phone}}`
     - onClick → Run JavaScript:
       ```javascript
       const row = preTable.selectedRow.data;
       const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           action: 'admin_upsert_student',
           phone: row.phone,
           name: row.name,
           current_module: 1
         })
       });
       const data = await r.json();
       if (data.id || data.phone) {
         alert('✅ Aluno matriculado! ID: ' + (data.id || data.phone));
         listPreInscricoes.run();
       } else {
         alert('Erro: ' + JSON.stringify(data));
       }
       ```
     - **IMPORTANTE:** Este botão NUNCA envia mensagem — apenas cria o registro no banco.
