import { addKeyword } from '@builderbot/bot'
import type { BotContext, BotMethods } from '@builderbot/bot/dist/types'

// =============================================================================
// FLOW DE ATENDIMENTO HUMANO
// Disparado quando aluno solicita tutor.
// O N8N: 1) registra a sessão no DB, 2) notifica o tutor disponível (round-robin),
//         3) pausa o bot para aquele número via POST /api/pause no BuilderBot.
// =============================================================================

import { mcpClient } from '../services/mcp-client'

// Keywords que disparam transferência para humano
// Tupla explícita exigida pela tipagem do BuilderBot
const HUMAN_KEYWORDS: [string, ...string[]] = [
    'tutor',
    'humano',
    'atendente',
    'ajuda',
    'não entendi',
    'nao entendi',
    'não consigo',
    'nao consigo',
    'problema',
]

export const humanSupportFlow = addKeyword(HUMAN_KEYWORDS)
    .addAnswer(
        'Entendido! Vou conectar você com um tutor disponível. 🤝',
        { delay: 800 }
    )
    .addAnswer(
        'Por favor, descreva brevemente o que você precisa de ajuda:',
        { capture: true, delay: 500 },
        async (ctx: BotContext, { flowDynamic }: BotMethods) => {
            const phone = ctx.from
            const reason = ctx.body

            await flowDynamic([
                { body: 'Aguarde um momento, estou acionando um tutor...' },
            ])

            try {
                // CRM: Track tutor request (+5 points)
                await mcpClient.trackInteraction(phone, 5, 'pedido_suporte')

                // N8N recebe o pedido e: distribui para tutor (round-robin),
                // registra sessão, e chama POST /api/pause no BuilderBot
                // MCP: Solicitar tutor via N8N
                // Usando callTool genérico para garantir compatibilidade
                const resultTools = await mcpClient.callTool('request-human-support', {
                    phone,
                    reason
                })

                console.log(`✅ MCP Tool Result: request-human-support`, resultTools)

                // Safely parse result
                let result = { success: false, tutorName: 'Equipe', estimatedWait: 'alguns minutos' }

                if (resultTools && resultTools.content && resultTools.content[0] && resultTools.content[0].text) {
                    try {
                        const parsed = JSON.parse(resultTools.content[0].text)
                        // Merge parsed result with defaults
                        result = { ...result, ...parsed }
                    } catch (e) {
                        console.error('Falha ao parsear JSON do N8N (ignorando):', e)
                    }
                }

                if (result.success || resultTools) {
                    await flowDynamic([
                        {
                            body: `✅ ${result.tutorName} foi notificado(a) e entrará em contato em breve.\n\nTempo estimado de espera: ${result.estimatedWait}\n\nO bot ficará pausado durante o atendimento. Quando o tutor encerrar, você voltará automaticamente para a trilha.`,
                        },
                    ])
                } else {
                    throw new Error('Falha no retorno do N8N')
                }

            } catch (err) {
                console.error('[humanSupportFlow] Erro ao acionar N8N:', err)
                await flowDynamic([
                    {
                        body: 'Seu pedido foi registrado. Um tutor entrará em contato em breve. ✅',
                    },
                ])
            }
        }
    )
