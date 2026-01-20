import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/src',
            '@components': '/src/components',
            '@hooks': '/src/hooks',
            '@utils': '/src/utils',
            '@features': '/src/features',
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json'],
            include: ['src/utils/**', 'src/hooks/**'],
            exclude: ['**/*.test.js', '**/setupTests.js', '**/index.js']
        }
    },
});
