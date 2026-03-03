import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url';
import viteCompression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt', // Let the app handle updates (PWAManager)
        devOptions: {
          enabled: false
        },
        includeAssets: ['app_icon_192.png', 'app_icon_512.png', 'app_icon_v2.png', 'byd_logo.png'],
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
              src: '/app_icon_192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/app_icon_512.png',
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
              }
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          // Don't cache map files or legacy polyfills heavily
          globIgnores: ['**/node_modules/**/*', '*.map'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/www\.googleapis\.com\/drive\//,
              handler: 'NetworkFirst' as const,
              options: {
                cacheName: 'google-drive-api',
                expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
              handler: 'NetworkFirst' as const,
              options: {
                cacheName: 'firestore-api',
                expiration: { maxEntries: 100, maxAgeSeconds: 600 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@core': path.resolve(__dirname, './src/core'),
        '@features': path.resolve(__dirname, './src/features'),
        '@tabs': path.resolve(__dirname, './src/features/dashboard/tabs'),
      },
    },
    base: '', // Relative base for better subfolder support (GH Pages)
    worker: {
      format: 'es' // Fix for vite-plugin-pwa - IIFE not supported in newer Vite
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        external: ['fs', 'path', 'crypto'], // Externalize node built-ins
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/sql.js')) {
              return 'vendor-sqlite';
            }
            if (id.includes('node_modules/@capacitor')) {
              return 'vendor-capacitor';
            }
            if (id.includes('node_modules/@tensorflow')) {
              return 'vendor-tensorflow';
            }
            if (id.includes('node_modules/i18next')) {
              return 'vendor-i18n';
            }
          }
        }
      },
      chunkSizeWarningLimit: 500,
    },
    // Strip all console.* calls and debugger statements from production bundles
    esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
    optimizeDeps: {
      exclude: ['fs'] // Exclude fs from optimization
    },
  }
})
