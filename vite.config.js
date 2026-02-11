import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 🟢 Crucial para Electron (rutas relativas)
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-livekit': ['livekit-client', '@livekit/components-react'],
          'vendor-ui': ['sonner'],
        },
      },
    },
  },
})
