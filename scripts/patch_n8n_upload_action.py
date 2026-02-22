"""Patch N8N workflow to add admin_upload_module_file action → kreativ_ingest."""
import json, uuid, subprocess, sys

N8N_URL = "https://n8n.extensionista.site"
WF_ID   = "SoB5evP9aOmj6hLA"
LOCAL_WF = "/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json"


def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERRO:", r.stderr[:400])
        sys.exit(1)
    return r.stdout.strip()


n8n_key = run("grep N8N_API_KEY /root/ideias_app/.env | cut -d= -f2")

# Download current workflow
run(f'curl -s "{N8N_URL}/api/v1/workflows/{WF_ID}" '
    f'-H "X-N8N-API-KEY: {n8n_key}" > /tmp/wf_upload_patch.json')

with open('/tmp/wf_upload_patch.json') as f:
    wf = json.load(f)

nodes = wf['nodes']
connections = wf['connections']

# ── Guard: skip if already patched ────────────────────────────────────────────
if any(n['name'] == 'Admin: Upload Module File' for n in nodes):
    print("⚠️  Action already patched. Nothing to do.")
    sys.exit(0)

# ── Find the Switch/Roteador node ─────────────────────────────────────────────
router = next((n for n in nodes if n['name'] == 'Roteador de Ações'), None)
if not router:
    print("ERRO: 'Roteador de Ações' não encontrado")
    sys.exit(1)

# ── Add new case to Switch rules ──────────────────────────────────────────────
new_rule = {
    "conditions": {
        "options": {
            "caseSensitive": True,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 1
        },
        "conditions": [
            {
                "leftValue": "={{ $json.action }}",
                "rightValue": "admin_upload_module_file",
                "operator": {
                    "type": "string",
                    "operation": "equals"
                },
                "id": str(uuid.uuid4())
            }
        ],
        "combinator": "and"
    }
}
router['parameters']['rules']['values'].append(new_rule)
output_index = len(router['parameters']['rules']['values']) - 1
print(f"✅ Case 'admin_upload_module_file' adicionado ao Switch (output[{output_index}])")

# ── New HTTP Request node → kreativ_ingest:8000/process ───────────────────────
upload_node_id = str(uuid.uuid4())
# Position below Admin: Upsert Module (pos [1344, 2024])
upload_node = {
    "id": upload_node_id,
    "name": "Admin: Upload Module File",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1344, 2216],
    "continueOnFail": False,
    "parameters": {
        "method": "POST",
        "url": "http://kreativ_ingest:8000/process",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "Content-Type", "value": "application/json"}
            ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ module_id: $json.module_id, file_name: $json.file_name, file_base64: $json.file_base64, file_type: $json.file_type, replace_content: $json.replace_content !== false }) }}",
        "options": {"timeout": 120000}
    }
}
nodes.append(upload_node)
print(f"✅ Nó 'Admin: Upload Module File' criado (id={upload_node_id})")

# ── Connect: Switch output[N] → Upload → Responder Typebot ────────────────────
# Switch → Upload
switch_conns = connections.setdefault('Roteador de Ações', {}).setdefault('main', [])
# Extend list to output_index if needed
while len(switch_conns) <= output_index:
    switch_conns.append([])
switch_conns[output_index] = [{"node": "Admin: Upload Module File", "type": "main", "index": 0}]

# Upload → Responder Typebot (same as other admin nodes)
connections["Admin: Upload Module File"] = {
    "main": [[{"node": "Responder Typebot", "type": "main", "index": 0}]]
}
print("✅ Conexões: Switch → Upload → Responder Typebot")

# ── Build PUT payload ──────────────────────────────────────────────────────────
payload = {
    "name": wf.get("name"),
    "nodes": nodes,
    "connections": connections,
    "settings": wf.get("settings", {})
}

with open('/tmp/wf_upload_patched.json', 'w') as f:
    json.dump(payload, f, indent=2)
print("📄 Arquivo salvo: /tmp/wf_upload_patched.json")
print(f"   Total nodes: {len(nodes)}, Switch cases: {output_index + 1}")
