import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
            manifest: {
                name: 'Norte Piscinas',
                short_name: 'Norte Piscinas',
                description: 'Loja de produtos para piscina — entrega rápida na sua cidade',
                theme_color: '#0EA5E9',
                background_color: '#0F172A',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            }
        })
    ],
    server: {
        host: '0.0.0.0',
        port: 5173
    },
    build: {
        outDir: 'dist',
        sourcemap: false
    }
});
