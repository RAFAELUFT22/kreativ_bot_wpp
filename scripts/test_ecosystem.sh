#!/bin/bash

# =============================================================================
# KREATIV EDUCAÇÃO — INTEGRATION & HEALTH TEST SUITE
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}      🚀 KREATIV EDUCAÇÃO — ECOSYSTEM TEST SUITE 🚀      ${NC}"
echo -e "${BLUE}==========================================================${NC}"

# Load ENV
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

check_container() {
    local name=$1
    if [ "$(docker inspect -f '{{.State.Running}}' $name 2>/dev/null)" == "true" ]; then
        echo -e "[${GREEN}UP${NC}] Container $name"
        return 0
    else
        echo -e "[${RED}DOWN${NC}] Container $name"
        return 1
    fi
}

check_webhook() {
    local path=$1
    local name=$2
    echo -n "Checking Webhook $name ($path)... "
    # We need to escape the double quotes for the column name in the SQL query
    exists=$(docker exec kreativ_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -t -c "SELECT COUNT(*) FROM webhook_entity WHERE \"webhookPath\" = '$path';" | xargs)
    if [[ "$exists" =~ ^[0-9]+$ ]] && [ "$exists" -gt 0 ]; then
        echo -e "${GREEN}ACTIVE${NC}"
        return 0
    else
        echo -e "${RED}MISSING${NC}"
        return 1
    fi
}

echo -e "
${YELLOW}--- PHASE 1: CONTAINER STATUS ---${NC}"
check_container "kreativ_postgres"
check_container "kreativ_redis"
check_container "kreativ_n8n"
check_container "kreativ_evolution"
check_container "kreativ_builderbot"
check_container "kreativ_chatwoot_app"

echo -e "
${YELLOW}--- PHASE 2: N8N WEBHOOKS ---${NC}"
check_webhook "whatsapp" "WhatsApp Router"
check_webhook "ai-tutor-v2-unique-rafael" "AI Adaptive Router"
check_webhook "chatwoot-events" "Chatwoot Events"

echo -e "
${YELLOW}--- PHASE 3: CONNECTIVITY ---${NC}"
# Postgres from BuilderBot
docker exec kreativ_builderbot nc -zv kreativ_postgres 5432 >/dev/null 2>&1
if [ $? -eq 0 ]; then echo -e "[${GREEN}OK${NC}] BuilderBot -> Postgres"; else echo -e "[${RED}FAIL${NC}] BuilderBot -> Postgres"; fi

# n8n from Evolution
docker exec kreativ_evolution wget --spider -S "http://kreativ_n8n:5678/healthz" >/dev/null 2>&1
if [ $? -eq 0 ]; then echo -e "[${GREEN}OK${NC}] Evolution -> n8n"; else echo -e "[${RED}FAIL${NC}] Evolution -> n8n"; fi

# BuilderBot from n8n
docker exec kreativ_n8n wget -qO- --post-data='{"query":"SELECT 1"}' --header="Content-Type: application/json" "http://kreativ_builderbot:3008/api/query" | grep -q "rows"
if [ $? -eq 0 ]; then echo -e "[${GREEN}OK${NC}] n8n -> BuilderBot API"; else echo -e "[${RED}FAIL${NC}] n8n -> BuilderBot API"; fi

echo -e "
${YELLOW}--- PHASE 4: END-TO-END SIMULATION ---${NC}"
echo "Sending simulated message to WhatsApp Router..."
resp=$(docker exec kreativ_builderbot wget -qO- --post-data='{"event":"messages.upsert","instance":"europs","data":{"key":{"remoteJid":"556399374165@s.whatsapp.net","fromMe":false,"id":"TEST-'$(date +%s)'"},"pushName":"Tester","message":{"conversation":"Teste automatizado"},"messageType":"conversation","messageTimestamp":'$(date +%s)'}}' --header="Content-Type: application/json" "http://kreativ_n8n:5678/webhook/whatsapp" 2>&1)

if [[ "$resp" == *"\"success\":true"* ]]; then
    echo -e "[${GREEN}SUCCESS${NC}] Full Flow Response: $resp"
else
    echo -e "[${RED}FAILED${NC}] Full Flow Response: $resp"
fi

echo -e "
${BLUE}==========================================================${NC}"
echo -e "${BLUE}TEST SUITE COMPLETE${NC}"
echo -e "${BLUE}==========================================================${NC}"
