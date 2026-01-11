import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/app', '@capacitor/filesystem', '@capacitor/status-bar'],
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increase limit slightly to avoid warnings for reasonable chunks
  }
})
