import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API requests to the backend server during development
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1/tts': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
