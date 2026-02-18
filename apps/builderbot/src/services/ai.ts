import OpenAI from 'openai'

// DeepSeek é compatível com a SDK OpenAI — só muda o baseURL e o modelo
const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
})

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const SYSTEM_PROMPT = `Você é o assistente virtual da Kreativ Educação, um programa de educação profissional e social para comunidades do Tocantins e região Norte do Brasil.

Seu papel:
- Apoiar estudantes durante a trilha de aprendizagem via WhatsApp
- Responder dúvidas sobre os conteúdos dos cursos
- Motivar e engajar os estudantes
- Quando não souber algo específico, direcionar para um tutor humano

Cursos disponíveis:
- Gestão Financeira para Empreendimentos
- Boas Práticas na Produção e Manipulação de Alimentos
- Organização da Produção para o Mercado
- Inteligência Artificial e Inclusão Digital
- Produção Audiovisual
- Saúde e Bem-estar
- Administração e Gestão
- Agronegócio e Produção Rural
- (e outros)

Diretrizes:
- Seja amigável, claro e objetivo
- Use linguagem simples e acessível
- Mensagens curtas (máx. 300 caracteres quando possível)
- Em caso de dúvida técnica complexa, sugira: "Gostaria de falar com um tutor? Responda TUTOR"
- Nunca invente informações sobre módulos ou quizzes — consulte o sistema para isso
- Não discuta temas fora do escopo educacional`

/**
 * Gera resposta de IA para mensagem livre do estudante.
 * @param userMessage - Mensagem enviada pelo estudante
 * @param courseContext - Contexto do curso (nome, módulo atual)
 */
export async function askDeepSeek(
    userMessage: string,
    courseContext?: { courseName?: string; moduleTitle?: string }
): Promise<string> {
    const contextMsg = courseContext?.courseName
        ? `\n[Contexto: estudante inscrito em "${courseContext.courseName}"${courseContext.moduleTitle ? `, módulo "${courseContext.moduleTitle}"` : ''}]`
        : ''

    try {
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + contextMsg },
                { role: 'user', content: userMessage },
            ],
            max_tokens: 300,
            temperature: 0.7,
        })

        return completion.choices[0]?.message?.content?.trim()
            || 'Desculpe, não consegui processar sua mensagem. Tente novamente ou responda TUTOR para falar com um atendente.'
    } catch (err) {
        console.error('[DeepSeek] Erro na chamada à API:', err)
        throw err
    }
}
