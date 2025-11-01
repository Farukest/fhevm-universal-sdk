import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3004,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'react.unifhevm.xyz']
  },
  preview: {
    allowedHosts: ['localhost', '127.0.0.1', 'react.unifhevm.xyz']
  }
})
