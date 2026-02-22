# ROADMAP — Kreativ Educação: Próximos Passos de Implementação

> Atualizado em: 22/02/2026 (v0.4.1 — Gestão de Alunos Concluída)

---

## Fases Concluídas ✅

### Fase 1 — Infra Base ✅
- Coolify configurado na VPS Hostinger (7.8GB RAM, 2 vCPU)
- Subdomínios com SSL via Traefik + Let's Encrypt
- Containers: PostgreSQL + pgvector, Redis, MinIO, Evolution API

### Fase 2 — BuilderBot + Evolution ✅ (legado)
- BuilderBot foi o primeiro framework do bot (substituído pelo Typebot na Fase 2b)

### Fase 2b — Migração para Typebot v6 ✅
- **Arquitetura ativa**: WhatsApp → Evolution API → **Typebot v6** → N8N → PostgreSQL
- Bot "Kreativ Educacao" (ID: `vnp6x9bqwrx54b2pct5dhqlb`) em produção
- N8N Unified API: `POST /webhook/kreativ-unified-api` (5 ações: check_student, get_module, submit_quiz, get_progress, request_human)
- Lição crítica: blocos `"Webhook"` (capital W) = server-side; `"webhook"` lowercase = client-side (Evolution ignora)
- Deploy via DB injection: `scripts/build_typebot.py`

### Fase 3 — Flow de Boas-Vindas / Menu Principal ✅
- Verificação de cadastro ao entrar
- Menu: Estudar módulo, Fazer quiz, Meu progresso, Falar com tutor
- Entrega de conteúdo do módulo atual via N8N

### Módulos e Quiz (parte da Fase 5) ✅
- Conteúdo dos módulos sendo entregue via WhatsApp
- Quiz com questões reais do banco de dados
- Score calculado e progresso salvo no PostgreSQL

### FASE 7 — ToolJet (Painel Administrativo) ✅
- **URL**: `https://admin.extensionista.site`
- **Status**: Online. DB `tooljet_db` criado.
- **Função**: Gestão de módulos e gestão manual de alunos (v0.3.6).
- **Blueprint**: Configurado para cadastros, edições e resets de alunos via Admin.

### FASE 8 — Chatwoot (Tutores) ✅
- **URL**: `https://suporte.extensionista.site`
- **Status**: Online e Integrado.
- **Fluxo**:
  1. Aluno pede TUTOR -> N8N seta `attendance_status='human'`
  2. N8N cria conversa no Chatwoot via API
  3. Tutor responde -> Evolution API envia
  4. Tutor resolve ticket -> Webhook Chatwoot chama N8N -> Retoma Bot

### FASE 9 — Scoring + Qualificação de Leads ✅
- **Status**: Workflows N8N ativos.
- **Lógica**:
  - Módulo completo -> Calcula Score -> Atualiza Label Chatwoot
  - Envia msg parabéns se score > 70%

### FASE 10 — Certificados Automáticos ✅
- **Status**: Implementado (versão HTML).
- **Fluxo**:
  - Conclusão do curso -> N8N gera HTML
  - Salva no MinIO (bucket: certificados)
  - Envia link via WhatsApp e Portal do Aluno

### FASE 11 — Metabase (Analytics) ✅
- **URL**: `https://dash.extensionista.site`
- **Status**: Online. Conectado ao `kreativ_edu`.

### FASE 12 — Portal Next.js (Conteúdo Rico) ✅
- **URL**: `https://portal.extensionista.site`
- **Stack**: Next.js 14, TailwindCSS.
- **Funcionalidades**:
  - Lista de Módulos (integrada ao DB)
  - Visualização de Certificados

---

## Fases Pendentes

---

### FASE 3A — Corrigir Botões WhatsApp ✅
- **Status**: Concluído via sintaxe `[buttons]` da Evolution API.
- **Implementação**: Blocos de texto dinâmicos que geram botões nativos.
---

### FASE 3B — Avaliação Quiz com DeepSeek
**Problema**: `submit_quiz` no N8N retorna apenas `{"success": true}`, sem avaliação IA.

**Implementar**:
1. Buscar pergunta e rubrica do módulo atual no PostgreSQL
2. Chamar DeepSeek com prompt de avaliação pedagógica
3. Retornar `score`, `feedback`, `passed` (>=70%)
4. Se passed: emitir certificado via `12-emit-certificate.json`

---

### FASE 4 — RAG (Material Didático)
**Infra pronta**: `document_chunks` tabela existe, índice ivfflat criado, AI Router V3 tem nó RAG.
**Pendente**: Popular com embeddings reais.

**Passos**:
1. Gerar embeddings do conteúdo dos módulos (OpenAI text-embedding-3-small ou DeepSeek)
2. Inserir em `document_chunks` com `metadata->>'course_int_id'` e `metadata->>'module_number'`
3. Workflow `22-rag-ingestion.json` já preparado

---

### FASE 6 — Voice Integration (Voz no Bot)
**Objetivo**: Permitir que o aluno mande áudios e receba respostas em voz.
**Passos**:
1. Configurar Evolution API para baixar áudios.
2. Usar OpenAI Whisper (via n8n) para transcrição.
3. Responder usando OpenAI TTS ou ElevenLabs no fluxo de saída.

---

### FASE 13 — Observabilidade e Monitoramento
**Objetivo**: Dashboard de falhas da IA e latência de resposta.
**Passos**:
1. Criar tabela `api_logs` para cada request ao n8n.
2. Monitorar erros de RAG (respostas "não sei").
3. Alertas via WhatsApp para o admin se a API do DeepSeek falhar.

---

## Resumo de Prioridades

| Prioridade | Fase | Status |
|---|---|---|
| 🟢 CONCLUÍDO | 1, 2, 2b, 3, 3A, 7, 8, 9, 10, 11, 12 | ✅ |
| 🟢 CONCLUÍDO | Gestão de Alunos (Admin) | ✅ |
| 🟠 ALTA | 3B (Quiz DeepSeek) | Pendente |
| 🟠 ALTA | 4 (RAG Embeddings) | Pendente |
| 🟡 MÉDIA | 5 (Cloud API Meta) | Pendente |
