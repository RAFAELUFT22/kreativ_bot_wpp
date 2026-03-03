#!/usr/bin/env bash
# =============================================================================
# rollback_to_typebot.sh — Restaurar integração Evolution → Typebot
# Execute se o N8N Conversation Engine apresentar problemas
# =============================================================================

set -e

EVOLUTION_URL="${EVOLUTION_URL:-https://evolution.extensionista.site}"
INSTANCE="${EVOLUTION_INSTANCE:-europs}"
TYPEBOT_URL="http://kreativ_typebot_viewer:3000"
TYPEBOT_BOT_ID="vnp6x9bqwrx54b2pct5dhqlb"

if [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep EVOLUTION_API_KEY | xargs)
fi

echo "🔙 ROLLBACK: Restaurando integração Evolution → Typebot..."
echo ""

echo "⏳ [1/2] Desativando webhook N8N..."
curl -s -X PUT \
  "${EVOLUTION_URL}/webhook/set/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false, "url": "", "events": [] }' \
  | python3 -m json.tool || true
echo ""

echo "⏳ [2/2] Reativando integração Typebot..."
curl -s -X POST \
  "${EVOLUTION_URL}/typebot/start/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": true,
    \"url\": \"${TYPEBOT_URL}\",
    \"typebot\": \"kreativ-educacao\",
    \"triggerType\": \"all\",
    \"expire\": 0,
    \"keywordFinish\": \"#sair\",
    \"delayMessage\": 1000,
    \"stopBotFromMe\": false,
    \"keepOpen\": false,
    \"debounceTime\": 10
  }" | python3 -m json.tool
echo ""

echo "✅ Rollback concluído! Typebot ativo novamente."
