/**
 * MCP-like Client for Kreativ BuilderBot
 * 
 * Since the N8N version doesn't support the mcpServerTrigger node natively,
 * this client wraps direct HTTP calls to N8N webhook endpoints in an MCP-like
 * interface. When N8N upgrades to support MCP natively, only this file needs
 * to change — the rest of the codebase uses the same API.
 */

const N8N_BASE = process.env.N8N_WEBHOOK_BASE || 'http://kreativ_n8n:5678/webhook'

interface ToolResult {
    content: Array<{ type: string; text: string }>
}

class MCPClient {
    private baseUrl: string

    constructor() {
        this.baseUrl = N8N_BASE
        console.log(`📡 MCP Client initialized (webhook mode) → ${this.baseUrl}`)
    }

    /**
     * Generic tool call — POST to N8N webhook endpoint
     */
    async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
        console.log(`📡 MCP Tool Call: ${name}`, JSON.stringify(args))

        try {
            const response = await fetch(`${this.baseUrl}/${name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args),
            })

            const text = await response.text()
            console.log(`✅ MCP Tool Result: ${name}`, text.substring(0, 200))

            return {
                content: [{ type: 'text', text }],
            }
        } catch (error) {
            console.error(`❌ MCP Tool Error: ${name}`, error)
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, error: String(error) }) }],
            }
        }
    }

    // --- Specific Tool Wrappers ---

    async requestTutor(phone: string, reason: string, context?: string): Promise<ToolResult> {
        return this.callTool('request-human-support', { phone, reason, context })
    }

    async resumeBot(phone: string, summary?: string): Promise<ToolResult> {
        return this.callTool('resume-bot', { phone, summary })
    }

    async saveProgress(phone: string, moduleId: number, score: number, completed: boolean): Promise<ToolResult> {
        return this.callTool('save-progress', { phone, moduleId, score, completed })
    }

    async emitCertificate(phone: string, studentName: string, courseName: string): Promise<ToolResult> {
        return this.callTool('emit-certificate', { phone, studentName, courseName })
    }
}

export const mcpClient = new MCPClient()
