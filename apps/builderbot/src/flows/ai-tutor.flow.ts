import { addKeyword } from '@builderbot/bot'
import type { BotContext, BotMethods } from '@builderbot/bot/dist/types'
import { askDeepSeek } from '../services/ai'

// =============================================================================
// FLOW DE IA — Intercepta mensagens livres com palavras-chave amplas.
// Para catch-all em BuilderBot 1.x, combinar com a modificação do welcomeFlow.
// =============================================================================

// Termos que indicam uma pergunta ou texto livre (não cobertos por outros flows)
const AI_KEYWORDS: [string, ...string[]] = [
    'como',
    'o que',
    'o que é',
    'qual',
    'quando',
    'onde',
    'porque',
    'por que',
    'quero saber',
    'me explica',
    'explica',
    'dúvida',
    'duvida',
    'pergunta',
    'não entendo',
    'nao entendo',
    'o que significa',
]

async function handleAIResponse(ctx: BotContext, { flowDynamic, state }: BotMethods) {
    const message = ctx.body?.trim()
    if (!message || message.length < 3) return

    await flowDynamic([{ body: '🤔 Pensando...' }])

    const courseContext = {
        courseName: (await state.get('courseName')) as string | undefined,
        moduleTitle: (await state.get('moduleTitle')) as string | undefined,
    }

    try {
        const reply = await askDeepSeek(message, courseContext)
        await flowDynamic([{ body: reply }])
    } catch (_err) {
        await flowDynamic([
            {
                body: 'Não consegui processar agora. Responda *TUTOR* para falar com um atendente.',
            },
        ])
    }
}

export const aiTutorFlow = addKeyword(AI_KEYWORDS).addAction(handleAIResponse)

// Re-exporta o handler para uso no welcomeFlow (default case)
export { handleAIResponse as aiHandler }
