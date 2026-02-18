import { createBot, createProvider, createFlow } from '@builderbot/bot'
import { EvolutionProvider as Provider } from '@builderbot/provider-evolution-api'
import { PostgreSQLAdapter as Database } from '@builderbot/database-postgres'
import { Pool } from 'pg'

import { welcomeFlow } from './flows/welcome.flow'
import { moduleFlow, quizFlow } from './flows/module.flow'
import { humanSupportFlow } from './flows/human-support.flow'
import { aiTutorFlow } from './flows/ai-tutor.flow'

const PORT = parseInt(process.env.PORT || '3008')

// Pool direto para operações de pause/resume fora do escopo do BuilderBot
const pgPool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kreativ_edu',
})

const main = async () => {
    // -------------------------------------------------------------------------
    // Banco de dados — persiste estado de conversas e contexto do aluno
    // -------------------------------------------------------------------------
    const adapterDB = new Database({
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'kreativ_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kreativ_edu',
    })

    // -------------------------------------------------------------------------
    // Provider — Evolution API (WhatsApp unofficial)
    // Para migrar para Meta API Oficial: troque por MetaProvider.
    // Os flows não precisam de alteração.
    // -------------------------------------------------------------------------
    const adapterProvider = createProvider(Provider, {
        baseURL: process.env.EVOLUTION_API_URL || 'http://evolution-api:8080',
        apiKey: process.env.EVOLUTION_API_KEY || '',
        instanceName: process.env.EVOLUTION_INSTANCE || 'kreativ-bot',
    })

    // -------------------------------------------------------------------------
    // Flows — lógica de conversação
    // -------------------------------------------------------------------------
    const adapterFlow = createFlow([
        welcomeFlow,
        moduleFlow,
        quizFlow,
        humanSupportFlow,
        aiTutorFlow,  // FALLBACK: responde mensagens livres com DeepSeek
    ])

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // -------------------------------------------------------------------------
    // Endpoint interno para N8N enviar mensagens proativamente ao aluno
    // POST http://builderbot:3008/api/send
    // Body: { "number": "5511999999999", "message": "texto" }
    // -------------------------------------------------------------------------
    adapterProvider.server.post(
        '/api/send',
        handleCtx(async (bot, req, res) => {
            const { number, message } = req.body as { number: string; message: string }
            if (!number || !message) {
                return res.status(400).end('Campos obrigatórios: number, message')
            }
            await bot.sendMessage(number, message, {})
            return res.end('ok')
        })
    )

    // -------------------------------------------------------------------------
    // Pause/resume do bot via flag no PostgreSQL (attendance_status)
    // N8N chama estes endpoints quando tutor assume / encerra atendimento.
    // POST /api/pause  { "number": "5511999999999" }
    // POST /api/resume { "number": "5511999999999" }
    // -------------------------------------------------------------------------
    adapterProvider.server.post(
        '/api/pause',
        handleCtx(async (_bot, req, res) => {
            const { number } = req.body as { number: string }
            await pgPool.query(
                `UPDATE students SET attendance_status = 'human', updated_at = NOW()
                 WHERE phone = $1`,
                [number]
            )
            return res.end('paused')
        })
    )

    adapterProvider.server.post(
        '/api/resume',
        handleCtx(async (_bot, req, res) => {
            const { number } = req.body as { number: string }
            await pgPool.query(
                `UPDATE students SET attendance_status = 'bot', updated_at = NOW()
                 WHERE phone = $1`,
                [number]
            )
            return res.end('resumed')
        })
    )

    httpServer(PORT)
    console.log(`[BuilderBot] Iniciado na porta ${PORT}`)
    console.log(`[BuilderBot] Evolution API: ${process.env.EVOLUTION_API_URL}`)
    console.log(`[BuilderBot] Instância: ${process.env.EVOLUTION_INSTANCE}`)
}

main().catch((err) => {
    console.error('[BuilderBot] Erro fatal na inicialização:', err)
    process.exit(1)
})
