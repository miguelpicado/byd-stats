
// src/core/__tests__/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, LogLevel } from '../logger';

describe('logger', () => {
    let consoleSpy: {
        log: ReturnType<typeof vi.spyOn>;
        warn: ReturnType<typeof vi.spyOn>;
        error: ReturnType<typeof vi.spyOn>;
        info: ReturnType<typeof vi.spyOn>;
    };

    beforeEach(() => {
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => { }),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => { }),
            error: vi.spyOn(console, 'error').mockImplementation(() => { }),
            info: vi.spyOn(console, 'info').mockImplementation(() => { }),
        };
        logger.setLevel(LogLevel.DEBUG); // Enable all logs for testing
    });

    afterEach(() => {
        Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    describe('log levels', () => {
        it('logger.debug calls console.log', () => {
            // Note: Implementation uses console.log for debug
            logger.debug('debug message');
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[DEBUG]'),
                'debug message'
            );
        });

        it('logger.info calls console.info', () => {
            logger.info('info message');
            expect(consoleSpy.info).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]'),
                'info message'
            );
        });

        it('logger.warn calls console.warn', () => {
            logger.warn('warning message');
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('[WARN]'),
                'warning message'
            );
        });

        it('logger.error calls console.error', () => {
            logger.error('error message');
            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                'error message'
            );
        });
    });

    describe('log level filtering', () => {
        it('respects log level setting', () => {
            logger.setLevel(LogLevel.WARN);

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(consoleSpy.log).not.toHaveBeenCalled(); // debug
            expect(consoleSpy.info).not.toHaveBeenCalled(); // info
            expect(consoleSpy.warn).toHaveBeenCalled();
            expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('LogLevel.ERROR suppresses lower logs', () => {
            logger.setLevel(LogLevel.ERROR);

            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');

            expect(consoleSpy.log).not.toHaveBeenCalled();
            expect(consoleSpy.info).not.toHaveBeenCalled();
            expect(consoleSpy.warn).not.toHaveBeenCalled();
            expect(consoleSpy.error).toHaveBeenCalled();
        });
    });

    describe('additional arguments', () => {
        it('passes additional arguments to console', () => {
            const error = new Error('test error');
            logger.error('Something failed', error);

            expect(consoleSpy.error).toHaveBeenCalledWith(
                expect.any(String),
                'Something failed',
                error
            );
        });
    });
});
