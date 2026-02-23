# Kreativ Educação — Comet Briefing (23/02/2026)

> **Para:** Agente Comet (browser automation)
> **De:** Claude Code (Claude Sonnet 4.6)
> **Objetivo:** Configurar ToolJet Admin App via interface web

---

## CONTEXTO DO SISTEMA

### O que é o Kreativ

Sistema de educação conversacional via WhatsApp com IA.
- Alunos interagem com bot WhatsApp para estudar módulos, fazer quizzes e obter certificados
- Tutor humano monitora pelo Chatwoot; dados analíticos no Metabase
- Admins gerenciam conteúdo pelo ToolJet

### Estado atual (23/02/2026)

| Serviço | Status | URL |
|---------|--------|-----|
| Bot WhatsApp (Typebot) | ✅ Ativo | https://bot.extensionista.site/kreativ-educacao |
| N8N (workflows) | ✅ Ativo | https://n8n.extensionista.site |
| Portal LMS | ✅ Ativo | https://portal.extensionista.site |
| Chatwoot | ✅ Ativo | https://suporte.extensionista.site |
| Metabase | ✅ Configurado | https://dash.extensionista.site |
| ToolJet | ⚠️ UI não configurada | https://admin.extensionista.site |
| MinIO | ✅ Ativo | https://files.extensionista.site |

### Dados no banco (kreativ_edu)

- 6 alunos cadastrados
- 12 módulos publicados
- 508 pré-inscrições
- 0 certificados emitidos
- 1 registro de uso de IA (ai_usage_log)
- 28 chunks RAG (document_chunks)

---

## TAREFA PRINCIPAL: Configurar ToolJet Admin App

**URL:** https://admin.extensionista.site

O ToolJet precisa de um app completo para os admins gerenciarem:
1. Módulos (listar, editar, fazer upload de PDF/imagem)
2. Alunos (listar, ver progresso)
3. Pré-inscrições (listar, converter em aluno)

O plano detalhado está em: `docs/plans/SONAR_PLANO_2_TOOLJET.md`

---

## CREDENCIAIS NECESSÁRIAS

### ToolJet
- URL: https://admin.extensionista.site
- **Criar conta admin:** Use a tela de setup inicial (primeira vez)
  - Email sugerido: `admin@extensionista.site`
  - Senha: definir durante setup

### Banco de Dados PostgreSQL (para configurar como datasource no ToolJet)
- Host: `kreativ_postgres` (nome do container Docker)
- Port: `5432`
- Database: `kreativ_edu`
- Username: `kreativ_user`
- Password: *(ver variável `POSTGRES_PASSWORD` no .env do servidor)*
- SSL: desativado

### MinIO (para upload de arquivos)
- API interna para uploads: `http://kreativ_ingest:8000/process`
  - Este endpoint aceita POST com JSON `{module_id, file_base64, filename, file_type}`
  - Retorna `{ok: true, url: "https://files.extensionista.site/..."}`

---

## SCHEMA DO BANCO — Tabelas principais

### `modules`
```sql
id SERIAL PRIMARY KEY,
course_int_id INTEGER,         -- FK para courses.id
title VARCHAR(500),
content_text TEXT,             -- conteúdo do módulo (texto)
module_number INTEGER,
quiz_data JSONB,               -- quiz em JSON
video_url TEXT,                -- URL YouTube
media_urls TEXT[],             -- array de URLs (PDFs, imagens)
is_published BOOLEAN,
created_at TIMESTAMP
```

### `students`
```sql
id SERIAL PRIMARY KEY,
phone VARCHAR(20),             -- chave principal (ex: 556399374165)
name VARCHAR(255),
email VARCHAR(255),
current_module INTEGER,        -- progresso atual
attendance_status VARCHAR(50), -- 'bot' ou 'human'
portal_token UUID,
created_at TIMESTAMP,
updated_at TIMESTAMP
```

### `enrollment_progress`
```sql
id SERIAL PRIMARY KEY,
student_id INTEGER,
module_number INTEGER,
status VARCHAR(20),            -- 'passed', 'failed', 'in_progress'
score INTEGER,                 -- 0-100
completed_at TIMESTAMP
```

### `pre_inscriptions`
```sql
id SERIAL PRIMARY KEY,
nome VARCHAR(255),
telefone VARCHAR(20),
email VARCHAR(255),
telefone_valido BOOLEAN,
convertido BOOLEAN,
created_at TIMESTAMP
```

### `certificates`
```sql
id SERIAL PRIMARY KEY,
student_id INTEGER,
course_id VARCHAR(100),
issued_at TIMESTAMP
```

---

## PLANO DETALHADO — SONAR_PLANO_2_TOOLJET.md

O documento completo com instruções passo-a-passo está disponível em:
`/root/ideias_app/docs/plans/SONAR_PLANO_2_TOOLJET.md`

### Resumo das Fases

