# Guia de Testes — Ecossistema Kreativ Educação

Este ecossistema utiliza uma arquitetura distribuída com Docker, n8n, Evolution API, BuilderBot e Chatwoot. Para facilitar a validação após edições, utilize os scripts abaixo.

## 🚀 Teste Rápido (Ecosystem Test)

O script principal valida o status de todos os containers, o registro de webhooks no n8n, a conectividade entre serviços e realiza uma simulação ponta-a-ponta de uma mensagem de WhatsApp.

```bash
./scripts/test_ecosystem.sh
```

### O que o teste valida?
1.  **Fase 1 (Containers):** Verifica se todos os serviços essenciais estão rodando.
2.  **Fase 2 (n8n Webhooks):** Garante que os fluxos estão ativos e com as URLs de webhook registradas no banco de dados.
3.  **Fase 3 (Conectividade):** Testa se o BuilderBot alcança o Postgres, se a Evolution alcança o n8n e se o n8n alcança o BuilderBot.
4.  **Fase 4 (Simulação E2E):** Dispara uma mensagem simulada para o Router do n8n e aguarda a resposta de sucesso do fluxo completo (Parser -> AI Router -> DeepSeek -> BuilderBot Send).

---

## 🛠️ Debug por Módulo

Se o teste principal falhar, utilize as ferramentas específicas:

### 1. n8n (Automação e IA)
Se os webhooks estiverem `MISSING`:
- Reinicie o n8n: `docker restart kreativ_n8n`
- Verifique fluxos duplicados: `docker exec kreativ_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT id, name, active FROM workflow_entity;"`

### 2. Evolution API (WhatsApp)
Se a conexão com o WhatsApp falhar:
- Verifique as instâncias: `docker exec kreativ_builderbot wget -qO- --header="apikey: $EVOLUTION_API_KEY" "http://kreativ_evolution:8080/instance/fetchInstances"`
- Verifique o Webhook: `docker exec kreativ_builderbot wget -qO- --header="apikey: $EVOLUTION_API_KEY" "http://kreativ_evolution:8080/webhook/find/europs"`

### 3. BuilderBot (Interface de Envio e Banco)
Se o envio falhar:
- Verifique logs em tempo real: `docker logs -f kreativ_builderbot`
- Teste a API de query: `docker exec kreativ_n8n wget -qO- --post-data='{"query":"SELECT 1"}' --header="Content-Type: application/json" "http://kreativ_builderbot:3008/api/query"`

---

## 📝 Logs Consolidados
Sempre verifique o arquivo `bot_logs.txt` na raiz para erros de integração do BuilderBot e o status do provedor WhatsApp.
