import json, requests

N8N_KEY = ""
with open('/root/ideias_app/.env', 'r') as f:
    for line in f:
        if line.startswith('N8N_API_KEY='):
            N8N_KEY = line.strip().split('=', 1)[1]

url = "https://n8n.extensionista.site/api/v1/workflows/y92mEtPP4nK1p037"
headers = {'X-N8N-API-KEY': N8N_KEY}

wf = requests.get(url, headers=headers).json()

for node in wf['nodes']:
    if node['name'] == 'Tipo de Evento':
        print("Switch Node:", node.get('name'))
        print(json.dumps(node, indent=2))
        
    if node['name'] == 'Extrair Evento':
        print("Extract Node:", node.get('name'))
        print(node['parameters'].get('jsCode', node['parameters']))
