import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3003,
    host: true,
  },
  preview: {
    allowedHosts: ['localhost', '127.0.0.1', 'vanilla.unifhevm.xyz']
  }
});
