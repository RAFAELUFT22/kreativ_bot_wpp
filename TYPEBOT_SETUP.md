# Typebot + N8N + ToolJet — Guia de Setup Manual

## Pré-requisitos (executar antes de subir os containers)

```bash
# 1. Criar banco typebot_db
docker exec kreativ_postgres psql -U kreativ_user -c "CREATE DATABASE typebot_db;"

# 2. Criar bucket MinIO para Typebot
docker exec kreativ_minio mc alias set local http://localhost:9000 kreativ_minio <MINIO_ROOT_PASSWORD>
docker exec kreativ_minio mc mb local/typebot --ignore-existing
docker exec kreativ_minio mc anonymous set download local/typebot

# 3. Gerar segredos e colocar no .env
openssl rand -hex 32   # → TYPEBOT_NEXTAUTH_SECRET
openssl rand -hex 32   # → TYPEBOT_ENCRYPTION_SECRET
# Editar .env: substituir os placeholders pelos valores gerados

# 4. Criar registros DNS (painel do provedor)
#    typebot.extensionista.site  A  187.77.46.37
#    bot.extensionista.site      A  187.77.46.37

# 5. Subir containers Typebot (parar builderbot primeiro)
docker compose stop builderbot
docker compose up -d typebot-builder typebot-viewer
```

---

## Bloco 3 — Construir o Bot no Typebot UI

**Acessar:** https://typebot.extensionista.site
**Login:** rafaloct@gmail.com ou 
**API_TYPE_BOT** LqkFiNhRjg1p2W3nNkgLpxPM

### Criar o bot
1. New typebot → "Kreativ Educacao" → slug: `kreativ-educacao`
2. Criar 8 grupos conforme mapa abaixo

### Grupo 1 — Catraca (toda conversa inicia aqui)

```
[HTTP Request Block]
  Method: POST
  URL: http://kreativ_n8n:5678/webhook/check-student
  Body: { "phone": "{{contact.number}}" }
  Save response as: gatekeeperResponse

[Condition Block] on gatekeeperResponse.status:
  "unknown" → [Text] "Olá! Seu número não está no programa Kreativ.
                      Inscreva-se: https://extensionista.site" → [End]
  "human"   → [End]  (silêncio — agente humano está atendendo)
  "bot"     → [Set Variables]:
                studentName  = gatekeeperResponse.name
                courseId     = gatekeeperResponse.course_id
                courseName   = gatekeeperResponse.course_name
                currentModule = gatekeeperResponse.current_module
                portal_token = gatekeeperResponse.portal_token
              → Grupo 2: Menu
```

### Grupo 2 — Menu Principal

```
[Text Block]
  "Olá, {{studentName}}! 👋 Curso: {{courseName}}
   O que você quer fazer?"

[Buttons]
  📖 MODULO  → Grupo 3
  📊 PROGRESSO → Grupo 5
  👤 TUTOR   → Grupo 6

[Text Input] (captura texto livre)
  Save as: freeInput
  → Grupo 7: AI Tutor
```

### Grupo 3 — Conteúdo do Módulo

```
[HTTP Request Block]
  POST http://kreativ_n8n:5678/webhook/get-module
  Body: { "phone": "{{contact.number}}", "module_number": {{currentModule}} }
  Save as: moduleData

[Set Variables]
  quizQuestions = moduleData.quiz_questions
  totalQuestions = 3
  questionIndex = 0

[Text] "*Módulo {{moduleData.module_number}}: {{moduleData.title}}*"
[Text] "{{moduleData.content_text}}"
[Text] "---\nDigite *QUIZ* para avaliar | *MENU* para voltar"

[Text Input] Save as: moduleChoice
  Condition: moduleChoice == "QUIZ" → Grupo 4
  Condition: moduleChoice == "MENU" → Grupo 2
  Else → Grupo 7
```

### Grupo 4 — Quiz Loop

```
[Condition] questionIndex < totalQuestions
  TRUE:
    [Text] "*Pergunta {{questionIndex + 1}} de {{totalQuestions}}*
            {{quizQuestions[questionIndex].question}}"
    [Text Input] Save as: userAnswer
    [HTTP Request]
      POST http://kreativ_n8n:5678/webhook/submit-quiz
      Body: {
        "phone": "{{contact.number}}",
        "module_number": {{currentModule}},
        "question_index": {{questionIndex}},
        "answer": "{{userAnswer}}",
        "total_questions": {{totalQuestions}}
      }
      Save as: quizResult
    [Text] "{{quizResult.feedback}}"
    [Set] questionIndex = questionIndex + 1
    [Jump] → início do Grupo 4

  FALSE (quiz concluído):
    [Condition] quizResult.module_complete
      TRUE + quizResult.is_last_module:
        → Grupo 8: Certificado
      TRUE + next_module existe:
        [Text] "✅ Módulo concluído! Próximo: Módulo {{quizResult.next_module}}
                Responda MODULO para continuar."
        [Set] currentModule = quizResult.next_module
        [End]
      FALSE (não passou):
        [Text] "Você precisa de {{moduleData.passing_score}}% para passar.
                Responda MODULO para revisar o conteúdo."
        [End]
```

