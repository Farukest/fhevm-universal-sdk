import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3003,
    host: true,
  },
});
