# Lista Mestre de Nodes n8n - Referência de Funções

Este arquivo serve como um dicionário técnico para consulta rápida de funcionalidades que podem otimizar o desenvolvimento do projeto.

## 🚀 Nodes de Alta Otimização (Recomendados)

| Node | Função Principal | Por que otimiza? |
| :--- | :--- | :--- |
| **Code** | Executa JS/Python nativo. | Evita a criação de múltiplos nodes simples; consolida lógica complexa em um só lugar. |
| **HTTP Request** | Conexão com qualquer API. | Permite integrar com Evolution API, Chatwoot e serviços de IA sem esperar por nodes oficiais. |
| **Wait** | Pausa inteligente (Webhook/Tempo). | Essencial para fluxos que dependem de resposta do aluno ou aprovação de tutor. |
| **Execute Workflow** | Chamada de Sub-workflows. | Permite reutilizar a lógica de "Verificação de Token" ou "Envio de Log" em todos os bots. |
| **Edit Fields (Set)** | Manipulação de JSON. | Organiza o payload antes de enviar para o banco de dados ou IA. |

---

## 📋 Lista de Referência (A-Z)

| Nome do Node | Tipo | Descrição/Função |
| :--- | :--- | :--- |
| **1Shot API** | Integration | Interação autônoma com blockchain (EVM). |
| **2Chat** | Regular | Integração multicanal de mensageria. |
| **3Scribe** | Integration | Assistente de escrita e estruturação de conteúdo. |
| **Abstract** | Regular | Verificação de e-mails, IPs e dados de empresas. |
| **Ably** | Integration | Distribuição de dados em tempo real (WebSockets). |
| **Accredible** | Integration | Emissão e gestão de certificados digitais. |
| **ActiveCampaign** | Integration | Automação de marketing e réguas de relacionamento. |
| **Adalo** | Integration | Integração com apps No-code. |
| **Airtable** | Regular | Banco de dados relacional visual e flexível. |
| **AI Scraper** | Integration | Extração de dados de sites usando linguagem natural. |
| **AI Transform** | Core | Transformação de dados usando modelos de linguagem. |
| **Anthropic (Claude)** | Integration | Modelos de IA avançados para pesquisa e escrita. |
| **APITemplate.io** | Integration | Geração automática de imagens, banners e PDFs. |
| **Asana** | Integration | Gestão de tarefas e projetos pedagógicos. |
| **AssemblyAI** | Regular | Transcrição de áudio para texto (Speech-to-Text). |
| **AWS Lambda** | Integration | Execução de código serverless para tarefas pesadas. |
| **AWS S3** | Integration | Armazenamento de arquivos (vídeos de aulas, PDFs). |
| **AWS Textract** | Integration | OCR avançado para extrair dados de documentos. |
| **Bannerbear** | Integration | Automação de design e imagens dinâmicas. |
| **Baserow** | Integration | Alternativa open-source ao Airtable. |
| **Bitly** | Integration | Encurtamento de URLs para rastreamento de cliques de alunos. |
| **Box / Dropbox** | Integration | Gestão de arquivos e documentos de suporte. |
| **Bubble** | Integration | Conector para webapps complexos no-code. |
| **Calendly** | Regular | Agendamento automático de mentorias/tutorias. |
| **Chatbase** | Integration | Criação de chatbots personalizados treinados em dados próprios. |
| **ClickUp** | Integration | Gestão de roadmap e bugs do projeto. |
| **Cloudflare** | Integration | Segurança e performance de rede. |
| **Code Tool** | Regular | Ferramenta para agentes de IA executarem código. |
| **Cron / Schedule** | Trigger | Execução de tarefas recorrentes (ex: relatórios semanais). |
| **DeepL** | Integration | Tradução de alta qualidade para cursos multi-idioma. |
| **Discord** | Regular | Comunicação interna da equipe de tutores. |
| **Docparser** | Integration | Extração de dados estruturados de faturas e contratos. |
| **ElevenLabs** | Integration | Narração realista de textos para aulas em áudio. |
| **Error Trigger** | Regular | Captura de falhas em workflows para alertas no Slack. |
| **Firecrawl** | Integration | Crawler otimizado para alimentar bases de conhecimento de IA. |
| **Google Gemini** | Integration | Motor de IA multimodal do Google Workspace. |
| **Google Sheets** | Regular | Planilhas para controle rápido de leads e notas. |
| **HubSpot** | Integration | CRM completo para vendas e suporte. |
| **Instantly** | Regular | Automação de cold e-mail para prospecção. |
| **Jina AI** | Integration | Pesquisa neural e processamento de embeddings. |
| **LangChain** | Core | Framework para construção de agentes de IA complexos. |
| **Lokalise** | Integration | Gestão de tradução e localização do portal do aluno. |
| **Mailchimp** | Integration | Disparo de newsletters e novidades do curso. |
| **Make (Integromat)** | Integration | Conexão entre plataformas de automação. |
| **MongoDB / MySQL** | Integration | Bancos de dados para aplicações de grande escala. |
| **Notion** | Regular | Wiki do projeto e documentação interna. |
| **OpenAI** | Integration | Implementação de GPT-4, Whisper e DALL-E. |
| **Paddle / Stripe** | Integration | Processamento de pagamentos e assinaturas. |
| **PDF Monkey** | Regular | Geração de PDFs complexos via templates. |
| **Pinecone** | Vector Store | Banco de vetores para busca semântica (RAG). |
| **Postgres** | Regular | Banco de dados principal do ecossistema Ideas. |
| **Redis** | Integration | Gestão de filas e cache de alta performance. |
| **Respond.io** | Regular | Agregação de canais de chat (WhatsApp, FB, etc). |
| **Salesforce** | Integration | CRM corporativo para grandes parcerias. |
| **SendGrid** | Integration | Envio de e-mails transacionais (boas-vindas). |
| **Slack** | Regular | Hub de notificações e logs de sistema. |
| **Supabase** | Integration | Backend completo com DB, Auth e Storage. |
| **Telegram** | Regular | Interface rápida para comandos administrativos. |
| **Trello** | Integration | Organização visual de tarefas simples. |
| **Twilio** | Integration | Infraestrutura de SMS e chamadas de voz. |
| **Typeform** | Trigger | Coleta de feedbacks e quizzes de nivelamento. |
| **Vector Store Tool** | Regular | Ferramenta de busca em bases de conhecimento para IA. |
| **Webflow** | Integration | CMS para landing pages de alta conversão. |
| **Webhook** | Integration | Ponto de entrada para receber dados de qualquer sistema. |
| **WhatsApp Business** | Integration | Canal oficial para interação com alunos. |
| **YouTube** | Integration | Gestão de vídeos e playlists das aulas. |
| **Zendesk** | Regular | Plataforma de suporte ao cliente enterprise. |
| **Zoho CRM** | Integration | Suíte de produtividade e gestão de vendas. |
| **Zoom** | Integration | Gravação e agendamento de aulas ao vivo. |

---
*Nota: Esta lista foca nos nodes com maior probabilidade de uso no desenvolvimento de EdTechs e apps baseados em IA.*
