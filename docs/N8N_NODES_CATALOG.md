# Catálogo de Nodes n8n - Otimização Ideas-App

Este documento contém uma seleção técnica dos nodes disponíveis no n8n (baseado na Master List de Fev/2026), filtrados por relevância para o projeto **ideias-app**.

## 1. Inteligência Artificial (LLMs e Agentes)
Nodes essenciais para os fluxos de tutoria adaptativa e análise de sentimentos.

| Node | Tipo | Descrição | Uso Potencial no Projeto |
| :--- | :--- | :--- | :--- |
| **OpenRouter** | **Gateway** | Gateway Unificado de Modelos. | **Estratégia Central:** Ponto único de acesso para múltiplos modelos com fallbacks automáticos. |
| **Anthropic** | Integração | Interface para modelos Claude. | Consumido via OpenRouter para tutorias complexas. |
| **DeepSeek** | Chat Model | Modelo de chat otimizado. | Ideal para raciocínio lógico barato via gateway `deepseek/deepseek-chat`. |
| **Google Gemini** | Integração | Motor multimodal do Google. | Processamento de imagens/áudio dos alunos. |
| **OpenAI** | Integração | Motor GPT-4/DALL-E. | Utilizado via nó nativo mas apontando para endpoint do OpenRouter. |
| **Perplexity** | Integração | Motor de busca com IA. | Pesquisa em tempo real para enriquecer respostas dos tutores. |
| **MCP Client** | AI Tool | Model Context Protocol. | Integração com o novo servidor MCP do projeto. |

### 💡 Estratégia de Gateway (Model Gateway)
A transição de chamadas diretas (DeepSeek) para o **OpenRouter** amadurece a arquitetura do motor cognitivo:

1.  **Resiliência (Fallbacks):** Permite configurar uma lista de modelos (ex: `deepseek-chat` -> `claude-3-haiku`). Se o principal falhar ou estiver lento, o aluno não fica sem resposta.
2.  **Configuração no n8n:**
    *   **Opção Rápida (HTTP Request):** Mudar URL para `https://openrouter.ai/api/v1/chat/completions` e headers `Authorization`.
    *   **Opção Nativa (Recomendada para RAG/V3):** Usar o nó **OpenAI Chat Model**, ajustar o *Base URL* nas credenciais para o OpenRouter e digitar manualmente o modelo (ex: `deepseek/deepseek-chat`).
3.  **Observabilidade:** Métricas consolidadas de custo e latência em um único painel.

## 2. Comunicação e Engajamento
Foco na interface com o aluno via WhatsApp e canais de suporte humano.

| Node | Descrição | Uso Potencial |
| :--- | :--- | :--- |
| **WhatsApp Cloud** | API oficial do WhatsApp. | Migração do Builderbot para infraestrutura oficial. |
| **Chatwoot** | Gestão de atendimento. | Já integrado; essencial para o transbordo humano. |
| **Discord / Slack** | Notificações de equipe. | Alertas automáticos de erro ou novos leads (Lead Scoring). |
| **Telegram** | Bot secundário. | Canal de contingência para suporte técnico. |
| **Twilio** | SMS e Voz. | Recuperação de alunos inativos via SMS ou ligações automáticas. |

## 3. Geração de Documentos e Certificados
Nodes para automatizar a emissão de certificados PDF e HTML.

| Node | Descrição | Uso Potencial |
| :--- | :--- | :--- |
| **HTML to PDF** | Converte HTML/CSS em PDF. | Geração dinâmica dos certificados de conclusão. |
| **DocsAutomator** | Automação de documentos. | Criação de relatórios semanais de desempenho para alunos. |
| **PDF.co** | Edição e extração de PDF. | Leitura de documentos enviados pelos alunos para a RAG. |
| **Cloudinary** | Gestão de imagens. | Hospedagem de imagens geradas por IA para os cursos. |

## 4. Banco de Dados e Infraestrutura
Gestão de progresso, tokens e memória de treinamento.

| Node | Descrição | Uso Potencial |
| :--- | :--- | :--- |
| **Supabase** | Backend as a Service. | Principal DB para progresso e autenticação de tokens. |
| **Postgres** | Banco relacional. | Consultas complexas e analytics (KPIs). |
| **Redis** | Cache e Memória. | Gestão de estado do bot e memória de curto prazo da IA. |
| **Pinecone / Qdrant** | Vector Stores. | Armazenamento de embeddings para a base de conhecimento (RAG). |
| **Airtable** | DB No-code. | Prototipagem rápida de novos módulos pedagógicos. |

## 5. Ferramentas de Desenvolvimento (Core)
Otimização da lógica interna dos workflows.

| Node | Função | Por que usar? |
| :--- | :--- | :--- |
| **Code (Python/JS)** | Execução de scripts. | Lógica customizada de cálculo de notas e validação de tokens. |
| **HTTP Request** | Chamadas de API genéricas. | Integração com o Evolution API ou serviços customizados. |
| **Wait (HITL)** | Human-in-the-loop. | Pausa o fluxo até aprovação humana (ex: emissão de certificado). |
| **Merge / Filter** | Manipulação de dados. | Limpeza de payloads JSON vindos do Chatwoot. |
| **Execute Workflow** | Sub-workflows. | Modularização: separar lógica de IA da lógica de mensageria. |

---
*Gerado por Gemini CLI em 22/02/2026 para suporte à Fase 1 do Roadmap.*
