import { addKeyword, EVENTS } from '@builderbot/bot'
import type { BotContext, BotMethods } from '@builderbot/bot/dist/types'
import { aiHandler } from './ai-tutor.flow'

const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'http://n8n:5678/webhook'

// =============================================================================
// FLOW DE BOAS-VINDAS
// Disparado quando novo contato envia qualquer mensagem (EVENTS.WELCOME).
// Também captura PARAR / CONTINUAR para pause/resume inteligente.
// =============================================================================

export const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAnswer(
        'Olá! Seja bem-vindo(a) à trilha de aprendizagem. 🎓\n\nEu sou o assistente virtual da Kreativ Educação.',
        { delay: 1000 }
    )
    .addAnswer(
        'O que você gostaria de fazer?\n\n*1* - Iniciar a trilha\n*2* - Continuar de onde parei\n*3* - Falar com um tutor\n*4* - Verificar meu certificado\n*PARAR* - Pausar e continuar depois',
        { capture: true, delay: 800 },
        async (ctx: BotContext, { gotoFlow, flowDynamic, state }: BotMethods) => {
            const choice = ctx.body.trim().toUpperCase()
            const phone = ctx.from

            await state.update({ phone, lastMenu: 'welcome' })

            switch (choice) {
                case '1':
                case 'MODULO':
                case 'MÓDULO':
                case 'INICIAR':
                    return gotoFlow(moduleFlow)

                case '2':
                case 'CONTINUAR': {
                    await flowDynamic([{ body: '🔍 Verificando seu progresso...' }])
                    try {
                        const res = await fetch(`${N8N_BASE}/get-student-module`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone }),
                        })
                        const data = await res.json() as { moduleNumber?: number; title?: string }
                        if (data.moduleNumber && data.moduleNumber > 0) {
                            await flowDynamic([{
                                body: `Bem-vindo(a) de volta! 👋\n\nVocê estava no *Módulo ${data.moduleNumber}: ${data.title || ''}*\n\nResponda *MODULO* para continuar de onde parou.`,
                            }])
                        } else {
                            await flowDynamic([{
                                body: 'Você ainda não iniciou a trilha. Responda *1* para começar agora! 🚀',
                            }])
                        }
                    } catch {
                        await flowDynamic([{
                            body: 'Responda *MODULO* para continuar sua trilha de aprendizado.',
                        }])
                    }
                    break
                }

                case '3':
                case 'TUTOR':
                    return gotoFlow(humanSupportFlow)

                case '4':
                case 'CERTIFICADO': {
                    await flowDynamic([
                        { body: '🔍 Verificando seus certificados...' },
                        { body: 'Em breve você poderá consultar seus certificados aqui! Conclua todos os módulos para emitir. 🏆' },
                    ])
                    break
                }

                case 'PARAR':
                case 'STOP':
                case 'PAUSAR': {
                    try {
                        await fetch(`${N8N_BASE}/get-student-module`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone }),
                        })
                    } catch { /* ignore */ }
                    await flowDynamic([{
                        body: '⏸️ Tudo bem! Seu progresso foi salvo.\n\nQuando quiser retomar, é só responder *CONTINUAR* aqui nesta conversa. A gente não esquece onde você parou! 💪',
                    }])
                    break
                }

                case 'MENU':
                case 'AJUDA':
                case 'OI':
                case 'OLÁ':
                case 'OLA': {
                    await flowDynamic([{
                        body: 'Escolha uma opção:\n\n*1* - Iniciar a trilha\n*2* - Continuar de onde parei\n*3* - Falar com um tutor\n*PARAR* - Pausar para depois\n\nOu me faça qualquer pergunta! 😊',
                    }])
                    break
                }

                default:
                    await aiHandler(ctx, { gotoFlow, flowDynamic, state } as BotMethods)
            }
        }
    )

// Import circular — resolvido aqui para evitar problema com TS
import { humanSupportFlow } from './human-support.flow'
import { moduleFlow } from './module.flow'
