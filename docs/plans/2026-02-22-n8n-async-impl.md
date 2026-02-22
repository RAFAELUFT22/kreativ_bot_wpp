# N8N Async Modernization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir chamadas síncronas ao DeepSeek no ULTIMATE por padrão assíncrono com nós nativos N8N (AI Agent, Window Buffer Memory, OpenAI Chat Model), eliminando timeouts e falhas de list_reply no WhatsApp.

**Architecture:** O nó `Respond to Webhook` envia HTTP 200 ao Typebot imediatamente; a execução continua em background com AI Agent + OpenRouter; a resposta é entregue diretamente via Evolution API. Nenhum novo container necessário.

**Tech Stack:** N8N API v1, N8N LangChain nodes (@n8n/n8n-nodes-langchain.*), OpenRouter (base URL para OpenAI Chat Model), Redis (Window Buffer Memory backend), Evolution API (sendText), PostgreSQL (contexto RAG)

**Design doc:** `docs/plans/2026-02-22-n8n-async-redesign.md`

---

## Pré-requisitos

Variáveis de ambiente necessárias (já no `.env`):
```bash
N8N_API_KEY=...          # para chamar a API do N8N
EVOLUTION_API_KEY=...    # para enviar WhatsApp direto
OPENROUTER_API_KEY=...   # OU usar DEEPSEEK_API_KEY com base URL do DeepSeek
REDIS_PASSWORD=...       # para Window Buffer Memory
```

Verificação rápida antes de começar:
```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -c "import json,sys; w=json.load(sys.stdin); print(f'Active: {w[\"active\"]}, Nodes: {len(w[\"nodes\"])}')"
# Expected: Active: True, Nodes: 43
```

---

## Task 1: Verificar Disponibilidade dos Nós LangChain

Os nós AI Agent, Window Buffer Memory e OpenAI Chat Model precisam estar disponíveis no N8N.

**Arquivos:** nenhum — só verificação via API

### Step 1: Verificar nós LangChain disponíveis

```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')

curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/node-types" | \
  python3 -c "
import json, sys
types = json.load(sys.stdin)
langchain = [t['name'] for t in types.get('data', []) if 'langchain' in t.get('name','').lower()]
print('LangChain nodes disponíveis:')
for t in sorted(langchain): print(f'  {t}')
"
```

**Expected:** lista incluindo ao menos:
```
@n8n/n8n-nodes-langchain.agent
@n8n/n8n-nodes-langchain.lmChatOpenAi
@n8n/n8n-nodes-langchain.memoryBufferWindow
@n8n/n8n-nodes-langchain.chainLlm
```

### Step 2: Se não disponíveis — usar fallback (HTTP Request + Code Node)

Se os nós LangChain NÃO estiverem disponíveis, o design de fallback é:
- `AI Agent` → substituir por `HTTP Request` + `Code` (como o sub-workflow atual mas com async)
- `Window Buffer Memory` → manter o TCP Redis code existente (funciona bem de forma standalone)
- `OpenAI Chat Model` → substituir por `HTTP Request` ao DeepSeek

Neste caso, o benefício principal é o padrão `respondToWebhook` antecipado (async) — os nós nativos são otimização secundária.

### Step 3: Verificar credencial Redis existente

```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/credentials?type=redis" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
creds = r.get('data', [])
print(f'Redis credentials: {len(creds)}')
for c in creds: print(f'  id={c[\"id\"]} name={c[\"name\"]}')
"
```

**Commit:** não há commit nesta task (só verificação).

---

## Task 2: Criar Credenciais N8N (via UI — 1 vez)

Estas credenciais são necessárias para os nós nativos. **Não é possível via API** — fazer via UI do N8N.

**Arquivos:** nenhum (configuração no N8N)

### Step 1: Criar credencial OpenRouter (tipo "OpenAI API")

1. Acessar: https://n8n.extensionista.site
2. Menu lateral → Credentials → New Credential
3. Tipo: **"OpenAI"** (ou "OpenAI API")
4. Configurar:
   ```
   Nome: OpenRouter
   API Key: [valor de OPENROUTER_API_KEY do .env]
   Base URL: https://openrouter.ai/api/v1
   ```
5. Salvar

**Alternativa se não tiver OPENROUTER_API_KEY:** usar o DEEPSEEK_API_KEY com:
```
Base URL: https://api.deepseek.com
```

### Step 2: Criar credencial Redis para Window Buffer Memory

1. Credentials → New Credential
2. Tipo: **"Redis"**
3. Configurar:
   ```
   Nome: Redis Kreativ Memory
   Host: kreativ_redis
   Port: 6379
   Password: [valor de REDIS_PASSWORD do .env]
   ```
4. Salvar

### Step 3: Anotar os IDs das credenciais criadas

```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/credentials" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
for c in r.get('data', []):
    if 'openrouter' in c['name'].lower() or 'redis' in c['name'].lower():
        print(f'id={c[\"id\"]} name={c[\"name\"]} type={c[\"type\"]}')
"
```

**Anotar** os IDs (usados nos Steps seguintes):
- `OPENROUTER_CRED_ID = ???`
- `REDIS_CRED_ID = ???`

**Commit:** não há commit (configuração UI).

---

## Task 3: Implementar `ai_tutor` Assíncrono

Este é o path principal. O `AI Tutor: Proxy Request` (executeWorkflow) é removido e substituído por 7 nós inline.

**Arquivos:**
- Modify: `n8n-workflows/60-kreativ-api-ultimate.json`

### Step 1: Smoke test baseline (registrar estado atual)

