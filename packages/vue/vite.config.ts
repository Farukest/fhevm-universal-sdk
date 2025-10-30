import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3004,
    host: true,
  },
  preview: {
    allowedHosts: ['localhost', '127.0.0.1', 'vue.unifhevm.xyz']
  }
})
