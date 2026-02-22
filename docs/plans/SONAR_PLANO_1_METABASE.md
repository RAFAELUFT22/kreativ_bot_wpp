# Plano Metabase — Kreativ Visão Operacional
> Para: Sonar Pro (Comet) — agente de browser
> URL alvo: https://dash.extensionista.site
> Banco: kreativ_edu @ kreativ_postgres:5432 (PostgreSQL 15)
> Todas as queries foram testadas e validadas contra o schema real.

---

## CONTEXTO

Você vai configurar um dashboard analítico no Metabase chamado **"Kreativ — Visão Operacional"** com 5 cards. O banco de dados já está conectado. Seu trabalho é criar os cards e organizar o dashboard.

**Credenciais de login Metabase:** use o admin configurado na primeira vez que o Metabase foi acessado. Se não souber, tente admin@extensionista.site ou o email usado no setup inicial.

---

## PASSO 0 — Verificar conexão com o banco

1. Faça login em https://dash.extensionista.site
2. Clique no **ícone de engrenagem (⚙)** no canto superior direito da tela
3. No menu que abre, clique em **"Admin settings"**
4. Na barra de menu superior da tela de admin, clique em **"Databases"**
5. Verifique se aparece um banco chamado **"kreativ_edu"**

**SE o banco aparecer:** clique nele e confirme:
- Host: `kreativ_postgres`
- Port: `5432`
- Database name: `kreativ_edu`
- Username: `kreativ_user`
- Clique em **"Save changes"** (mesmo sem alterar nada) para confirmar

**SE o banco NÃO aparecer:** clique em **"Add a database"** (botão azul no canto superior direito):
- Database type: `PostgreSQL`
- Display name: `kreativ_edu`
- Host: `kreativ_postgres`
- Port: `5432`
- Database name: `kreativ_edu`
- Username: `kreativ_user`
- Password: `[a senha do POSTGRES_PASSWORD — peça ao operador]`
- Deixe SSL desativado
- Clique **"Save"** — aguarde "Successfully connected"

---

## PASSO 1 — Criar o Dashboard vazio

1. Clique no logo do Metabase (canto superior esquerdo) para ir à Home
2. Clique no botão **"New +"** (azul, canto superior direito)
3. No menu dropdown, clique em **"Dashboard"**
4. No campo "Name", digite exatamente: `Kreativ — Visão Operacional`
5. O campo "Description" pode ficar vazio
6. Clique no botão **"Create"**
7. Você verá o dashboard vazio com a mensagem "This dashboard is empty"

---

## PASSO 2 — Card 1: "Alunos Ativos Hoje" (Big Number)

### 2A — Criar a question

1. No dashboard vazio, clique no botão **"Add a question"** (ou o ícone "+" dentro do dashboard)
2. Uma janela modal abre. Clique em **"New question"** (botão azul)
3. A tela de criação de question abre. Clique em **"Native query"** (ou "SQL" — é a opção que permite escrever SQL puro, geralmente um ícone de banco de dados com `</>`  ou a aba "SQL")
4. No dropdown "Pick your starting data" ou "Select a database", selecione **"kreativ_edu"**
5. Uma caixa de texto grande aparece. Cole o SQL abaixo:

```sql
SELECT COUNT(DISTINCT student_id) AS alunos_ativos_hoje
FROM enrollment_progress
WHERE completed_at >= CURRENT_DATE
```

6. Clique no botão **"Run query"** (ícone de play ▶ ou botão azul "Visualize")
7. Os resultados aparecem. Clique em **"Visualization"** (ícone gráfico no canto inferior esquerdo, ou barra lateral)
8. No painel de visualizações, clique em **"Number"** (o ícone com "123" ou um número grande)
9. Nas configurações do Number, procure o campo **"Column"** e selecione `alunos_ativos_hoje`
10. Procure a opção **"Label"** e escreva: `Alunos Ativos Hoje`

### 2B — Salvar e adicionar ao dashboard

