import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path' // Check if this works in ESM
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    plugins: [react()],
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
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/setupTests.js',
        exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    },
})
