# Design: Pipeline de Conteúdo + Analytics Expandido
> **Data:** 2026-02-22
> **Status:** Aprovado — aguardando implementação
> **Contexto:** VPS Hostinger 7.8GB RAM, 1 vCPU, 14 containers ativos, swap 3.6/4GB usado

---

## 1. Motivação

O sistema atual exige que operadores insiram conteúdo de módulos manualmente como texto plano num textarea. PDFs e outros arquivos não têm pipeline. O AI Tutor RAG está sem contexto real (embeddings vazios). O Metabase não mostra os segmentos operacionais críticos (parados, novos, reprovados).

---

## 2. Escopo

### 2.1 Componentes novos
- **`kreativ_ingest`** — microserviço Python/FastAPI para extração e ingestão
- **Dashboard Metabase "Kreativ — Monitoramento"** — 8 cards focados em ação operacional

### 2.2 Componentes modificados
- **ToolJet "Kreativ Admin"** — seção de arquivos no modal de módulo + aba Pré-inscrições
- **N8N ULTIMATE** — nova action `admin_upload_module_file`
- **Portal Next.js** — renderizar PDF embed e imagens via `media_urls`

---

## 3. Microserviço `kreativ_ingest`

### 3.1 Decisão de tecnologia

| Opção | RAM | Viável no VPS? | Motivo da decisão |
|---|---|---|---|
| Unstructured.io | 500MB–1GB | ❌ | VPS com 1.5GB disponível — inviável |
| Stirling-PDF | ~256MB | ⚠️ Arriscado | Margem insuficiente com 14 containers |
| **FastAPI custom** | **~80MB** | **✅** | Único caminho seguro; PDFs são digitais (sem OCR) |

Pacotes: `pdfplumber` (PDF), `python-docx` (DOCX), `boto3` (MinIO), `psycopg2-binary` (PG), `httpx` (DeepSeek), `fastapi + uvicorn`.

### 3.2 Endpoints

```
POST /process   → pipeline completo (upload + extração + embeddings)
GET  /health    → health check (usado pelo docker healthcheck)
```

### 3.3 Payload de entrada

```json
{
  "module_id": "uuid-do-modulo",
  "file_name": "apostila_modulo1.pdf",
  "file_base64": "JVBERi0xLjQ...",
  "file_type": "pdf",
  "replace_content": true
}
```

`file_type` aceita: `pdf`, `docx`, `image`, `video_url`
Para `video_url`: `file_base64` é a URL (YouTube/Vimeo), sem extração de texto.

### 3.4 Pipeline interno

```
1. Decodifica base64 → bytes
2. Salva no MinIO:
     bucket: kreativ-modules
     key: modules/{module_id}/{file_name}
   → obtém URL pública
3. UPDATE modules SET media_urls = media_urls || ARRAY[url]

4. SE file_type IN ('pdf', 'docx'):
     4a. Extrai texto:
           pdf  → pdfplumber.open() → concat page.extract_text()
           docx → python-docx Document() → concat paragraphs
     4b. Limpa texto: remove linhas vazias duplas, strip
     4c. SE replace_content=true: UPDATE modules SET content_text = texto_extraido
         SE replace_content=false: content_text = content_text || '\n\n' || texto
     4d. Chunka em blocos de ~500 tokens (split por parágrafo duplo, max 500 words)
     4e. DELETE FROM document_chunks WHERE module_id = ?
     4f. PARA CADA chunk:
           POST https://api.deepseek.com/embeddings (model: text-embedding-ada-002 compat)
           INSERT INTO document_chunks (module_id, content, embedding, chunk_index)
     4g. Retorna { ok, url, text_length, chunks_inserted }

5. SE file_type IN ('image', 'video_url'):
     Apenas salva URL em media_urls, sem extração de texto
     Retorna { ok, url }
```

### 3.5 Configuração Docker

```yaml
kreativ_ingest:
  image: kreativ_ingest:latest
  build: ./services/ingest
  container_name: kreativ_ingest
  restart: unless-stopped
  networks: [kreativ_net]   # apenas rede interna — sem porta pública
  environment:
    - POSTGRES_HOST=kreativ_postgres
    - POSTGRES_DB=kreativ_edu
    - POSTGRES_USER=kreativ_user
    - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    - MINIO_ENDPOINT=http://kreativ_minio:9000
    - MINIO_ACCESS_KEY=${MINIO_ROOT_USER}
    - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}
    - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
  mem_limit: 200m          # hard cap — protege o VPS
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### 3.6 Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpoppler-cpp-dev curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`requirements.txt`:
```
fastapi==0.111.0
uvicorn==0.29.0
pdfplumber==0.11.0
python-docx==1.1.0
boto3==1.34.0
psycopg2-binary==2.9.9
httpx==0.27.0
```

---

## 4. N8N — action `admin_upload_module_file`

Adicionar ao roteador do ULTIMATE (`Roteador de Ações`):

```
action == 'admin_upload_module_file'
  → nó HTTP Request: POST http://kreativ_ingest:8000/process
  → body: { module_id, file_name, file_base64, file_type, replace_content }
  → timeout: 120s (extração de PDF grande pode demorar)
  → retorna { ok, url, text_length, chunks_inserted } ao webhook caller
