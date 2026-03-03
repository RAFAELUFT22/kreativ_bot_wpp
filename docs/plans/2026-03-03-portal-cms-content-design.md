# Portal CMS + Content Generation — Design Doc

**Data:** 2026-03-03
**Status:** Aprovado
**Escopo:** Area admin no Portal Next.js + geração de conteúdo para top 10 cursos

---

## 1. Contexto

O sistema Kreativ Educação tem 21 cursos cadastrados, mas apenas 3 possuem conteúdo real (curso 19 IA com 5 módulos, cursos 4 e 5 com 3 módulos TDS cada). Há 508 pré-inscritos na tabela `pre_inscriptions` com interesse distribuído entre os cursos. O portal atual é read-only — sem área administrativa.

### Demanda por curso (top 10):
| Pos | ID | Curso | Pré-inscritos | Conteúdo |
|-----|---:|-------|:---:|:---:|
| 1 | 5 | Gestão Financeira para Empreendimentos | 210 | 3 módulos TDS |
| 2 | 11 | Boas Práticas Produção/Manipulação Alimentos | 89 | nenhum |
| 3 | 7 | Organização da Produção para o Mercado | 83 | nenhum |
| 4 | 19 | IA e Inclusão Digital | 78 | 5 módulos ✅ |
| 5 | 16 | Produção Audiovisual | 27 | nenhum |
| 6 | 2 | Saúde e Bem-estar | 22 | nenhum |
| 7 | 1 | Administração e Gestão | 16 | nenhum |
| 8 | 4 | Agronegócio e Produção Rural | 12 | 3 módulos TDS |
| 9 | 13 | Quintais Produtivos | 6 | nenhum |
| 10 | 6 | Captação de Recursos | 2 | nenhum |

## 2. Decisões de Design

- **CMS:** Área `/admin` dentro do Portal Next.js (não ToolJet)
- **Auth:** Senha única via `ADMIN_PASSWORD` no `.env`, cookie httpOnly HMAC-SHA256
- **Conteúdo:** Gerado por Claude (conhecimento próprio), modelo Khan Academy
- **Quiz:** Híbrido — 3 múltipla escolha + 1 discursiva com rubrica IA
- **LLM padrão:** Claude Opus 4.6 (`claude-opus-4-6`)
- **Escopo geração:** 8 cursos sem conteúdo do top 10 (3 módulos cada = 24 módulos)

## 3. Arquitetura

### 3.1 Rotas Admin

```
/admin/login          → Tela de login (POST senha → cookie)
/admin                → Dashboard (stats + tabela cursos)
/admin/cursos         → Lista cursos (módulos/inscritos)
/admin/curso/[id]     → Detalhe curso + módulos
/admin/modulo/[id]    → Editor de módulo (blocks + quiz)
/admin/modulo/novo    → Criar novo módulo
/admin/pre-inscritos  → CRM: lista/filtro/conversão pré-inscritos
```

### 3.2 API Routes

```
POST   /api/admin/login        → valida ADMIN_PASSWORD, set cookie
GET    /api/admin/stats        → contagens para dashboard
POST   /api/admin/modulo       → INSERT módulo
PUT    /api/admin/modulo/[id]  → UPDATE módulo (blocks, quiz, rubrica)
DELETE /api/admin/modulo/[id]  → DELETE módulo
POST   /api/admin/matricular   → converter pré-inscrito → student
```

### 3.3 Autenticação

- `ADMIN_PASSWORD` definido no `.env`
- Login: POST com senha → servidor gera token = `HMAC-SHA256(timestamp, ADMIN_PASSWORD)`
- Cookie: `admin_token=<timestamp>:<hmac>`, httpOnly, secure, maxAge 24h
- Validação: extrair timestamp, recalcular HMAC, verificar match + expiração
- Sem tabela de usuários admin — single-user suficiente para equipe atual

### 3.4 Stack

- Mesmo Next.js 14 pages router
- Mesmo `pg` Pool (sem ORM adicional)
- API Routes internas para mutations
- CSS com variáveis existentes (`--gold`, `--bg`, `--text`)
- Zero dependências novas

## 4. Modelo de Conteúdo — Khan Academy Style

### 4.1 Estrutura por módulo (Mastery-Based Learning)

```
Módulo N: [Título]
├── Block 1: CONCEITO (type: "text")
│   └── Explicação clara, ~300-400 palavras, analogias do cotidiano
├── Block 2: EXEMPLO PRÁTICO (type: "text")
│   └── Caso real/cenário aplicado ao público-alvo
├── Block 3: DICA PRÁTICA (type: "text")
│   └── Ação concreta, ferramenta ou técnica aplicável
└── Quiz: HÍBRIDO
    ├── 3 questões múltipla escolha (auto-corrigidas)
    └── 1 questão discursiva (avaliada por IA + rubrica)
```

