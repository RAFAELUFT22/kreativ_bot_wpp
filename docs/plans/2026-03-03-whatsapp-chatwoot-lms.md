# Plano Operacional – Integração WhatsApp API + Chatwoot + Portal LMS

> Escopo: aplicação hardcoded para este projeto (sem planos comerciais), usando o ecossistema existente (WhatsApp API, Chatwoot, n8n/Typebot, Portal Next.js + Postgres).

---

## 1. Objetivo

Criar um fluxo integrado de **captar → matricular → engajar → apoiar** aprendizes usando:

- WhatsApp como **canal principal de entrada, lembrete e suporte rápido**.
- Portal LMS (apps/portal) como **camada de aprendizagem estruturada** (módulos, trilhas, quizzes, certificados).
- Chatwoot como **camada de atendimento humano e registro institucional**.

Tudo pensado para **um único projeto/território**, sem multi-tenant nem cobrança.

---

## 2. Arquitetura Lógica

- **WhatsApp API / Typebot / n8n**
  - Fluxos de captura de dados, qualificação e envio de mensagens transacionais (links de módulos, lembretes, parabéns, etc.).
  - Integração HTTP com APIs do portal (`/api/admin/matricular`, endpoints dedicados de tracking).

- **Portal Next.js (apps/portal) + Postgres**
  - Tabelas chave: `pre_inscriptions`, `pre_inscription_courses`, `students`, `courses`, `modules`, `certificates`.
  - Páginas admin já existentes:
    - `/admin/pre-inscritos` – CRM de pré-inscritos + botão “Matricular”.
    - `/admin/curso/[id]` – gestão de módulos do curso.
    - `/admin/modulo/novo`, `/admin/modulo/[id]` – editor de módulo (blocos + quiz + rubrica).

- **Chatwoot**
  - Recebe conversas iniciadas no WhatsApp quando há necessidade de humano.
  - Webhooks para o backend atualizarem sinais no banco (`student_support_events` etc.).

---

## 3. Fluxo 1 – Captação e Pré-inscrição (WhatsApp → Portal)

**Objetivo:** transformar contatos de WhatsApp em registros estruturados de pré-inscrição.

1. **Bot de entrada (WhatsApp / Typebot)**
   - Coleta:
     - Nome completo
     - Telefone (já vem do WhatsApp)
     - Município / comunidade
     - Perfil (agricultor, técnico, jovem, liderança, etc.)
     - Interesses em cursos (1..N cursos do catálogo)
   - Ao finalizar, envia payload para um webhook n8n.

2. **n8n → API do Portal**
   - Fluxo n8n chama endpoint interno (pode ser criado se não existir) ex:
     - `POST /api/integrations/pre-inscription`
   - Esse endpoint:
     - Cria/atualiza registro em `pre_inscriptions`.
     - Preenche tabela `pre_inscription_courses` com os `course_id` de interesse.

3. **Confirmação pelo WhatsApp**
   - n8n envia mensagem de confirmação:
     - “Você se pré-inscreveu em [cursos X/Y]. Em breve vamos te matricular e mandar o link das aulas.”

Resultado: **toda entrada de WhatsApp vira pré-inscrição rastreável no admin**.

---

## 4. Fluxo 2 – Matrícula e Criação de Acesso (Admin → Portal → WhatsApp)

**Objetivo:** transformar pré-inscrição em aluno com acesso, o mais automatizado possível.

1. **Gestão no admin**
   - Coordenador acessa `/admin/pre-inscritos`.
   - Usa filtros por curso, município, status.
   - Para cada pré-inscrito apto, clica em **“Matricular”**:
     - Chama `/api/admin/matricular` (já implementado).
     - Cria/atualiza registro em `students` com:
       - `phone`, `name`, `email`, `course_id`, `portal_token`.
     - Marca `pre_inscriptions.convertido = true` e associa `student_id`.

2. **Trigger n8n pós-matrícula**
   - Um worker (cron ou trigger via webhook do Postgres) detecta `pre_inscriptions.convertido = true`.
   - n8n envia mensagem de boas-vindas no WhatsApp:
     - Explica que o aluno foi matriculado no curso X.
     - Envia link direto para o **módulo 1** (`/curso/[slug]/modulo/[n]` ou similar).
     - Opcional: grava pequeno áudio com explicação simples de como usar a plataforma.

Resultado: conversão fluida **WhatsApp → admin → aluno → primeiro módulo**.

---

## 5. Fluxo 3 – Engajamento e Lembretes (Portal → WhatsApp)

**Objetivo:** manter o aluno ativo na trilha sem depender apenas de humanos.

1. **Eventos registrados no portal**
   - Em cada conclusão de módulo/quiz:
     - Registrar evento em tabela `learning_events` (ex.: `student_id`, `module_id`, `status`, `score`, `timestamp`).

2. **Jobs de engajamento (n8n / scripts)**
   - Rotina diária:
     - Identifica:
       - Alunos que nunca iniciaram o curso 3 dias após matrícula.
       - Alunos que iniciaram módulo mas não concluíram em X dias.
     - Para cada caso, aciona n8n/WhatsApp:
       - Mensagem com linguagem simples:
         - “Vi que você começou o módulo sobre [tema] e ainda não terminou. Quer continuar agora? [link]”