```

Nenhuma mudança no webhook path `/kreativ-unified-api`. Sem novo endpoint.

---

## 5. ToolJet — mudanças no plano existente

### 5.1 Seção "Arquivos" no modal de edição de módulo

Adicionada abaixo dos campos existentes (título, conteúdo, rubrica, publicado):

```
────────────────────────────────────────
📎 Arquivos do Módulo
────────────────────────────────────────
Arquivos atuais:
  [📄 apostila.pdf]  [🗑️]
  [🎬 youtube.com/...]  [🗑️]

Adicionar arquivo:
  [File Picker: .pdf, .docx, .jpg, .png]    [Fazer Upload]

Adicionar vídeo:
  [URL do YouTube ou Vimeo               ]  [Adicionar URL]

Status: ● Pronto  ou  ⟳ Processando...  ou  ✅ X chunks gerados
```

**Queries novas no ToolJet** (além das 7 do plano atual):

```
Query 8 — uploadModuleFile (RunJS)
  Input: fileInput.file (base64 + name + type)
  Ação: fetch POST N8N admin_upload_module_file
  Sucesso: re-run loadModulo + mostrar "✅ X chunks gerados"

Query 9 — addVideoUrl (RunJS)
  Input: videoUrlInput.value
  Ação: fetch POST N8N admin_upload_module_file com file_type='video_url'
  Sucesso: re-run loadModulo
```

### 5.2 Nova aba "Pré-inscrições" (4ª página no app)

```
[ Buscar por nome, telefone ou cidade... ]

Nome         | Telefone    | Cidade   | Curso Interesse | Cadastro  | Ação
João Silva   | 5511...     | Palmas   | Agronegócio     | 15/02/26  | [Matricular]
Maria...     | 5563...     | Araguaína| Financeiro      | 10/02/26  | [Matricular]
             Total: 508 aguardando conversão

[Botão "Matricular"]:
  → Abre mini-modal: confirma nome + seleciona curso + módulo inicial (default: 1)
  → Chama N8N admin_upsert_student
  → NUNCA envia mensagem (só cria registro no banco)
  → Marca pre_inscriptions.convertido = true
```

**Query 10 — listPreInscricoes (PostgreSQL)**
```sql
SELECT
  pi.id::text,
  pi.nome_completo AS name,
  pi.telefone_whatsapp AS phone,
  pi.cidade,
  pi.estado,
  STRING_AGG(c.name, ', ') AS cursos_interesse,
  TO_CHAR(pi.data_primeira_inscricao, 'DD/MM/YYYY') AS cadastrado_em
FROM pre_inscriptions pi
LEFT JOIN pre_inscription_courses pic ON pic.pre_inscription_id = pi.id
LEFT JOIN courses c ON c.id = pic.course_id
WHERE pi.convertido = false
  AND pi.telefone_valido = true
  AND ('{{searchPreInput.value}}' = ''
       OR pi.nome_completo ILIKE '%' || '{{searchPreInput.value}}' || '%'
       OR pi.telefone_whatsapp ILIKE '%' || '{{searchPreInput.value}}' || '%'
       OR pi.cidade ILIKE '%' || '{{searchPreInput.value}}' || '%')
GROUP BY pi.id, pi.nome_completo, pi.telefone_whatsapp, pi.cidade, pi.estado, pi.data_primeira_inscricao
ORDER BY pi.data_primeira_inscricao DESC
LIMIT 100
```

### 5.3 Botão "Enviar mensagem" na aba Alunos

- Adicionado no modal do aluno
- **Em desenvolvimento:** visível mas desabilitado com tooltip "Disponível em produção"
- **Em produção:** habilitado para número de produção, com confirmação obrigatória
- Só funcionará para `phone = '556399374165'` enquanto `NODE_ENV=development`

---

## 6. Portal Next.js — renderização de media_urls

Adicionar ao `modulo/[id].tsx` após o bloco de YouTube existente:

```tsx
// PDF embed
{mediaUrls.filter(u => u.endsWith('.pdf')).map(url => (
  <div key={url}>
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="btn btn-outline">
      📄 Baixar Apostila
    </a>
    <embed src={url} width="100%" height="700px"
           style={{ borderRadius: 'var(--radius)', marginTop: '12px' }} />
  </div>
))}

// Imagens
{mediaUrls.filter(u => /\.(jpg|jpeg|png|webp|gif)$/i.test(u)).map(url => (
  <img key={url} src={url} alt="Material do módulo"
       style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: '16px' }} />
))}
```

---

## 7. Metabase — Dashboard "Kreativ — Monitoramento"

Dashboard separado do "Kreativ — Visão Operacional". Focado em ação operacional diária.

### Layout

```
Linha 1 — Big Numbers
  [Certificados Emitidos]  [Parados >7 dias]  [Alunos Novos ≤3d]  [Reprovados 30d]

Linha 2 — Tabelas de Atenção (contêm telefone para ação direta)
  [Alunos Parados >7 dias]           [Reprovados sem aprovação]
  nome | módulo | dias | telefone    nome | módulo | tentativas | telefone

