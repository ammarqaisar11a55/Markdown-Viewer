import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const isDebug = Boolean(process.env.TAURI_ENV_DEBUG);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tauri expects a fixed port and must be able to see Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  worker: { format: 'es' },
  build: {
    // WebView2 (Chromium) on Windows and WebKitGTK on Linux.
    target: ['es2022', 'chrome111', 'safari16'],
    minify: !isDebug,
    sourcemap: isDebug,
    chunkSizeWarningLimit: 1024,
  },
});
