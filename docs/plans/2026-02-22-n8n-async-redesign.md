# Kreativ N8N — Design: Modernização Assíncrona com Nós Nativos
> **Data:** 2026-02-22
> **Status:** Aprovado — aguardando implementação
> **Autor:** Sessão de brainstorming Claude Sonnet 4.6

---

## 1. Problema

O fluxo atual do ULTIMATE usa chamadas síncronas ao DeepSeek com timeout de 120s, bloqueando
o webhook do Typebot. Isso causa:

- `Problem in node 'AI Tutor: Proxy Request'` — timeout no executeWorkflow
- Falhas de `list_reply` no WhatsApp (Evolution API encerra a conexão antes da resposta)
- Sub-workflow com `respondToWebhook` que falha em contexto `executeWorkflow`
- Redis implementado via TCP raw (frágil, não-padrão)

**Custo zero atual dos nós afetados:** Code, HTTP Request, Execute Workflow — todos gratuitos.
O custo é de API (DeepSeek). A modernização não adiciona custo.

---

## 2. Decisões de Design

| Decisão | Escolha | Justificativa |
|---|---|---|
| Padrão de resposta | **Async** | `respondToWebhook` libera o Typebot antes da IA processar |
| Memória de conversa | **Window Buffer Memory** nativo | Substitui TCP Redis raw, gerencia janela de tokens |
| Provider LLM | **OpenAI Chat Model + OpenRouter** | Custo igual (mesmo modelo), troca de provider pelo UI |
| Escopo | **ai_tutor + submit_quiz + get_module** | As 3 ações com chamadas DeepSeek de alta latência |
| Infra | **Sem mudança** | Redis + PostgreSQL + Evolution API já existem |

---

## 3. Insight Arquitetural Chave

No N8N, o nó `Respond to Webhook` **não encerra a execução**. Ele possui uma saída que
continua o workflow após enviar a resposta HTTP. Isso permite:

```
Typebot webhook POST
  → ULTIMATE recebe
  → Switch → ai_tutor case
  → [Respond to Webhook 200] ← libera Typebot imediatamente
         ↓ (execução continua aqui)
  → AI Agent processa em background
  → HTTP Request → Evolution API (WhatsApp direto ao aluno)
```

---

## 4. Nodes N8N: Custo Zero (referência)

| Node | Tipo | Custo |
|---|---|---|
| Respond to Webhook | Trigger/Response | Zero |
| Edit Fields (Set) | Data manipulation | Zero |
| Code | JS/Python local | Zero |
| HTTP Request | Network | Zero (custo é da API de destino) |
| OpenAI Chat Model | LLM connector | Zero (custo é da API de IA) |
| Window Buffer Memory | Memory | Zero (Redis é o backend) |
| AI Agent | LangChain orchestrator | Zero |
| PostgreSQL | Database | Zero |
| Execute Workflow | Sub-process | Zero |
| Error Trigger | Fault tolerance | Zero |

---

## 5. Design por Action

### 5.1 `ai_tutor` — Multi-turn com Memória

