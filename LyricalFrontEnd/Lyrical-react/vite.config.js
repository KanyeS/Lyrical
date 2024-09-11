import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Get the target IP from the environment variable or use a default
const targetIP = process.env.VITE_API_BASE_URL || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `${targetIP}`,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
})
