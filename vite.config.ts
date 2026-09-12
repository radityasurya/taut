import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const dist = fileURLToPath(new URL('./dist/web', import.meta.url));

/**
 * Stamps the built shell into `web/public/sw.js` after Vite copies it: one
 * `self.__VERSION` (the cache name) and one `self.__PRECACHE` list.
 * ponytail: eight lines instead of vite-plugin-pwa; the worker itself is hand-written.
 */
function swPrecache() {
  return {
    name: 'tautan-sw-precache',
    apply: 'build' as const,
    closeBundle() {
      const sw = join(dist, 'sw.js');
      if (!existsSync(sw)) return;
      const assets = existsSync(join(dist, 'assets')) ? readdirSync(join(dist, 'assets')) : [];
      const files = ['/index.html', '/manifest.webmanifest', ...assets.map((f) => `/assets/${f}`)];
      // Asset names carry Vite's content hash, so hashing the names tracks the contents.
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 8);
      const header = `self.__VERSION=${JSON.stringify(version)};self.__PRECACHE=${JSON.stringify(files)};\n`;
      writeFileSync(sw, header + readFileSync(sw, 'utf8'));
    },
  };
}

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss(), swPrecache()],
  resolve: { alias: { '@': fileURLToPath(new URL('./web', import.meta.url)) } },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: ['.ts.net', 'localhost'], // tailscale serve forwards with the tailnet Host header
    proxy: { '/api': { target: 'http://127.0.0.1:7700', changeOrigin: false } },
  },
});
