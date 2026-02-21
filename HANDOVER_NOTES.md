# Handover Técnico: Kreativ Unified API & RAG Architecture

Este documento orienta sobre a reformulação estrutural realizada em Fevereiro de 2026, focada na transição para uma arquitetura **Typebot-Centric** com **n8n como Backend Orquestrador**.

## 🚀 O que mudou? (Modificações)

### 1. Unified API Router (`60-kreativ-api.json`)
Centralizamos todos os webhooks dispersos em um único roteador unificado no endpoint `/webhook/kreativ-unified-api`.
- **Ações implementadas:** `check_student`, `get_module`, `submit_quiz`, `get_progress`, `request_human`, `ai_tutor`, `rag_ingest`.
- **Lógica de Roteamento:** Um nó `Switch` direciona a requisição baseado no campo `action` do JSON recebido.

### 2. Catraca de Estado (Stateful Gatekeeper)
O `check_student` não apenas verifica o aluno, mas retorna um **Objeto de Estado Rico**:
- Retorna `progress_pct`, `is_last_module`, `course_completed` e `first_name`.
- **Impacto:** O Typebot agora é "burro" em lógica e "rico" em contexto, usando essas flags para decidir qual botão mostrar.

### 3. Quiz IA Dinâmico & Avaliação Pedagógica
- **Geração:** O `get_module` invoca o DeepSeek para ler o conteúdo do banco e gerar 3 perguntas inéditas em tempo real.
- **Avaliação:** O `submit_quiz` usa LLM para dar feedback humano ("Você acertou o conceito X, mas esqueceu do detalhe Y") em vez de um simples Certo/Errado.

### 4. Sincronização de Sessão (Handoff)
- A ação `request_human` agora dispara um comando para a **Evolution API** (`/typebot/changeStatus`) definindo o status como `paused`.
- **Resultado:** O bot para de responder automaticamente no WhatsApp enquanto o humano atende no Chatwoot.

### 5. RAG Autogerenciável (Knowledge Ingest)
- Criada a ação `rag_ingest` que permite subir PDFs via chat (Typebot Admin).
- O n8n faz o download, extrai texto, gera **embeddings** (vetores) via DeepSeek e salva no Postgres (`pgvector`).

---

## 💪 Pontos Fortes (Vantagens)

1.  **Escalabilidade de Interface:** Mudar o visual do bot no Typebot não exige mexer no código do n8n.
2.  **Inteligência Contextual:** O Tutor IA (`ai_tutor`) tem acesso ao histórico (Redis), contexto do aluno (Postgres) e manuais técnicos (RAG).
3.  **Manutenção Simplificada:** Apenas um endpoint para configurar no Typebot. Logs centralizados.
4.  **Pedagogia Ativa:** Quizzes dinâmicos evitam que o aluno decore respostas de versões estáticas.

---

## ⚠️ Pontos Fracos (Débitos Técnicos e Riscos)

1.  **Latência de Geração:** A geração do Quiz no `get_module` leva de 5 a 10 segundos. O Typebot **precisa** de uma mensagem de "carregando" para o usuário não achar que travou.
2.  **Dependência de LLM (DeepSeek):** Se a API do DeepSeek cair, a geração de quizzes e o Tutor IA param. Existe um fallback básico, mas é limitado.
3.  **Complexidade do JSON:** O arquivo `60-kreativ-api.json` ficou grande. Edições manuais no JSON exigem cuidado com escapes de string.
4.  **Custo de Tokens:** A ingestão constante de PDFs e geração de embeddings consome créditos da API.

---

## 🛠️ Instruções para o Próximo Agente

- **Para atualizar o Workflow:** Use o comando `curl -d @"n8n-workflows/60-kreativ-api.json"`. O n8n v1 API às vezes falha com `PUT` se o workflow estiver ativo; prefira deletar e recriar (`POST`) se houver erro 400.
- **Segurança:** A chave do DeepSeek está hardcoded em alguns nós por compatibilidade legado. Recomenda-se mover para `Credentials` do n8n ou variáveis de ambiente.
- **Tabela RAG:** A busca semântica no `ai_tutor` depende da tabela `document_chunks`. Se os resultados forem irrelevantes, verifique a qualidade dos chunks no `rag_ingest`.
