import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import '@/styles/globals.css'

declare global {
    interface Window {
        chatwootSettings?: Record<string, unknown>
        chatwootSDK?: { run: (config: { websiteToken: string; baseUrl: string }) => void }
    }
}

export default function App({ Component, pageProps }: AppProps) {
    useEffect(() => {
        const token = process.env.NEXT_PUBLIC_CHATWOOT_TOKEN
        if (!token) return
        window.chatwootSettings = { hideMessageBubble: false, position: 'right' }
        const s = document.createElement('script')
        s.src = 'https://suporte.extensionista.site/packs/js/sdk.js'
        s.async = true
        s.onload = () => {
            window.chatwootSDK?.run({
                websiteToken: token,
                baseUrl: 'https://suporte.extensionista.site',
            })
        }
        document.head.appendChild(s)
    }, [])

    return <Component {...pageProps} />
}
