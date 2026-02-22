import json
import uuid

path = '/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json'
with open(path, 'r') as f:
    wf = json.load(f)

# IDs for new nodes
id_extract = str(uuid.uuid4())
id_update_mod = str(uuid.uuid4())
id_batch_enroll = str(uuid.uuid4())

# Nodes to add
new_nodes = [
    {
        "parameters": {
            "operation": "pdf",
            "options": {}
        },
        "id": id_extract,
        "name": "Admin: Extrair PDF",
        "type": "n8n-nodes-base.extractFromFile",
        "typeVersion": 1,
        "position": [800, 1800]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE modules SET content_text = '{{ $json.text.replace(\"'\", \"''\") }}', updated_at = NOW() WHERE course_int_id = {{ $('Normalizar Input').first().json.course_id }} AND module_number = {{ $('Normalizar Input').first().json.module_number }} RETURNING id, title;",
            "options": {}
        },
        "id": id_update_mod,
        "name": "Admin: Atualizar Texto Modulo",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [1024, 1800],
        "credentials": { "postgres": { "id": "lJaeEy4CpHbhgMAp", "name": "Kreativ PostgreSQL" } }
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "INSERT INTO students (phone, name, course_id, current_module, portal_token)\nSELECT telefone_whatsapp, nome_completo, (SELECT id FROM courses LIMIT 1), 1, encode(gen_random_bytes(16), 'hex')\nFROM pre_inscriptions\nWHERE id::text = ANY(ARRAY{{ JSON.stringify($json.ids) }})\nON CONFLICT (phone) DO UPDATE SET updated_at = NOW()\nRETURNING phone, name;",
            "options": {}
        },
        "id": id_batch_enroll,
        "name": "Admin: Batch Enroll",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [800, 2000],
        "credentials": { "postgres": { "id": "lJaeEy4CpHbhgMAp", "name": "Kreativ PostgreSQL" } }
    }
]

wf['nodes'].extend(new_nodes)

# Update Switch (Roteador de Ações)
for node in wf['nodes']:
    if node['name'] == 'Roteador de Ações':
        rules = node['parameters']['rules']['values']
        # Add admin_pdf_extract
        rules.append({
            "conditions": {
                "options": { "caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1 },
                "conditions": [{ "leftValue": "={{ $json.action }}", "rightValue": "admin_pdf_extract", "operator": { "type": "string", "operation": "equals" }, "id": str(uuid.uuid4()) }],
                "combinator": "and"
            }
        })
        idx_pdf = len(rules) - 1
        # Add admin_batch_enroll
        rules.append({
            "conditions": {
                "options": { "caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1 },
                "conditions": [{ "leftValue": "={{ $json.action }}", "rightValue": "admin_batch_enroll", "operator": { "type": "string", "operation": "equals" }, "id": str(uuid.uuid4()) }],
                "combinator": "and"
            }
        })
        idx_batch = len(rules) - 1
        
        # Add connections to switch
        if 'Roteador de Ações' not in wf['connections']:
            wf['connections']['Roteador de Ações'] = { 'main': [[] for _ in range(len(rules))] }
        
        # Ensure switch has enough outputs in connections
        while len(wf['connections']['Roteador de Ações']['main']) < len(rules):
            wf['connections']['Roteador de Ações']['main'].append([])
            
        wf['connections']['Roteador de Ações']['main'][idx_pdf] = [{ "node": "Admin: Extrair PDF", "type": "main", "index": 0 }]
        wf['connections']['Roteador de Ações']['main'][idx_batch] = [{ "node": "Admin: Batch Enroll", "type": "main", "index": 0 }]

# Existing connections
wf['connections']["Admin: Extrair PDF"] = { "main": [[{ "node": "Admin: Atualizar Texto Modulo", "type": "main", "index": 0 }]] }
wf['connections']["Admin: Atualizar Texto Modulo"] = { "main": [[{ "node": "Responder Typebot", "type": "main", "index": 0 }]] }
wf['connections']["Admin: Batch Enroll"] = { "main": [[{ "node": "Responder Typebot", "type": "main", "index": 0 }]] }

with open(path, 'w') as f:
    json.dump(wf, f, indent=2)

print("Injected admin actions into n8n workflow.")
