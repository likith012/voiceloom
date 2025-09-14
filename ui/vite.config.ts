import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Proxy API requests to the backend server during development
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'VoiceLoom',
        short_name: 'VoiceLoom',
        description: 'Generate, align, and preview multi-voice TTS.',
        theme_color: '#0f172a',
        background_color: '#0b1020',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          // NOTE: Add these PNGs under ui/public for best install prompts on mobile/desktop.
          // Placeholder entries included; replace with your real assets.
          // If the files are missing, the app still works but install prompts may show a generic icon.
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/v1\/tts/],
        runtimeCaching: [
          {
            // HTML navigations (SPA): prefer network but fall back to cache when offline
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
            },
          },
          {
            // Static assets: scripts, styles, fonts, workers
            urlPattern: ({ request }) => ['style', 'script', 'worker', 'font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'asset-cache',
            },
          },
          {
            // Images
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/v1/tts': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
