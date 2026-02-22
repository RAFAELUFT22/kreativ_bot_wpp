import requests, json

N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

headers = {'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json'}
url = "https://n8n.extensionista.site/api/v1/workflows/y92mEtPP4nK1p037"

wf = requests.get(url, headers=headers).json()
if not wf.get('active'):
    # clean None manually
    payload = {
        "name": wf.get("name"),
        "nodes": wf.get("nodes"),
        "connections": wf.get("connections"),
        "settings": wf.get("settings", {}),
        "active": True
    }
    r = requests.put(url, headers=headers, json=payload)
    print("Activated via API:", r.status_code)
    if not r.ok:
        print(r.text)
else:
    print("Already active via API")

