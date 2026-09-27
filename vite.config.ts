/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Les 3 000 caractères les plus fréquents (paquets s00 à s05) sont disponibles hors ligne
// dès l'installation ; les autres paquets sont mis en cache à la première consultation.
const PRECACHED_STROKE_SHARDS = 'data/strokes/s0[0-5].json';

export default defineConfig({
  // Servi depuis https://thr1llex.github.io/PolyChinese/
  base: '/PolyChinese/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'PolyChinese',
        short_name: 'PolyChinese',
        description: 'Apprendre le chinois : caractères, ordre des traits, mots et prononciation.',
        lang: 'fr',
        theme_color: '#c62828',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', 'data/*.json', PRECACHED_STROKE_SHARDS],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/strokes/'),
            handler: 'CacheFirst',
            options: { cacheName: 'strokes', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
