import sys
import json
import requests
import os
import subprocess

API_KEY = "sk-412552782fbe4009a25a013825e6ab66"

SYSTEM_PROMPT = """Você é um assistente especializado em criar fluxos para o Typebot V3 via JSON API.
Você deve gerar o JSON EXATO que será importado/enviado via PATCH.
O JSON deve obedecer ESTRITAMENTE às seguintes regras:
1. Deve ser um objeto com as chaves "groups", "variables", "edges", e "events".
2. O "groups" DEVE ser uma lista. O PRIMEIRO grupo (groups[0]) DEVE conter um bloco com `"type": "start"`.
3. Todos os blocos do tipo "condição" devem usar "Condition" com a letra C MAIÚSCULA. Exemplo: `{"type": "Condition"}`
4. Todos os blocos do tipo "webhook" devem usar "webhook" com letras minúsculas (nunca "Webhook").
5. Todos os items dentro de blocos de Condition ou Choice devem ter a propriedade `"id"`.
6. O evento inicial (events[0]) deve ser do `"type": "start"`, com um `"id"`, e um `"outgoingEdgeId"`.
7. O edge que sai do evento inicial deve ter `"from": {"eventId": "..."}` em vez de blockId.

Retorne APENAS o JSON. Não retorne texto explicativo ou markdown type. 
Se for usar blocos do tipo "text" (bubble), coloque text dentro de "richText" -> "children" -> "text".
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
