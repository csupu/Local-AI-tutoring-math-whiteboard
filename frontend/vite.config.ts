import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.MATHTOOLS_BACKEND || 'http://localhost:8000';
const backendWs = backend.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/ws': { target: backendWs, ws: true, changeOrigin: true },
    },
  },
});