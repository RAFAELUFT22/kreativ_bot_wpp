import { addKeyword } from '@builderbot/bot'
import type { BotContext, BotMethods } from '@builderbot/bot/dist/types'

// =============================================================================
// FLOW DE MÓDULO
// Gerencia a progressão dentro de um módulo (conteúdo + quiz).
// O conteúdo real e as perguntas vêm do banco de dados (tabela modules).
// O N8N é chamado via webhook para registrar respostas e calcular scores.
// =============================================================================

// N8N_WEBHOOK_BASE está disponível via env: http://n8n:5678/webhook
const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'http://n8n:5678/webhook'

interface QuizQuestion {
    id: number
    question: string
    options: Record<string, string>
    answer: string
    feedbackCorrect: string
    feedbackWrong: string
}

export const moduleFlow = addKeyword(['modulo', 'módulo', 'iniciar', 'continuar'])
    .addAnswer(
        '📚 Carregando o conteúdo do módulo...',
        { delay: 1000 },
        async (ctx: BotContext, { flowDynamic, state }: BotMethods) => {
            const phone = ctx.from

            try {
                // Chama N8N para buscar o módulo atual do aluno e o conteúdo
                const response = await fetch(`${N8N_BASE}/get-student-module`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone }),
                })

                if (!response.ok) {
                    throw new Error(`N8N retornou ${response.status}`)
                }

                const data = await response.json() as {
                    moduleNumber: number
                    title: string
                    content: string
                    hasQuiz: boolean
                    quizQuestions?: QuizQuestion[]
                }

                await state.update({
                    currentModule: data.moduleNumber,
                    moduleTitle: data.title,
                    awaitingQuiz: data.hasQuiz,
                    quizQuestions: data.quizQuestions || [],
                })

                await flowDynamic([
                    { body: `*Módulo ${data.moduleNumber}: ${data.title}*` },
                    { body: data.content, delay: 1500 },
                ])

                if (data.hasQuiz) {
                    await flowDynamic([
                        {
                            body: 'Quando terminar de ler, responda *QUIZ* para iniciar a avaliação do módulo.',
                            delay: 500,
                        },
                    ])
                }
            } catch (err) {
                console.error('[moduleFlow] Erro ao buscar módulo:', err)
                await flowDynamic([
                    {
                        body: 'Tivemos um problema ao carregar o conteúdo. Tente novamente em alguns instantes ou fale com um tutor.',
                    },
                ])
            }
        }
    )

// Quiz handler — busca perguntas reais do estado (salvas pelo moduleFlow)
export const quizFlow = addKeyword(['quiz', 'QUIZ', 'avaliação', 'prova'])
    .addAnswer(
        'Vamos começar a avaliação! Responda com a letra da alternativa correta.',
        { delay: 800 },
        async (ctx: BotContext, { flowDynamic, state }: BotMethods) => {
            // Exibe a pergunta real do banco de dados
            const questions = (await state.get('quizQuestions')) as QuizQuestion[] | undefined
            const q = questions?.[0]

            if (q) {
                const optionsText = Object.entries(q.options)
                    .map(([k, v]) => `*${k})* ${v}`)
                    .join('\n')
                await flowDynamic([{ body: `*${q.question}*\n\n${optionsText}`, delay: 500 }])
            } else {
                // Fallback se não houver questões no estado
                await flowDynamic([{
                    body: '*Pergunta:* Qual é um dos 3 pilares do negócio digital?\n\n*A)* Produto/Serviço\n*B)* Escritório físico\n*C)* Funcionários',
                    delay: 500,
                }])
            }
        }
    )
    .addAnswer(
        '',
        { capture: true },
        async (ctx: BotContext, { flowDynamic, state }: BotMethods) => {
            const answer = ctx.body.trim().toUpperCase()
            const phone = ctx.from
            const moduleNum = (await state.get('currentModule')) as number

            try {
                // Envia resposta ao N8N para registro e validação
                const response = await fetch(`${N8N_BASE}/submit-quiz-answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone,
                        moduleNumber: moduleNum,
                        questionIndex: 0,
                        answer,
                    }),
                })

                const result = await response.json() as {
                    correct: boolean
                    feedback: string
                    moduleComplete: boolean
                    score: number
                    nextModule?: number
                }

                const feedbackMsg = result.correct
                    ? `✅ Correto! ${result.feedback}`
                    : `❌ Não foi dessa vez. ${result.feedback}`

                await flowDynamic([{ body: feedbackMsg }])

                if (result.moduleComplete) {
                    const completionMsg =
                        result.score >= 70
                            ? `🎉 Parabéns! Você completou o módulo ${moduleNum} com ${result.score}% de aproveitamento!\n\nPode avançar para o próximo módulo. Responda *MÓDULO* quando estiver pronto.`
                            : `Sua pontuação foi ${result.score}%. Você precisa de pelo menos 70% para avançar.\n\nGostaria de rever o conteúdo e tentar novamente? Responda *MÓDULO* para reler ou *TUTOR* para falar com um tutor.`

                    await flowDynamic([{ body: completionMsg, delay: 500 }])
                }
            } catch (err) {
                console.error('[quizFlow] Erro ao submeter resposta:', err)
                await flowDynamic([
                    { body: 'Erro ao registrar sua resposta. Tente novamente.' },
                ])
            }
        }
    )
