import json
import subprocess
import sys

BOT_ID = "td Thrust-tds-bot" # Using a consistent ID
PUB_BOT_ID = "pub-tds-bot"
WORKSPACE_ID = "cmlv5a2o50000p31fikol0jg5"

def psql(sql):
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
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    groups = json.dumps(data.get('groups', [])).replace("'", "''")
    variables = json.dumps(data.get('variables', [])).replace("'", "''")
    edges = json.dumps(data.get('edges', [])).replace("'", "''")
    events = json.dumps(data.get('events', [])).replace("'", "''")
    
    # Create Bot entry if not exists
    psql(f"""
    INSERT INTO "Typebot" (id, name, "workspaceId", groups, variables, edges, events, theme, settings, version, "createdAt", "updatedAt")
    VALUES ('{BOT_ID}', 'TDS - Pré-Inscrição', '{WORKSPACE_ID}', '{groups}', '{variables}', '{edges}', '{events}', '{{}}', '{{}}', '6.1', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
        groups = EXCLUDED.groups,
        variables = EXCLUDED.variables,
        edges = EXCLUDED.edges,
        events = EXCLUDED.events,
        "updatedAt" = NOW();
    """)
    
    # Create PublicTypebot entry if not exists
    psql(f"""
    INSERT INTO "PublicTypebot" (id, "typebotId", groups, variables, edges, events, theme, settings, "updatedAt")
    VALUES ('{PUB_BOT_ID}', '{BOT_ID}', '{groups}', '{variables}', '{edges}', '{events}', '{{}}', '{{}}', NOW())
    ON CONFLICT (id) DO UPDATE SET
        groups = EXCLUDED.groups,
        variables = EXCLUDED.variables,
        edges = EXCLUDED.edges,
        events = EXCLUDED.events,
        "updatedAt" = NOW();
    """)
    
    print(f"✅ TDS Bot deployed with ID: {BOT_ID}")
    print(f"🔗 Public URL: https://bot.extensionista.site/{PUB_BOT_ID}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 deploy_tds.py <json_file>")
        sys.exit(1)
    deploy(sys.argv[1])
