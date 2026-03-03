import sys
import json
import requests
import os
import subprocess

API_KEY = "sk-412552782fbe4009a25a013825e6ab66"

SYSTEM_PROMPT = """Você é um assistente especializado em criar fluxos para o Typebot V6 via JSON.
Você deve gerar o JSON EXATO que obedece estritamente ao schema do Typebot V6.

Regras Cruciais:
1. Raiz: Deve conter {"groups": [], "variables": [], "edges": [], "events": []}.
2. Grupo Inicial: O PRIMEIRO grupo (groups[0]) DEVE obrigatoriamente conter um bloco do tipo "start".
3. Edges (Conexões): O campo "to" de cada edge DEVE conter obrigatoriamente um "groupId". NUNCA aponte um edge diretamente para um "blockId" no destino. Se quiser ir para um bloco específico, aponte para o grupo que o contém.
4. Coordenadas: TODO grupo e TODO evento DEVE ter "graphCoordinates": {"x": number, "y": number}.
5. Blocos de Texto: O conteúdo deve seguir este formato exato:
   "content": {"richText": [{"type": "p", "children": [{"text": "Sua mensagem aqui"}]}]}
6. Tipos de Bloco:
   - Entrada de texto: "type": "text input" (com variableId em options)
   - Escolha/Botões: "type": "choice input" (com "items": [{"id": "item1", "content": "Opção"}] e outgoingEdgeId em cada item ou no bloco)
   - Webhook: "type": "Webhook" (W maiúsculo para server-side)
   - Lógica: "type": "Condition" (C maiúsculo)
7. Variáveis: Declare todas as variáveis usadas em "variables": [{"id": "var_id", "name": "nome_var"}].
8. Evento Inicial: O primeiro item em "events" deve ser {"id": "start", "type": "start", "graphCoordinates": {"x": -400, "y": 0}, "outgoingEdgeId": "edge_from_start"}.

Retorne APENAS o JSON puro, sem markdown ou explicações.
"""

def generate_flow(prompt, output_file):
    print("🤖 Generative AI: Solicitando criação do fluxo Typebot para o DeepSeek...")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Por favor crie um fluxo Typebot simples com base neste pedido: {prompt}"}
        ],
        "response_format": {"type": "json_object"}
    }
    
    response = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=data)
    
    if response.status_code != 200:
        print(f"Erro na API DeepSeek: {response.text}")
        sys.exit(1)
        
    result = response.json()
    content = result["choices"][0]["message"]["content"]
    
    # Try parsing JSON
    try:
        json_data = json.loads(content)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Fluxo salvo com sucesso em {output_file}")
    except Exception as e:
        print(f"Erro ao parsear JSON: {e}")
        print("Conteúdo recebido:")
        print(content)
        sys.exit(1)
        
    # Validate
    print("🔍 Validando JSON gerado...")
    validation_cmd = [sys.executable, "scripts/validate_typebot_json.py", output_file]
    proc = subprocess.run(validation_cmd, capture_output=True, text=True)
    
    if proc.returncode == 0:
        print(f"✅ Pipeline validou com sucesso! O fluxo {output_file} está pronto para deploy.")
    else:
        print(f"❌ Erros de validação detectados. O modelo AI errou:")
        print(proc.stdout)
        # Opcional: Aqui poderíamos retroalimentar o erro para a IA corrigir sozinha (auto-healing).
            
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python generate_typebot_flow.py 'Seu prompt descrevendo o fluxo' output_file.json")
        sys.exit(1)
        
    prompt = sys.argv[1]
    out_file = sys.argv[2]
    generate_flow(prompt, out_file)
