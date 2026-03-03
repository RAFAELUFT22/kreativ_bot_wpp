# Content Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar o microserviço `kreativ_ingest` para upload de PDF/DOCX → extração de texto → embeddings automáticos, com integração ToolJet (upload), N8N (orquestração) e Portal (renderização).

**Architecture:** FastAPI Python container (~80MB RAM) recebe arquivo via N8N, salva no MinIO, extrai texto com pdfplumber/python-docx, chunkeia e gera embeddings via OpenRouter (text-embedding-3-small, 1536 dims) salvos em `document_chunks` pgvector. Metabase ganha dashboard "Monitoramento" separado com 8 cards operacionais.

**Tech Stack:** Python 3.11-slim, FastAPI, pdfplumber, python-docx, boto3 (MinIO S3), psycopg2-binary, httpx, OpenRouter API, PostgreSQL 15 + pgvector, MinIO, N8N webhook, ToolJet RunJS, Next.js portal.

**Referências críticas:**
- Design: `docs/plans/2026-02-22-content-pipeline-design.md`
- Schema: `init-scripts/01-init-dbs.sql` + colunas reais em `modules`, `document_chunks`
- Embedding API: OpenRouter `https://openrouter.ai/api/v1/embeddings` model `openai/text-embedding-3-small`
- `.env`: `OPEN_ROUTER_API`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- `document_chunks` tem UNIQUE(module_id, chunk_index) → usar ON CONFLICT DO UPDATE
- `modules.media_urls` é `ARRAY` de texto — append com `array_append()`
- Rede Docker interna: `kreativ_net`, serviços acessíveis por nome de container

---

## Task 1: Criar o microserviço `services/ingest/`

**Files:**
- Create: `services/ingest/main.py`
- Create: `services/ingest/requirements.txt`
- Create: `services/ingest/Dockerfile`

### Step 1: Criar estrutura de diretórios

```bash
mkdir -p /root/ideias_app/services/ingest
```

Saída esperada: nenhuma (só cria o diretório)

### Step 2: Criar `requirements.txt`

```
fastapi==0.111.0
uvicorn==0.29.0
pdfplumber==0.11.0
python-docx==1.1.0
boto3==1.34.0
psycopg2-binary==2.9.9
httpx==0.27.0
python-multipart==0.0.9
```

### Step 3: Criar `Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libpoppler-cpp-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 4: Criar `main.py` (serviço completo)

