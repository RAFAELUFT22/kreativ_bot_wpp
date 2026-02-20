-- =============================================================================
-- SEED: Conteúdo real dos módulos do Curso IA (course_int_id = 19)
-- Inteligência Artificial e Inclusão Digital
-- 3 módulos com HTML rico (~400 palavras), quiz discursivo (3 perguntas cada)
-- Aplicar: docker exec -i kreativ_postgres psql -U kreativ_user -d kreativ_edu < scripts/05-seed-content-ia.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- MÓDULO 1: O que é IA e como ela está no seu dia a dia
-- -----------------------------------------------------------------------------
INSERT INTO modules (
    course_id, course_int_id, module_number,
    title, description,
    content_text, quiz_questions, passing_score,
    is_published, is_active
)
VALUES (
    '19', 19, 1,
    'O que é IA e como ela está no seu dia a dia',
    'Entenda o que é Inteligência Artificial de forma simples e descubra onde ela já está presente na sua vida.',
    '<h2>Bem-vindo ao Mundo da Inteligência Artificial</h2>

<p>Você já perguntou ao Google algo e ele completou a sua frase antes de terminar? Ou recebeu uma sugestão de série no Netflix que parecia lida na sua cabeça? Essas experiências são exemplos de <strong>Inteligência Artificial (IA)</strong> funcionando para você — e você nem percebeu.</p>

<h2>O que é Inteligência Artificial?</h2>

<p>IA é a capacidade de máquinas e computadores de <strong>aprenderem com dados e tomarem decisões</strong> de forma parecida com os seres humanos. Em vez de seguir um roteiro fixo, a IA analisa padrões e melhora com o tempo.</p>

<p>Pense assim: um computador comum segue instruções exatas (se A, faça B). Já uma IA aprende observando milhares de exemplos e, a partir daí, consegue antecipar o que você vai precisar.</p>

<h2>IA no seu bolso — exemplos reais</h2>

<ul>
<li><strong>WhatsApp:</strong> O corretor automático e o reconhecimento de voz usam IA para entender o que você quer dizer.</li>
<li><strong>YouTube e Spotify:</strong> As recomendações de vídeos e músicas são feitas por algoritmos de IA que aprendem seus gostos.</li>
<li><strong>Banco e cartão de crédito:</strong> Quando seu banco bloqueia uma compra suspeita, é a IA analisando se aquele gasto combina com o seu perfil.</li>
<li><strong>Google Maps:</strong> As rotas e previsões de trânsito são calculadas por IA em tempo real.</li>
<li><strong>iFood e Rappi:</strong> A estimativa de tempo de entrega e as promoções personalizadas são geradas por IA.</li>
</ul>

<h2>IA é robô que vai tomar meu emprego?</h2>

<p>Essa é uma preocupação real e precisamos falar sobre ela com honestidade. A IA <strong>vai mudar</strong> muitas profissões — mas a história mostra que novas tecnologias sempre criaram mais empregos novos do que eliminaram.</p>

<p>O que a IA faz muito bem: tarefas repetitivas, análise de grandes quantidades de dados, reconhecimento de padrões. O que a IA <strong>não consegue fazer</strong>: criatividade genuína, empatia, liderança humana, adaptação a situações completamente novas.</p>

<p>Quem vai se dar melhor no futuro é a pessoa que souber <strong>trabalhar junto com a IA</strong> — usando ela como ferramenta, não como ameaça.</p>

<h2>Por onde começar?</h2>

<p>Não precisa ser desenvolvedor nem ter faculdade para usar IA. Existem ferramentas hoje, como o <strong>ChatGPT</strong>, que você acessa pelo celular e que consegue redigir textos, responder dúvidas, criar roteiros e muito mais — apenas conversando em português normal.</p>

<p>Ao longo deste curso, você vai aprender a usar essas ferramentas de forma prática para melhorar sua vida pessoal e profissional.</p>

<blockquote><em>"Não é o mais forte que sobrevive, nem o mais inteligente. É o que melhor se adapta às mudanças." — Charles Darwin</em></blockquote>',

    '[
      {"id": 1, "type": "discursive", "question": "Em suas próprias palavras, explique o que é Inteligência Artificial e dê um exemplo de IA que você já usou no dia a dia (pode ser algo do seu celular, aplicativo ou serviço online)."},
      {"id": 2, "type": "discursive", "question": "Você acha que a IA vai ajudar ou atrapalhar na sua área de trabalho ou negócio? Por quê? Pense em uma tarefa que a IA poderia facilitar para você."},
      {"id": 3, "type": "discursive", "question": "Dentre os exemplos de IA citados no módulo (WhatsApp, YouTube, banco, Maps, iFood), qual você usa com mais frequência? Você percebeu que estava usando IA? O que mudou na sua percepção depois de ler este conteúdo?"}
    ]',
    70, TRUE, TRUE
)
ON CONFLICT (course_id, module_number) DO UPDATE
    SET title         = EXCLUDED.title,
        description   = EXCLUDED.description,
        content_text  = EXCLUDED.content_text,
        quiz_questions= EXCLUDED.quiz_questions,
        is_published  = EXCLUDED.is_published,
        course_int_id = EXCLUDED.course_int_id,
        updated_at    = NOW();

