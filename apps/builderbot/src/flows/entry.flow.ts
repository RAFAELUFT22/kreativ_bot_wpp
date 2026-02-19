import { addKeyword, EVENTS } from '@builderbot/bot'
import { mcpClient } from '../services/mcp-client'
import type { BotContext, BotMethods } from '@builderbot/bot/dist/types'

export const entryFlow = addKeyword(EVENTS.WELCOME)
    .addAction(async (ctx: BotContext, { flowDynamic, state, provider }: BotMethods) => {
        const phone = ctx.from
        const body = ctx.body
        const name = ctx.name

        try {
            // ASYNC PATTERN: Fire and Forget
            // N8N receives, responds 200 OK immediately, processes in background,
            // and calls back /api/send when ready.
            fetch(`${process.env.N8N_WEBHOOK_BASE}/ai-tutor-v3`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, body, name })
            }).catch(err => console.error('N8N Dispatch Error (Ignored for Async):', err))

            // We do NOT await response body or flowDynamic here.

        } catch (error) {
            console.error('BuilderBot Forward Error:', error)
        }
    })
