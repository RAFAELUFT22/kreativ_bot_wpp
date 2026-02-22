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
