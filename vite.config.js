import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🟢 Lógica dinámica: Si estamos construyendo para Electron, usa './'
  // Si es para la web (deploy en Render/Vercel), usa '/' para que funcione el routing
  base: process.env.ELECTRON_BUILD ? './' : '/',
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
