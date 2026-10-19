import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserPages = repoName?.endsWith('.github.io');
const defaultBase = process.env.GITHUB_ACTIONS && repoName && !isUserPages ? `/${repoName}/` : '/';
const base = process.env.BASE_PATH ?? defaultBase;

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: [
        'favicon.ico',
        'icon.svg',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'apple-touch-icon-180x180.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
  },
});