### 4.2 Formato blocks JSONB

```json
[
  {"order": 1, "type": "text", "content": "## O que é...\n\nTexto conceitual..."},
  {"order": 2, "type": "text", "content": "## Exemplo Prático\n\nCenário real..."},
  {"order": 3, "type": "text", "content": "## Na Prática\n\nDica aplicável..."}
]
```

### 4.3 Formato quiz_questions JSONB (Híbrido)

```json
[
  {"id": 1, "type": "multiple_choice", "question": "...",
   "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "B"},
  {"id": 2, "type": "multiple_choice", "question": "...",
   "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "C"},
  {"id": 3, "type": "multiple_choice", "question": "...",
   "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A"},
  {"id": 4, "type": "discursive", "question": "..."}
]
```

### 4.4 Rubrica (evaluation_rubric TEXT)

```
Critérios: compreensão do conceito (40%), aplicação prática (40%), clareza (20%).
Nota mínima: 70/100 para aprovação.
Linguagem: avaliação empática e construtiva.
```

## 5. Grade de Cursos (24 módulos a gerar)

### Curso 11 — Boas Práticas na Produção e Manipulação de Alimentos
- M1: Segurança Alimentar — Conceitos Fundamentais
- M2: Higiene na Manipulação de Alimentos
- M3: Controle de Qualidade e Boas Práticas

### Curso 7 — Organização da Produção para o Mercado
- M1: Planejamento e Organização da Produção
- M2: Acesso a Mercados Locais e Regionais
- M3: Precificação e Estratégias de Venda

### Curso 16 — Produção Audiovisual
- M1: Fundamentos da Produção Audiovisual
- M2: Roteiro, Gravação e Produção
- M3: Edição, Publicação e Distribuição

### Curso 2 — Saúde e Bem-estar
- M1: Saúde Preventiva no Ambiente de Trabalho
- M2: Alimentação Equilibrada e Qualidade de Vida
- M3: Saúde Mental e Produtividade

### Curso 1 — Administração e Gestão
- M1: Fundamentos de Gestão para Pequenos Negócios
- M2: Planejamento Estratégico Simplificado
- M3: Gestão de Pessoas e Processos

### Curso 13 — Desenvolvimento de Quintais Produtivos
- M1: Planejamento do Quintal Produtivo
- M2: Técnicas de Cultivo e Manejo
- M3: Beneficiamento e Comercialização

### Curso 6 — Elaboração de Projetos para Captação de Recursos
- M1: Fontes de Financiamento e Editais
- M2: Elaboração do Projeto — Passo a Passo
- M3: Prestação de Contas e Monitoramento

### Curso 21 — Culinária Saudável
- M1: Nutrição Básica e Escolha de Ingredientes
- M2: Técnicas de Preparo Saudável
- M3: Cardápio Empreendedor — Da Cozinha ao Negócio

## 6. CRM de Pré-inscritos

### Página /admin/pre-inscritos

- Tabela paginada (20 por página)
- Filtros: nome, telefone, cidade, curso, status
- Colunas: nome, telefone, cidade, cursos de interesse, status, ações
- Botão "Matricular" → selecionar curso → INSERT em students + UPDATE convertido
- Stats no topo: total, convertidos, pendentes

### Dashboard /admin

- Cards: cursos ativos, módulos publicados, alunos, pré-inscritos pendentes, certificados
- Tabela cursos: nome, área, módulos, pré-inscritos, alunos ativos

## 7. Mudanças no Banco

Nenhuma migração de schema necessária — todas as tabelas e colunas existem:
- `modules.blocks` JSONB ✅
- `modules.quiz_questions` JSONB ✅
- `modules.evaluation_rubric` TEXT ✅
- `modules.is_published` BOOLEAN ✅
- `pre_inscriptions` + `pre_inscription_courses` ✅
- `students` com todos os campos necessários ✅

Apenas INSERT de dados (24 módulos novos).

## 8. Fluxo de Dados

```
Admin cria/edita módulo no Portal
  → API Route POST/PUT /api/admin/modulo
  → INSERT/UPDATE modules (blocks, quiz_questions, evaluation_rubric)
  → is_published = true → aparece no portal do aluno
  → document_chunks (futuro: kreativ_ingest gera embeddings para RAG)

Admin matricula pré-inscrito
  → API Route POST /api/admin/matricular
  → INSERT students (phone, name, course_id, portal_token)
  → UPDATE pre_inscriptions SET convertido = true, student_id = ...
  → Aluno pode acessar portal via /aluno/[token]
```

## 9. Fora do Escopo (v1)

- Upload de arquivos (PDF/DOCX) — usar kreativ_ingest depois
- Notificação WhatsApp automática ao matricular
- Editor WYSIWYG rico (Markdown textarea é suficiente)
- Multi-tenancy / roles de admin
- Geração de embeddings automática (manual via kreativ_ingest)
