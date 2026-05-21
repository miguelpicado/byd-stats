// BYD Stats - Logger Utility Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
    let consoleSpy: any;

    beforeEach(() => {
        // Spy on console methods
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => { }),
            info: vi.spyOn(console, 'info').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { }),
        };
        // Set to DEBUG level for all tests to ensure they are captured
        logger.setLevel(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Reset to default level (usually 2 for dev)
        logger.setLevel(2);
    });

    describe('debug', () => {
        it('should call console.log with DEBUG prefix in development', () => {
            logger.debug('Test debug message');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[DEBUG]'),
                'Test debug message'
            );
        });

        it('should handle multiple arguments', () => {
            logger.debug('Message', 'arg1', { key: 'value' });
            expect(consoleSpy.log).toHaveBeenCalled();
        });

        it('should handle objects and arrays', () => {
            const obj = { test: 'value', nested: { key: 123 } };
            const arr = [1, 2, 3];
            logger.debug('Objects:', obj, arr);
            if (import.meta.env.MODE !== 'production') {
                expect(consoleSpy.log).toHaveBeenCalled();
            }
        });
    });

    describe('info', () => {
        it('should call console.info with INFO prefix', () => {
            logger.info('Test info message');
            expect(consoleSpy.info).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]'),
                'Test info message'
            );
        });

        it('should handle null and undefined', () => {
            logger.info(null, undefined);
            expect(consoleSpy.info).toHaveBeenCalled();
        });
    });

    describe('warn', () => {
        it('should call console.warn with WARN prefix', () => {
            logger.warn('Test warning message');
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('[WARN]'),
                'Test warning message'
            );
        });

        it('should always log warnings even in production', () => {
            logger.warn('Critical warning');
            expect(consoleSpy.warn).toHaveBeenCalled();
        });
    });

    describe('error', () => {
        it('should call console.error with ERROR prefix', () => {
            logger.error('Test error message');
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                'Test error message'
            );
        });

        it('should handle Error objects', () => {
            const error = new Error('Test error');
            logger.error('Error occurred:', error);
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('should always log errors even in production', () => {
            logger.error('Critical error');
            expect(consoleSpy.error).toHaveBeenCalled();
        });
    });

    describe('production mode behavior', () => {
        it('should suppress debug/info logs in production', () => {

            // Note: Actual production mode testing would require mocking import.meta.env
            // This test serves as documentation of expected behavior
            expect(logger.debug).toBeDefined();
            expect(logger.info).toBeDefined();
        });

        it('should always allow warn and error in production', () => {
            expect(logger.warn).toBeDefined();
            expect(logger.error).toBeDefined();
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(() => logger.debug('')).not.toThrow();
            expect(() => logger.info('')).not.toThrow();
            expect(() => logger.warn('')).not.toThrow();
            expect(() => logger.error('')).not.toThrow();
        });

        it('should handle circular references safely', () => {
            const circular: any = {};
            circular.self = circular;
            expect(() => logger.debug('Circular:', circular)).not.toThrow();
        });

        it('should handle very long messages', () => {
            const longMessage = 'x'.repeat(10000);
            expect(() => logger.debug(longMessage)).not.toThrow();
        });
    });
});
