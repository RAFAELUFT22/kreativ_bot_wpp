import requests, json, time, os, sys

# Config
N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

PHONE = "556399374165"
UNIFIED_API_URL = "https://n8n.extensionista.site/webhook/kreativ-unified-api"
CW_WEBHOOK_URL = "https://n8n.extensionista.site/webhook/chatwoot-events"

def run_sql(query):
    return os.popen(f"docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -t -A -c \"{query}\"").read().strip()

print("=== STEP 0: Resetting state to BOT ===")
run_sql(f"UPDATE students SET attendance_status='bot' WHERE phone='{PHONE}';")
run_sql(f"UPDATE handoff_control SET status='bot' WHERE phone='{PHONE}';")

print(f"=== STEP 1: Requesting Human for {PHONE} ===")
r = requests.post(UNIFIED_API_URL, json={'action': 'request_human', 'phone': PHONE, 'reason': 'PROVA FINAL'})
print("Status:", r.status_code)

time.sleep(3)
status = run_sql(f"SELECT attendance_status FROM students WHERE phone='{PHONE}'")
print(f"DB Status (should be human): {status}")

print("=== STEP 2: Resolving Conversation in Chatwoot ===")
payload = {
    "event": "conversation_status_changed",
    "conversation": {
        "status": "resolved",
        "id": 9999,
        "meta": {
            "sender": {
                "phone_number": f"+{PHONE}"
            }
        }
    }
}
r = requests.post(CW_WEBHOOK_URL, json=payload)
print("Webhook Response:", r.status_code)

time.sleep(3)
status = run_sql(f"SELECT attendance_status FROM students WHERE phone='{PHONE}'")
print(f"DB Status (should be bot): {status}")

print("=== STEP 3: Checking N8N Executions ===")
headers = {'X-N8N-API-KEY': N8N_KEY}
# Check tOGG (Unified)
r = requests.get("https://n8n.extensionista.site/api/v1/executions?limit=1&workflowId=tOGGjrzk3ZImsK81", headers=headers).json()
print("Unified Execution:", r['data'][0]['status'])

# Check y92 (Resume)
r = requests.get("https://n8n.extensionista.site/api/v1/executions?limit=1&workflowId=y92mEtPP4nK1p037", headers=headers).json()
latest_id = r['data'][0]['id']
print(f"Resume Execution {latest_id}:", r['data'][0]['status'])

r_det = requests.get(f"https://n8n.extensionista.site/api/v1/executions/{latest_id}?includeData=true", headers=headers).json()
nodes_ran = r_det.get('data',{}).get('resultData',{}).get('runData',{}).keys()
print("Nodes ran in Resume workflow:", list(nodes_ran))

if "Retomar Typebot" in nodes_ran:
    print("SUCCESS: Typebot unpause node executed!")
else:
    print("FAILURE: Typebot unpause node NOT executed.")
