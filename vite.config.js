import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url';
import viteCompression from 'vite-plugin-compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@features': path.resolve(__dirname, './src/features'),
    },
  },
  base: '/',
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
  }
})
