import { createBot, createProvider, createFlow } from '@builderbot/bot'
import { PostgresAdapter as Database } from '@builderbot/database-postgres'
import { EvolutionProvider as Provider } from '@builderbot/provider-evolution-api'

import { entryFlow } from './flows/entry.flow'

const PORT = process.env.PORT ?? 3008

const main = async () => {
    // Phase 19: Only entryFlow is used. All logic delegated to N8N.
    const adapterFlow = createFlow([entryFlow])

    const adapterProvider = createProvider(Provider, {
        name: process.env.EVOLUTION_INSTANCE,
        baseUrl: process.env.EVOLUTION_API_URL,
        apikey: process.env.EVOLUTION_API_KEY,
    })

    const adapterDB = new Database({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT),
    })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    httpServer(+PORT)

    // Endpoints extras para controle (pausa/resume)
    adapterProvider.server.post('/api/pause', async (req, res) => {
        const { phone } = req.body
        if (phone) {
            await adapterDB.update({ attendance_status: 'human' }, phone)
            console.log(`[PAUSE] Bot pausado para ${phone}`)
            res.json({ success: true, message: 'Bot paused' })
        } else {
            res.status(400).json({ error: 'Phone is required' })
        }
    })

    adapterProvider.server.post('/api/resume', async (req, res) => {
        const { phone } = req.body
        if (phone) {
            await adapterDB.update({ attendance_status: 'bot' }, phone)
            console.log(`[RESUME] Bot retomado para ${phone}`)
            res.json({ success: true, message: 'Bot resumed' })
        } else {
            res.status(400).json({ error: 'Phone is required' })
        }
    })

    // Webhook endpoint for N8N or other services to send messages voluntarily
    adapterProvider.server.post('/api/send', async (req, res) => {
        const { phone, message } = req.body
        if (phone && message) {
            try {
                await adapterProvider.sendText(`${phone}@s.whatsapp.net`, message)
                res.json({ success: true })
            } catch (err) {
                console.error('Error sending message:', err)
                res.status(500).json({ error: 'Failed' })
            }
        } else {
            res.status(400).json({ error: 'Missing phone or message' })
        }
    })
}

main()