11. Clique no botão **"Save"** (canto superior direito)
12. No campo "Name", escreva: `Card 1 — Alunos Ativos Hoje`
13. Em "Where do you want to save this?", escolha a pasta padrão ou "Our analytics"
14. Clique **"Save"**
15. Uma pergunta aparece: "Do you want to add this to a dashboard?" → clique **"Yes please!"**
16. Selecione o dashboard **"Kreativ — Visão Operacional"** e clique **"Add"**

---

## PASSO 3 — Card 2: "Alunos Ativos Esta Semana" (Big Number)

Repita o mesmo processo do Passo 2, mas com o SQL abaixo:

```sql
SELECT COUNT(DISTINCT student_id) AS alunos_ativos_semana
FROM enrollment_progress
WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'
```

- Visualização: **Number**
- Label: `Alunos Ativos Esta Semana`
- Nome ao salvar: `Card 2 — Alunos Ativos Esta Semana`
- Adicionar ao dashboard: **"Kreativ — Visão Operacional"**

---

## PASSO 4 — Card 3: "Funil de Aprendizado" (Bar Chart)

### 4A — Criar a question

1. Clique no botão **"Add a question"** no dashboard (ou acesse a home → New → Question)
2. Clique em **"Native query"** → selecione database **"kreativ_edu"**
3. Cole o SQL:

```sql
SELECT
  CASE
    WHEN current_module = 0 THEN 'Não iniciado'
    ELSE CONCAT('Módulo ', current_module)
  END AS modulo,
  COUNT(*) AS alunos
FROM students
GROUP BY current_module
ORDER BY current_module
```

4. Clique **"Run query"** (ou Visualize)
5. Clique em **"Visualization"** → escolha **"Bar"** (gráfico de barras verticais)
6. Nas configurações do gráfico:
   - Eixo X (horizontal): selecione coluna `modulo`
   - Eixo Y (vertical): selecione coluna `alunos`
   - Título do gráfico: `Distribuição por Módulo`

### 4B — Salvar

7. Clique **"Save"** → nome: `Card 3 — Funil de Aprendizado`
8. Adicionar ao dashboard: **"Kreativ — Visão Operacional"**

---

## PASSO 5 — Card 4: "Score Médio por Módulo" (Bar Chart)

1. Nova question → Native query → kreativ_edu
2. Cole o SQL:

```sql
SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  ROUND(AVG(score)::numeric, 1) AS score_medio,
  COUNT(*) AS tentativas
FROM enrollment_progress
WHERE score IS NOT NULL
GROUP BY module_number
ORDER BY module_number
```

**Nota:** O filtro de 30 dias foi removido porque o banco tem poucos dados no momento. Isso mostra todos os registros históricos.

3. Clique **"Run query"** → **"Visualization"** → **"Bar"**
4. Configurar:
   - Eixo X: `modulo`
   - Eixo Y: `score_medio`
   - Título: `Score Médio por Módulo`
5. Save → nome: `Card 4 — Score Médio por Módulo`
6. Adicionar ao dashboard

---

## PASSO 6 — Card 5: "Chamadas AI Tutor — 14 dias" (Line Chart)

1. Nova question → Native query → kreativ_edu
2. Cole o SQL:

```sql
SELECT
  DATE(created_at) AS dia,
  COUNT(*) AS chamadas,
  SUM(COALESCE(prompt_tokens, 0)) AS tokens_prompt,
  SUM(COALESCE(completion_tokens, 0)) AS tokens_resposta,
  ROUND(AVG(COALESCE(duration_ms, 0))::numeric / 1000, 1) AS tempo_medio_s
FROM ai_usage_log
WHERE event_type = 'ai_tutor'
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC
```

3. Clique **"Run query"**

   **Atenção:** A tabela `ai_usage_log` existe mas está vazia por agora (zero registros). O Metabase vai mostrar "No results" ou uma linha vazia — isso é **esperado e correto**. O card vai popular automaticamente quando o bot começar a ser usado.

