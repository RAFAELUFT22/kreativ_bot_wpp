import json, requests, sys

N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

headers = {'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}

filename = sys.argv[1] if len(sys.argv) > 1 else '/root/ideias_app/n8n-workflows/60-kreativ-api.json'
try:
    with open(filename, 'r') as f:
        wf_local = json.load(f)
except Exception as e:
    print(f"Cannot read local json {filename}:", e)
    sys.exit(1)

url = "https://n8n.extensionista.site/api/v1/workflows/tOGGjrzk3ZImsK81"
current_wf_req = requests.get(url, headers=headers)
if not current_wf_req.ok:
    print("Failed to get current workflow:", current_wf_req.text)
    sys.exit(1)
current_wf = current_wf_req.json()

payload = {
    "name": current_wf.get("name"),
    "nodes": wf_local["nodes"],
    "connections": wf_local["connections"],
    "settings": current_wf.get("settings", {})
}

res = requests.put(url, headers=headers, json=payload)
print("PUT Status:", res.status_code)
if res.ok:
    print("Workflow updated successfully with fixes!")
else:
    print(res.text[:500])
