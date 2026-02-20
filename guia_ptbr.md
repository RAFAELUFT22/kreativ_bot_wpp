# 📘 Guia Técnico de Customização e Lógica (Ideias App)

Este documento detalha a arquitetura, a lógica de negócio e as convenções do projeto para garantir que novos agentes de IA possam atuar de forma consistente e segura.

---

## 1. Visão Geral da Arquitetura

O sistema opera como um ecossistema de microserviços orquestrados por eventos, focado em educação via WhatsApp (**EdTech**).

```mermaid
graph TD
    WA[WhatsApp] --> EVO[Evolution API]
    EVO --> N8N_R[N8N: Router 01]222
    N8N_R -->|Bot State| BB[BuilderBot]
    N8N_R -->|AI Query| AI[N8N: AI Router V3]
    AI --> DS[DeepSeek API]
    AI --> PG[(PostgreSQL + pgvector)]
    BB --> PG
    N8N_R -->|Suporte| CW[Chatwoot]
```

---

## 2. Estrutura de Pastas e Responsabilidades

### 📂 `/apps` (N/MO222úcleo da Aplicação)
*   `builderbot/`: Gerencia a Máquina de Estados (FSM) do bot. Controla fluxos fixos como boas-vindas e menus.
*   `evolution/`: Instância do gateway WhatsApp. Responsável pelo recebimento/envio de mensagens e mídias.
*   `portal/` & `web/`: Frontends em Next.js (v14+) para o Portal do Aluno e landing pages.
*   `certificate-template/`: Gerador de certificados em HTML/PDF.

### 📂 `/n8n-workflows` (Orquestração de Lógica)
Esta é a "inteligência" do sistema. Os arquivos seguem uma numeração de prioridade:
*   `01-whatsapp-router.json`: O ponto de entrada. Decide se a mensagem vai para o BuilderBot, AI Tutor ou Suporte Humano.
*   `04-request-human-support.json`: Gerencia o transbordo para o Chatwoot.
*   `20-ai-router-v3.json`: Implementa o RAG (*Retrieval-Augmented Generation*) com histórico de chat no Redis.
*   `22-rag-ingestion.json`: Pipeline de ingestão que transforma PDFs/Textos em vetores no Postgres.

### 📂 `/init-scripts` & `/scripts`
*   `01-init-dbs.sql`: Define o schema canônico.
*   `04-analytics-kpis.sql`: Queries prontas para dashboards no Metabase.
*   `03-migration-tds-modules.sql`: Script crítico que padroniza o uso de `course_int_id`.

---

## 3. Lógica de Dados e Convenções Críticas

### ⚠ Identificadores de Curso (Atenção Agentes!)
Existe uma transição de schema. **Sempre priorize:**
*   **`course_int_id` (INTEGER):** Usado para *Joins* e busca de módulos.
*   `course_id` (VARCHAR): Campo legado, use apenas para referência externa se necessário.

### 🧠 Fluxo de Recuperação (RAG)
O **AI Router V3** utiliza uma estratégia de "Dual-Mode":
1.  **Contexto Estático:** Injeta a ementa do curso baseada no `course_int_id`.
2.  **Contexto Dinâmico:** Busca *chunks* na tabela `document_chunks` usando similaridade de cosseno (*pgvector*).
3.  **Memória de Curto Prazo:** Recupera as últimas 10 interações do Redis via protocolo TCP direto para máxima performance.

### 🤝 Controle de Transbordo (Handoff)
Para evitar que o bot responda enquanto um humano atende no Chatwoot:
*   O campo `attendance_status` na tabela de sessões deve ser definido como **`human`**.
*   O workflow `10-chatwoot-events.json` reativa o bot (status=`bot`) quando o ticket é fechado no painel de suporte.

---

## 4. Como Customizar

### Adicionar um Novo Curso
1.  Insira o curso na tabela `courses`.
2.  Adicione os módulos na tabela `modules` vinculando ao `course_int_id`.
3.  Execute o workflow `22-rag-ingestion.json` com o material didático para popular os vetores de busca.

### Alterar a Personalidade da IA
*   Edite o nó **"System Prompt"** no workflow `20-ai-router-v3.json`.
*   O prompt é dinâmico e aceita variáveis como `{{student_name}}` e `{{course_name}}`.

---

## 5. Comandos de Manutenção Rápida

**Resetar Estado de um Aluno:**
```bash
docker exec kreativ_redis redis-cli -a $REDIS_PASSWORD DEL "session:55...:status"
```

**Verificar Saúde da Ingestão:**
```sql
SELECT count(*), metadata->>'course_int_id' 
FROM document_chunks 
GROUP BY 2;
```

---
> *Este guia deve ser atualizado sempre que houver mudanças no schema do banco de dados ou na arquitetura de roteamento.*