4. Mesmo com zero resultados, clique **"Visualization"** → escolha **"Line"** (gráfico de linhas)
5. Configurar:
   - Eixo X: `dia`
   - Eixo Y: `chamadas`
   - Título: `Chamadas AI Tutor (14 dias)`
6. Save → nome: `Card 5 — Uso do AI Tutor`
7. Adicionar ao dashboard

---

## PASSO 7 — Organizar o Layout do Dashboard

1. Abra o dashboard **"Kreativ — Visão Operacional"**
2. Clique no botão **"Edit dashboard"** (ícone de lápis ✏️ ou botão no canto superior direito)
3. Arraste e redimensione os cards:

```
┌─────────────────────────┬─────────────────────────┐
│  Card 1                 │  Card 2                 │
│  Alunos Ativos Hoje     │  Alunos Ativos Semana   │
│  [Big Number pequeno]   │  [Big Number pequeno]   │
├─────────────────────────┼─────────────────────────┤
│  Card 3                 │  Card 4                 │
│  Funil de Aprendizado   │  Score Médio/Módulo      │
│  [Bar Chart]            │  [Bar Chart]            │
├─────────────────────────┴─────────────────────────┤
│  Card 5 — Chamadas AI Tutor (14 dias)             │
│  [Line Chart — largura total]                     │
└───────────────────────────────────────────────────┘
```

4. Cards 1 e 2 devem ocupar cada um **~50% da largura** e altura pequena (1-2 linhas de grid)
5. Cards 3 e 4 devem ocupar cada um **~50% da largura** e altura média (3-4 linhas)
6. Card 5 deve ocupar **100% da largura** (largura total) e altura média
7. Clique **"Save"** para salvar o layout

---

## RESULTADO ESPERADO

Após concluir, o dashboard deve mostrar:
- **Card 1:** Número "1" (1 aluno completou algo hoje)
- **Card 2:** Número ≥ 1 (alunos ativos nos últimos 7 dias)
- **Card 3:** Barras mostrando "Não iniciado", "Módulo 1", "Módulo 2" com contagens
- **Card 4:** Barras com score médio 50.0 para Módulo 1 e Módulo 2
- **Card 5:** Gráfico vazio (sem dados em ai_usage_log ainda) — normal

---

## VERIFICAÇÃO FINAL

Após salvar tudo, acesse https://dash.extensionista.site e confirme:
1. O dashboard "Kreativ — Visão Operacional" aparece na lista
2. Todos os 5 cards estão visíveis
3. Nenhum card mostra erro de SQL (se aparecer erro vermelho, copie a mensagem e informe)

**Se algum card mostrar erro de permissão ou "table not found"**, verifique se a conexão de banco está usando `kreativ_user` no database `kreativ_edu` (não `postgres` nem `n8n`).


---

## PARTE 3 — Dashboard "Kreativ — Monitoramento" (segundo dashboard)

> Dashboard operacional separado. Focado em ação, não em KPI.
> Criado em paralelo ao "Visão Operacional" ou após ele.

### Passo 3.1 — Criar o dashboard

1. Home → "New +" → "Dashboard"
2. Nome: `Kreativ — Monitoramento`
3. Salve vazio

### Passo 3.2 — Big Number: "Certificados Emitidos"

SQL:
```sql
SELECT COUNT(*) AS certificados_emitidos FROM certificates
```
Visualização: Number | Label: `Certificados Emitidos`
Salve: `Monitor 1 — Certificados Emitidos` → Add to `Kreativ — Monitoramento`

### Passo 3.3 — Big Number: "Alunos Parados >7 dias"

SQL:
```sql
SELECT COUNT(*) AS parados
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0
```
Visualização: Number | Label: `Alunos Parados >7 dias`
Salve: `Monitor 2 — Alunos Parados` → Add to dashboard

### Passo 3.4 — Big Number: "Alunos Novos ≤3 dias"

