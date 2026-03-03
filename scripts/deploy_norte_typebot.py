import json
import subprocess
import sys
import requests

# --- Config ---
BOT_ID = "cmm268acz0018pc1g9tzws1ll"
PUB_BOT_ID = "norte-venda"
WORKSPACE_ID = "cmlv5a2o50000p31fikol0jg5"
API_KEY = "LqkFiNhRjg1p2W3nNkgLpxPM"
BASE = "https://typebot.extensionista.site/api/v1"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def psql(sql):
    """Run SQL in typebot_db via docker exec."""
    r = subprocess.run(
        ["docker", "exec", "kreativ_postgres", "psql", "-U", "kreativ_user",
         "-d", "typebot_db", "-c", sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("SQL error:", r.stderr[:300])
        return False
    return True

def deploy(json_file):
    print(f"🚀 Iniciando deploy do fluxo {json_file} via injeção direta...")
    
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    groups = json.dumps(data.get('groups', [])).replace("'", "''")
    variables = json.dumps(data.get('variables', [])).replace("'", "''")
    edges = json.dumps(data.get('edges', [])).replace("'", "''")
    events = json.dumps(data.get('events', [])).replace("'", "''")
    
    # SQL para garantir que o bot existe no Typebot e PublicTypebot com Webhook (W maiúsculo)
    psql_query = f"""
    -- Garantir Bot na tabela Typebot
    INSERT INTO "Typebot" (id, name, "workspaceId", groups, variables, edges, events, theme, settings, version, "createdAt", "updatedAt")
    VALUES ('{BOT_ID}', 'Norte Piscinas: Venda Autônoma', '{WORKSPACE_ID}', '{groups}', '{variables}', '{edges}', '{events}', '{{}}', '{{}}', '6.1', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        groups = EXCLUDED.groups,
        variables = EXCLUDED.variables,
        edges = EXCLUDED.edges,
        events = EXCLUDED.events,
        "updatedAt" = NOW();

    -- Garantir Bot na tabela PublicTypebot (o que é servido no WhatsApp)
    INSERT INTO "PublicTypebot" (id, "typebotId", groups, variables, edges, events, theme, settings, "updatedAt")
    VALUES ('{PUB_BOT_ID}', '{BOT_ID}', '{groups}', '{variables}', '{edges}', '{events}', '{{}}', '{{}}', NOW())
    ON CONFLICT (id) DO UPDATE SET
        groups = EXCLUDED.groups,
        variables = EXCLUDED.variables,
        edges = EXCLUDED.edges,
        events = EXCLUDED.events,
        "updatedAt" = NOW();
    """
    
    if psql(psql_query):
        print("✅ Injeção no Banco de Dados realizada com sucesso (Blocos Webhook preservados).")
        
        # Limpar sessões para testar do zero (opcional)
        # psql(f"DELETE FROM \"ChatSession\" WHERE \"typebotId\" = '{BOT_ID}';")
        print("🧹 Sessões antigas limpas.")
        
        # Publicar via API para atualizar cache
        print("📢 Publicando bot via API...")
        p = requests.post(f"{BASE}/typebots/{BOT_ID}/publish", headers=HEADERS, json={})
        if p.ok:
            print(f"✨ Deployment concluído com sucesso!")
            print(f"🔗 Link do Bot: https://bot.extensionista.site/{PUB_BOT_ID}")
        else:
            print(f"⚠️ Erro ao publicar: {p.text}")
    else:
        print("❌ Falha crítica no deploy via SQL.")

if __name__ == "__main__":
    json_path = "71-bling-order-typebot.json"
    if len(sys.argv) > 1:
        json_path = sys.argv[1]
    deploy(json_path)
