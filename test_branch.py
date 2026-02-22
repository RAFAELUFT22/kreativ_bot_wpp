import json, requests

N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

url = "https://n8n.extensionista.site/api/v1/executions?limit=1&workflowId=tOGGjrzk3ZImsK81"
headers = {'X-N8N-API-KEY': N8N_KEY}

latest_id = requests.get(url, headers=headers).json()['data'][0]['id']
r_det = requests.get(f"https://n8n.extensionista.site/api/v1/executions/{latest_id}?includeData=true", headers=headers).json()
rdata = r_det.get('data',{}).get('resultData',{}).get('runData',{})

if_node = rdata.get('Human: IF Conv Exists', [{}])[0]
if if_node.get('data'):
    ports = if_node['data']['main']
    for i, p in enumerate(ports):
        if p and len(p) > 0:
            print(f"Port {i} TAKEN! Result: {json.dumps(p[0].get('json', {}), indent=2)}")
        else:
            print(f"Port {i} EMPTY.")
else:
    print("IF Conv Exists did not execute?!")