### Grupo 5 — Progresso

```
[HTTP Request]
  POST http://kreativ_n8n:5678/webhook/get-progress
  Body: { "phone": "{{contact.number}}" }
  Save as: progressData

[Text]
  "📊 *{{progressData.course_name}}*
   Módulo: {{progressData.current_module}}/{{progressData.total_modules}}
   Progresso: {{progressData.completion_pct}}%
   🔗 https://portal.extensionista.site/aluno/{{gatekeeperResponse.portal_token}}"

[Buttons]
  Continuar Módulo → Grupo 3
  Menu → Grupo 2
```

### Grupo 6 — Handoff Humano

```
[Text] "Conectando com um tutor... 👤"
[HTTP Request]
  POST http://kreativ_n8n:5678/webhook/request-human
  Body: { "phone": "{{contact.number}}", "reason": "Solicitação via Typebot" }
[Text] "✅ Um tutor vai te atender em breve!
        Quando terminar, o bot retoma automaticamente."
[End]
```

### Grupo 7 — AI Tutor (fire & forget)

```
[HTTP Request]
  POST http://kreativ_n8n:5678/webhook/ai-tutor-v3
  Body: { "phone": "{{contact.number}}", "body": "{{freeInput}}" }
  (N8N processa e envia resposta diretamente via Evolution API)
[End]  ← NÃO mostrar resposta aqui (evita duplicata)
```

### Grupo 8 — Certificado

```
[HTTP Request]
  POST http://kreativ_n8n:5678/webhook/emit-certificate
  Body: {
    "phone": "{{contact.number}}",
    "moduleNumber": {{currentModule}},
    "score": {{quizResult.score}}
  }
  Save as: certResult

[Text]
  "🏆 Parabéns, {{studentName}}!
   Você concluiu *{{courseName}}*!

   📜 Certificado: {{certResult.certUrl}}
   Código: {{certResult.certId}}"
[End]
```

### Publicar o bot
1. Clicar em "Publish" → anotar o slug `kreativ-educacao`
2. Ir para o Bloco 4 abaixo

---

## Bloco 4 — Conectar Evolution API ao Typebot

**Importante:** Verificar o slug exato publicado antes de executar.

```bash
# Configurar Typebot na instância europs
curl -X POST http://localhost:8081/typebot/create/europs \
  -H "apikey: EXr5OuEE2sBMbRo94LtWQfofvEF1gHUM" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://bot.extensionista.site",
    "typebot": "kreativ-educacao",
    "expire": 20,
    "keywordFinish": "PARAR",
    "delayMessage": 1000,
    "unknownMessage": "",
    "listeningFromMe": false,
    "stopBotFromMe": true,
    "keepOpen": false,
    "debounceTime": 3
  }'

# Verificar webhook anterior (apontava para N8N)
curl http://localhost:8081/webhook/findWebhook/europs \
  -H "apikey: EXr5OuEE2sBMbRo94LtWQfofvEF1gHUM"

# Desativar workflow 01-whatsapp-router-v2 no N8N UI (não deletar)
# Acessar: https://n8n.extensionista.site → workflows → 01-whatsapp-router-v2 → Toggle Off
```

---

## Bloco 5 — ToolJet: Apps Admin

**Acessar:** https://admin.extensionista.site

### Setup de Data Sources

1. **PostgreSQL** (Settings → Data Sources → Add):
   - Name: `Kreativ DB`
   - Host: `kreativ_postgres` | Port: `5432`
   - DB: `kreativ_edu`
   - User: `kreativ_user` | Pass: (ver .env POSTGRES_PASSWORD)

2. **REST API** (Settings → Data Sources → Add):
   - Name: `Kreativ N8N`
   - Base URL: `http://kreativ_n8n:5678/webhook`

### App 1: "Gestão de Alunos"

Criar novo app com:

**Query principal** (Postgres, nome: `listarAlunos`):
```sql
SELECT s.id, s.phone, s.name, s.email, s.course_id,
       c.name as course_name, s.current_module,
       s.completed_modules, s.attendance_status, s.lead_score,
       to_char(s.created_at,'DD/MM/YYYY') as data_cadastro
FROM students s
LEFT JOIN courses c ON c.id = s.course_id
WHERE s.phone ILIKE '%{{components.search.value}}%'
   OR s.name ILIKE '%{{components.search.value}}%'
ORDER BY s.created_at DESC LIMIT 200
```