```
Switch (ai_tutor)
  ↓
[Nó 1] AI Tutor: Extrair Input
  type: Edit Fields (Set)
  → phone: {{ $json.phone }}
  → message: {{ $json.message || $json.body || 'Olá' }}

  ↓
[Nó 2] AI Tutor: Responder 200
  type: Respond to Webhook
  → { "ok": true, "response": "Seu tutor está analisando... 🤔" }

  ↓
[Nó 3] AI Tutor: Buscar Contexto
  type: PostgreSQL
  → Combined Context Query (reutilizar SQL do sub-workflow existente):
    - module_data: title, content_text as syllabus, evaluation_rubric
    - fewshot_data: training_memory (últimos 3 exemplos)
    - rag_chunks: document_chunks JOIN modules (top 5 por chunk_index)

  ↓
[Nó 4] AI Tutor: Preparar Sistema
  type: Edit Fields (Set)
  → systemMessage: string composta com curso, módulo, syllabus, rag_context, rubric

  ↓
[Nó 5] AI Tutor: Chat Model    [sub-nó conectado ao Agent]
  type: OpenAI Chat Model (n8n-nodes-langchain.lmChatOpenAi)
  → Credential: "OpenRouter" (tipo OpenAI, base URL: https://openrouter.ai/api/v1)
  → Model: deepseek/deepseek-chat
  → Temperature: 0.7

[Nó 6] AI Tutor: Memória       [sub-nó conectado ao Agent]
  type: Window Buffer Memory (n8n-nodes-langchain.memoryBufferWindow)
  → Session Key: {{ $('AI Tutor: Extrair Input').first().json.phone }}
  → Context Window Length: 10 (5 trocas)
  → Backend: Redis (credencial existente kreativ_redis)

  ↓
[Nó 7] AI Tutor: Agent
  type: AI Agent (n8n-nodes-langchain.agent)
  → Chat Model: [Nó 5]
  → Memory: [Nó 6]
  → System Message: {{ $('AI Tutor: Preparar Sistema').first().json.systemMessage }}
  → Human Message: {{ $('AI Tutor: Extrair Input').first().json.message }}
  → continueOnFail: true

  ↓              ↓ (erro)
[normal]    [Nó 7b] AI Tutor: Fallback
              type: Edit Fields (Set)
              → output: "Desculpe, o tutor está indisponível. Tente em instantes! 🔧"

  ↓
[Nó 8] AI Tutor: Enviar WhatsApp
  type: HTTP Request
  → POST https://evolution.extensionista.site/message/sendText/europs
  → Headers: { "apikey": "{{ $env.EVOLUTION_API_KEY }}" }
  → Body: {
      "number": "{{ $('AI Tutor: Extrair Input').first().json.phone }}@s.whatsapp.net",
      "textMessage": { "text": "{{ $json.output }}" }
    }
```

**Remoção:** `AI Tutor: Proxy Request` (executeWorkflow) → eliminado

---

### 5.2 `submit_quiz` — Single-turn (sem memória de conversa)

```
Switch (submit_quiz)
  ↓
[Nó 1] Quiz: Responder 200
  type: Respond to Webhook
  → { "ok": true, "response": "Avaliando suas respostas... ✅ Resultado em instantes!" }

  ↓
[Nó 2] Quiz: Buscar Contexto  ← existente, manter
  type: PostgreSQL
  → SELECT content FROM document_chunks WHERE module_id = $1

  ↓
[Nó 3] Quiz: Chat Model
  type: OpenAI Chat Model
  → Credential: "OpenRouter"
  → Model: deepseek/deepseek-chat
  → Temperature: 0.3 (mais determinístico para avaliação)

  ↓
[Nó 4] Quiz: AI Avaliar
  type: Basic LLM Chain (n8n-nodes-langchain.chainLlm)
  → LLM: [Nó 3]
  → Prompt: montado pelo "Quiz: Prompt Avaliar" (Code node existente)
  → Output Parser: JSON (espera { score, passed, feedback, next_module })

  ↓
[Nó 5] Quiz: Processar Resultado  ← existente, manter
  type: Code
  → extrai score + feedback da resposta

  ↓
[Nó 6] Quiz: Atualizar Progresso  ← existente, manter
  type: PostgreSQL
  → INSERT/UPDATE enrollment_progress

  ↓
[Nó 7] Quiz: Enviar Resultado
  type: HTTP Request → Evolution API sendText
  → "📊 *Resultado do Quiz*\n\nNota: {score}/100\n\n{feedback}"
  → Se passed=true: "\n\n✅ Aprovado! Próximo módulo: {next_module}"
  → Se passed=false: "\n\n📚 Continue estudando e tente novamente!"
```

**Substituição:** `Quiz: DeepSeek Avaliar` (HTTP Request manual) → `Quiz: AI Avaliar` (Basic LLM Chain)

---

### 5.3 `get_module` — Retorno parcial síncrono + quiz assíncrono

```
Switch (get_module)
  ↓
[Nó 1] Module: Buscar Dados  ← existente, manter
  type: PostgreSQL

  ↓
[Nó 2] Module: Responder 200
  type: Respond to Webhook
  → {
      "ok": true,
      "title": "{{ $json.title }}",
      "content": "{{ $json.content_text }}",
      "module_number": {{ $json.module_number }},
      "response": "Quiz sendo gerado... 📚"
    }
  ← Typebot recebe title + content IMEDIATAMENTE

  ↓ (continua em background)
[Nó 3] Module: Chat Model
  type: OpenAI Chat Model
  → Credential: "OpenRouter"
  → Model: deepseek/deepseek-chat

[Nó 4] Module: AI Gerar Quiz
  type: Basic LLM Chain
  → LLM: [Nó 3]
  → Prompt: reutilizar "Module: Prompt AI Quiz" (Code node existente)
  → Output: texto formatado com as perguntas do quiz

  ↓
[Nó 5] Module: Enviar Quiz
  type: HTTP Request → Evolution API sendText
  → "📝 *Quiz do {title}*\n\n{perguntas geradas}"
```

