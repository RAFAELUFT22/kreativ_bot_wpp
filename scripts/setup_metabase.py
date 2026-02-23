"""
setup_metabase.py — Cria os dois dashboards Kreativ no Metabase via API REST.

Dashboards:
  1. "Kreativ — Visão Operacional" — 5 cards KPI
  2. "Kreativ — Monitoramento"     — 8 cards operacionais

Uso:
  python3 scripts/setup_metabase.py

Requer:
  MB_URL  e MB_API no .env (ou exportar como env vars)
  DB_ID = 2 (kreativ_edu no Metabase)
"""

import os, sys, json, time
import urllib.request, urllib.error

# ── Config ───────────────────────────────────────────────────────────────────
MB_URL = os.getenv("METABASE_HOST", "https://dash.extensionista.site").rstrip("/")
MB_API = os.getenv("METABASE_API", "")
DB_ID  = 2  # kreativ_edu database ID in Metabase

if not MB_API:
    # Try loading from .env file
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    try:
        with open(os.path.abspath(env_path)) as f:
            for line in f:
                line = line.strip()
                if line.startswith("METABASE_API="):
                    MB_API = line.split("=", 1)[1].strip()
                if line.startswith("METABASE_HOST="):
                    MB_URL = line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass

if not MB_API:
    print("ERROR: METABASE_API not found in env or .env file")
    sys.exit(1)

HEADERS = {
    "x-api-key": MB_API,
    "Content-Type": "application/json",
}


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def api(method, path, body=None):
    url = f"{MB_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  HTTP {e.code} on {method} {path}: {err[:200]}")
        return None


def get_or_create_dashboard(name, description=""):
    """Find existing dashboard by name or create it."""
    existing = api("GET", "/api/dashboard")
    if existing:
        for d in existing:
            if d.get("name") == name:
                print(f"  Dashboard '{name}' já existe — ID={d['id']}")
                return d["id"]
    result = api("POST", "/api/dashboard", {"name": name, "description": description})
    if result:
        print(f"  ✅ Dashboard '{name}' criado — ID={result['id']}")
        return result["id"]
    return None


def create_card(name, sql, display, viz_settings=None):
    """Create a question/card. Returns card ID."""
    payload = {
        "name": name,
        "dataset_query": {
            "type": "native",
            "native": {"query": sql},
            "database": DB_ID,
        },
        "display": display,
        "visualization_settings": viz_settings or {},
    }
    result = api("POST", "/api/card", payload)
    if result:
        print(f"    ✅ Card '{name}' — ID={result['id']}")
        return result["id"]
    print(f"    ❌ Failed to create card '{name}'")
    return None


_dashcard_temp_id = -1  # Metabase requires negative IDs for new dashcards in PUT


def add_card_to_dashboard(dashboard_id, card_id, row, col, size_x=6, size_y=4):
    """Add an existing card to a dashboard (Metabase v0.44+ PUT approach)."""
    global _dashcard_temp_id
    existing = api("GET", f"/api/dashboard/{dashboard_id}")
    # Existing dashcards already have real ids; new ones get temporary negative ids
    cards = list(existing.get("dashcards", [])) if existing else []
    cards.append({
        "id": _dashcard_temp_id,
        "card_id": card_id,
        "col": col,
        "row": row,
        "size_x": size_x,
        "size_y": size_y,
        "series": [],
        "parameter_mappings": [],
        "visualization_settings": {},
    })
    _dashcard_temp_id -= 1
    result = api("PUT", f"/api/dashboard/{dashboard_id}/cards", {"cards": cards})
    return result is not None


# ── Dashboard 1: Visão Operacional ───────────────────────────────────────────
VISAO_CARDS = [
    # (name, sql, display, viz_settings, row, col, size_x, size_y)
    (
        "Card 1 — Alunos Ativos Hoje",
        "SELECT COUNT(DISTINCT student_id) AS alunos_ativos_hoje FROM enrollment_progress WHERE completed_at >= CURRENT_DATE",
        "scalar",
        {},
        0, 0, 6, 4,
    ),
    (
        "Card 2 — Alunos Ativos Esta Semana",
        "SELECT COUNT(DISTINCT student_id) AS alunos_ativos_semana FROM enrollment_progress WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'",
        "scalar",
        {},
        0, 6, 6, 4,
    ),
    (
        "Card 3 — Distribuição por Módulo",
        """SELECT
  CASE WHEN current_module = 0 THEN 'Não iniciado'
       ELSE CONCAT('Módulo ', current_module)
  END AS modulo,
  COUNT(*) AS alunos
FROM students
GROUP BY current_module
ORDER BY current_module""",
        "bar",
        {"graph.x_axis.title_text": "Módulo", "graph.y_axis.title_text": "Alunos"},
        4, 0, 8, 6,
    ),
    (
        "Card 4 — Score Médio por Módulo",
        """SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  ROUND(AVG(score)::numeric, 1) AS score_medio,
  COUNT(*) AS tentativas
FROM enrollment_progress
WHERE score IS NOT NULL
GROUP BY module_number
ORDER BY module_number""",
        "bar",
        {"graph.x_axis.title_text": "Módulo", "graph.y_axis.title_text": "Score Médio"},
        4, 8, 8, 6,
    ),
    (
        "Card 5 — Chamadas AI Tutor (14 dias)",
        """SELECT
  DATE(created_at) AS dia,
  COUNT(*) AS chamadas,
  COALESCE(SUM(prompt_tokens), 0) AS tokens_prompt,
  COALESCE(SUM(completion_tokens), 0) AS tokens_resposta,
  ROUND(COALESCE(AVG(duration_ms), 0)::numeric / 1000, 1) AS tempo_medio_s
FROM ai_usage_log
WHERE event_type = 'ai_tutor'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC""",
        "line",
        {"graph.x_axis.title_text": "Dia", "graph.y_axis.title_text": "Chamadas"},
        10, 0, 16, 6,
    ),
]

