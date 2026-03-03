# Guia de Criação de Cursos Rápidos — Frappe LMS
## Kreativ Educação — Portal `lms.extensionista.site`

> Para professores e criadores de conteúdo. Sem necessidade de código.

---

## Visão Geral da Estrutura

```
Curso
└── Capítulo (agrupamento temático)
    └── Lição
        ├── Texto / Rich Text
        ├── Vídeo (YouTube embed)
        ├── Arquivo PDF
        └── Quiz (perguntas de múltipla escolha)
```

---

## Templates de Curso

| Tipo | Capítulos | Lições | Quizzes | Tempo de Setup |
|------|-----------|--------|---------|----------------|
| **Curso Express** | 1 | 3 | 1 | ~45 min |
| **Curso Padrão** | 3 | 9 | 3 | ~3 horas |
| **Curso Completo** | 5 | 15 | 5 | ~6 horas |

---

## Passo a Passo — Criar um Curso Express (3 Lições)

### 1. Acesse o Portal de Administração

1. Acesse: [https://lms.extensionista.site](https://lms.extensionista.site)
2. Login: use seu e-mail de professor + senha
3. Clique em **"Cursos"** no menu lateral → **"Novo Curso"**

---

### 2. Configure o Curso

Preencha os campos:

| Campo | O que escrever |
|-------|----------------|
| **Título do Curso** | Ex: "Empreendedorismo Digital em 3 Passos" |
| **Descrição Curta** | 1-2 frases (aparece no catálogo) |
| **Imagem de Capa** | Upload de imagem 1280×720px (JPG/PNG) |
| **Tags** | Ex: "negócios, vendas, digital" |
| **Publicado** | ✅ Sim (para aparecer no portal) |
| **Curso Gratuito** | ✅ Sim (padrão Kreativ) |

Clique em **"Salvar"**.

---

### 3. Adicione um Capítulo

1. Na página do curso, clique em **"Adicionar Capítulo"**
2. Dê um nome: ex. "Fundamentos"
3. Salve

---

### 4. Crie as Lições (repita para cada lição)

1. Dentro do capítulo, clique em **"Adicionar Lição"**
2. Preencha:

**Lição 1 — Conteúdo Texto:**
- Título: "O que é empreendedorismo digital?"
- Conteúdo: use o editor rich-text (negrito, lista, imagens)
- Duração estimada: 5 minutos

**Lição 2 — Vídeo YouTube:**
- Título: "Cases de sucesso"
- Cole a URL do YouTube no campo **"Vídeo"**
- O embed é automático — sem código!

**Lição 3 — Material Complementar + Quiz:**
- Título: "Planejando seu negócio"
- Upload de PDF (máx 50MB)
- Ative **"Adicionar Quiz"** → siga a Seção 5

---

### 5. Criando um Quiz

1. Na lição, role até **"Quiz"** → clique **"Adicionar Questão"**
2. Para cada questão:

| Campo | Exemplo |
|-------|---------|
| **Pergunta** | "Qual é o primeiro passo para abrir um negócio online?" |
| **Opção A** | "Criar uma logo" |
| **Opção B** | "Definir o público-alvo" ✅ |
| **Opção C** | "Abrir CNPJ" |
| **Opção D** | "Contratar funcionários" |
| **Resposta Correta** | Selecione a opção B |

3. Repita para adicionar 3-5 questões
4. Defina **Pontuação mínima de aprovação**: 70%
5. Salve

---

### 6. Publicar e Verificar

1. Acesse o link do curso: `https://lms.extensionista.site/courses/[slug-do-curso]`
2. Faça o fluxo completo como aluno para testar
3. O curso aparecerá automaticamente no WhatsApp para alunos matriculados

---

## Guia de Conteúdo Rápido com NotebookLM

Para criar conteúdo rico em menos tempo, use o **NotebookLM** do Google:

### Fluxo Recomendado

```
1. NotebookLM
   └── Faça upload do material base (PDF, slides, links)
   └── Peça: "Crie um roteiro de 3 lições sobre [tema]"
   └── Peça: "Crie 5 questões de múltipla escolha com gabarito"
   └── Exporte como texto

2. Frappe LMS
   └── Cole o roteiro nas lições
   └── Adicione o quiz com as questões geradas

3. WhatsApp (N8N)
   └── Aluno recebe conteúdo automaticamente ao acessar "Estudar"
```

### Prompt Modelo para NotebookLM

```
Com base neste material, crie:

1. ROTEIRO DE 3 LIÇÕES (formato markdown):
   - Lição 1: Introdução (500-800 palavras)
   - Lição 2: Desenvolvimento prático (500-800 palavras)
   - Lição 3: Aplicação e síntese (300-500 palavras)

2. QUIZ DE 5 QUESTÕES:
   - Múltipla escolha (4 opções cada)
   - Indique a resposta correta
   - Nível: intermediário

3. RESUMO EXECUTIVO (para envio via WhatsApp, máx 300 palavras)
```

---

## Receber Conteúdo via WhatsApp (Automático)

Após publicar o curso no Frappe LMS:

1. **Matrícula**: Aluno é matriculado via N8N (painel admin ou automático)
2. **Acesso WhatsApp**: Aluno digita "oi" → menu aparece
3. **Estudar**: Aluno seleciona "📖 Estudar Módulo" → recebe resumo + link da lição
4. **Quiz**: Ao completar a lição web, quiz é enviado pelo WhatsApp
5. **Progresso**: "📊 Meu Progresso" → barra de conclusão por curso
6. **Certificado**: Ao concluir → certificado gerado e enviado via WhatsApp + e-mail

---

## Dicas de Boas Práticas

### ✅ Faça
- Lições com 300-800 palavras (leitura de 3-7 min)
- 1 conceito principal por lição
- Quiz com 3-5 questões por lição
- Imagem de capa atraente (impacta conversão)
- Vídeos curtos (5-10 min) do YouTube

### ❌ Evite
- Lições com mais de 1.500 palavras (divide em duas)
- Quizzes com mais de 10 questões por vez
- PDFs acima de 10MB (compacte antes)
- Conteúdo sem revisão de texto

---

## Integração com Teacher Panel

Para professores com acesso ao **Teacher Panel** (`/teacher`):

1. **Dashboard**: Visão geral de alunos por curso
2. **Notas/Turmas**: Gestão de turmas e avaliações
3. **Exportar**: Relatório de progresso por aluno (CSV)

> O Teacher Panel é integrado ao banco de dados principal e reflete automaticamente os dados do Frappe LMS após a migração.

---

## Dicas "Pro" para Administradores (Configurações Avançadas)

Para quem deseja escalar a criação de conteúdo ou automatizar processos:

### 1. Criar via Awesome Bar (Busca Rápida)
No painel Admin do Frappe, pressione `Ctrl + G` e digite o nome do DocType para ir direto à lista:
- `LMS Course`: Lista de todos os cursos.
- `LMS Chapter`: Onde os capítulos são definidos (vinculados ao curso).
- `LMS Lesson`: Conteúdo individual das aulas.
- `LMS Quiz`: Banco de questões e quizzes.

### 2. Importação em Massa (CSV/Excel)
Se você tem 20+ cursos para subir de uma vez:
1. No Awesome Bar, busque por **"Data Import"**.
2. Clique em **"Add Data Import"**.
3. Selecione o DocType (ex: `LMS Course`).
4. Baixe o Template (CSV ou Excel).
5. Preencha e faça o upload. O Frappe criará todos os registros automaticamente.

### 3. API REST para Desenvolvedores
Cada curso é um recurso acessível via:
`POST https://lms.extensionista.site/api/resource/LMS Course`
> [!TIP]
> Use o nó do **n8n** que já deixamos configurado para automatizar matrículas e criação de leads vindos do WhatsApp.

---

## Suporte

- **Portal Frappe**: `https://lms.extensionista.site/help`
- **Admin N8N**: `https://n8n.extensionista.site`
- **Analytics**: `https://dash.extensionista.site`
- **Suporte Técnico**: Chatwoot interno em `https://suporte.extensionista.site`
