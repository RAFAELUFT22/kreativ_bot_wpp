#!/bin/bash
# =============================================================================
# KREATIV EDUCACAO — Integration & Health Test Suite
# Tests: containers, unified API actions, connectivity, end-to-end
# Usage: bash scripts/test_ecosystem.sh
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
PASS=0; FAIL=0; TOTAL=0

ok()   { ((PASS++)); ((TOTAL++)); echo -e "  [${GREEN}PASS${NC}] $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "  [${RED}FAIL${NC}] $1"; }

echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}      KREATIV EDUCACAO — ECOSYSTEM TEST SUITE             ${NC}"
echo -e "${BLUE}==========================================================${NC}"

# ── Phase 1: Container Status ──────────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 1: Containers ---${NC}"
for c in kreativ_postgres kreativ_redis kreativ_n8n kreativ_evolution \
         kreativ_typebot_viewer kreativ_portal kreativ_ingest; do
  if docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null | grep -q true; then
    ok "$c running"
  else
    fail "$c not running"
  fi
done

# ── Phase 2: Connectivity ──────────────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 2: Connectivity ---${NC}"

# Postgres from n8n
if docker exec kreativ_n8n nc -zv kreativ_postgres 5432 >/dev/null 2>&1; then
  ok "n8n -> Postgres"
else
  fail "n8n -> Postgres"
fi

# Portal from n8n
if docker exec kreativ_n8n wget -qO- --timeout=5 "http://kreativ_portal:3000/" 2>/dev/null | grep -q "Kreativ"; then
  ok "n8n -> Portal"
else
  fail "n8n -> Portal"
fi

# Evolution from n8n
if docker exec kreativ_n8n wget --spider --timeout=5 "http://kreativ_evolution:8080/manager" >/dev/null 2>&1; then
  ok "n8n -> Evolution API"
else
  fail "n8n -> Evolution API"
fi

# Redis from n8n
if docker exec kreativ_n8n nc -zv kreativ_redis 6379 >/dev/null 2>&1; then
  ok "n8n -> Redis"
else
  fail "n8n -> Redis"
fi

# ── Phase 3: Unified API Actions ───────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 3: Unified API Actions ---${NC}"
WEBHOOK_URL="http://localhost:5678/webhook/kreativ-unified-api"

api_test() {
  local label=$1 payload=$2 expect=$3
  local resp
  resp=$(docker exec kreativ_n8n wget -qO- --timeout=10 \
    --post-data="$payload" \
    --header="Content-Type: application/json" \
    "$WEBHOOK_URL" 2>/dev/null || echo "TIMEOUT")

  if echo "$resp" | grep -qE "$expect"; then
    ok "$label"
  else
    fail "$label (got: ${resp:0:80})"
  fi
}

api_test "check_student" \
  '{"action":"check_student","phone":"556399374165"}' \
  '"phone"|"name"|"status"'

api_test "get_progress" \
  '{"action":"get_progress","phone":"556399374165"}' \
  '"current_module"|"total_modules"|"completed"'

api_test "get_module" \
  '{"action":"get_module","phone":"556399374165"}' \
  '"title"|"content"|"module_number"'

api_test "enroll_student (new)" \
  '{"action":"enroll_student","phone":"5563999999999","name":"Test Bot"}' \
  '"portal_url"|"portal_token"'

api_test "check_student (enrolled)" \
  '{"action":"check_student","phone":"5563999999999"}' \
  '"phone"|"name"|"status"'

# ── Phase 4: DB Sanity ─────────────────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 4: DB Sanity ---${NC}"

db_check() {
  local label=$1 query=$2 min=$3
  local n
  n=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -tAc "$query" 2>/dev/null | tr -d ' ')
  if [ -n "$n" ] && [ "$n" -ge "$min" ] 2>/dev/null; then
    ok "$label: $n (>= $min)"
  else
    fail "$label: ${n:-0} (expected >= $min)"
  fi
}

db_check "Published modules" "SELECT count(*) FROM modules WHERE is_published = TRUE" 1
db_check "Students" "SELECT count(*) FROM students" 1
db_check "Modules with blocks" "SELECT count(*) FROM modules WHERE blocks IS NOT NULL" 1
db_check "Modules with rubric" "SELECT count(*) FROM modules WHERE evaluation_rubric IS NOT NULL" 1
db_check "Courses" "SELECT count(*) FROM courses" 1

# ── Phase 5: Portal HTTP ──────────────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 5: Portal ---${NC}"
for path in "/" "/aluno/193e1ef6-02de-4866-b838-3f277453ac00"; do
  PORTAL_RESP=$(docker exec kreativ_n8n wget -qO- --timeout=10 \
    "http://kreativ_portal:3000$path" 2>/dev/null | head -c 500)
  if echo "$PORTAL_RESP" | grep -q "Kreativ"; then
    ok "Portal $path -> OK"
  else
    fail "Portal $path -> no response"
  fi
done

# ── Phase 6: Typebot Bot ──────────────────────────────────────────────
echo -e "\n${YELLOW}--- Phase 6: Typebot ---${NC}"
BOT_HEALTH=$(docker exec kreativ_n8n wget -qO- --timeout=10 \
  "http://kreativ_typebot_viewer:3000/healthz" 2>/dev/null)
if echo "$BOT_HEALTH" | grep -qi "ok\|true\|healthy\|{"; then
  ok "Typebot viewer /healthz -> OK"
else
  fail "Typebot viewer not responding"
fi

# ── Cleanup ──────────────────────────────────────────────────────────
echo -e "\n${YELLOW}--- Cleanup ---${NC}"
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c \
  "DELETE FROM students WHERE phone = '5563999999999'" >/dev/null 2>&1
echo -e "  Cleaned up test student"

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}==========================================================${NC}"
echo -e " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} ($TOTAL total)"
if [ "$FAIL" -eq 0 ]; then
  echo -e " ${GREEN}ALL CLEAR${NC}"
else
  echo -e " ${RED}ISSUES DETECTED${NC}"
fi
echo -e "${BLUE}==========================================================${NC}"
exit "$FAIL"
