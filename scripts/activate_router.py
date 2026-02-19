import requests
import os
import sys

N8N_API_KEY = os.environ.get('N8N_API_KEY')
if not N8N_API_KEY:
    # Try to read from .env if not in environment
    try:
        with open('/root/ideias_app/.env', 'r') as f:
            for line in f:
                if line.startswith('N8N_API_KEY='):
                    N8N_API_KEY = line.strip().split('=', 1)[1]
                    break
    except:
        pass

if not N8N_API_KEY:
    print("Error: N8N_API_KEY not found")
    sys.exit(1)

headers = {'X-N8N-API-KEY': N8N_API_KEY}
try:
    # List workflows
    resp = requests.get('http://localhost:5678/api/v1/workflows', headers=headers)
    resp.raise_for_status()
    workflows = resp.json().get('data', [])
    
    target_id = None
    for wf in workflows:
        if wf['name'] == 'Kreativ: AI Cognitive Router':
            target_id = wf['id']
            break
            
    if target_id:
        print(f"Found Workflow ID: {target_id}")
        # Activate
        act_resp = requests.post(f'http://localhost:5678/api/v1/workflows/{target_id}/activate', headers=headers)
        if act_resp.status_code == 200:
            print("Workflow activated successfully")
        else:
            print(f"Failed to activate: {act_resp.text}")
    else:
        print("Workflow 'Kreativ: AI Cognitive Router' not found")
        sys.exit(1)

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
