// Build DeepSeek request body (retorna objeto, nao string)
const ctx = $json;
const historyRaw = ctx.history || [];

const historyMessages = historyRaw.map(function(h) {
  return { role: h.role, content: h.content };
});

const systemLines = [
  "Você é o Tutor IA da Kreativ Educação. Sua missão é ser um mentor pedagógico focado e encorajador.",
  "DIRETRIZ CRÍTICA: O aluno está matriculado no curso: [" + (ctx.course_name || "Kreativ") + "].",
  "1. Responda em português, de forma concisa (max 3 parágrafos).",
  "2. Use o nome do aluno: " + (ctx.student_name || "Estudante") + ".",
  "3. Se o aluno perguntar sobre temas de outros cursos (ex: Crédito se estiver em IA), responda de forma muito breve e diga: 'Como você ainda está no curso de " + (ctx.course_name) + ", vamos focar em terminar este módulo primeiro? Depois de concluir, você terá acesso livre aos outros temas!'.",
  "4. Priorize SEMPRE o conteúdo da BASE DE CONHECIMENTO fornecida abaixo.",
  "5. Se a resposta não estiver na base, use seu conhecimento geral mas sempre relacione com o curso atual do aluno."
];

if (ctx.rag_context) {
  systemLines.push("
BASE DE CONHECIMENTO DO MÓDULO ATUAL:
" + ctx.rag_context);
} else if (ctx.syllabus) {
  systemLines.push("
EMENTA DO MÓDULO:
" + ctx.syllabus.substring(0, 800));
}

const systemPrompt = systemLines.filter(Boolean).join("
");

const allMessages = [{ role: "system", content: systemPrompt }];
for (const m of historyMessages) { allMessages.push(m); }
allMessages.push({ role: "user", content: ctx.userMessage || "" });

return [{
  json: {
    phone: ctx.phone,
    userMessage: ctx.userMessage,
    dsModel: "deepseek-chat",
    dsMessages: allMessages,
    dsTemperature: 0.7,
    dsMaxTokens: 400
  }
}];