**Fase 1 — Setup inicial e Datasource**
1. Acessar https://admin.extensionista.site
2. Criar conta admin (email/senha)
3. Criar novo App: "Kreativ Admin"
4. Adicionar datasource PostgreSQL com as credenciais acima

**Fases 2-5 — Queries SQL**

Query 1: `listModules` — `SELECT id, title, module_number, is_published, video_url, array_length(media_urls,1) as media_count FROM modules ORDER BY module_number`

Query 2: `getModuleDetail` — `SELECT * FROM modules WHERE id = {{modules_table.selectedRow.id}}`

Query 3: `updateModule` — UPDATE modules SET title, video_url, content_text, is_published WHERE id

Query 4: `listStudents` — `SELECT id, phone, name, current_module, attendance_status, created_at FROM students ORDER BY created_at DESC`

Query 5: `getStudentProgress` — JOIN students + enrollment_progress

Query 6: `listPreInscricoes` — `SELECT * FROM pre_inscriptions WHERE convertido=false ORDER BY created_at DESC LIMIT 200`

Query 7: `matricularAluno` — INSERT INTO students + UPDATE pre_inscriptions SET convertido=true

Query 8: `uploadModuleFile` (JavaScript) — POST para `http://kreativ_ingest:8000/process`

Query 9: `addVideoUrl` (JavaScript) — UPDATE modules SET video_url

Query 10: `listPreInscricoes` — versão paginada

**Fases 6-9 — Interface (Componentes)**

- **Página Módulos:**
  - Table com listModules
  - Modal de edição com Form (title, video_url, content_text, is_published)
  - Botão Upload arquivo (PDF/imagem) → uploadModuleFile
  - Botão salvar → updateModule + runQuery(listModules)

- **Página Alunos:**
  - Table com listStudents
  - Painel lateral com progresso detalhado (getStudentProgress)

- **Página Pré-inscrições:**
  - Table com listPreInscricoes
  - Botão "Matricular" por linha → modal de confirmação → matricularAluno
  - Após matricular: atualizar tabela

---

## METABASE — Já Configurado

Os dois dashboards do Metabase foram criados e populados via API:

**Dashboard 1 — Kreativ — Visão Operacional** (ID=2)
URL: https://dash.extensionista.site/dashboard/2
- Card 1: Alunos Ativos Hoje
- Card 2: Alunos Ativos Esta Semana
- Card 3: Funil de Aprendizado (bar chart)
- Card 4: Score Médio por Módulo (bar chart)
- Card 5: Chamadas AI Tutor 14 dias (line chart)

**Dashboard 2 — Kreativ — Monitoramento** (ID=5)
URL: https://dash.extensionista.site/dashboard/5
- Monitor 1: Certificados Emitidos (número)
- Monitor 2: Alunos Parados >7 dias (número)
- Monitor 3: Alunos Novos ≤3 dias (número)
- Monitor 4: Pré-inscrições Aguardando (número)
- Monitor 5: Tabela de alunos parados com link WhatsApp
- Monitor 6: Tabela de reprovados sem aprovação
- Monitor 7: Taxa de aprovação por módulo (bar)
- Monitor 8: Funil de conversão (bar)

---

## ARQUITETURA — Comunicação entre Serviços

```
WhatsApp → Evolution API (europs) → Typebot v6 → N8N → PostgreSQL
                                          ↓
                                    Portal LMS (Next.js)
                                          ↓
                               Metabase (analytics)
                               ToolJet (admin)
                               Chatwoot (suporte)
                               MinIO (arquivos)
```

### Serviços Docker (todos na rede `kreativ_net` + `coolify`)

| Container | Hostname interno | Porta |
|-----------|-----------------|-------|
| kreativ_postgres | kreativ_postgres | 5432 |
| kreativ_n8n | kreativ_n8n | 5678 |
| kreativ_typebot_builder | kreativ_typebot_builder | 3000 |
| kreativ_evolution | kreativ_evolution | 8080 |
| kreativ_tooljet | kreativ_tooljet | 3000 |
| kreativ_metabase | kreativ_metabase | 3000 |
| kreativ_minio | kreativ_minio | 9000 |
| kreativ_ingest | kreativ_ingest | 8000 |
| portal | portal | 3000 |

---

## OBSERVAÇÕES IMPORTANTES

1. **Upload de arquivos no ToolJet**: Use o endpoint interno `http://kreativ_ingest:8000/process` — NOT a URL pública. O ToolJet roda dentro do Docker e pode acessar diretamente.

2. **JavaScript Queries no ToolJet**: Para o uploadModuleFile, use uma JS query que faz `fetch()` com `{module_id, file_base64, filename, file_type}`.

3. **Botão Matricular**: Ao matricular via `matricularAluno`, o N8N não é notificado automaticamente. O aluno precisará iniciar contato pelo WhatsApp para ser ativado no bot.

4. **DB_ID no Metabase**: O banco `kreativ_edu` tem ID=2 no Metabase.

5. **Typebot API Key**: `LqkFiNhRjg1p2W3nNkgLpxPM` — não é necessária para ToolJet.