3. **Mensagens de conquista**
   - Ao concluir módulo ou trilha:
     - Enviar parabéns + próximo passo (próximo módulo ou curso complementar).
   - Ao emitir certificado:
     - Enviar link/arquivo do certificado.

Resultado: **ciclo de lembretes e comemorações** para reduzir evasão.

---

## 6. Fluxo 4 – Tutor IA no WhatsApp e Transbordo para Chatwoot

**Objetivo:** oferecer suporte pedagógico 24/7 e escalar para humano quando necessário.

1. **Tutor IA no WhatsApp**
   - Webhook de mensagens WhatsApp → serviço de IA:
     - Recupera contexto: `student_id`, cursos ativos, módulo atual (se possível pelo link clicado).
     - Usa base de conhecimento:
       - Blocos de conteúdo (`modules.blocks`).
       - Materiais anexos (PDFs, docs).
       - FAQ do projeto (políticas públicas, programas, prazos).
     - Gera resposta:
       - Explicação simples.
       - Links para trechos do módulo.
       - Sugestão de atividade prática.

2. **Regras de transbordo para Chatwoot**
   - Se a IA detectar:
     - Palavras-chave de reclamação séria, problemas de acesso, temas sensíveis.
     - Ou o aluno solicitar explícita/implicitamente “falar com pessoa”.
   - Ação:
     - Criar conversation no Chatwoot (via API) com:
       - Telefone, nome (se houver), `student_id`.
       - Tag: `aluno`, `curso_X`, `suporte_pedagogico` ou `suporte_tecnico`.
       - Resumo da conversa IA → humano (compacto).

3. **Atendimento humano no Chatwoot**
   - Atendente vê:
     - Histórico de mensagens.
     - Dados do aluno (puxados de endpoint do portal, ex.: `/api/admin/student-summary?id=...`).
   - Após encerrar:
     - Chatwoot manda webhook para backend:
       - Registra evento em `student_support_events` (tipo, tags, resolução).
       - Opcional: sugerir módulos de reforço (`recommended_modules`).

Resultado: IA cuida da maior parte das dúvidas, com **humanos focados nos casos mais críticos ou estratégicos**.

---

## 7. Fluxo 5 – Relatórios para Gestão e Prestação de Contas

**Objetivo:** gerar relatórios específicos do projeto (não genéricos de SaaS) usando dados do portal + WhatsApp + Chatwoot.

1. **Indicadores pedagógicos**
   - Por curso/módulo:
     - Nº de matriculados, concluintes, taxa de conclusão.
     - Médias de nota nos quizzes.
   - Por território/comunidade:
     - Alunos ativos, módulos concluídos, temas mais acessados.

2. **Indicadores de suporte**
   - Nº de conversas IA-only vs. escaladas para humano.
   - Temas mais frequentes de atendimento.
   - Tempo médio de resolução em Chatwoot.

3. **Geração de relatórios**
   - Páginas admin dedicadas (ex.: `/admin/relatorios/projeto-X`).
   - Exportação CSV/Excel para anexar em prestações de contas.

---

## 8. Roadmap de Implementação (enxuto)

**Fase 1 – Amarrar o funil básico (semanas 1–3)**

- Implementar endpoint de **criação de pré-inscrição** específico para o bot de WhatsApp.
- Ajustar fluxo n8n/Typebot para chamar esse endpoint.
- Garantir operação estável de:
  - `/admin/pre-inscritos` + `/api/admin/matricular`.
  - Mensagem manual de boas-vindas (n8n) após matrícula.

**Fase 2 – Engajamento automatizado (semanas 4–8)**

- Criar tabela `learning_events` e registrar eventos de conclusão/início de módulo.
- Implementar job (script ou n8n) que busca alunos “parados” e dispara mensagens de lembrete.
- Adicionar mensagens de parabéns e envio de certificado via WhatsApp.

**Fase 3 – Tutor IA + Chatwoot (semanas 9–16)**

- Implementar serviço de IA que responde dúvidas baseadas em `modules.blocks` + PDFs.
- Conectar esse serviço ao webhook de WhatsApp.
- Implementar regras de transbordo para Chatwoot + criação de conversas com tags.
- Criar webhook do Chatwoot para registrar `student_support_events`.

**Fase 4 – Relatórios do projeto (semanas 17–24)**

- Páginas admin de relatórios com foco nas perguntas do financiador (por território/curso).
- Exportações CSV.
- Pequenos dashboards visuais para uso interno da coordenação.

---

## 9. Princípios de Produto (relembrando)

- **Hardcoded de propósito**:
  - Cursos, trilhas, fluxos de bot e relatórios desenhados para este projeto específico.
  - Sem planos, sem billing, sem multi-tenant.
- **Conversacional + pedagógico, não comercial**:
  - WhatsApp e Chatwoot como extensões da **extensão rural/educação popular**, não como funil de vendas.
- **Automação para liberar gente boa**:
  - Bots e IA lidam com o repetitivo.
  - Time humano foca em casos complexos, acolhimento e ajustes finos do conteúdo.