```bash
echo "=== BASELINE antes da mudança ==="
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"ai_tutor","message":"Teste baseline"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" --max-time 40 | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'ok={r.get(\"ok\")} resp={str(r.get(\"response\",\"\"))[:50]}')"
```

### Step 2: Baixar workflow atual e preparar script de modificação

```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')

curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" > /tmp/ultimate_before_async.json

echo "Backup salvo. Nodes: $(python3 -c "import json; w=json.load(open('/tmp/ultimate_before_async.json')); print(len(w['nodes']))")"
```

### Step 3: Verificar a estrutura da conexão ai_tutor atual

```bash
python3 -c "
import json
wf = json.load(open('/tmp/ultimate_before_async.json'))
conns = wf['connections']
# Encontrar o que conecta ao AI Tutor: Proxy Request
for src, targets in conns.items():
    for conn_type, lists in targets.items():
        for tlist in lists:
            for t in tlist:
                if 'AI Tutor' in t.get('node','') or 'AI Tutor' in src:
                    print(f'{src} --[{conn_type}]--> {t[\"node\"]}')
"
```

### Step 4: Criar script de modificação do ULTIMATE para ai_tutor async

Criar `/tmp/patch_ai_tutor.py`:

```python
#!/usr/bin/env python3
"""
Patch ai_tutor path no ULTIMATE:
- Remove: AI Tutor: Proxy Request (executeWorkflow)
- Adiciona: 7 nós inline async + 1 fallback
IMPORTANTE: Preencha OPENROUTER_CRED_ID e REDIS_CRED_ID antes de rodar.
"""
import json
import uuid

# === CONFIGURAR ANTES DE RODAR ===
OPENROUTER_CRED_ID = "PREENCHER"  # ID da credencial OpenRouter no N8N
REDIS_CRED_ID = "PREENCHER"       # ID da credencial Redis no N8N
EVOLUTION_URL = "https://evolution.extensionista.site"

def patch(wf_path, out_path):
    with open(wf_path) as f:
        wf = json.load(f)

    nodes = wf['nodes']
    conns = wf['connections']

    # 1. Encontrar e remover o nó AI Tutor: Proxy Request
    proxy_node = next((n for n in nodes if n['name'] == 'AI Tutor: Proxy Request'), None)
    if not proxy_node:
        print("ERRO: AI Tutor: Proxy Request não encontrado!")
        return False

    # Pegar posição base para os novos nós
    base_x = proxy_node['position'][0]
    base_y = proxy_node['position'][1]

    # Remover o nó proxy
    nodes = [n for n in nodes if n['name'] != 'AI Tutor: Proxy Request']

    # 2. Encontrar o que conectava AO proxy (source) e o que vinha APÓS (target)
    # Source: nó do Switch que aponta para o proxy
    proxy_sources = []
    proxy_targets = []
    for src, targets in conns.items():
        for conn_type, lists in targets.items():
            for tlist in lists:
                for t in tlist:
                    if t['node'] == 'AI Tutor: Proxy Request':
                        proxy_sources.append({'node': src, 'type': conn_type})
    # Target: o que o proxy apontava
    if 'AI Tutor: Proxy Request' in conns:
        for conn_type, lists in conns['AI Tutor: Proxy Request'].items():
            for tlist in lists:
                for t in tlist:
                    proxy_targets.append({'node': t['node'], 'type': conn_type})

    print(f"Proxy sources: {proxy_sources}")
    print(f"Proxy targets: {proxy_targets}")

    # 3. Remover conexões do proxy do dict
    if 'AI Tutor: Proxy Request' in conns:
        del conns['AI Tutor: Proxy Request']
    for src, targets in list(conns.items()):
        for conn_type, lists in targets.items():
            new_lists = []
            for tlist in lists:
                new_tlist = [t for t in tlist if t['node'] != 'AI Tutor: Proxy Request']
                new_lists.append(new_tlist)
            conns[src][conn_type] = new_lists

    # 4. Novos nós
    node_extrair = {
        "parameters": {
            "assignments": {
                "assignments": [
                    {"id": str(uuid.uuid4()), "name": "phone", "value": "={{ $json.phone }}", "type": "string"},
                    {"id": str(uuid.uuid4()), "name": "message", "value": "={{ $json.message || $json.body || 'Olá' }}", "type": "string"}
                ]
            },
            "options": {}
        },
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [base_x, base_y],
        "id": "ai-tutor-extrair",
        "name": "AI Tutor: Extrair Input"
    }

    node_responder_200 = {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify({ ok: true, response: 'Seu tutor está analisando... 🤔' }) }}",
            "options": {}
        },
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [base_x + 200, base_y],
        "id": "ai-tutor-responder-200",
        "name": "AI Tutor: Responder 200"
    }

    # SQL reutilizado do sub-workflow (Combined Context Query)
    combined_context_sql = """WITH module_data AS (
  SELECT title, content_text AS syllabus, evaluation_rubric
  FROM modules
  WHERE course_int_id = (
    SELECT course_id FROM students WHERE phone = '{{ $('AI Tutor: Extrair Input').first().json.phone }}' LIMIT 1
  )
  AND module_number = (
    SELECT current_module FROM students WHERE phone = '{{ $('AI Tutor: Extrair Input').first().json.phone }}' LIMIT 1
  )
  LIMIT 1
),
rag_data AS (
  SELECT dc.content
  FROM document_chunks dc
  JOIN modules m ON dc.module_id = m.id
  WHERE m.course_int_id = (
    SELECT course_id FROM students WHERE phone = '{{ $('AI Tutor: Extrair Input').first().json.phone }}' LIMIT 1
  )
  ORDER BY dc.chunk_index ASC
  LIMIT 5
)
SELECT
  (SELECT row_to_json(md.*) FROM module_data md LIMIT 1) AS module_row,
  (SELECT json_agg(rd.content) FROM rag_data rd) AS rag_chunks"""

    node_buscar_contexto = {
        "parameters": {
            "operation": "executeQuery",
            "query": combined_context_sql,
            "options": {}
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.5,
        "position": [base_x + 400, base_y],
        "id": "ai-tutor-contexto",
        "name": "AI Tutor: Buscar Contexto",
        "credentials": {
            "postgres": {"id": "lJaeEy4CpHbhgMAp", "name": "Kreativ PostgreSQL"}
        },
        "continueOnFail": True
    }

    node_preparar_sistema = {
        "parameters": {
            "jsCode": """const ctx = $json;
const mod = ctx.module_row ? JSON.parse(ctx.module_row) : {};
const ragChunks = ctx.rag_chunks ? JSON.parse(ctx.rag_chunks) : [];

let ragContext = '';
if (ragChunks.length > 0) {
  ragContext = '\\n\\nMATERIAL DO MÓDULO (BASE DE CONHECIMENTO):\\n' +
    ragChunks.map((c, i) => `[${i+1}] ${c}`).join('\\n\\n');
} else if (mod.syllabus) {
  ragContext = '\\n\\nEMENTA DO MÓDULO:\\n' + mod.syllabus;
}

const rubric = mod.evaluation_rubric
  ? `\\n\\nCRITÉRIO DE AVALIAÇÃO:\\n${mod.evaluation_rubric}` : '';

const systemMessage = `Você é um tutor pedagógico do curso ${mod.title || 'Kreativ Educação'}.
Responda de forma clara, encorajadora e em português brasileiro.
Seja conciso (máximo 3 parágrafos). Adapte a linguagem ao nível do aluno.
${ragContext}${rubric}`;

return [{ json: { systemMessage } }];"""
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [base_x + 600, base_y],
        "id": "ai-tutor-sistema",
        "name": "AI Tutor: Preparar Sistema"
    }

    # OpenAI Chat Model (sub-node para o Agent)
    node_chat_model = {
        "parameters": {
            "model": "deepseek/deepseek-chat",
            "options": {
                "temperature": 0.7
            }
        },
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1.2,
        "position": [base_x + 800, base_y + 100],
        "id": "ai-tutor-chat-model",
        "name": "AI Tutor: Chat Model",
        "credentials": {
            "openAiApi": {"id": OPENROUTER_CRED_ID, "name": "OpenRouter"}
        }
    }

    # Window Buffer Memory (sub-node para o Agent)
    node_memory = {
        "parameters": {
            "sessionKey": "={{ $('AI Tutor: Extrair Input').first().json.phone }}",
            "contextWindowLength": 10
        },
        "type": "@n8n/n8n-nodes-langchain.memoryBufferWindow",
        "typeVersion": 1.3,
        "position": [base_x + 800, base_y + 200],
        "id": "ai-tutor-memory",
        "name": "AI Tutor: Memória",
        "credentials": {
            "redis": {"id": REDIS_CRED_ID, "name": "Redis Kreativ Memory"}
        }
    }

    # AI Agent
    node_agent = {
        "parameters": {
            "options": {
                "systemMessage": "={{ $('AI Tutor: Preparar Sistema').first().json.systemMessage }}"
            }
        },
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 1.7,
        "position": [base_x + 800, base_y],
        "id": "ai-tutor-agent",
        "name": "AI Tutor: Agent",
        "continueOnFail": True
    }

    # Fallback para erros do Agent
    node_fallback = {
        "parameters": {
            "jsCode": """return [{ json: { output: 'Desculpe, o tutor está temporariamente indisponível. Tente em instantes! 🔧' } }];"""
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [base_x + 800, base_y - 120],
        "id": "ai-tutor-fallback",
        "name": "AI Tutor: Fallback"
    }

    node_enviar_wpp = {
        "parameters": {
            "method": "POST",
            "url": f"={EVOLUTION_URL}/message/sendText/europs",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "apikey", "value": "={{ $env.EVOLUTION_API_KEY || '' }}"}]
            },
            "sendBody": True,
            "contentType": "json",
            "body": {
                "number": "={{ $('AI Tutor: Extrair Input').first().json.phone + '@s.whatsapp.net' }}",
                "textMessage": {
                    "text": "={{ $json.output || $('AI Tutor: Fallback').first().json.output }}"
                }
            },
            "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [base_x + 1000, base_y],
        "id": "ai-tutor-enviar-wpp",
        "name": "AI Tutor: Enviar WhatsApp",
        "continueOnFail": True
    }

    # Adicionar nós novos
    new_nodes = [
        node_extrair, node_responder_200, node_buscar_contexto,
        node_preparar_sistema, node_chat_model, node_memory,
        node_agent, node_fallback, node_enviar_wpp
    ]
    nodes.extend(new_nodes)

    # 5. Reconectar: source do proxy → AI Tutor: Extrair Input
    for src in proxy_sources:
        if src['node'] not in conns:
            conns[src['node']] = {}
        if 'main' not in conns[src['node']]:
            conns[src['node']]['main'] = [[]]
        # Adicionar novo destino
        conns[src['node']]['main'][0].append({
            "node": "AI Tutor: Extrair Input",
            "type": "main",
            "index": 0
        })

    # 6. Conexões entre os novos nós (fluxo principal)
    conns["AI Tutor: Extrair Input"] = {
        "main": [[{"node": "AI Tutor: Responder 200", "type": "main", "index": 0}]]
    }
    conns["AI Tutor: Responder 200"] = {
        "main": [[{"node": "AI Tutor: Buscar Contexto", "type": "main", "index": 0}]]
    }
    conns["AI Tutor: Buscar Contexto"] = {
        "main": [[{"node": "AI Tutor: Preparar Sistema", "type": "main", "index": 0}]]
    }
    conns["AI Tutor: Preparar Sistema"] = {
        "main": [[{"node": "AI Tutor: Agent", "type": "main", "index": 0}]]
    }

    # Sub-nodes conectados ao Agent (conexões especiais LangChain)
    conns["AI Tutor: Chat Model"] = {
        "ai_languageModel": [[{"node": "AI Tutor: Agent", "type": "ai_languageModel", "index": 0}]]
    }
    conns["AI Tutor: Memória"] = {
        "ai_memory": [[{"node": "AI Tutor: Agent", "type": "ai_memory", "index": 0}]]
    }

    # Agent → Enviar WhatsApp (saída normal)
    # Agent → Fallback (saída de erro, index 1)
    conns["AI Tutor: Agent"] = {
        "main": [
            [{"node": "AI Tutor: Enviar WhatsApp", "type": "main", "index": 0}],
            [{"node": "AI Tutor: Fallback", "type": "main", "index": 0}]  # output de erro
        ]
    }
    conns["AI Tutor: Fallback"] = {
        "main": [[{"node": "AI Tutor: Enviar WhatsApp", "type": "main", "index": 0}]]
    }

    # Reconectar o que vinha APÓS o proxy (ex: Responder Typebot)
    # O Responder Typebot já NÃO precisa ser chamado para ai_tutor (async)
    # mas se havia conexão, removemos (já foi removida ao limpar conns do proxy)

    wf['nodes'] = nodes
    wf['connections'] = conns

    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
        'staticData': wf.get('staticData', None)
    }

    with open(out_path, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"Patch aplicado. Total nós: {len(nodes)}")
    print(f"Novos nós: {[n['name'] for n in new_nodes]}")
    return True

if __name__ == '__main__':
    ok = patch('/tmp/ultimate_before_async.json', '/tmp/ultimate_ai_tutor_async.json')
    if ok:
        print("\nPayload pronto em /tmp/ultimate_ai_tutor_async.json")
        print("Próximo passo: PUT para N8N")
```

