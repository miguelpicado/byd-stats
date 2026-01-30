import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression(),
    VitePWA({
      registerType: 'prompt', // Let the app handle updates (PWAManager)
      devOptions: {
        enabled: true
      },
      includeAssets: ['favicon.png', 'app_icon_v2.png', 'app_logo.png', 'byd_logo.png'],
      manifest: {
        name: 'BYD Stats',
        short_name: 'BYD Stats',
        description: 'Analiza las estadísticas de tu vehículo BYD de forma local y privada',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        scope: './',
        start_url: './?v=1.6',
        id: './?v=1.6',
        categories: ['utilities', 'productivity'],
        icons: [
          {
            src: '/app_icon_v2.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/app_icon_v2.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        share_target: {
          action: '/?share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'file',
                accept: ['application/x-sqlite3', 'application/vnd.sqlite3', 'application/octet-stream', '.db', '.sqlite', '.sqlite3', 'image/jpeg', 'image/jpg', '*/*']
              }
            ]
          }
        },
        file_handlers: [
          {
            action: '/?file-handler',
            accept: {
              'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
              'application/vnd.sqlite3': ['.db', '.sqlite', '.sqlite3'],
              'application/octet-stream': ['.db']
            },
            launch_type: 'single-client'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Don't cache map files or legacy polyfills heavily
        globIgnores: ['**/node_modules/**/*', '*.map']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/core'),
      '@core': path.resolve(__dirname, './src/core'),
      '@features': path.resolve(__dirname, './src/features'),
      '@tabs': path.resolve(__dirname, './src/features/dashboard/tabs'),
    },
  },
  base: '', // Relative base for better subfolder support (GH Pages)
  build: {
    rollupOptions: {
      external: ['fs', 'path', 'crypto'], // Externalize node built-ins
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'utils-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/app', '@capacitor/filesystem', '@capacitor/status-bar'],
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increase limit slightly to avoid warnings for reasonable chunks
  },
  optimizeDeps: {
    exclude: ['fs'] // Exclude fs from optimization
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
  }
})
