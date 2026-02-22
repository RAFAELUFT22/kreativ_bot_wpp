# Guia de Início: WhatsApp Business Platform (Cloud API)

Este guia detalha o processo para configurar e começar a usar a **WhatsApp Business Platform (Cloud API)**, baseado na documentação oficial da Meta (atualizado para as diretrizes de 2025/2026).

---

## 📋 Pré-requisitos

Antes de iniciar a configuração técnica, certifique-se de possuir:

1.  **Conta de Desenvolvedor do Facebook:** Vinculada ao seu perfil pessoal do Facebook.
2.  **Conta Empresarial da Meta (Meta Business Account):** Necessária para gerenciar o WhatsApp Business Platform. Contas verificadas possuem limites maiores, mas não é obrigatória para testes iniciais.
3.  **Número de Telefone:** Um número que **não** esteja vinculado a uma conta do WhatsApp (App ou Business). Ele deve ser capaz de receber SMS ou chamadas de voz para verificação.
4.  **Endpoint de Webhook (HTTPS):** Um servidor (ex: n8n, Express) com certificado SSL válido para receber eventos em tempo real.

---

## 🚀 Passo a Passo de Configuração

### 1. Criar o Aplicativo Meta
1. Acesse o [Painel de Aplicativos da Meta](https://developers.facebook.com/apps).
2. Clique em **Criar Aplicativo**.
3. Selecione o tipo de aplicativo **Negócios** (Business).
4. Preencha o nome do app, e-mail de contato e selecione seu Portfólio Empresarial.
5. Clique em **Criar Aplicativo**.

### 2. Adicionar o Produto WhatsApp
1. No painel do seu novo aplicativo, role até encontrar **WhatsApp** e clique em **Configurar**.
2. Aceite os termos e condições.
3. Você receberá um **Número de Teste** e um **ID de Telefone de Teste** para começar imediatamente sem precisar de um número real.

### 3. Registrar um Número de Telefone Real
1. No menu lateral do WhatsApp, vá em **Configuração da API**.
2. Role até a seção de números de telefone e clique em **Adicionar número de telefone**.
3. Preencha o Nome de Exibição, Categoria e Descrição do Negócio.
4. Insira o número no formato E.164 (ex: `+5563999999999`).
5. Escolha o método de verificação (SMS ou Voz) e insira o código recebido.
6. **Nota:** Desde 2024, a autenticação de dois fatores (2FA) é mandatória.

### 4. Configurar Webhooks
Para que seu bot receba mensagens, você precisa configurar os Webhooks:
1. Vá em **WhatsApp > Configuração**.
2. Clique em **Configurar Webhooks**.
3. Insira a **URL de Retorno** (ex: `https://n8n.seuservidor.com/webhook/meta`) e o **Token de Verificação** (uma string secreta que você define).
4. Em **Campos de Inscrição**, selecione ao menos o campo `messages`.

### 5. Enviar a Primeira Mensagem (Via cURL)
Você pode testar o envio de um template usando o ID do telefone:

```bash
curl -X POST "https://graph.facebook.com/v21.0/ID_DO_TELEFONE/messages" 
     -H "Authorization: Bearer SEU_ACCESS_TOKEN" 
     -H "Content-Type: application/json" 
     -d '{
       "messaging_product": "whatsapp",
       "to": "5563999999999",
       "type": "template",
       "template": {
         "name": "hello_world",
         "language": { "code": "en_US" }
       }
     }'
```

---

## ⚠️ Atualizações Importantes (2025-2026)

*   **Cloud API como Padrão:** A opção "On-Premise" foi descontinuada pela Meta em favor da Cloud API (hospedada pela Meta).
*   **Modelo de Conta Compartilhada:** O modelo "Em nome de" (OBO) foi substituído pelo modelo onde a empresa deve possuir sua própria conta WhatsApp Business (WABA).
*   **Precificação por Mensagem:** Desde julho de 2025, a cobrança é feita por mensagem de template entregue, substituindo a taxa fixa por conversa de 24 horas.
*   **Conformidade de IA (2026):** Chatbots abertos não são mais permitidos; a IA deve realizar tarefas de negócios concretas e ter supervisão humana acessível.

---

## 🔗 Links Úteis
* [Documentação Oficial Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
* [Gerenciador do WhatsApp (WABA)](https://business.facebook.com/wa/manage/)
* [Política de Mensagens Comerciais](https://www.whatsapp.com/legal/business-policy/)