### Step 5: Preencher os IDs de credencial no script e rodar

```bash
# Pegar IDs das credenciais criadas na Task 2
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/credentials" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
for c in r.get('data', []):
    print(f'id={c[\"id\"]} | name={c[\"name\"]} | type={c[\"type\"]}')
"

# Editar o script com os IDs corretos (substituir PREENCHER)
# OPENROUTER_CRED_ID = "ID_DA_CREDENCIAL_OPENROUTER"
# REDIS_CRED_ID = "ID_DA_CREDENCIAL_REDIS"

python3 /tmp/patch_ai_tutor.py
```

### Step 6: Fazer PUT do workflow modificado no N8N

```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')

curl -s -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/ultimate_ai_tutor_async.json \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
print(f'Nodes: {len(r.get(\"nodes\",[]))}')
ai_nodes = [n['name'] for n in r.get('nodes',[]) if 'AI Tutor' in n['name']]
print(f'AI Tutor nodes: {ai_nodes}')
"

# Reativar
curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA/activate" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Active: {r.get(\"active\")}')"
```

### Step 7: Smoke test do ai_tutor assíncrono

```bash
echo "=== AI Tutor async test (deve responder em < 2s) ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"ai_tutor","message":"Qual módulo devo estudar agora?"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | python3 -m json.tool
```