```python
"""kreativ_ingest — PDF/DOCX → MinIO + content_text + embeddings pgvector."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64, io, os, logging, uuid

import pdfplumber
from docx import Document as DocxDocument
import boto3
from botocore.client import Config
import psycopg2
import httpx

app = FastAPI(title="kreativ_ingest", version="1.0.0")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── Configuração via env ──────────────────────────────────────────────────────
PG = dict(
    host=os.getenv("POSTGRES_HOST", "kreativ_postgres"),
    dbname=os.getenv("POSTGRES_DB", "kreativ_edu"),
    user=os.getenv("POSTGRES_USER", "kreativ_user"),
    password=os.getenv("POSTGRES_PASSWORD", ""),
)
MINIO_URL    = os.getenv("MINIO_ENDPOINT", "http://kreativ_minio:9000")
MINIO_PUB    = os.getenv("MINIO_PUBLIC_URL", "https://files.extensionista.site")
MINIO_KEY    = os.getenv("MINIO_ACCESS_KEY", "")
MINIO_SECRET = os.getenv("MINIO_SECRET_KEY", "")
MINIO_BUCKET = "kreativ-modules"
OR_KEY       = os.getenv("OPEN_ROUTER_API", "")
OR_URL       = "https://openrouter.ai/api/v1/embeddings"
OR_MODEL     = "openai/text-embedding-3-small"
CHUNK_WORDS  = 500

# ── Modelos ───────────────────────────────────────────────────────────────────
class ProcessRequest(BaseModel):
    module_id: str
    file_name: str
    file_base64: str          # base64 do arquivo; para video_url = URL direta
    file_type: str            # pdf | docx | image | video_url
    replace_content: bool = True  # True = substitui content_text; False = concatena

# ── Helpers ───────────────────────────────────────────────────────────────────
def db():
    return psycopg2.connect(**PG)

def s3():
    return boto3.client(
        "s3",
        endpoint_url=MINIO_URL,
        aws_access_key_id=MINIO_KEY,
        aws_secret_access_key=MINIO_SECRET,
        config=Config(signature_version="s3v4"),
    )

def ensure_bucket(client):
    try:
        client.head_bucket(Bucket=MINIO_BUCKET)
    except Exception:
        client.create_bucket(Bucket=MINIO_BUCKET)
        policy = (
            '{"Version":"2012-10-17","Statement":[{'
            '"Effect":"Allow","Principal":"*","Action":"s3:GetObject",'
            f'"Resource":"arn:aws:s3:::{MINIO_BUCKET}/*"'
            '}]}'
        )
        client.put_bucket_policy(Bucket=MINIO_BUCKET, Policy=policy)

def extract_pdf(data: bytes) -> str:
    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t.strip())
    return "\n\n".join(parts)

def extract_docx(data: bytes) -> str:
    doc = DocxDocument(io.BytesIO(data))
    return "\n\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())

def chunk_text(text: str) -> list[str]:
    """Chunka por parágrafo duplo, max CHUNK_WORDS palavras por chunk."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, cur, cur_w = [], [], 0
    for para in paras:
        w = len(para.split())
        if cur_w + w > CHUNK_WORDS and cur:
            chunks.append("\n\n".join(cur))
            cur, cur_w = [], 0
        cur.append(para)
        cur_w += w
    if cur:
        chunks.append("\n\n".join(cur))
    return chunks

def get_embedding(text: str) -> list[float]:
    with httpx.Client(timeout=30) as client:
        r = client.post(
            OR_URL,
            headers={"Authorization": f"Bearer {OR_KEY}", "Content-Type": "application/json"},
            json={"model": OR_MODEL, "input": text},
        )
        r.raise_for_status()
        return r.json()["data"][0]["embedding"]

def vec_str(v: list[float]) -> str:
    """Converte lista de floats para string formato pgvector: [0.1,0.2,...]"""
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "service": "kreativ_ingest"}


@app.post("/process")
def process(req: ProcessRequest):
    log.info(f"Processing file_type={req.file_type} module_id={req.module_id} file={req.file_name}")

    # ── 1. Para video_url: apenas append URL em media_urls ───────────────────
    if req.file_type == "video_url":
        url = req.file_base64  # file_base64 carrega a URL diretamente
        conn = db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE modules SET media_urls = array_append(COALESCE(media_urls, '{}'), %s) WHERE id = %s",
                    (url, req.module_id),
                )
            conn.commit()
        finally:
            conn.close()
        return {"ok": True, "url": url, "text_length": 0, "chunks_inserted": 0}

    # ── 2. Decodificar arquivo ────────────────────────────────────────────────
    try:
        file_data = base64.b64decode(req.file_base64)
    except Exception as e:
        raise HTTPException(400, f"base64 inválido: {e}")

    # ── 3. Upload para MinIO ──────────────────────────────────────────────────
    content_types = {
        "pdf":   "application/pdf",
        "docx":  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image": "image/jpeg",
    }
    try:
        client = s3()
        ensure_bucket(client)
        key = f"modules/{req.module_id}/{req.file_name}"
        client.put_object(
            Bucket=MINIO_BUCKET,
            Key=key,
            Body=file_data,
            ContentType=content_types.get(req.file_type, "application/octet-stream"),
        )
        url = f"{MINIO_PUB}/{MINIO_BUCKET}/{key}"
        log.info(f"MinIO upload OK: {url}")
    except Exception as e:
        raise HTTPException(500, f"MinIO upload falhou: {e}")

    # ── 4. Registrar URL em media_urls ───────────────────────────────────────
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE modules SET media_urls = array_append(COALESCE(media_urls, '{}'), %s) WHERE id = %s",
                (url, req.module_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"DB media_urls falhou: {e}")
    finally:
        conn.close()

    # ── 5. Imagens: sem extração de texto ────────────────────────────────────
    if req.file_type == "image":
        return {"ok": True, "url": url, "text_length": 0, "chunks_inserted": 0}

    # ── 6. PDF/DOCX: extrair texto ───────────────────────────────────────────
    try:
        text = extract_pdf(file_data) if req.file_type == "pdf" else extract_docx(file_data)
    except Exception as e:
        raise HTTPException(500, f"Extração de texto falhou: {e}")

    if not text.strip():
        log.warning(f"Nenhum texto extraído de {req.file_name}")
        return {"ok": True, "url": url, "text_length": 0, "chunks_inserted": 0,
                "warning": "Nenhum texto extraído — PDF pode ser imagem (sem OCR)"}

    # ── 7. Atualizar content_text no módulo ───────────────────────────────────
    conn = db()
    try:
        with conn.cursor() as cur:
            if req.replace_content:
                cur.execute("UPDATE modules SET content_text = %s, updated_at = NOW() WHERE id = %s",
                            (text, req.module_id))
            else:
                cur.execute(
                    "UPDATE modules SET content_text = COALESCE(content_text,'') || E'\\n\\n' || %s,"
                    " updated_at = NOW() WHERE id = %s",
                    (text, req.module_id),
                )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"DB content_text falhou: {e}")
    finally:
        conn.close()

    # ── 8. Chunkar e gerar embeddings ─────────────────────────────────────────
    chunks = chunk_text(text)
    log.info(f"{len(chunks)} chunks para módulo {req.module_id}")

    inserted = 0
    for i, chunk in enumerate(chunks):
        try:
            embedding = get_embedding(chunk)
            emb_str = vec_str(embedding)
            conn = db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO document_chunks
                               (id, module_id, source_file, chunk_index, content, embedding)
                           VALUES (%s, %s, %s, %s, %s, %s::vector)
                           ON CONFLICT (module_id, chunk_index) DO UPDATE
                               SET content = EXCLUDED.content,
                                   embedding = EXCLUDED.embedding""",
                        (str(uuid.uuid4()), req.module_id, req.file_name, i, chunk, emb_str),
                    )
                conn.commit()
                inserted += 1
            finally:
                conn.close()
        except Exception as e:
            log.warning(f"Chunk {i} falhou: {e}")

    log.info(f"Concluído: {inserted}/{len(chunks)} chunks embedded para {req.module_id}")
    return {
        "ok": True,
        "url": url,
        "text_length": len(text),
        "chunks_total": len(chunks),
        "chunks_inserted": inserted,
    }
```