**Substituição:** `Module: DeepSeek Generate Quiz` (HTTP Request manual) → `Module: AI Gerar Quiz` (Basic LLM Chain)

---

## 6. Credenciais Novas (configurar 1x via N8N UI)

| Credencial | Tipo N8N | Parâmetros |
|---|---|---|
| `OpenRouter` | OpenAI API | Base URL: `https://openrouter.ai/api/v1`, API Key: `OPENROUTER_API_KEY` |
| `Redis Kreativ` | Redis | Host: `kreativ_redis`, Port: `6379`, Password: `.env REDIS_PASSWORD` |

*As credenciais de PostgreSQL (`Kreativ PostgreSQL`) e Evolution API já existem.*

---

## 7. Mudança no Typebot (`build_typebot.py`)

Apenas o bloco webhook `ai_tutor` precisa mudar:

| Parâmetro | Antes | Depois |
|---|---|---|
| `responseVariableMapping` | `[{ variableId: "...", bodyPath: "data.response" }]` | `[]` (vazio) |
| Próximo bloco | Text block com `{{ ai_response }}` | Text block estático: `"Seu tutor responderá em instantes! 📱"` |

Os blocos `submit_quiz` e `get_module` também recebem `responseVariableMapping: []` ou simplificado
para apenas capturar os dados síncronos que ainda retornam (ex: `title` e `content` do get_module).

---

## 8. Tratamento de Erros

```
Error Trigger (mFwiM2dZyKeEgKk6) — existente, cobre falhas não tratadas
         ↓
         [DeepSeek gera plano de correção + notifica tutor via WhatsApp]
```

Para o path async especificamente:
- `AI Agent` com `continueOnFail: true` → fallback node envia mensagem de indisponibilidade
- `HTTP Request Evolution` com `continueOnFail: true` → falha silenciosa registrada no execution log

---

## 9. Diagrama de Fluxo Final

```
WhatsApp do aluno
  ↓
Evolution API → Typebot (bot ID: vnp6x9bqwrx54b2pct5dhqlb)
  ↓
Typebot Webhook server-side ("Webhook" capital W)
  ↓
ULTIMATE (SoB5evP9aOmj6hLA) — POST /webhook/kreativ-unified-api
  ↓
Switch por action
  ├─ check_student    → PostgreSQL → respondToWebhook [sync, mantém]
  ├─ get_progress     → PostgreSQL → respondToWebhook [sync, mantém]
  ├─ request_human    → Chatwoot → respondToWebhook [sync, mantém]
  ├─ emit_certificate → PostgreSQL → respondToWebhook [sync, mantém]
  ├─ admin_*          → PostgreSQL → respondToWebhook [sync, mantém]
  │
  ├─ get_module       → PostgreSQL → respondToWebhook(title+content) → OpenAI@OpenRouter → Evolution [NOVO ASYNC]
  ├─ submit_quiz      → respondToWebhook(200) → PostgreSQL → OpenAI@OpenRouter → PostgreSQL → Evolution [NOVO ASYNC]
  └─ ai_tutor         → respondToWebhook(200) → PostgreSQL(contexto) → AIAgent(Memory) → Evolution [NOVO ASYNC]
```

---

## 10. Ordem de Implementação

1. **Criar credenciais N8N** (OpenRouter + Redis) via UI — 5 min
2. **ai_tutor inline** — remover executeWorkflow, adicionar 7 nós novos
3. **Testar ai_tutor** — smoke test + verificar WhatsApp direto
4. **submit_quiz async** — mover respondToWebhook para cima, trocar HTTP Request por Basic LLM Chain
5. **get_module async** — mover respondToWebhook, adicionar Basic LLM Chain
6. **Typebot update** — executar `build_typebot.py` atualizado
7. **Exportar workflows** para o repo (`git commit`)

---

## 11. Arquivos Afetados

```
n8n-workflows/
  60-kreativ-api-ultimate.json     ← principal, 3 paths redesenhados
  20-ai-router-v3-redis-rag.json   ← mantém (pode ser usado standalone)

scripts/
  build_typebot.py                 ← atualizar bloco ai_tutor (+ submit_quiz + get_module)
```