**Expected:**
```json
{"ok": true, "response": "Seu tutor está analisando... 🤔"}
```
Tempo: < 2s (antes era 5–30s)

A resposta real chega como mensagem WhatsApp direta ao número `556399374165`.

### Step 8: Verificar execução no N8N

```bash
sleep 15  # aguardar IA processar
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/executions?workflowId=SoB5evP9aOmj6hLA&limit=3" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
for e in r['data'][:3]:
    print(f'Exec {e[\"id\"]} | Status: {e[\"status\"]} | Last: {e.get(\"data\",{}).get(\"resultData\",{}).get(\"lastNodeExecuted\",\"?\")}')
"
```

**Expected:** último exec com status `success`, last node = `AI Tutor: Enviar WhatsApp`

### Step 9: Exportar workflow atualizado para o repo

```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json

echo "Exportado. Lines: $(wc -l < /root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json)"
```

### Step 10: Commit

```bash
cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): ai_tutor async — respondToWebhook 200 + AI Agent nativo + Evolution direct"
```

---

## Task 4: Implementar `submit_quiz` Assíncrono

Mesma lógica: responder 200 imediatamente, avaliar em background, enviar resultado via WhatsApp.

**Arquivos:**
- Modify: `n8n-workflows/60-kreativ-api-ultimate.json`

### Step 1: Smoke test baseline

```bash
# Obter um module_id válido
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT id, title FROM modules WHERE module_number=2 LIMIT 1;" -t

# Testar submit_quiz atual
curl -s -X POST -H "Content-Type: application/json" \
  -d '{
    "phone": "556399374165",
    "action": "submit_quiz",
    "module_id": "UUID_DO_MODULO_AQUI",
    "answers": ["A documentação rural é importante para registro da propriedade"]
  }' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" --max-time 40
```

