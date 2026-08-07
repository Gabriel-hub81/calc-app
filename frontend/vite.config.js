import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // cache del shell de la app; los datos siempre van a la red
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: []
      },
      manifest: {
        name: 'CALC — Tu co-piloto financiero',
        short_name: 'CALC',
        description:
          'Calcula, anota tu día y cuida tus precios — en tu idioma, con tu forma de hablar.',
        lang: 'es',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#10b981',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          // maskable: sin esquinas redondeadas propias y con margen, para que
          // Android lo recorte a su forma sin morder el «=»
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});
