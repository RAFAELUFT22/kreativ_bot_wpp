# Plano de Testes E2E — Usuário Rafael

**Telefone:** `556399374165`  
**Estado atual no DB:** `attendance_status=human`, `current_module=4`, modules 1-3 concluídos (100%)  
**Data:** 2026-02-19

---

## Pré-requisito: Reset do Usuário

Antes de cada rodada de testes, resetar o estado do Rafael para simular diferentes cenários:

```bash
# Reset completo (novo aluno)
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
UPDATE students SET 
  attendance_status='bot', 
  current_module=1, 
  completed_modules='{}', 
  scores='{}', 
  lead_score=0, 
  lead_tags=NULL 
WHERE phone='556399374165';"

# Reset parcial (manter progresso, só corrigir status)
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c "
UPDATE students SET attendance_status='bot' WHERE phone='556399374165';"
```

---

## Fluxos a Testar

### 1. 🟢 Welcome Flow (Primeiro Contato)
**Trigger:** Enviar "oi" ou "olá" no WhatsApp  
**Esperado:** Bot responde com boas-vindas e menu de opções  
**Teste via webhook:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "event": "messages.upsert",
  "data": {
    "key": {"remoteJid": "556399374165@s.whatsapp.net", "fromMe": false},
    "pushName": "Rafael Luciano",
    "message": {"conversation": "oi"}
  }
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/whatsapp
```
**Verificar:** Rota → `deepseek` (current_module=0 ou aluno novo)

---

### 2. 📚 Module Flow (Carregar Conteúdo)
**Trigger:** Enviar "modulo" ou "continuar" no WhatsApp  
**Pré-condição:** `attendance_status=bot`, `current_module >= 1`  
**Esperado:** Bot envia conteúdo do módulo atual  
**Teste via webhook:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "event": "messages.upsert",
  "data": {
    "key": {"remoteJid": "556399374165@s.whatsapp.net", "fromMe": false},
    "pushName": "Rafael Luciano",
    "message": {"conversation": "modulo"}
  }
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/whatsapp
```
**Verificar:**
- [ ] N8N chama `get-student-module` e retorna conteúdo correto
- [ ] BuilderBot envia conteúdo no WhatsApp
- [ ] Conteúdo corresponde ao `current_module` do aluno

---

### 3. 📝 Quiz Flow (Resposta + Pontuação)
**Trigger:** Enviar "quiz" seguido de resposta ("A", "B", "C")  
**Pré-condição:** Conteúdo do módulo já foi enviado  
**Esperado:** Bot avalia resposta, atualiza score via MCP `save-progress`  
**Teste direto do save-progress:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "phone": "556399374165",
  "moduleId": 4,
  "score": 100,
  "completed": true
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/save-progress
```
**Verificar:**
- [ ] `scores` no DB inclui `module_4: 100`
- [ ] `completed_modules` inclui `4`
- [ ] `current_module` avança para `5`

---

### 4. 🆘 Human Support Flow (Solicitar Tutor)
**Trigger:** Enviar "tutor" ou "ajuda" no WhatsApp  
**Esperado:** Bot confirma, N8N cria sessão, notifica tutor, pausa bot  
**Teste via webhook:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "event": "messages.upsert",
  "data": {
    "key": {"remoteJid": "556399374165@s.whatsapp.net", "fromMe": false},
    "pushName": "Rafael Luciano",
    "message": {"conversation": "tutor"}
  }
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/whatsapp
```
**Verificar:**
- [ ] `attendance_status` muda para `human`
- [ ] Conversa criada no Chatwoot (Inbox 2)
- [ ] Mensagem do BuilderBot confirmando transferência
- [ ] Novas mensagens do aluno são silenciadas (rota `paused`)

---

### 5. 🔄 Chatwoot Resolution → Bot Resume
**Trigger:** Resolver conversa no Chatwoot  
**Esperado:** Webhook dispara, `attendance_status` volta a `bot`, mensagem de retomada  
**Teste direto do resume-bot:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "phone": "556399374165",
  "message": "Olá Rafael! O atendimento foi finalizado. Responda CONTINUAR para retomar."
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/resume-bot
```
**Verificar:**
- [ ] `attendance_status` volta para `bot`
- [ ] Mensagem de retomada enviada pelo WhatsApp
- [ ] Próximas mensagens voltam a ser processadas pelo bot

---

### 6. 📊 Lead Scoring
**Trigger:** Automático após módulo concluído  
**Esperado:** `lead_score` atualizado, labels no Chatwoot  
**Verificar após completar módulos:**
```bash
docker exec kreativ_postgres psql -U kreativ_user -d kreativ_edu -c \
"SELECT lead_score, lead_tags FROM students WHERE phone='556399374165';"
```
- [ ] `lead_score` > 0 após completar módulo
- [ ] `lead_tags` atualizadas conforme progresso

---

### 7. 🎓 Certificado (Emissão)
**Trigger:** Webhook `emit-certificate` após completar todos os módulos  
**Teste direto:**
```bash
docker exec kreativ_n8n wget -qO- --post-data='{
  "phone": "556399374165",
  "moduleNumber": 5
}' --header="Content-Type: application/json" \
http://localhost:5678/webhook/emit-certificate
```
**Verificar:**
- [ ] HTML gerado e salvo no MinIO
- [ ] Link enviado via WhatsApp
- [ ] Certificado acessível no portal

---

### 8. 🤖 DeepSeek AI (Fallback)
**Trigger:** Mensagem genérica de aluno novo (sem módulo ativo)  
**Pré-condição:** `current_module = 0` ou aluno inexistente  
**Esperado:** Resposta da IA via DeepSeek  
**Verificar:**
- [ ] Resposta enviada pelo WhatsApp
- [ ] Conteúdo é relevante e em português

---

## Sequência de Teste Recomendada

1. **Reset completo** do Rafael
2. Testar **Welcome** (mensagem "oi")
3. Testar **Module** (mensagem "modulo") 
4. Testar **Quiz** (mensagem "quiz" + resposta)
5. Verificar **Lead Scoring** no DB
6. Testar **Human Support** (mensagem "tutor")
7. Verificar status `human` no DB e ticket no Chatwoot
8. Testar **Resume Bot** (resolver no Chatwoot ou webhook direto)
9. Verificar retorno ao status `bot`
10. Completar módulos restantes + testar **Certificado**

---

## Problemas Conhecidos

| # | Problema | Severidade | Status |
|---|---------|-----------|--------|
| 1 | `attendance_status` travado em `human` (não voltou automaticamente) | 🔴 Alta | A investigar |
| 2 | Módulos duplicados (module_number 1, 2, 3 aparecem 2x cada) | 🟡 Média | A investigar |
| 3 | Workflow `MCP Server: Kreativ Tools` usa node inexistente | 🟢 Baixa | ✅ Desativado |
| 4 | `lead_score = 0` mesmo com 3 módulos completos | 🟡 Média | A investigar |

---

## Registro de Testes

| Data | Teste | Resultado | Observações |
|------|-------|-----------|-------------|
| | | | |