### Step 2: Modificar submit_quiz — mover respondToWebhook para cima

Identificar os nós do path `submit_quiz` no ULTIMATE atual:
```bash
python3 -c "
import json
wf = json.load(open('/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json'))
# Mostrar todos os nós Quiz:*
quiz_nodes = [n for n in wf['nodes'] if 'Quiz' in n['name']]
for n in quiz_nodes:
    print(f'  [{n[\"type\"].split(\".\")[-1]}] {n[\"name\"]} pos={n[\"position\"]}')
"
```

### Step 3: Criar script de patch para submit_quiz

Criar `/tmp/patch_submit_quiz.py`:

```python
#!/usr/bin/env python3
"""
Patch submit_quiz no ULTIMATE:
- Adiciona nó 'Quiz: Responder 200' antes do processamento de IA
- Substitui 'Quiz: DeepSeek Avaliar' (HTTP Request manual) por
  OpenAI Chat Model + Basic LLM Chain
- Adiciona 'Quiz: Enviar WhatsApp' no final
"""
import json, uuid

OPENROUTER_CRED_ID = "PREENCHER"

def patch(wf_path, out_path):
    with open(wf_path) as f:
        wf = json.load(f)

    nodes = wf['nodes']
    conns = wf['connections']

    # 1. Encontrar posição dos nós Quiz existentes
    quiz_buscar = next((n for n in nodes if n['name'] == 'Quiz: Buscar Contexto'), None)
    quiz_deepseek = next((n for n in nodes if n['name'] == 'Quiz: DeepSeek Avaliar'), None)
    quiz_processar = next((n for n in nodes if n['name'] == 'Quiz: Processar Resultado'), None)

    if not quiz_buscar:
        print("ERRO: Quiz: Buscar Contexto não encontrado!")
        return False

    base_x = quiz_buscar['position'][0]
    base_y = quiz_buscar['position'][1]

    # 2. Encontrar o nó do Switch que aponta para Quiz: Buscar Contexto
    quiz_source = None
    for src, targets in conns.items():
        for conn_type, lists in targets.items():
            for tlist in lists:
                for t in tlist:
                    if t['node'] == 'Quiz: Buscar Contexto':
                        quiz_source = src

    print(f"Quiz source: {quiz_source}")

    # 3. Inserir 'Quiz: Responder 200' entre o Switch e 'Quiz: Buscar Contexto'
    node_responder_200 = {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify({ ok: true, response: 'Avaliando suas respostas... ✅ Resultado em instantes!' }) }}",
            "options": {}
        },
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [base_x - 200, base_y],
        "id": "quiz-responder-200",
        "name": "Quiz: Responder 200"
    }

    # 4. Substituir DeepSeek HTTP Request por LLM Chain nativo
    # Remover o nó DeepSeek
    if quiz_deepseek:
        nodes = [n for n in nodes if n['name'] != 'Quiz: DeepSeek Avaliar']
        if 'Quiz: DeepSeek Avaliar' in conns:
            del conns['Quiz: DeepSeek Avaliar']

    quiz_chat_model = {
        "parameters": {
            "model": "deepseek/deepseek-chat",
            "options": {"temperature": 0.3}
        },
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1.2,
        "position": [base_x + 400, base_y + 100],
        "id": "quiz-chat-model",
        "name": "Quiz: Chat Model",
        "credentials": {
            "openAiApi": {"id": OPENROUTER_CRED_ID, "name": "OpenRouter"}
        }
    }

    quiz_llm_chain = {
        "parameters": {
            "prompt": {
                "messages": [{"message": "={{ $('Quiz: Prompt Avaliar').first().json.prompt }}"}]
            },
            "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.chainLlm",
        "typeVersion": 1.4,
        "position": [base_x + 400, base_y],
        "id": "quiz-llm-chain",
        "name": "Quiz: AI Avaliar",
        "continueOnFail": True
    }

    # HTTP Request para enviar resultado WhatsApp
    quiz_enviar_wpp = {
        "parameters": {
            "method": "POST",
            "url": "=https://evolution.extensionista.site/message/sendText/europs",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "apikey", "value": "={{ $env.EVOLUTION_API_KEY || '' }}"}]
            },
            "sendBody": True,
            "contentType": "json",
            "body": {
                "number": "={{ $('Quiz: Buscar Contexto').first().json.phone || '' }}@s.whatsapp.net",
                "textMessage": {
                    "text": "={{ '📊 *Resultado do Quiz*\\n\\nNota: ' + ($('Quiz: Processar Resultado').first().json.score || 0) + '/100\\n\\n' + ($('Quiz: Processar Resultado').first().json.feedback || 'Avaliação concluída.') }}"
                }
            },
            "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [base_x + 800, base_y],
        "id": "quiz-enviar-wpp",
        "name": "Quiz: Enviar WhatsApp",
        "continueOnFail": True
    }

    new_nodes = [node_responder_200, quiz_chat_model, quiz_llm_chain, quiz_enviar_wpp]
    nodes.extend(new_nodes)

    # 5. Reconectar: Switch → Responder 200 → Buscar Contexto
    if quiz_source:
        for conn_type, lists in conns[quiz_source].items():
            for i, tlist in enumerate(lists):
                for j, t in enumerate(tlist):
                    if t['node'] == 'Quiz: Buscar Contexto':
                        conns[quiz_source][conn_type][i][j]['node'] = 'Quiz: Responder 200'

    conns["Quiz: Responder 200"] = {
        "main": [[{"node": "Quiz: Buscar Contexto", "type": "main", "index": 0}]]
    }

    # 6. Reconectar: Quiz: Prompt Avaliar → Quiz: AI Avaliar (em vez de DeepSeek)
    # Encontrar o nó que apontava para DeepSeek e redirecionar para AI Avaliar
    for src, targets in list(conns.items()):
        for conn_type, lists in targets.items():
            for i, tlist in enumerate(lists):
                for j, t in enumerate(tlist):
                    if t.get('node') == 'Quiz: DeepSeek Avaliar':
                        conns[src][conn_type][i][j]['node'] = 'Quiz: AI Avaliar'

    # Sub-node: Chat Model conecta ao LLM Chain
    conns["Quiz: Chat Model"] = {
        "ai_languageModel": [[{"node": "Quiz: AI Avaliar", "type": "ai_languageModel", "index": 0}]]
    }

    # AI Avaliar → Processar Resultado
    conns["Quiz: AI Avaliar"] = {
        "main": [[{"node": "Quiz: Processar Resultado", "type": "main", "index": 0}]]
    }

    # 7. Após Quiz: Atualizar Progresso → Enviar WhatsApp (em vez de Responder Typebot)
    # Encontrar o que vinha após Atualizar Progresso
    if 'Quiz: Atualizar Progresso' in conns:
        # Adicionar também o Enviar WhatsApp
        conns['Quiz: Atualizar Progresso']['main'] = [
            [{"node": "Quiz: Enviar WhatsApp", "type": "main", "index": 0}]
        ]

    wf['nodes'] = nodes
    wf['connections'] = conns

    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
        'staticData': wf.get('staticData', None)
    }

    with open(out_path, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"Patch submit_quiz aplicado. Total nós: {len(nodes)}")
    return True

if __name__ == '__main__':
    # Usar o workflow JÁ modificado pela Task 3
    ok = patch('/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json', '/tmp/ultimate_quiz_async.json')
    if ok:
        print("\nProximo: PUT para N8N e testar")
```