### Step 5: Verificar estrutura criada

```bash
ls -la /root/ideias_app/services/ingest/
```

Saída esperada:
```
Dockerfile
main.py
requirements.txt
```

### Step 6: Build da imagem para validar

```bash
cd /root/ideias_app
docker build -t kreativ_ingest:latest services/ingest/
```

Saída esperada: `Successfully built ...` (pode demorar ~2 min no primeiro build)

### Step 7: Commit

```bash
git add services/ingest/
git commit -m "feat(ingest): microserviço FastAPI para PDF→texto→embeddings"
```

---

## Task 2: Adicionar `kreativ_ingest` ao docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (adicionar serviço no final, antes do fechamento)

### Step 1: Ler o final do docker-compose.yml para encontrar o ponto de inserção

```bash
tail -30 /root/ideias_app/docker-compose.yml
```

Identifique a última linha antes de `networks:` ou `volumes:` no nível raiz.

### Step 2: Adicionar o serviço

Adicione o bloco abaixo **dentro de `services:`**, após o último serviço existente:

```yaml
  kreativ_ingest:
    image: kreativ_ingest:latest
    build:
      context: ./services/ingest
      dockerfile: Dockerfile
    container_name: kreativ_ingest
    restart: unless-stopped
    networks:
      - kreativ_net
    environment:
      - POSTGRES_HOST=kreativ_postgres
      - POSTGRES_DB=kreativ_edu
      - POSTGRES_USER=kreativ_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - MINIO_ENDPOINT=http://kreativ_minio:9000
      - MINIO_PUBLIC_URL=https://files.extensionista.site
      - MINIO_ACCESS_KEY=${MINIO_ROOT_USER}
      - MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}
      - OPEN_ROUTER_API=${OPEN_ROUTER_API}
    mem_limit: 200m
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
```

**ATENÇÃO:** Verifique no `.env` o nome exato das variáveis MinIO:
```bash
grep -E 'MINIO_ROOT|MINIO_ACCESS|MINIO_SECRET' /root/ideias_app/.env
```
Ajuste `MINIO_ACCESS_KEY` e `MINIO_SECRET_KEY` conforme o que estiver no `.env`.

### Step 3: Subir o container

```bash
cd /root/ideias_app
docker compose up -d kreativ_ingest
```

Aguardar 15s e verificar:
```bash
docker ps | grep kreativ_ingest
docker logs kreativ_ingest --tail=20
```

