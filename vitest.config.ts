
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/setupTests.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.{idea,git,cache,output,temp}/**',
            'functions/lib/**',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'src/setupTests.ts',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.test.tsx',
                'src/i18n/',
                'src/locales/',
                'functions/lib/**',
            ],
            thresholds: {
                global: {
                    statements: 70,
                    branches: 70,
                    functions: 70,
                    lines: 70,
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@hooks': path.resolve(__dirname, './src/hooks'),
            '@core': path.resolve(__dirname, './src/core'),
            '@services': path.resolve(__dirname, './src/services'),
            '@features': path.resolve(__dirname, './src/features'),
            '@tabs': path.resolve(__dirname, './src/features/dashboard/tabs'),
        },
    },
});
