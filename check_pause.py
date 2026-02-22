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

node = rdata.get('Human: Pausar Typebot', [{}])[0]
if node.get('error'):
    print("ERRO EM Pausar Typebot:")
    print(json.dumps(node['error'], indent=2))
elif node.get('data'):
    print("PAUSAR TYPEBOT OK:")
    print(json.dumps(node['data']['main'], indent=2))
else:
    print("PAUSAR TYPEBOT NÃO EXECUTOU")