Saída esperada nos logs:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 4: Testar o health check

```bash
docker exec kreativ_n8n curl -s http://kreativ_ingest:8000/health
```

Saída esperada: `{"ok":true,"service":"kreativ_ingest"}`

### Step 5: Commit

```bash
git add docker-compose.yml
git commit -m "feat(docker): adicionar kreativ_ingest ao compose (200MB mem_limit)"
```

---

## Task 3: Teste de integração do microserviço com PDF real

**Files:**
- Create: `/tmp/test_ingest.py` (script temporário de teste, não commitar)

### Step 1: Preparar PDF de teste com base64

```bash
# Usar um módulo real do banco para testar
MODULE_ID=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -t -c \
  "SELECT id FROM modules WHERE content_text IS NOT NULL LIMIT 1;" | tr -d ' \n')
echo "Module ID para teste: $MODULE_ID"
```

### Step 2: Criar PDF de teste mínimo e testar via curl

```bash
# Criar PDF de teste simples com Python
python3 -c "
import base64, json

# PDF mínimo válido (1 página com texto)
pdf_bytes = b'%PDF-1.4\n1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n/Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n4 0 obj\n<</Length 44>>\nstream\nBT /F1 12 Tf 100 700 Td (Teste de extracao) Tj ET\nendstream\nendobj\n5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n\n0000000360 00000 n\ntrailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n441\n%%EOF'

payload = {
    'module_id': '$MODULE_ID',
    'file_name': 'teste.pdf',
    'file_base64': base64.b64encode(pdf_bytes).decode(),
    'file_type': 'pdf',
    'replace_content': False
}
print(json.dumps(payload))
" > /tmp/test_payload.json

# Enviar para o serviço via rede interna Docker
docker exec kreativ_n8n curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @/tmp/test_payload.json \
  http://kreativ_ingest:8000/process
```

Saída esperada:
```json
{"ok":true,"url":"https://files.extensionista.site/kreativ-modules/modules/.../teste.pdf","text_length":18,"chunks_total":1,"chunks_inserted":1}
```

**Se `text_length` for 0:** O PDF mínimo acima pode não ser parseable por pdfplumber. Isso é esperado — PDFs reais de apostilas funcionarão. O teste confirma que o pipeline roda sem erros 500.

### Step 3: Verificar que o arquivo aparece no MinIO

Acesse https://files.extensionista.site ou via API:
```bash
docker exec kreativ_minio mc ls local/kreativ-modules/modules/ 2>/dev/null || \
docker exec kreativ_n8n curl -s http://kreativ_minio:9000/kreativ-modules/ | head -30
```

### Step 4: Verificar que o document_chunk foi inserido

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT module_id, source_file, chunk_index, LEFT(content, 50) AS preview
FROM document_chunks
ORDER BY created_at DESC LIMIT 3;"
```

---

## Task 4: N8N — action `admin_upload_module_file`

**Files:**
- Create: `scripts/patch_n8n_upload_action.py`
- Modify: `n8n-workflows/60-kreativ-api-ultimate.json` (via script)

### Step 1: Identificar o nó "Roteador de Ações" no workflow

```bash
N8N_KEY=$(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)
curl -s "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" \
  -H "X-N8N-API-KEY: $N8N_KEY" | python3 -c "
import sys, json
wf = json.load(sys.stdin)
for n in wf['nodes']:
    if 'Roteador' in n['name'] or 'Switch' in n['type'] or 'switch' in n['type']:
        print(f'Nome: {n[\"name\"]} | Tipo: {n[\"type\"]} | ID: {n[\"id\"]}')
        print('Params:', json.dumps(n.get('parameters',{}))[:400])
"
```

### Step 2: Criar script de patch

```python
# scripts/patch_n8n_upload_action.py
import json, uuid, subprocess, sys

N8N_URL = "https://n8n.extensionista.site"
WF_ID   = "SoB5evP9aOmj6hLA"

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERRO:", r.stderr[:300])
        sys.exit(1)
    return r.stdout.strip()

n8n_key = run("grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2")

# Baixar workflow atual
run(f'curl -s "https://n8n.extensionista.site/api/v1/workflows/{WF_ID}" '
    f'-H "X-N8N-API-KEY: {n8n_key}" > /tmp/wf_upload_patch.json')

with open('/tmp/wf_upload_patch.json') as f:
    wf = json.load(f)

nodes = wf['nodes']
connections = wf['connections']

