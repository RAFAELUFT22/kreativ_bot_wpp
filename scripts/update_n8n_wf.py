import json
import os

path = '/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json'
with open(path, 'r') as f:
    wf = json.load(f)

# 1. Update Quiz: Prompt Avaliar node
for node in wf['nodes']:
    if node['name'] == 'Quiz: Prompt Avaliar':
        node['parameters']['jsCode'] = """const input = $('Normalizar Input').first().json;
const ctx = $json;

const sysPrompt = `Você é um avaliador pedagógico da Kreativ Educação.
Avalie a resposta do aluno ao módulo "${ctx.title}".

O aluno recebeu 3 perguntas e respondeu em texto livre.
Compare a resposta do aluno com o conteúdo do módulo e verifique se ele demonstrou entendimento.

Critérios:
- Analise a compreensão dos conceitos
- Atribua score de 0 a 100
- Feedback construtivo em português (máximo 3 frases)
- Se o aluno não soube responder, incentive a revisão

Retorne APENAS JSON: {"score": número, "feedback": "texto"}`;

const userMsg = `RESPOSTA DO ALUNO:\\n${input.answers || '(sem resposta)'}`;

return [{ json: {
  ...ctx,
  input,
  dsMessages: [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: userMsg }
  ]
} }];"""

# 2. Add/Update Admin routes in switch if needed (they seem to be there)

with open(path, 'w') as f:
    json.dump(wf, f, indent=2)
print("Updated n8n workflow JSON successfully.")
