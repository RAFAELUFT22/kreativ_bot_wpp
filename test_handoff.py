import requests, json, subprocess

print('Resetando Rafael para bot...')
try:
    subprocess.run('''docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "UPDATE students SET attendance_status='bot' WHERE phone='556399374165'; UPDATE handoff_control SET status='bot' WHERE phone='556399374165';" ''', shell=True, check=True)
except Exception as e:
    print(e)
print('Chamando request_human...')
r = requests.post(
    'https://n8n.extensionista.site/webhook/kreativ-unified-api',
    headers={'Content-Type': 'application/json'},
    json={'action': 'request_human', 'phone': '556399374165', 'reason': 'Teste boolean fix in IF v1'},
    timeout=20
)
print('Status HTTP:', r.status_code)

print("\n--- executions ---")
N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

url = "https://n8n.extensionista.site/api/v1/executions?limit=3&workflowId=tOGGjrzk3ZImsK81"
headers = {'X-N8N-API-KEY': N8N_KEY}
r = requests.get(url, headers=headers)
data = r.json()
latest_id = data['data'][0]['id']
r_det = requests.get(f"https://n8n.extensionista.site/api/v1/executions/{latest_id}?includeData=true", headers=headers)
ex = r_det.json()
rdata = ex.get('data',{}).get('resultData',{}).get('runData',{})

print("\n--- NODES EXECUTION RESULTS ---")
for nodeName, runs in rdata.items():
    for run in runs:
        if run.get('error'):
            print(f'ERRO em [{nodeName}]:', json.dumps(run['error'], ensure_ascii=False)[:300])
        else:
            d = run.get('data',{}).get('main',[[]])
            if d and d[0] and len(d[0]) > 0:
                print(f'[{nodeName}]: OK')
