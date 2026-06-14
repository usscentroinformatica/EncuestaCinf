import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/google-script': {
        target: 'https://script.google.com/macros/s/AKfycbx8U_IWUo38fPGfNrtQ84wDQDTU9JLwbL7RYHpx4wbCDu4IeEAxtEDJSYiHg_Q7Z3seMw/exec',
        changeOrigin: true,
        rewrite: () => '', // Elimina /api/google-script
      }
    }
  }
})