# ── Dashboard 2: Monitoramento ────────────────────────────────────────────────
MONITOR_CARDS = [
    (
        "Monitor 1 — Certificados Emitidos",
        "SELECT COUNT(*) AS certificados_emitidos FROM certificates",
        "scalar", {},
        0, 0, 4, 4,
    ),
    (
        "Monitor 2 — Alunos Parados >7 dias",
        """SELECT COUNT(*) AS parados
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0""",
        "scalar", {},
        0, 4, 4, 4,
    ),
    (
        "Monitor 3 — Alunos Novos ≤3 dias",
        "SELECT COUNT(*) AS novos FROM students WHERE created_at >= NOW() - INTERVAL '3 days'",
        "scalar", {},
        0, 8, 4, 4,
    ),
    (
        "Monitor 4 — Pré-inscrições Aguardando",
        "SELECT COUNT(*) AS aguardando FROM pre_inscriptions WHERE convertido = false AND telefone_valido = true",
        "scalar", {},
        0, 12, 4, 4,
    ),
    (
        "Monitor 5 — Lista Parados >7d",
        """SELECT
  COALESCE(name, 'Sem nome') AS nome,
  phone AS telefone,
  current_module AS modulo_atual,
  EXTRACT(DAY FROM NOW() - updated_at)::int AS dias_parado,
  'https://wa.me/' || phone AS link_whatsapp
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0
ORDER BY updated_at ASC""",
        "table", {},
        4, 0, 8, 8,
    ),
    (
        "Monitor 6 — Reprovados sem Aprovação",
        """SELECT
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
ORDER BY tentativas DESC, ep.score ASC""",
        "table", {},
        4, 8, 8, 8,
    ),
    (
        "Monitor 7 — Taxa Aprovação por Módulo",
        """SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  COUNT(*) FILTER (WHERE status = 'passed') AS aprovados,
  COUNT(*) FILTER (WHERE status = 'failed') AS reprovados,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'passed') / NULLIF(COUNT(*), 0), 1) AS taxa_pct
FROM enrollment_progress
GROUP BY module_number
ORDER BY module_number""",
        "bar",
        {"graph.x_axis.title_text": "Módulo", "graph.y_axis.title_text": "Quantidade"},
        12, 0, 8, 6,
    ),
    (
        "Monitor 8 — Funil de Conversão",
        """SELECT unnest(ARRAY['Pré-inscrições','Alunos cadastrados','Iniciaram','Certificados']) AS etapa,
       unnest(ARRAY[
         (SELECT COUNT(*) FROM pre_inscriptions)::int,
         (SELECT COUNT(*) FROM students)::int,
         (SELECT COUNT(*) FROM students WHERE current_module > 0)::int,
         (SELECT COUNT(*) FROM certificates)::int
       ]) AS total""",
        "bar",
        {"graph.x_axis.title_text": "Etapa", "graph.y_axis.title_text": "Total"},
        12, 8, 8, 6,
    ),
]


# ── Main ──────────────────────────────────────────────────────────────────────
def run():
    print(f"\n🚀 Metabase Setup — {MB_URL}")
    print(f"   DB_ID={DB_ID} | API key: {MB_API[:20]}...\n")

    # Test API key
    me = api("GET", "/api/user/current")
    if not me:
        print("❌ API key inválida ou Metabase inacessível")
        sys.exit(1)
    print(f"✅ Autenticado como: {me.get('email', '?')}\n")

    # ── Dashboard 1: Visão Operacional ────────────────────────────────────────
    print("📊 Dashboard 1: Kreativ — Visão Operacional")
    d1_id = get_or_create_dashboard(
        "Kreativ — Visão Operacional",
        "KPIs operacionais: alunos ativos, distribuição por módulo, score médio, uso de IA"
    )
    if d1_id:
        print(f"  Criando {len(VISAO_CARDS)} cards...")
        for name, sql, display, viz, row, col, sx, sy in VISAO_CARDS:
            card_id = create_card(name, sql, display, viz)
            if card_id:
                time.sleep(0.3)
                add_card_to_dashboard(d1_id, card_id, row, col, sx, sy)

    print()

    # ── Dashboard 2: Monitoramento ────────────────────────────────────────────
    print("📊 Dashboard 2: Kreativ — Monitoramento")
    d2_id = get_or_create_dashboard(
        "Kreativ — Monitoramento",
        "Ação operacional diária: parados, reprovados, funil de conversão"
    )
    if d2_id:
        print(f"  Criando {len(MONITOR_CARDS)} cards...")
        for name, sql, display, viz, row, col, sx, sy in MONITOR_CARDS:
            card_id = create_card(name, sql, display, viz)
            if card_id:
                time.sleep(0.3)
                add_card_to_dashboard(d2_id, card_id, row, col, sx, sy)

    print()
    print(f"🎉 Concluído!")
    print(f"   Dashboard 1: {MB_URL}/dashboard/{d1_id}")
    print(f"   Dashboard 2: {MB_URL}/dashboard/{d2_id}")


if __name__ == "__main__":
    run()
