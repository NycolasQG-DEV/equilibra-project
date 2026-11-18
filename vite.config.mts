import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  publicDir: false,
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/whatsapp': 'http://localhost:3000',
      '/responder': 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './client/src'),
    },
  },
});