SQL:
```sql
SELECT COUNT(*) AS novos FROM students
WHERE created_at >= NOW() - INTERVAL '3 days'
```
Visualização: Number | Label: `Alunos Novos (últimos 3 dias)`
Salve: `Monitor 3 — Alunos Novos` → Add to dashboard

### Passo 3.5 — Big Number: "Pré-inscrições Aguardando"

SQL:
```sql
SELECT COUNT(*) AS aguardando
FROM pre_inscriptions
WHERE convertido = false AND telefone_valido = true
```
Visualização: Number | Label: `Pré-inscrições Aguardando`
Salve: `Monitor 4 — Pre-inscrições` → Add to dashboard

### Passo 3.6 — Tabela: "Alunos Parados >7 dias" (com telefone)

SQL:
```sql
SELECT
  COALESCE(name, 'Sem nome') AS nome,
  phone AS telefone,
  current_module AS modulo_atual,
  EXTRACT(DAY FROM NOW() - updated_at)::int AS dias_parado,
  'https://wa.me/' || phone AS link_whatsapp
FROM students
WHERE updated_at < NOW() - INTERVAL '7 days'
  AND attendance_status = 'bot'
  AND current_module > 0
ORDER BY updated_at ASC
```
Visualização: **Table** (não gráfico — precisa do telefone para ação direta)
Salve: `Monitor 5 — Lista Parados >7d` → Add to dashboard

### Passo 3.7 — Tabela: "Reprovados sem aprovação"

SQL:
```sql
SELECT
  s.name AS nome,
  s.phone AS telefone,
  ep.module_number AS modulo,
  ep.score AS ultimo_score,
  COUNT(*) AS tentativas
FROM enrollment_progress ep
JOIN students s ON s.id = ep.student_id
WHERE ep.status = 'failed'
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_progress ep2
    WHERE ep2.student_id = ep.student_id
      AND ep2.module_number = ep.module_number
      AND ep2.status = 'passed'
  )
GROUP BY s.name, s.phone, ep.module_number, ep.score
ORDER BY tentativas DESC, ep.score ASC
```
Visualização: **Table**
Salve: `Monitor 6 — Reprovados sem aprovação` → Add to dashboard

### Passo 3.8 — Bar Chart: "Taxa de Aprovação por Módulo"

SQL:
```sql
SELECT
  CONCAT('Módulo ', module_number) AS modulo,
  COUNT(*) FILTER (WHERE status = 'passed') AS aprovados,
  COUNT(*) FILTER (WHERE status = 'failed') AS reprovados,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'passed') / NULLIF(COUNT(*), 0), 1) AS taxa_pct
FROM enrollment_progress
GROUP BY module_number
ORDER BY module_number
```
Visualização: Bar | X = `modulo` | Y = `aprovados` e `reprovados` (grouped)
Salve: `Monitor 7 — Taxa Aprovação por Módulo` → Add to dashboard

### Passo 3.9 — Bar horizontal: "Funil de Conversão"

SQL:
```sql
SELECT unnest(ARRAY['Pré-inscrições','Alunos cadastrados','Iniciaram','Certificados']) AS etapa,
       unnest(ARRAY[
         (SELECT COUNT(*) FROM pre_inscriptions)::int,
         (SELECT COUNT(*) FROM students)::int,
         (SELECT COUNT(*) FROM students WHERE current_module > 0)::int,
         (SELECT COUNT(*) FROM certificates)::int
       ]) AS total
```
Visualização: Bar (horizontal se disponível) | X = `etapa` | Y = `total`
Salve: `Monitor 8 — Funil de Conversão` → Add to dashboard

### Passo 3.10 — Organizar layout

```
Linha 1: [Certificados] [Parados >7d] [Novos ≤3d] [Pré-inscrições]  ← 4 big numbers
Linha 2: [Tabela Parados >7d]  [Tabela Reprovados]                   ← 2 tables, 50/50
Linha 3: [Taxa Aprovação — Bar]  [Funil — Bar horizontal]            ← 2 charts, 50/50
```