-- -----------------------------------------------------------------------------
-- MÓDULO 2: Ferramentas de IA que você pode usar agora
-- -----------------------------------------------------------------------------
INSERT INTO modules (
    course_id, course_int_id, module_number,
    title, description,
    content_text, quiz_questions, passing_score,
    is_published, is_active
)
VALUES (
    '19', 19, 2,
    'Ferramentas de IA que você pode usar agora',
    'Conheça as principais ferramentas de IA disponíveis gratuitamente e aprenda como usá-las no dia a dia.',
    '<h2>As Ferramentas de IA estão ao seu Alcance</h2>

<p>Até pouco tempo atrás, usar Inteligência Artificial era coisa de grandes empresas com supercomputadores. Hoje, com um smartphone e conexão à internet, você acessa as mesmas tecnologias que impulsionam as maiores empresas do mundo — muitas delas <strong>de graça</strong>.</p>

<h2>ChatGPT — Seu Assistente de Texto</h2>

<p>O <strong>ChatGPT</strong> (da empresa OpenAI) é como ter um assistente disponível 24 horas que:</p>
<ul>
<li>Responde perguntas em português claro e simples</li>
<li>Escreve textos, e-mails, currículos e propostas comerciais</li>
<li>Explica conceitos difíceis de forma acessível</li>
<li>Cria roteiros, scripts para vídeos e posts para redes sociais</li>
<li>Traduz textos e corrige erros gramaticais</li>
</ul>

<p><strong>Como acessar:</strong> Entre em chat.openai.com pelo celular ou computador. A versão gratuita (GPT-3.5) já é muito capaz para o uso diário.</p>

<h2>Google Gemini — IA Integrada ao Google</h2>

<p>O <strong>Gemini</strong> é a IA do Google, integrada ao Gmail, Google Docs e Google Drive. Com ele você pode:</p>
<ul>
<li>Redigir e-mails profissionais com um clique</li>
<li>Resumir documentos longos automaticamente</li>
<li>Gerar imagens a partir de descrições em texto</li>
<li>Pesquisar com respostas mais completas do que o Google tradicional</li>
</ul>

<h2>Canva IA — Design para Todos</h2>

<p>O <strong>Canva</strong> já era fácil de usar, mas agora com IA ficou ainda mais poderoso:</p>
<ul>
<li><strong>Magic Write:</strong> gera textos para posts, apresentações e materiais de marketing</li>
<li><strong>Text to Image:</strong> cria imagens originais a partir de uma descrição sua</li>
<li><strong>Background Remover:</strong> remove o fundo de fotos automaticamente</li>
</ul>

<h2>IA no WhatsApp — Mais Próxima do que Você Imagina</h2>

<p>Hoje já existem bots de IA integrados ao WhatsApp. Empresas usam IA para:</p>
<ul>
<li>Atender clientes automaticamente fora do horário comercial</li>
<li>Qualificar leads antes de transferir para um vendedor humano</li>
<li>Enviar lembretes e notificações personalizadas</li>
</ul>

<p>Como você está estudando neste momento — via WhatsApp — você já é usuário de um sistema com IA!</p>

<h2>Dica de Uso: Como Fazer uma Boa Pergunta para a IA</h2>

<p>A qualidade da resposta da IA depende da qualidade da sua pergunta (os especialistas chamam isso de <em>prompt</em>). Siga esta fórmula simples:</p>

<ol>
<li><strong>Contexto:</strong> "Sou artesão que vende produtos em feiras..."</li>
<li><strong>Tarefa:</strong> "...e preciso de um texto para minha página do Instagram..."</li>
<li><strong>Formato:</strong> "...em tom descontraído, com no máximo 150 caracteres e com emojis."</li>
</ol>

<p>Quanto mais específico você for, melhor será a resposta da IA.</p>',

    '[
      {"id": 1, "type": "discursive", "question": "Escolha uma das ferramentas mencionadas no módulo (ChatGPT, Gemini, Canva IA ou outra que você conheça) e descreva como você poderia usá-la para resolver um problema real na sua vida pessoal ou no seu trabalho."},
      {"id": 2, "type": "discursive", "question": "Usando a fórmula de prompt (Contexto + Tarefa + Formato) ensinada no módulo, escreva uma pergunta que você faria para o ChatGPT sobre algo relacionado ao seu negócio, trabalho ou vida pessoal."},
      {"id": 3, "type": "discursive", "question": "Você já usou alguma dessas ferramentas antes? Se sim, qual foi sua experiência? Se não, qual delas você mais quer experimentar primeiro e por quê?"}
    ]',
    70, TRUE, TRUE
)
ON CONFLICT (course_id, module_number) DO UPDATE
    SET title         = EXCLUDED.title,
        description   = EXCLUDED.description,
        content_text  = EXCLUDED.content_text,
        quiz_questions= EXCLUDED.quiz_questions,
        is_published  = EXCLUDED.is_published,
        course_int_id = EXCLUDED.course_int_id,
        updated_at    = NOW();

