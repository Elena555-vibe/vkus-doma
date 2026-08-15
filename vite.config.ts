import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/vkus-doma/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/app-icon.svg'],
      manifest: {
        name: 'Вкус дома — кулинарная книга',
        short_name: 'Вкус дома',
        description: 'Личная и общая домашняя кулинарная книга.',
        lang: 'ru',
        start_url: '/vkus-doma/',
        scope: '/vkus-doma/',
        display: 'standalone',
        background_color: '#FAF7F1',
        theme_color: '#A995C2',
        icons: [{ src: 'icons/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { navigateFallback: '/vkus-doma/index.html', globPatterns: ['**/*.{js,css,html,svg,png}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
});
