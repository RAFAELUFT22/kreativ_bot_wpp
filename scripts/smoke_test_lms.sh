#!/bin/bash
# =============================================================================
# KREATIV LMS — Smoke Test Suite
# Tests: containers, DB schema, data sanity, N8N API, Portal HTTP
# Usage: bash scripts/smoke_test_lms.sh
# =============================================================================

set -uo pipefail
PASS=0; FAIL=0; TOTAL=0

ok()   { ((PASS++)); ((TOTAL++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo "  [FAIL] $1"; }

echo "=========================================="
echo " KREATIV LMS — Smoke Test"
echo "=========================================="

# ── Phase 1: Container Status ──────────────────────────────────────────
echo ""
echo "--- Phase 1: Containers ---"
for c in kreativ_postgres kreativ_redis kreativ_n8n kreativ_evolution \
         kreativ_typebot_viewer kreativ_portal kreativ_ingest; do
  if docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null | grep -q true; then
    ok "$c running"
  else
    fail "$c not running"
  fi
done

# ── Phase 2: DB Schema ─────────────────────────────────────────────────
echo ""
echo "--- Phase 2: DB Schema ---"
check_col() {
  local tbl=$1 col=$2
  if docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -tAc \
    "SELECT column_name FROM information_schema.columns WHERE table_name='$tbl' AND column_name='$col'" 2>/dev/null \
    | grep -q "$col"; then
    ok "$tbl.$col exists"
  else
    fail "$tbl.$col MISSING"
  fi
}
check_col students enrollment_date
check_col students portal_token
check_col modules evaluation_rubric
check_col modules course_int_id
check_col modules blocks
check_col modules keyword
check_col certificates course_int_id

# Check module_sessions table
if docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -tAc \
  "SELECT tablename FROM pg_tables WHERE tablename='module_sessions'" 2>/dev/null \
  | grep -q module_sessions; then
  ok "table module_sessions exists"
else
  fail "table module_sessions MISSING"
fi

# ── Phase 3: Data Sanity ───────────────────────────────────────────────
echo ""
echo "--- Phase 3: Data ---"

count_check() {
  local label=$1 query=$2 min=$3
  local n
  n=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -tAc "$query" 2>/dev/null | tr -d ' ')
  if [ -n "$n" ] && [ "$n" -ge "$min" ] 2>/dev/null; then
    ok "$label: $n (>= $min)"
  else
    fail "$label: ${n:-0} (expected >= $min)"
  fi
}

count_check "Published modules" "SELECT count(*) FROM modules WHERE is_published = TRUE" 1
count_check "Students" "SELECT count(*) FROM students" 1
count_check "Modules with blocks" "SELECT count(*) FROM modules WHERE blocks IS NOT NULL" 1
count_check "Modules with rubric" "SELECT count(*) FROM modules WHERE evaluation_rubric IS NOT NULL" 1
count_check "RAG document_chunks" "SELECT count(*) FROM document_chunks" 0

# ── Phase 4: N8N Unified API ──────────────────────────────────────────
echo ""
echo "--- Phase 4: N8N API ---"
RESP=$(curl -sf --max-time 10 -X POST \
  "http://localhost:5678/webhook/kreativ-unified-api" \
  -H "Content-Type: application/json" \
  -d '{"action":"check_student","phone":"556399374165"}' 2>/dev/null || echo "TIMEOUT_OR_ERROR")

if echo "$RESP" | grep -qE '"phone"|"name"|"status"'; then
  ok "check_student returns valid response"
else
  # Try via docker network
  RESP2=$(docker exec kreativ_n8n wget -qO- --timeout=10 --post-data='{"action":"check_student","phone":"556399374165"}' \
    --header="Content-Type: application/json" \
    "http://localhost:5678/webhook/kreativ-unified-api" 2>/dev/null || echo "TIMEOUT")
  if echo "$RESP2" | grep -qE '"phone"|"name"|"status"'; then
    ok "check_student returns valid response (via docker)"
  else
    fail "check_student: no valid response"
  fi
fi

# ── Phase 5: Portal HTTP ──────────────────────────────────────────────
echo ""
echo "--- Phase 5: Portal ---"
# Portal not exposed on host — test via docker network (n8n -> portal)
for path in "/" "/aluno/193e1ef6-02de-4866-b838-3f277453ac00"; do
  PORTAL_RESP=$(docker exec kreativ_n8n wget -qO- --timeout=10 \
    "http://kreativ_portal:3000$path" 2>/dev/null | head -c 500)
  if echo "$PORTAL_RESP" | grep -q "Kreativ"; then
    ok "Portal $path -> OK"
  else
    # Fallback: try localhost (if port is exposed)
    code=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" \
      "http://localhost:3000$path" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
      ok "Portal $path -> HTTP 200 (localhost)"
    else
      fail "Portal $path -> no response"
    fi
  fi
done

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo "=========================================="
echo " Results: $PASS passed, $FAIL failed ($TOTAL total)"
if [ "$FAIL" -eq 0 ]; then
  echo " ALL CLEAR"
else
  echo " ISSUES DETECTED"
fi
echo "=========================================="
exit "$FAIL"