-- -----------------------------------------------------------------------------
-- MÓDULO 3: IA no seu Negócio — Do Atendimento ao Marketing
-- -----------------------------------------------------------------------------
INSERT INTO modules (
    course_id, course_int_id, module_number,
    title, description,
    content_text, quiz_questions, passing_score,
    is_published, is_active
)
VALUES (
    '19', 19, 3,
    'IA no seu Negócio — Do Atendimento ao Marketing',
    'Aprenda estratégias práticas para usar IA e aumentar as vendas, melhorar o atendimento e economizar tempo no seu negócio.',
    '<h2>IA como Diferencial Competitivo para Pequenos Negócios</h2>

<p>Uma das grandes vantagens da IA hoje é que ela <strong>niveló o campo de jogo</strong>. Uma pequena empresa ou empreendedor individual pode agora ter acesso às mesmas ferramentas que grandes corporações usam para marketing, atendimento e produção de conteúdo — por uma fração do custo.</p>

<h2>1. Atendimento ao Cliente com IA</h2>

<p>O maior custo de muitos pequenos negócios é o tempo perdido respondendo as mesmas perguntas repetidas vezes. A IA resolve isso:</p>

<ul>
<li><strong>Chatbots no WhatsApp:</strong> Respondem automaticamente fora do horário comercial, qualificam clientes e encaminham apenas as dúvidas complexas para você.</li>
<li><strong>Respostas automáticas no Instagram:</strong> Ferramentas como o ManyChat respondem comentários e mensagens diretas com IA.</li>
<li><strong>FAQ Inteligente:</strong> Configure o ChatGPT com informações do seu negócio e deixe-o responder dúvidas frequentes.</li>
</ul>

<p><strong>Resultado prático:</strong> Empreendedores que implementam chatbots relatam redução de 60% a 70% no tempo gasto com atendimento rotineiro.</p>

<h2>2. Marketing de Conteúdo com IA</h2>

<p>Criar conteúdo de qualidade é um dos maiores desafios para quem empreende sozinho. A IA elimina o "bloqueio criativo":</p>

<ul>
<li><strong>Legendas para Instagram:</strong> Descreva seu produto ou serviço e peça para a IA criar 5 opções de legenda com hashtags.</li>
<li><strong>Script para Reels/TikTok:</strong> "Me ajude a criar um vídeo de 60 segundos mostrando os benefícios do meu produto [X] para o público [Y]."</li>
<li><strong>E-mail marketing:</strong> A IA escreve newsletters completas, com assunto chamativo e chamada para ação.</li>
<li><strong>Criação de imagens:</strong> O Canva IA e o Microsoft Designer geram imagens profissionais sem precisar de designer.</li>
</ul>

<h2>3. Gestão e Produtividade com IA</h2>

<ul>
<li><strong>Planilhas inteligentes:</strong> O Google Sheets e o Excel agora têm IA que analisa seus dados e cria gráficos e relatórios automaticamente.</li>
<li><strong>Precificação:</strong> Use o ChatGPT para calcular custos, margens e simular cenários de preço.</li>
<li><strong>Contratos e documentos:</strong> A IA ajuda a redigir contratos simples, termos de serviço e propostas comerciais.</li>
<li><strong>Pesquisa de mercado:</strong> Peça para a IA resumir tendências do seu setor ou analisar o que os concorrentes estão fazendo.</li>
</ul>

<h2>4. Exemplo Real: O Artesão Digital</h2>

<p>Imagine uma artesã que vende produtos no Instagram. Com IA, ela pode:</p>
<ol>
<li>Fotografar seus produtos e usar IA para remover o fundo (Canva)</li>
<li>Pedir ao ChatGPT que escreva 10 legendas diferentes para o mesmo produto</li>
<li>Configurar um chatbot que responde perguntas sobre preço, tamanho e prazo de entrega</li>
<li>Usar IA para gerar imagens de "lifestyle" com seus produtos</li>
</ol>

<p>Resultado: mais tempo para criar, menos tempo para administrar.</p>

<h2>Próximos Passos</h2>

<p>Você chegou ao fim do módulo 3 e do curso! Mas a jornada com IA está apenas começando. As ferramentas evoluem todo mês. O segredo é: <strong>experimentar, errar rápido e aprender</strong>.</p>

<p>Lembre-se: a IA é uma ferramenta. Quem vai fazer a diferença é você — com sua criatividade, seus valores e seu conhecimento do seu cliente.</p>

<blockquote><em>"A tecnologia não vai substituir os grandes professores, mas a tecnologia nas mãos de grandes professores é transformadora." — Thomas Friedman</em></blockquote>',

    '[
      {"id": 1, "type": "discursive", "question": "Pense no seu negócio atual ou em um negócio que você sonha ter. Descreva 2 tarefas que a IA poderia fazer por você, economizando tempo ou melhorando resultados. Seja específico sobre qual ferramenta usaria e como."},
      {"id": 2, "type": "discursive", "question": "Escreva um prompt (instrução) que você daria ao ChatGPT para criar um post para as redes sociais sobre seu produto ou serviço. Use a fórmula: Contexto + Tarefa + Formato aprendida no módulo anterior."},
      {"id": 3, "type": "discursive", "question": "Qual foi o aprendizado mais importante de todo o curso de IA para você? Como você pretende aplicar esse conhecimento nos próximos 30 dias? Descreva uma ação concreta que vai tomar."}
    ]',
    70, TRUE, TRUE
)
ON CONFLICT (course_id, module_number) DO UPDATE
    SET title         = EXCLUDED.title,
        description   = EXCLUDED.description,
        content_text  = EXCLUDED.content_text,
        quiz_questions= EXCLUDED.quiz_questions,
        is_published  = EXCLUDED.is_published,
        course_int_id = EXCLUDED.course_int_id,
        updated_at    = NOW();

COMMIT;

-- Verificação pós-seed
SELECT
    m.module_number,
    m.title,
    m.is_published,
    length(m.content_text) AS content_length,
    jsonb_array_length(m.quiz_questions) AS num_questions
FROM modules m
WHERE m.course_int_id = 19
ORDER BY m.module_number;
