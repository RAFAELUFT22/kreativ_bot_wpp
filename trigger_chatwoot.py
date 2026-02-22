import requests, json, time, os

payload = {
    "event": "conversation_status_changed",
    "conversation": {
        "status": "resolved",
        "id": 9999,
        "meta": {
            "sender": {
                "phone_number": "+556399374165"
            }
        }
    }
}

print("Triggering webhook...")
r = requests.post(
    'https://n8n.extensionista.site/webhook/chatwoot-events',
    headers={'Content-Type': 'application/json'},
    json=payload,
    timeout=10
)

print('Webhook Event Response Status:', r.status_code)
try:
    print('Webhook Event Response Body:', r.json())
except:
    print('Webhook Event Response Text:', r.text)

print("Checking DB...")
time.sleep(2)
os.system("docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c \"SELECT phone, attendance_status FROM students WHERE phone='556399374165'; SELECT phone, status FROM handoff_control WHERE phone='556399374165';\"")