### Step 4: Rodar o patch e enviar para N8N

```bash
# Substituir PREENCHER com ID real antes de rodar
python3 /tmp/patch_submit_quiz.py

export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/ultimate_quiz_async.json \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Nodes: {len(r.get(\"nodes\",[])) }')"

curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA/activate" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Active: {r.get(\"active\")}')"
```

### Step 5: Testar submit_quiz async

```bash
MODULE_ID=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT id FROM modules WHERE module_number=2 LIMIT 1;" -t | tr -d ' \n')

echo "=== submit_quiz async (deve responder < 2s) ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"556399374165\",
    \"action\": \"submit_quiz\",
    \"module_id\": \"$MODULE_ID\",
    \"answers\": [\"A documentação rural é importante para registro\"]
  }" \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
```

**Expected:** `{"ok": true, "response": "Avaliando suas respostas... ✅ Resultado em instantes!"}` em < 2s

### Step 6: Exportar e commit

```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json

cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): submit_quiz async — responder 200 imediato + Basic LLM Chain + Evolution direct"
```

---

## Task 5: Implementar `get_module` com Retorno Parcial + Quiz Assíncrono

Diferente dos outros: `get_module` responde com `title` e `content` sincronamente (dados SQL, fast), e o quiz gerado por IA chega depois via WhatsApp.

**Arquivos:**
- Modify: `n8n-workflows/60-kreativ-api-ultimate.json`

### Step 1: Identificar os nós Module: * atuais

```bash
python3 -c "
import json
wf = json.load(open('/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json'))
module_nodes = [n for n in wf['nodes'] if 'Module' in n['name']]
for n in module_nodes:
    print(f'  [{n[\"type\"].split(\".\")[-1]}] {n[\"name\"]}')
"
```

### Step 2: Criar script de patch para get_module

Criar `/tmp/patch_get_module.py`:

