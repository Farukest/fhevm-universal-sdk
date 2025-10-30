import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3002,
    host: true,
  },
  preview: {
    allowedHosts: ['localhost', '127.0.0.1', 'react.unifhevm.xyz']
  }
})