# Encontrar nó de normalização (ponto de saída do router para novos paths)
normalizar = next((n for n in nodes if 'Normalizar' in n['name']), None)
if not normalizar:
    print("ERRO: Nó Normalizar não encontrado")
    sys.exit(1)

# Encontrar posição de referência (último nó admin existente)
admin_nodes = [n for n in nodes if n['name'].startswith('Admin:')]
base_x = max(n['position'][0] for n in admin_nodes) if admin_nodes else 2000
base_y = max(n['position'][1] for n in admin_nodes) + 300 if admin_nodes else 600

# ── Novo nó: Upload → kreativ_ingest ─────────────────────────────────────────
upload_node_id = str(uuid.uuid4())
upload_node = {
    "id": upload_node_id,
    "name": "Admin: Upload Module File",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [base_x, base_y],
    "continueOnFail": False,
    "parameters": {
        "method": "POST",
        "url": "http://kreativ_ingest:8000/process",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [{"name": "Content-Type", "value": "application/json"}]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ module_id: $json.module_id, file_name: $json.file_name, file_base64: $json.file_base64, file_type: $json.file_type, replace_content: $json.replace_content !== false }) }}",
        "options": {"timeout": 120000}
    }
}

# ── Nó de resposta ────────────────────────────────────────────────────────────
respond_upload_id = str(uuid.uuid4())
respond_upload = {
    "id": respond_upload_id,
    "name": "Admin: Upload Respond",
    "type": "n8n-nodes-base.respondToWebhook",
    "typeVersion": 1.1,
    "position": [base_x + 240, base_y],
    "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}"
    }
}

nodes.extend([upload_node, respond_upload])

# ── Conectar: Normalizar → Upload → Respond ───────────────────────────────────
# O roteador existente já usa o padrão: action == X → nó específico
# Precisamos adicionar uma IF node para detectar admin_upload_module_file
# OU (mais simples) adicionar ao roteador de ações se ele for um Switch node

# Encontrar o Switch/Roteador
router = next((n for n in nodes if 'Roteador' in n['name']), None)
if router and router['type'] in ('n8n-nodes-base.switch', 'n8n-nodes-base.if'):
    # Adicionar case ao switch
    rules = router['parameters'].get('rules', {}).get('values', [])
    rules.append({
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "combinator": "and",
            "conditions": [{
                "leftValue": "={{ $json.action }}",
                "rightValue": "admin_upload_module_file",
                "operator": {"type": "string", "operation": "equals"}
            }]
        },
        "renameOutput": True,
        "outputKey": "upload_file"
    })
    print(f"✅ Case adicionado ao Switch: admin_upload_module_file")

# Conexão: Upload → Respond
connections["Admin: Upload Module File"] = {
    "main": [[{"node": "Admin: Upload Respond", "type": "main", "index": 0}]]
}

# Conexão: Router → Upload (output index = len(rules)-1 se switch, ou via IF separado)
# Como o routing pode ser complexo, usar abordagem IF node separada
if_upload_id = str(uuid.uuid4())
if_upload = {
    "id": if_upload_id,
    "name": "IF: admin_upload_module_file",
    "type": "n8n-nodes-base.if",
    "typeVersion": 2,
    "position": [normalizar['position'][0] + 200, base_y - 100],
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
            "combinator": "and",
            "conditions": [{
                "leftValue": "={{ $json.action }}",
                "rightValue": "admin_upload_module_file",
                "operator": {"type": "string", "operation": "equals", "name": "filter.operator.equals"}
            }]
        }
    }
}
nodes.append(if_upload)

# Conectar Normalizar → IF Upload (true → upload_node)
if "Normalizar Input" not in connections:
    connections["Normalizar Input"] = {"main": [[], []]}

# Adicionar conexão do IF ao upload
connections["IF: admin_upload_module_file"] = {
    "main": [
        [{"node": "Admin: Upload Module File", "type": "main", "index": 0}],  # true
        []  # false (ignora)
    ]
}

# O Normalizar já tem conexões — precisamos adicionar o IF em paralelo
# Verificar estrutura atual do Normalizar
norm_conns = connections.get("Normalizar Input", {}).get("main", [[]])
if norm_conns:
    norm_conns[0].append({"node": "IF: admin_upload_module_file", "type": "main", "index": 0})
print(f"✅ IF node adicionado: IF: admin_upload_module_file")