```python
#!/usr/bin/env python3
"""
Patch get_module no ULTIMATE:
- Mover respondToWebhook para APÓS Module: Buscar Dados (retorna title+content imediatamente)
- Substituir Module: DeepSeek Generate Quiz por Basic LLM Chain nativo
- Adicionar Module: Enviar Quiz (HTTP Request Evolution)
"""
import json

OPENROUTER_CRED_ID = "PREENCHER"

def patch(wf_path, out_path):
    with open(wf_path) as f:
        wf = json.load(f)

    nodes = wf['nodes']
    conns = wf['connections']

    mod_buscar = next((n for n in nodes if n['name'] == 'Module: Buscar Dados'), None)
    mod_deepseek = next((n for n in nodes if n['name'] == 'Module: DeepSeek Generate Quiz'), None)
    mod_finalizar = next((n for n in nodes if n['name'] == 'Module: Finalizar Dados'), None)

    if not mod_buscar:
        print("ERRO: Module: Buscar Dados não encontrado!")
        return False

    base_x = mod_buscar['position'][0]
    base_y = mod_buscar['position'][1]

    # 1. Nó respondToWebhook com title + content (resposta síncrona rápida)
    node_responder_200 = {
        "parameters": {
            "respondWith": "json",
            "responseBody": """={{ JSON.stringify({
  ok: true,
  title: $json.title || '',
  content: $json.content_text || $json.syllabus || '',
  module_number: $json.module_number || 0,
  response: 'Quiz sendo gerado... 📚'
}) }}""",
            "options": {}
        },
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [base_x + 200, base_y],
        "id": "module-responder-200",
        "name": "Module: Responder 200"
    }

    # 2. Substituir DeepSeek por LLM Chain nativo
    if mod_deepseek:
        nodes = [n for n in nodes if n['name'] != 'Module: DeepSeek Generate Quiz']
        if 'Module: DeepSeek Generate Quiz' in conns:
            del conns['Module: DeepSeek Generate Quiz']

    mod_chat_model = {
        "parameters": {
            "model": "deepseek/deepseek-chat",
            "options": {"temperature": 0.5}
        },
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
        "typeVersion": 1.2,
        "position": [base_x + 600, base_y + 100],
        "id": "module-chat-model",
        "name": "Module: Chat Model",
        "credentials": {
            "openAiApi": {"id": OPENROUTER_CRED_ID, "name": "OpenRouter"}
        }
    }

    mod_llm_chain = {
        "parameters": {
            "prompt": {
                "messages": [{"message": "={{ $('Module: Prompt AI Quiz').first().json.prompt }}"}]
            },
            "options": {}
        },
        "type": "@n8n/n8n-nodes-langchain.chainLlm",
        "typeVersion": 1.4,
        "position": [base_x + 600, base_y],
        "id": "module-llm-chain",
        "name": "Module: AI Gerar Quiz",
        "continueOnFail": True
    }

    mod_enviar_wpp = {
        "parameters": {
            "method": "POST",
            "url": "=https://evolution.extensionista.site/message/sendText/europs",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [{"name": "apikey", "value": "={{ $env.EVOLUTION_API_KEY || '' }}"}]
            },
            "sendBody": True,
            "contentType": "json",
            "body": {
                "number": "={{ $json.phone || '' }}@s.whatsapp.net",
                "textMessage": {
                    "text": "={{ '📝 *Quiz: ' + ($('Module: Buscar Dados').first().json.title || 'Módulo') + '*\\n\\n' + ($json.text || $json.output || 'Quiz gerado!') }}"
                }
            },
            "options": {}
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [base_x + 800, base_y],
        "id": "module-enviar-wpp",
        "name": "Module: Enviar Quiz",
        "continueOnFail": True
    }

    new_nodes = [node_responder_200, mod_chat_model, mod_llm_chain, mod_enviar_wpp]
    nodes.extend(new_nodes)

    # 3. Inserir Responder 200 APÓS Module: Buscar Dados
    if 'Module: Buscar Dados' in conns:
        old_target = conns['Module: Buscar Dados']['main'][0][0]['node'] if conns['Module: Buscar Dados'].get('main') else None
        conns['Module: Buscar Dados']['main'] = [[{"node": "Module: Responder 200", "type": "main", "index": 0}]]
        if old_target:
            conns['Module: Responder 200'] = {
                "main": [[{"node": old_target, "type": "main", "index": 0}]]
            }

    # 4. Reconectar: nó que apontava para DeepSeek → AI Gerar Quiz
    for src, targets in list(conns.items()):
        for conn_type, lists in targets.items():
            for i, tlist in enumerate(lists):
                for j, t in enumerate(tlist):
                    if t.get('node') == 'Module: DeepSeek Generate Quiz':
                        conns[src][conn_type][i][j]['node'] = 'Module: AI Gerar Quiz'

    conns['Module: Chat Model'] = {
        "ai_languageModel": [[{"node": "Module: AI Gerar Quiz", "type": "ai_languageModel", "index": 0}]]
    }
    conns['Module: AI Gerar Quiz'] = {
        "main": [[{"node": "Module: Enviar Quiz", "type": "main", "index": 0}]]
    }

    wf['nodes'] = nodes
    wf['connections'] = conns
    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': wf.get('settings', {}),
        'staticData': wf.get('staticData', None)
    }

    with open(out_path, 'w') as f:
        json.dump(payload, f, indent=2)

    print(f"Patch get_module aplicado. Total nós: {len(nodes)}")
    return True

if __name__ == '__main__':
    ok = patch('/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json', '/tmp/ultimate_module_async.json')
    if ok:
        print("\nProximo: PUT para N8N e testar")
```

### Step 3: Rodar, enviar, testar

```bash
python3 /tmp/patch_get_module.py

export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/ultimate_module_async.json \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Nodes: {len(r.get(\"nodes\",[])) }')"

curl -s -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA/activate" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Active: {r.get(\"active\")}')"

# Teste
MODULE_ID=$(docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu \
  -c "SELECT id FROM modules WHERE module_number=2 LIMIT 1;" -t | tr -d ' \n')

echo "=== get_module async ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"phone\":\"556399374165\",\"action\":\"get_module\",\"module_id\":\"$MODULE_ID\"}" \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
```

**Expected:** responde com `title` + `content` em < 2s; quiz chega via WhatsApp em ~10s

### Step 4: Exportar e commit

```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows/SoB5evP9aOmj6hLA" | \
  python3 -m json.tool > /root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json

cd /root/ideias_app
git add n8n-workflows/60-kreativ-api-ultimate.json
git commit -m "feat(n8n): get_module async — title+content síncrono + quiz gerado via LLM Chain + Evolution"
```

---

## Task 6: Atualizar Typebot (`build_typebot.py`)

O Typebot precisa parar de esperar resposta do webhook `ai_tutor` (e opcionalmente `submit_quiz` e `get_module`).

**Arquivos:**
- Modify: `scripts/build_typebot.py`

### Step 1: Localizar o bloco ai_tutor no build_typebot.py