Linha 3 — Funil + Aprovação
  [Funil: Pré → Aluno → Ativo → Cert]  [Taxa de Aprovação por Módulo]

Linha 4 — Pré-inscrições
  [Pré-inscrições aguardando]  Big Number com contexto "508 aguardando"
```

### SQLs validados

**Alunos Parados >7 dias (tabela)**
```sql
SELECT
  COALESCE(name, 'Sem nome') AS nome,
  phone AS telefone,
  current_module AS modulo_atual,
  EXTRACT(DAY FROM NOW() - updated_at)::int AS dias_parado,
  'https://wa.me/' || phone AS link_whatsapp
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0
ORDER BY updated_at ASC
```

**Alunos Novos ≤3 dias (tabela)**
```sql
SELECT
  COALESCE(name, 'Sem nome') AS nome,
  phone AS telefone,
  current_module AS modulo_atual,
  TO_CHAR(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS cadastrado_em
FROM students
WHERE created_at >= NOW() - INTERVAL '3 days'
ORDER BY created_at DESC
```

**Reprovados sem aprovação no módulo (tabela)**
```sql
SELECT
  s.name AS nome,
  s.phone AS telefone,
  ep.module_number AS modulo,
  ep.score AS ultimo_score,
  COUNT(*) AS tentativas
FROM enrollment_progress ep
JOIN students s ON s.id = ep.student_id
WHERE ep.status = 'failed'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_progress ep2
    WHERE ep2.student_id = ep.student_id
      AND ep2.module_number = ep.module_number
      AND ep2.status = 'passed'
  )
GROUP BY s.name, s.phone, ep.module_number, ep.score
ORDER BY tentativas DESC, ep.score ASC
```

**Funil de conversão (para bar chart horizontal)**
```sql
SELECT unnest(ARRAY[
  'Pré-inscrições',
  'Alunos cadastrados',
  'Iniciaram (módulo > 0)',
  'Certificados'
]) AS etapa,
unnest(ARRAY[
  (SELECT COUNT(*) FROM pre_inscriptions)::int,
  (SELECT COUNT(*) FROM students)::int,
  (SELECT COUNT(*) FROM students WHERE current_module > 0)::int,
  (SELECT COUNT(*) FROM certificates)::int
]) AS total
```

**Taxa de aprovação por módulo (bar chart)**
```sql
SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  COUNT(*) FILTER (WHERE status = 'passed') AS aprovados,
  COUNT(*) FILTER (WHERE status = 'failed') AS reprovados,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'passed') / NULLIF(COUNT(*), 0),
    1
  ) AS taxa_aprovacao_pct
FROM enrollment_progress
GROUP BY module_number
ORDER BY module_number
```

**Total de certificados emitidos**
```sql
SELECT COUNT(*) AS certificados_emitidos FROM certificates
```

**Pré-inscrições aguardando**
```sql
SELECT COUNT(*) AS aguardando_matricula
FROM pre_inscriptions
WHERE convertido = false AND telefone_valido = true
```

---

## 8. Restrições de desenvolvimento

- Mensagens WhatsApp habilitadas apenas para `phone = '556399374165'`
- Botão "Enviar mensagem" no ToolJet: desabilitado via toggle/constant `DEV_MODE=true`
- Bulk enrollment de pré-inscrições: cria registro no banco, **nunca dispara mensagem**
- `NEXT_PUBLIC_SUPPORT_PHONE` no portal: continua apontando para 556399374165

---

## 9. Ordem de implementação

```
Fase 1 — Microserviço kreativ_ingest
  1a. Criar services/ingest/ (Dockerfile + requirements.txt + main.py)
  1b. Adicionar ao docker-compose.yml
  1c. Criar bucket kreativ-modules no MinIO
  1d. Testar endpoint /process com PDF de teste

Fase 2 — N8N action admin_upload_module_file
  2a. Adicionar rota no ULTIMATE via script de patch
  2b. Testar via curl com base64 de PDF pequeno

Fase 3 — ToolJet (após Comet concluir Tasks 6-11)
  3a. Adicionar seção de arquivos no modal de módulo (Queries 8 e 9)
  3b. Adicionar aba Pré-inscrições (Query 10)
  3c. Adicionar botão "Enviar mensagem" desabilitado no modal de aluno

Fase 4 — Portal
  4a. Adicionar renderização de PDF e imagens em modulo/[id].tsx

Fase 5 — Metabase
  5a. Criar dashboard "Kreativ — Monitoramento" com 8 cards
  5b. Incluir nos planos do Sonar Pro (SONAR_PLANO_1_METABASE.md atualizado)
```

---

## 10. Dependências externas

| Serviço | Já existe? | Config necessária |
|---|---|---|
| MinIO (`kreativ_minio`) | ✅ | Criar bucket `kreativ-modules` + policy pública de leitura |
| DeepSeek API | ✅ | `DEEPSEEK_API_KEY` já no `.env` |
| PostgreSQL (`kreativ_postgres`) | ✅ | `document_chunks` já existe com pgvector |
| N8N webhook | ✅ | Apenas nova rota no roteador existente |
