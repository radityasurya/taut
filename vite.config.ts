import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./web', import.meta.url)) } },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['.ts.net', 'localhost'], // tailscale serve forwards with the tailnet Host header
    proxy: { '/api': { target: 'http://127.0.0.1:7700', changeOrigin: false } },
  },
});