**Componentes:**
- `search`: Text Input (placeholder: "Buscar por nome ou telefone")
- `studentsTable`: Table (data: `{{queries.listarAlunos.data}}`)
  - Colunas: phone, name, course_name, current_module, attendance_status, lead_score, data_cadastro
- `editModal`: Modal com campos de edição
- `enrollForm`: Formulário de matrícula → POST via N8N `enroll-student`

**Query update** (nome: `atualizarAluno`):
```sql
UPDATE students SET
  name='{{components.editName.value}}',
  course_id={{components.editCourse.value}},
  current_module={{components.editModule.value}},
  attendance_status='{{components.editStatus.value}}',
  updated_at=NOW()
WHERE id='{{components.studentsTable.selectedRow.id}}'
```

**Query matricular** (REST API - N8N):
```
Method: POST
Path: /enroll-student
Body: {
  "phone": "{{components.newPhone.value}}",
  "name": "{{components.newName.value}}",
  "course_id": "{{components.newCourse.value}}"
}
```

### App 2: "Cursos e Módulos"

**Query cursos** (nome: `listarCursos`):
```sql
SELECT id, name FROM courses ORDER BY name
```

**Query módulos** (nome: `listarModulos`):
```sql
SELECT id, module_number, title, description,
       content_text, quiz_questions::text as quiz_json,
       is_published, passing_score,
       to_char(updated_at,'DD/MM/YYYY HH24:MI') as atualizado
FROM modules
WHERE course_int_id = {{components.courseSelect.value}}
ORDER BY module_number
```

**Componentes:**
- `courseSelect`: Dropdown (data: `{{queries.listarCursos.data}}`)
- `modulesTable`: Table (data: `{{queries.listarModulos.data}}`)
- `editModal`: Modal com campos:
  - `editTitle`: Text Input
  - `editDesc`: Text Area
  - `editContent`: Text Area (grande, para HTML rico)
  - `editQuiz`: Text Area (JSON das perguntas)
  - `editScore`: Number Input (0-100)
  - `editPublished`: Toggle

**Query update módulo** (nome: `atualizarModulo`):
```sql
UPDATE modules SET
  title='{{components.editTitle.value}}',
  description='{{components.editDesc.value}}',
  content_text='{{components.editContent.value}}',
  quiz_questions='{{components.editQuiz.value}}'::jsonb,
  passing_score={{components.editScore.value}},
  is_published={{components.editPublished.value}},
  updated_at=NOW()
WHERE id='{{components.modulesTable.selectedRow.id}}'
```

---

## Checklist de Verificação E2E

```bash
# 1. Typebot rodando
curl -s -o /dev/null -w "%{http_code}" https://typebot.extensionista.site   # 200
curl -s -o /dev/null -w "%{http_code}" https://bot.extensionista.site        # 200

# 2. Catraca N8N respondendo
curl -s -X POST http://10.0.2.5:5678/webhook/check-student \
  -H "Content-Type: application/json" \
  -d '{"phone":"556399374165"}' | jq .status   # "bot"

curl -s -X POST http://10.0.2.5:5678/webhook/check-student \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511000000001"}' | jq .status  # "unknown"

# 3. Conteúdo do módulo
curl -s -X POST http://10.0.2.5:5678/webhook/get-module \
  -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","module_number":1}' | jq .title

# 4. Progresso
curl -s -X POST http://10.0.2.5:5678/webhook/get-progress \
  -H "Content-Type: application/json" \
  -d '{"phone":"556399374165"}' | jq '{module: .current_module, pct: .completion_pct}'

# 5. Teste WhatsApp manual (Rafael: 556399374165)
#    Enviar qualquer mensagem → deve aparecer menu Typebot
#    Digitar MODULO → ver conteúdo
#    Digitar QUIZ → ver primeira pergunta discursiva
#    Digitar TUTOR → ver mensagem de handoff + conversa no Chatwoot
```

---

## N8N: Limpeza de Workflows (opcional após tudo funcionando)

Deletar via N8N UI os workflows com nomes contendo:
`test`, `echo`, `path-v`, `half`, `minimal`, `code-only`, `inject`, `fresh`, `clone`,
`static`, `fetch-debug`, `module-test`, `mcp-server`, `tool-request`, `tool-save`,
`tool-resume`, `tool-emit`, `save-progress-webhook`, `resume-bot-webhook`,
`ai-router` (versões v1/v2/v2-final), `ai-router-v2`

**Manter:** `enroll-student`, `dashboard`, `inatividade`, `relatorio-semanal`,
`chatwoot-events`, `lead-scoring`, `emit-certificate`, `ai-router-v3`,
`rag-ingestion`, `Global-Error-Handler`

**Desativar (não deletar):** `01-whatsapp-router-v2` (fallback)