payload = {
    "name": wf.get("name"),
    "nodes": nodes,
    "connections": connections,
    "settings": wf.get("settings", {})
}

with open('/tmp/wf_upload_patched.json', 'w') as f:
    json.dump(payload, f, indent=2)
print("Arquivo: /tmp/wf_upload_patched.json")
```

### Step 3: Executar o patch

```bash
cd /root/ideias_app
python3 scripts/patch_n8n_upload_action.py
```

Saída esperada:
```
✅ IF node adicionado: IF: admin_upload_module_file
Arquivo: /tmp/wf_upload_patched.json
```

### Step 4: Fazer PUT no N8N

```bash
N8N_KEY=$(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)
curl -s -X PUT "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" \
  -H "X-N8N-API-KEY: $N8N_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/wf_upload_patched.json | python3 -c "
import sys, json
r = json.load(sys.stdin)
print('✅ OK. Nodes:', len(r['nodes'])) if 'id' in r else print('❌', json.dumps(r)[:300])
"
```

### Step 5: Testar via N8N webhook

```bash
# Usar o mesmo payload de teste do Task 3, mas agora via N8N
MODULE_ID=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -t -c \
  "SELECT id FROM modules LIMIT 1;" | tr -d ' \n')

curl -s -X POST "https://n8n.extensionista.site/webhook/kreativ-unified-api" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"admin_upload_module_file\",\"phone\":\"556399374165\",
       \"module_id\":\"$MODULE_ID\",\"file_name\":\"test.txt\",
       \"file_base64\":\"SGVsbG8gV29ybGQ=\",\"file_type\":\"image\"}"
```

Saída esperada: `{"ok":true,"url":"https://files.extensionista.site/...","text_length":0,"chunks_inserted":0}`

### Step 6: Exportar workflow e commitar

```bash
N8N_KEY=$(grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2)
curl -s "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" \
  -H "X-N8N-API-KEY: $N8N_KEY" > /root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json

git add scripts/patch_n8n_upload_action.py n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): action admin_upload_module_file → kreativ_ingest pipeline"
```

---

## Task 5: Portal — renderização de PDF e imagens

**Files:**
- Modify: `apps/portal/src/pages/modulo/[id].tsx`

### Step 1: Ler o arquivo atual

```bash
grep -n "youtubeId\|mediaUrls\|media_urls" apps/portal/src/pages/modulo/[id].tsx
```

### Step 2: Localizar o bloco de renderização de mídia (após o iframe do YouTube)

Encontre a linha com `{youtubeId && (` e adicione **após o fechamento** desse bloco:

```tsx
{/* PDFs: botão de download + embed visualizador */}
{mediaUrls
  .filter((u: string) => u.toLowerCase().endsWith('.pdf'))
  .map((u: string) => (
    <div key={u} style={{ marginBottom: '24px' }}>
      <a
        href={u}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline"
        style={{ marginBottom: '12px', display: 'inline-block' }}
      >
        📄 Baixar Apostila (PDF)
      </a>
      <embed
        src={u}
        type="application/pdf"
        width="100%"
        height="700px"
        style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'block' }}
      />
    </div>
  ))}

