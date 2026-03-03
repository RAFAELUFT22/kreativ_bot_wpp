# Roadmap Arquitetural: Integração WhatsApp, IA Educacional e Frappe LMS

Este roadmap define os passos para transformar a experiência passiva do portal LMS em uma jornada de aprendizado ativa, conversacional e onipresente via WhatsApp, orquestrada pelo **n8n**, conectada à **Evolution API**, e alimentada por **Agentes de IA**.

---

## 🎯 Visão Geral da Arquitetura

A nova stack conectará três pilares:
1. **Frontend Conversacional:** WhatsApp (via Evolution API).
2. **Cérebro e Orquestração:** n8n + Agentes de IA (RAG com LangChain/Redis).
3. **Backend Acadêmico:** Frappe LMS (Headless mode via REST API).

---

## 🗺️ Fases de Implementação

### Fase 1: Fundação do Gateway Conversacional (n8n + Evolution API)
**Objetivo:** Estabelecer a comunicação bidirecional confiável entre o WhatsApp do produtor rural e o orquestrador n8n.
*   **Ação 1.1:** Configurar Webhooks na Evolution API apontando para o n8n.
*   **Ação 1.2:** Criar o fluxo de roteamento principal no n8n (`20-ai-adaptive-router.json`). Ele deve classificar se a intenção do usuário é "Dúvida de Conteúdo", "Matrícula" ou "Fazer Quiz".
*   **Ação 1.3:** Implementar sistema de sessão e memória do usuário (Redis) para o bot lembrar em qual curso e lição o aluno está.

### Fase 2: O Tutor de IA (RAG + Contexto do LMS)
**Objetivo:** Criar um chatbot inteligente capaz de tirar dúvidas sobre o conteúdo exato que está no Frappe LMS.
*   **Ação 2.1:** Script de Sincronismo de Embeddings. Um fluxo no n8n ou Python que lê as lições do Frappe LMS (via API) e envia para um banco vetorial (Pinecone/Redis).
*   **Ação 2.2:** Desenvolver o Agent Tool "Tutor" no n8n. Quando o aluno perguntar "Qual a altura de saída do pasto Mombaça?", a IA busca no RAG (baseado no Capítulo 2 do curso injetado) e responde no WhatsApp.
*   **Ação 2.3:** Proatividade. A IA deve sugerir a próxima aula caso o aluno fique inativo (verificando progresso no LMS).

### Fase 3: Headless LMS e Gestão de Matrícula
**Objetivo:** Permitir que toda a burocracia aconteça sem o aluno abrir o portal.
*   **Ação 3.1:** Fluxo de Descoberta. Aluno manda: "Quais cursos vocês têm?". n8n faz `GET /api/resource/LMS Course` e lista no WhatsApp com botões interativos.
*   **Ação 3.2:** Fluxo de Inscrição. Aluno clica em "Quero fazer". n8n faz `POST` no Frappe para criar o `User` (se não existir) e gera o pedido no `LMS Batch`.
*   **Ação 3.3:** Notificação de Aprovação. Quando você (admin) aprovar no Frappe, um webhook avisa o n8n, que manda mensagem: "Sua matrícula foi aprovada! Vamos começar o Módulo 1?".

### Fase 4: O Santo Graal — Sincronismo de Quizzes (WhatsApp ↔ Frappe)
**Objetivo:** O aluno responde o quiz diretamente no WhatsApp e a nota vai para o Frappe, gerando o certificado.
*   **Ação 4.1:** Extração do Quiz. n8n busca o `LMS Quiz` via API e formata como uma Lista Interativa do WhatsApp (Evolution API).
*   **Ação 4.2:** Motor de Avaliação no n8n. O fluxo recebe a resposta (ex: A, B, C), valida com o gabarito (escondido no n8n ou IA) e dá o feedback instantâneo: "✅ Correto!" ou "❌ Incorreto, veja por que...".
*   **Ação 4.3:** Injeção de Resultado no LMS. Após o fim das perguntas, o n8n cria um registro no `LMS Quiz Submission` e/ou `LMS Quiz Result` no Frappe, garantindo a rastreabilidade acadêmica.
*   **Ação 4.4:** Emissão de Certificado Automático. Se aprovado, n8n aciona o Frappe para gerar o PDF e envia o arquivo do certificado direto no WhatsApp.

---

## 🛠️ Stack Tecnológica Envolvida

| Componente | Ferramenta | Papel |
| :--- | :--- | :--- |
| **Mensageria** | Evolution API | Disparar mensagens, botões e listas interativas no WhatsApp. |
| **Orquestrador** | n8n | Fluxos lógicos, webhooks, roteamento e requisições HTTP. |
| **Inteligência** | OpenAI / DeepSeek | Compreensão de linguagem natural e RAG (Tutor). |
| **Memória Vetorial**| Redis / Pinecone | Armazenar os blocos Editor.js das lições para busca da IA. |
| **Motor EAD** | Frappe LMS | Fonte da verdade acadêmica (Cursos, Alunos, Turmas, Quizzes, Notas). |

---

## 🚀 Próximos Passos Imediatos (Para Iniciarmos Agora)

1. **Desenvolver o "Roteador Inteligente" no n8n:** Criar o webhook que recebe a mensagem da Evolution API e decide se é bate-papo com o tutor ou resposta de quiz.
2. **Mapear a Injeção de Submissão de Quiz:** Validar via Python/API como enviar um `LMS Quiz Submission` válido para o Frappe, para termos certeza da viabilidade do Passo 4.3.
