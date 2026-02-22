# Diretrizes para Gemini CLI — Execução e Commit de Testes

Estas instruções são destinadas ao **Gemini CLI** para garantir que a execução dos planos de teste e o registro dos resultados no Git sejam feitos de forma segura, organizada e sem comprometer o código existente.

## 🚀 Execução dos Testes

1. **Leitura do Plano:** Sempre comece lendo o arquivo `docs/E2E_CONVERSATION_TEST_PLAN.md` para entender os cenários.
2. **Ambiente:** Verifique no `.env` se as URLs (`EVOLUTION_URL`, `N8N_URL`, etc.) estão acessíveis antes de iniciar.
3. **Registro:** Crie ou atualize um arquivo de log formatado em `docs/test-report-rafael.md` (ou similar conforme o caso) com a data, versão testada e o resultado (Passou/Falhou) para cada cenário.

## 🛡️ Regras de Ouro para Commits

Para evitar "estragar" o que já foi feito, siga rigorosamente estas regras:

1. **Escopo Estrito:**
    - **NUNCA** use `git add .` ou `git add -A`.
    - Adicione apenas os arquivos de documentação e log gerados: `git add docs/test-report-rafael.md`.
2. **Mensagens de Commit:**
    - Use o padrão **Conventional Commits**.
    - Exemplo: `test: e2e conversation status report 2026-02-22` ou `docs: update test plan for cloud api`.
3. **Sem Amending:** 
    - Não use `git commit --amend`. Crie novos commits para manter o histórico de testes claro.
4. **Verificação Pré-Commit:**
    - Execute `git status` e `git diff --cached` antes de commitar para garantir que nenhum arquivo de código ou configuração (`.env`, `*.py`, `*.json`) foi modificado acidentalmente.
5. **Push:**
    - Realize o push apenas se solicitado explicitamente pelo usuário, para evitar conflitos em branches ativos.

## 📋 Checklist de Segurança

- [ ] Eu li o plano de testes?
- [ ] Eu verifiquei o `git status` e não há arquivos de código marcados para commit?
- [ ] Minha mensagem de commit descreve claramente o teste realizado?
- [ ] Eu registrei as falhas encontradas no relatório antes de commitar?

---
*Nota: Estas diretrizes visam a estabilidade do projeto Kreativ Educação v0.4.x.*
