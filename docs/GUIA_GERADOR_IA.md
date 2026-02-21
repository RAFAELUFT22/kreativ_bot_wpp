# Pipeline de Geração de Fluxos Typebot com IA

Este documento descreve como funciona a geração automatizada de fluxos do Typebot usando IA (DeepSeek) e o script de validação de schema V3.

## Arquitetura

1. **Gerador (`scripts/generate_typebot_flow.py`)**: 
   Script Python que envia um prompt para a API do DeepSeek solicitando um fluxo JSON do Typebot. Ele inclui um "System Prompt" com todas as regras complexas de estrutura descobertas durante o reverse-engineering da API do Typebot V3.

2. **Validador (`scripts/validate_typebot_json.py`)**:
   Lê o JSON gerado e garante que as regras obrigatórias da API foram cumpridas. O JSON validado por este script tem 100% de chance de sucesso ao ser enviado via PATCH para a API do Typebot.

## Regras de Schema (Typebot V3)
- O `groups[0]` DEVE ser o Start Group e deve conter um bloco do tipo `"start"`.
- O bloco de condição usa **"Condition"** (letra C maiúscula).
- O bloco HTTP Request usa **"webhook"** (tudo minúsculo).
- Todos os itens dentro de Conditions ou Choices devem ter id atribuído.
- O evento inicial (`events[0]`) tem que ser do `"type": "start"` e declarar o edge inicial.
- Toda transição entre grupos deve referenciar corretamente `blockId` (e opcionalmente `itemId`). O nó inicial (start) referencia `eventId`.

## Como usar

Para gerar um novo fluxo automaticamente, basta rodar o comando:

```bash
python3 scripts/generate_typebot_flow.py "Descreva o fluxo desejado aqui" arquivo_saida.json
```

O script fará o seguinte:
1. Envia o prompt para a IA
2. Salva a resposta no arquivo JSON
3. Executa o validador
4. Informa se o fluxo está perfeitamente válido ou exibe os erros estruturais.

> **Nota:** Os arquivos gerados podem ser enviados para a instância do Typebot apontando para o EndPoint `PATCH /api/v1/typebots/{id}` usando a carga útil `{"typebot": <SEU_JSON_GERADO>}`.