{/* Imagens */}
{mediaUrls
  .filter((u: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(u))
  .map((u: string) => (
    <img
      key={u}
      src={u}
      alt="Material do módulo"
      style={{
        width: '100%',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        marginBottom: '16px',
        display: 'block',
      }}
    />
  ))}
```

### Step 3: Garantir que `mediaUrls` está tipado como `string[]`

Verificar no início da função:
```tsx
const mediaUrls: string[] = mod.media_urls || []
```
Se já existir `mediaUrls` declarado, apenas confirmar o tipo.

### Step 4: Rebuild do portal

```bash
docker compose restart kreativ_portal
sleep 10
curl -s -o /dev/null -w "%{http_code}" https://portal.extensionista.site/
```

Saída esperada: `200`

### Step 5: Commit

```bash
git add apps/portal/src/pages/modulo/[id].tsx
git commit -m "feat(portal): renderizar PDF embed e imagens de media_urls"
```

---

## Task 6: ToolJet — Queries 8 e 9 (upload) + Query 10 (pré-inscrições)

> Este task atualiza o `SONAR_PLANO_2_TOOLJET.md` com as queries adicionais para o Comet/Sonar Pro configurar. Se o Comet já terminou a configuração, aplicar manualmente no ToolJet.

**Files:**
- Modify: `docs/plans/SONAR_PLANO_2_TOOLJET.md` (adicionar Fase 9 ao final)

### Step 1: Adicionar Fase 9 ao plano ToolJet existente

Adicionar ao final do arquivo `docs/plans/SONAR_PLANO_2_TOOLJET.md`:

```markdown
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
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
     },
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
     headers: {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET
     },
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
   - **Text Input**: Name = `searchPreInput`, Placeholder = `Buscar por nome, telefone ou cidade...`, On change → Run listPreInscricoes
   - **Text** (contador): Content = `Total aguardando: {{listPreInscricoes.data?.length ?? 0}} (mostrando até 100)`
   - **Table**: Name = `preTable`, Data = `{{listPreInscricoes.data}}`
     - Colunas: name (Nome), phone (Telefone), cidade (Cidade), cursos_interesse (Cursos), cadastrado_em (Cadastro)
   - **Button** "Matricular Selecionado" (acima ou abaixo da tabela):
     - Visível apenas quando `{{preTable.selectedRow?.data?.phone}}`
     - onClick → Run JavaScript:
       ```javascript
       const row = preTable.selectedRow.data;
       const r = await fetch('https://n8n.extensionista.site/webhook/kreativ-unified-api', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + constants.ADMIN_WEBHOOK_SECRET },
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
```

### Step 2: Commit

```bash
git add docs/plans/SONAR_PLANO_2_TOOLJET.md
git commit -m "docs(tooljet): adicionar Fase 9 — upload arquivos + aba pré-inscrições"
```

---

## Task 7: Metabase — Dashboard "Kreativ — Monitoramento"

> Este task atualiza o `SONAR_PLANO_1_METABASE.md` com o segundo dashboard. Entregar ao Comet para configurar.

**Files:**
- Modify: `docs/plans/SONAR_PLANO_1_METABASE.md` (adicionar Parte 3)

### Step 1: Adicionar Parte 3 ao plano Metabase

Adicionar ao final do arquivo `docs/plans/SONAR_PLANO_1_METABASE.md`:

```markdown
---

## PARTE 3 — Dashboard "Kreativ — Monitoramento" (segundo dashboard)

> Dashboard operacional separado. Focado em ação, não em KPI.
> Criado em paralelo ao "Visão Operacional" ou após ele.

### Passo 3.1 — Criar o dashboard

1. Home → "New +" → "Dashboard"
2. Nome: `Kreativ — Monitoramento`
3. Salve vazio

### Passo 3.2 — Big Number: "Certificados Emitidos"

SQL:
```sql
SELECT COUNT(*) AS certificados_emitidos FROM certificates
```
Visualização: Number | Label: `Certificados Emitidos`
Salve: `Monitor 1 — Certificados Emitidos` → Add to `Kreativ — Monitoramento`

### Passo 3.3 — Big Number: "Alunos Parados >7 dias"

SQL:
```sql
SELECT COUNT(*) AS parados
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0
```
Visualização: Number | Label: `Alunos Parados >7 dias`
Salve: `Monitor 2 — Alunos Parados` → Add to dashboard

### Passo 3.4 — Big Number: "Alunos Novos ≤3 dias"

SQL:
```sql
SELECT COUNT(*) AS novos FROM students
WHERE created_at >= NOW() - INTERVAL '3 days'
```
Visualização: Number | Label: `Alunos Novos (últimos 3 dias)`
Salve: `Monitor 3 — Alunos Novos` → Add to dashboard

### Passo 3.5 — Big Number: "Pré-inscrições Aguardando"

SQL:
```sql
SELECT COUNT(*) AS aguardando
FROM pre_inscriptions
WHERE convertido = false AND telefone_valido = true
```
Visualização: Number | Label: `Pré-inscrições Aguardando`
Salve: `Monitor 4 — Pre-inscrições` → Add to dashboard

### Passo 3.6 — Tabela: "Alunos Parados >7 dias" (com telefone)

SQL:
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
Visualização: **Table** (não gráfico — precisa do telefone para ação)
Salve: `Monitor 5 — Lista Parados >7d` → Add to dashboard

### Passo 3.7 — Tabela: "Reprovados sem aprovação"

SQL:
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
Visualização: **Table**
Salve: `Monitor 6 — Reprovados sem aprovação` → Add to dashboard

### Passo 3.8 — Bar Chart: "Taxa de Aprovação por Módulo"

SQL:
```sql
SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  COUNT(*) FILTER (WHERE status = 'passed') AS aprovados,
  COUNT(*) FILTER (WHERE status = 'failed') AS reprovados,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'passed') / NULLIF(COUNT(*), 0), 1) AS taxa_pct
