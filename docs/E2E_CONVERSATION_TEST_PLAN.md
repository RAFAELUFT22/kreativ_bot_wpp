# Plano de Testes E2E — Conversa WhatsApp

Este plano define os cenários de teste de ponta a ponta para validar a integridade do fluxo conversacional após a migração para a **WhatsApp Cloud API** e a implementação do **N8N Async (v0.4.0)**.

## 🛠️ Ambiente de Teste
- **Número de Teste:** 556399374165 (Rafael)
- **Instância Evolution:** `europs`
- **Bot Typebot:** `kreativ-educacao`
- **N8N Webhook:** `https://n8n.extensionista.site/webhook/kreativ-unified-api`

---

## 📋 Cenários de Teste

### 1. Onboarding e Reconhecimento
- **Ação:** Enviar "Oi" ou "Olá"
- **Esperado:**
    - Bot identifica o aluno pelo telefone.
    - Bot envia mensagem de boas-vindas.
    - Bot apresenta menu principal com **botões interativos** (Cloud API).
- **Validação:** Verificar se o log do N8N mostra a action `check_student` com sucesso.

### 2. Entrega de Conteúdo (Módulo)
- **Ação:** Clicar no botão "Meu Módulo"
- **Esperado:**
    - Bot responde imediatamente: "Buscando seu conteúdo..." (ou similar).
    - Bot envia o título e descrição do módulo.
    - **Async Flow:** Após alguns segundos, bot envia o link do vídeo/texto via Evolution send direto.
- **Validação:** Verificar latência da resposta inicial (< 1s) e recebimento do conteúdo completo.

### 3. Realização de Quiz (IA Evaluation)
- **Ação:** Responder às perguntas do quiz.
- **Esperado:**
    - Bot coleta as respostas.
    - Ao finalizar, envia: "Analisando suas respostas com nossa IA..."
    - **Async Flow:** IA (DeepSeek) avalia e envia o feedback + nota diretamente no WhatsApp.
- **Validação:** Verificar se o feedback da IA é coerente e se o progresso foi atualizado no DB.

### 4. AI Tutor (RAG)
- **Ação:** Enviar uma dúvida técnica (ex: "O que é [conceito do curso]?")
- **Esperado:**
    - Bot responde: "Vou perguntar ao meu tutor IA..."
    - **Async Flow:** IA busca nos `document_chunks` (pgvector) e envia resposta embasada.
- **Validação:** Resposta deve conter informações específicas do material do curso.

### 5. Escala para Humano (Handoff)
- **Ação:** Clicar em "Falar com Humano" ou enviar "Suporte".
- **Esperado:**
    - Bot confirma a transferência.
    - Bot é pausado para aquele aluno (DB `handoff_control`).
    - Ticket é aberto no Chatwoot (Inbox WhatsApp).
- **Validação:** Verificar se mensagens subsequentes NÃO são respondidas pelo bot até que o ticket seja fechado.

---

## 📈 Critérios de Aceitação
- [ ] Todas as respostas iniciais das actions async ocorrem em menos de 1 segundo.
- [ ] Botões interativos aparecem corretamente (não como texto plano).
- [ ] IA envia mensagens complementares sem travar o fluxo do Typebot.
- [ ] Logs do N8N não apresentam erros 500.