```bash
grep -n "ai_tutor\|responseVariableMapping\|ai_response" /root/ideias_app/scripts/build_typebot.py | head -30
```

### Step 2: Entender a estrutura atual do webhook de ai_tutor

```bash
python3 -c "
import ast, inspect
with open('/root/ideias_app/scripts/build_typebot.py') as f:
    content = f.read()

# Encontrar a seção que menciona ai_tutor
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'ai_tutor' in line.lower():
        print(f'Line {i+1}: {line}')
" 2>/dev/null || grep -n -A5 -B5 "ai_tutor" /root/ideias_app/scripts/build_typebot.py
```

### Step 3: Remover responseVariableMapping do bloco ai_tutor

A mudança específica em `build_typebot.py`:

Localizar o dict/objeto que define o webhook `ai_tutor` e:
1. Remover `responseVariableMapping` (ou esvaziar o array: `[]`)
2. O texto de resposta do Typebot após o webhook deve ser estático:
   ```
   "Seu tutor responderá em instantes! 📱\n(A resposta chegará nesta conversa)"
   ```

Exemplo do tipo de mudança esperada (adaptar à estrutura real do arquivo):
```python
# ANTES:
"webhook_ai_tutor": {
    ...
    "responseVariableMapping": [
        {"variableId": "var_ai_response", "bodyPath": "data.response"}
    ]
}

# DEPOIS:
"webhook_ai_tutor": {
    ...
    "responseVariableMapping": []
}
```

### Step 4: Rebuild e redeploy do Typebot

```bash
cd /root/ideias_app
python3 scripts/build_typebot.py
echo "Typebot rebuiltado"

# Verificar que o bot está acessível
curl -s "https://bot.extensionista.site/api/typebots/vnp6x9bqwrx54b2pct5dhqlb" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'Bot: {r.get(\"typebot\",{}).get(\"name\")}')" 2>/dev/null || echo "Bot URL não disponível via API pública"
```

### Step 5: Commit

```bash
cd /root/ideias_app
git add scripts/build_typebot.py
git commit -m "feat(typebot): remover responseVariableMapping do ai_tutor — webhook agora é fire-and-forget"
```

---

## Task 7: Smoke Test Final Completo

### Step 1: Verificar todos os workflows ativos

```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' /root/ideias_app/.env | cut -d'=' -f2 | tr -d '"')
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/workflows?limit=100" | \
  python3 -c "
import json,sys
wfs = json.load(sys.stdin)
active = [w for w in wfs['data'] if w['active']]
print(f'Workflows ativos: {len(active)}')
for w in active: print(f'  ✅ {w[\"name\"]}')
"
```

### Step 2: Smoke tests de todas as ações

```bash
echo "=== 1. check_student (sync, deve ser instantâneo) ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"check_student"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'status={r.get(\"status\")} module={r.get(\"current_module\")}')"

echo ""
echo "=== 2. get_progress (sync) ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"get_progress"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'pct={r.get(\"completion_pct\")}%')"

echo ""
echo "=== 3. ai_tutor (async — deve responder < 2s) ==="
time curl -s -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165","action":"ai_tutor","message":"Resumo do módulo?"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api" | \
  python3 -c "import json,sys; r=json.load(sys.stdin); print(f'ok={r.get(\"ok\")} status={r.get(\"response\",\"\")[:50]}')"

echo ""
echo "=== 4. Payload inválido → 400 ==="
curl -s -o /dev/null -w "HTTP %{http_code}" -X POST -H "Content-Type: application/json" \
  -d '{"phone":"556399374165"}' \
  "https://n8n.extensionista.site/webhook/kreativ-unified-api"
```

### Step 3: Verificar execuções recentes no N8N

```bash
sleep 20  # aguardar todas as execuções async completarem
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.extensionista.site/api/v1/executions?workflowId=SoB5evP9aOmj6hLA&limit=10" | \
  python3 -c "
import json,sys; r=json.load(sys.stdin)
for e in r['data'][:5]:
    last = e.get('data',{}).get('resultData',{}).get('lastNodeExecuted','?')
    print(f'Exec {e[\"id\"]} | Status: {e[\"status\"]} | Last: {last}')
"
```

### Step 4: Commit final e push

```bash
cd /root/ideias_app
git log --oneline -5
git push origin main
```

---

## Fallback: Se LangChain Nodes Não Estiverem Disponíveis

Se a Task 1 revelar que os nós `@n8n/n8n-nodes-langchain.*` **não** estão instalados, usar este design alternativo mantendo o benefício principal (async):

**ai_tutor fallback:**
```
respondToWebhook(200)
  → Code: Redis Read History (TCP raw — reutilizar código do sub-workflow)
  → PostgreSQL: Buscar Contexto (mesmo SQL)
  → Code: Montar prompt
  → HTTP Request: DeepSeek (api.deepseek.com, timeout 120s)
  → Code: Extrair resposta
  → Code: Redis Write History (TCP raw)
  → HTTP Request: Evolution API sendText
```

O ganho permanece: **o Typebot não bloqueia** mesmo sem os nós nativos.

---

## Referências

- Design doc: `docs/plans/2026-02-22-n8n-async-redesign.md`
- ULTIMATE ID: `SoB5evP9aOmj6hLA`
- Sub-workflow ID: `5caL67H387euTxan`
- Evolution instância: `europs`
- PostgreSQL hostname: `kreativ_postgres` (NÃO `postgres`)
- Redis hostname: `kreativ_redis`
- Typebot bot ID: `vnp6x9bqwrx54b2pct5dhqlb`
- Build script: `scripts/build_typebot.py`