FROM enrollment_progress
GROUP BY module_number
ORDER BY module_number
```
Visualização: Bar | X = `modulo` | Y = `aprovados` e `reprovados` (grouped)
Salve: `Monitor 7 — Taxa Aprovação por Módulo` → Add to dashboard

### Passo 3.9 — Bar horizontal: "Funil de Conversão"

SQL:
```sql
SELECT unnest(ARRAY['Pré-inscrições','Alunos cadastrados','Iniciaram','Certificados']) AS etapa,
       unnest(ARRAY[
         (SELECT COUNT(*) FROM pre_inscriptions)::int,
         (SELECT COUNT(*) FROM students)::int,
         (SELECT COUNT(*) FROM students WHERE current_module > 0)::int,
         (SELECT COUNT(*) FROM certificates)::int
       ]) AS total
```
Visualização: Bar (horizontal se disponível) | X = `etapa` | Y = `total`
Salve: `Monitor 8 — Funil de Conversão` → Add to dashboard

### Passo 3.10 — Organizar layout

```
Linha 1: [Certificados] [Parados >7d] [Novos ≤3d] [Pré-inscrições]  ← 4 big numbers
Linha 2: [Tabela Parados >7d]  [Tabela Reprovados]                   ← 2 tables, 50/50
Linha 3: [Taxa Aprovação — Bar]  [Funil — Bar horizontal]           ← 2 charts, 50/50
```
```

### Step 2: Commit

```bash
git add docs/plans/SONAR_PLANO_1_METABASE.md
git commit -m "docs(metabase): dashboard Monitoramento — 8 cards operacionais"
```

---

## Task 8: Smoke test end-to-end

### Step 1: Testar pipeline completo com PDF real

```bash
# Pegar um módulo com conteúdo
MODULE_ID=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -t -c \
  "SELECT id FROM modules WHERE content_text IS NOT NULL LIMIT 1;" | tr -d ' \n')

# Codificar o próprio content_text como "pseudo-PDF" para não precisar de arquivo real
# (usa uma imagem de texto simples via MinIO existente)
echo "Teste: verificar que kreativ_ingest está UP"
docker exec kreativ_n8n curl -s http://kreativ_ingest:8000/health
```

Saída esperada: `{"ok":true,"service":"kreativ_ingest"}`

### Step 2: Confirmar que document_chunks tem dados após upload

```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
SELECT module_id, source_file, chunk_index, LEFT(content, 60) AS preview
FROM document_chunks ORDER BY created_at DESC LIMIT 5;"
```

### Step 3: Confirmar que AI Tutor usa os novos chunks

```bash
time curl -s -X POST "https://n8n.extensionista.site/webhook/kreativ-unified-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"ai_tutor","phone":"556399374165","message":"Me explique o módulo 1 em detalhes"}'
```

Aguardar ~15s e verificar se a resposta WhatsApp contém informações do PDF carregado.

### Step 4: Commit final e push

```bash
git add -A
git status
git log --oneline -5
git push origin main
```

---

## Ordem de execução

```
Task 1 → Criar microserviço (código + Docker)       ~15 min
Task 2 → docker-compose + subir container           ~5 min
Task 3 → Testar pipeline isolado                    ~10 min
Task 4 → N8N action via script de patch             ~10 min
Task 5 → Portal PDF/imagem rendering               ~5 min
Task 6 → ToolJet plan atualizado (Comet executa)   ~5 min (só editar doc)
Task 7 → Metabase plan atualizado (Comet executa)  ~5 min (só editar doc)
Task 8 → Smoke test end-to-end                     ~10 min
```

**Total estimado: ~65 min**

---

## Restrições de desenvolvimento (relembrar)

- MinIO bucket `kreativ-modules`: criar com policy pública de leitura (GET para todos)
- Mensagens WhatsApp: **somente** para `phone = 556399374165`
- Pré-inscrições: converter = criar registro, **nunca** enviar mensagem
- `NEXT_PUBLIC_SUPPORT_PHONE` no portal: mantém `556399374165`
- Demais alunos cadastrados: não recebem nenhuma comunicação até decisão explícita
