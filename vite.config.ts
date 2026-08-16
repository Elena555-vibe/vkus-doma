import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/vkus-doma/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/vkus-doma-logo-centered-v5.png',
        'icons/vkus-doma-logo-transparent-v2.png',
        'images/provence-watercolor-background.png',
      ],
      manifest: {
        name: 'Вкус дома — кулинарная книга',
        short_name: 'Вкус дома',
        description: 'Личная и общая домашняя кулинарная книга.',
        lang: 'ru',
        start_url: '/vkus-doma/',
        scope: '/vkus-doma/',
        display: 'standalone',
        background_color: '#FAF7F1',
        theme_color: '#FAF7F1',
        icons: [{ src: 'icons/vkus-doma-logo-centered-v5.png', sizes: '1254x1254', type: 'image/png', purpose: 'any maskable' }],
      },
      workbox: { navigateFallback: '/vkus-doma/index.html', globPatterns: ['**/*.{js,css,html,svg}'], globIgnores: ['assets/pdfmake-*.js', 'assets/vfs_fonts-*.js'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true },
    }),
  ],
});
