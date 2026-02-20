#!/bin/bash

# =============================================================================
# KREATIV EDUCAÇÃO — ECOSYSTEM HEALTH CHECK
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================================="
echo "      🔍 KREATIV EDUCAÇÃO — HEALTH CHECK 🔍"
echo "=========================================================="

check_service() {
    local service_name=$1
    local command=$2
    local expected_output=$3
    local description=$4

    echo -n "Checking $description ($service_name)... "
    
    # Run command inside the container
    output=$(docker exec $service_name /bin/sh -c "$command" 2>/dev/null)
    exit_code=$?

    if [ $exit_code -eq 0 ] && ([[ -z "$expected_output" ]] || [[ "$output" == *"$expected_output"* ]]); then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        [ -n "$output" ] && echo "   Detail: $output"
        return 1
    fi
}

check_http() {
    local container=$1
    local url=$2
    local expected_code=$3
    local description=$4

    echo -n "Checking $description ($url from $container)... "
    
    # Using wget inside the container to check another service
    # --spider doesn't download, --server-response shows headers
    code=$(docker exec $container wget --spider -S "$url" 2>&1 | grep "HTTP/" | awk '{print $2}' | tail -n 1)
    
    if [ "$code" == "$expected_code" ]; then
        echo -e "${GREEN}OK ($code)${NC}"
        return 0
    else
        echo -e "${RED}FAILED (Code: $code, Expected: $expected_code)${NC}"
        return 1
    fi
}

# 1. Database
check_service "kreativ_postgres" "pg_isready -U kreativ_user" "accepting connections" "PostgreSQL"

# 2. Redis
REDIS_PWD=$(grep REDIS_PASSWORD .env | cut -d '=' -f2)
check_service "kreativ_redis" "redis-cli -a $REDIS_PWD ping" "PONG" "Redis"

# 3. Evolution API Health
check_http "kreativ_builderbot" "http://kreativ_evolution:8080/instance/health" "200" "Evolution API from BuilderBot"

# 4. n8n Health
check_http "kreativ_builderbot" "http://kreativ_n8n:5678/healthz" "200" "n8n from BuilderBot"

# 5. BuilderBot Local Check
# Using 'node -e' to check if port is listening if netstat is missing
check_service "kreativ_builderbot" "netstat -tuln | grep :3008 || (nc -zv localhost 3008 2>&1)" "" "BuilderBot Listening on 3008"

# 6. Chatwoot Health (App)
# Chatwoot might not have health endpoint, check root
check_http "kreativ_n8n" "http://kreativ_chatwoot_app:3000" "200" "Chatwoot App from n8n"

# 7. Check if BuilderBot can talk to Postgres
check_service "kreativ_builderbot" "nc -zv kreativ_postgres 5432" "" "Postgres connection from BuilderBot"

echo "=========================================================="
echo "Health Check Complete."
echo "=========================================================="
