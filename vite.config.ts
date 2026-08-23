import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Рабочий домен обслуживает приложение из корня. Для GitHub Pages
  // base передаётся явно через VITE_APP_BASE в workflow.
  const appBase = loadEnv(mode, process.cwd(), '').VITE_APP_BASE || '/';
  const normalizedBase = appBase.endsWith('/') ? appBase : `${appBase}/`;

  return {
  base: normalizedBase,
  plugins: [
    react(),
    VitePWA({
      // Не перезагружаем приложение сами: во время заполнения рецепта это
      // могло бы выглядеть как потеря данных. Пользователь видит понятную
      // кнопку обновления и решает, когда применить новую версию.
      registerType: 'prompt',
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
        start_url: normalizedBase,
        scope: normalizedBase,
        display: 'standalone',
        background_color: '#FAF7F1',
        theme_color: '#FAF7F1',
        icons: [{ src: 'icons/vkus-doma-logo-centered-v5.png', sizes: '1254x1254', type: 'image/png', purpose: 'any maskable' }],
      },
      workbox: { navigateFallback: `${normalizedBase}index.html`, globPatterns: ['**/*.{js,css,html,svg}'], globIgnores: ['assets/pdfmake-*.js', 'assets/vfs_fonts-*.js'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, clientsClaim: true, cleanupOutdatedCaches: true },
    }),
  ],
  };
});
