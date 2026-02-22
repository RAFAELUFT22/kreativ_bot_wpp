import json, requests

N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

url = "https://n8n.extensionista.site/api/v1/executions?limit=3&workflowId=y92mEtPP4nK1p037"
headers = {'X-N8N-API-KEY': N8N_KEY}

r = requests.get(url, headers=headers).json()
for ex in r['data']:
    ex_id = ex['id']
    status = ex['status']
    print(f"Checking ID {ex_id} ({status})...")
    
    r_det = requests.get(f"https://n8n.extensionista.site/api/v1/executions/{ex_id}?includeData=true", headers=headers).json()
    runData = r_det.get('data', {}).get('resultData', {}).get('runData', {})
    
    nodes = list(runData.keys())
    print(f"  Nodes: {nodes}")
    if 'Retomar Typebot' in nodes:
        print(f"  SUCCESS in ID {ex_id}")
    else:
        print(f"  Retomar Typebot DID NOT RUN in ID {ex_id}")
