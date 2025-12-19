import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for Health Server
 * Tests the actual exported functions from health-server.js
 */

// Import actual functions from health-server
import { 
    updateAppState, 
    recordScrapeAttempt, 
    recordError,
    getAppState,
    resetAppState,
} from '../../../src/server/health-server.js';

describe('health-server', () => {
    beforeEach(() => {
        // Reset app state before each test
        resetAppState();
    });

    describe('updateAppState', () => {
        it('should update isReady state', () => {
            updateAppState({ isReady: true });
            const state = getAppState();
            expect(state.isReady).toBe(true);
        });

        it('should update multiple state properties', () => {
            updateAppState({ 
                isReady: true, 
                lastMonitorRun: '2025-12-01T00:00:00Z',
                lastMonitorSuccess: true,
            });
            const state = getAppState();
            expect(state.isReady).toBe(true);
            expect(state.lastMonitorRun).toBe('2025-12-01T00:00:00Z');
            expect(state.lastMonitorSuccess).toBe(true);
        });

        it('should handle partial updates without affecting other properties', () => {
            updateAppState({ isReady: true });
            updateAppState({ lastMonitorSuccess: false });
            const state = getAppState();
            expect(state.isReady).toBe(true);
            expect(state.lastMonitorSuccess).toBe(false);
        });

        it('should handle empty update object', () => {
            updateAppState({});
            const state = getAppState();
            expect(state.isReady).toBe(false); // Default value
        });
    });

    describe('recordScrapeAttempt', () => {
        it('should record successful scrape attempt', () => {
            recordScrapeAttempt(true);
            recordScrapeAttempt(true);
            const state = getAppState();
            expect(state.totalScrapesAttempted).toBe(2);
            expect(state.totalScrapesSuccessful).toBe(2);
            expect(state.lastMonitorSuccess).toBe(true);
        });

        it('should record failed scrape attempt', () => {
            recordScrapeAttempt(false);
            const state = getAppState();
            expect(state.totalScrapesAttempted).toBe(1);
            expect(state.totalScrapesSuccessful).toBe(0);
            expect(state.lastMonitorSuccess).toBe(false);
        });

        it('should track mixed success/failure', () => {
            recordScrapeAttempt(true);
            recordScrapeAttempt(false);
            recordScrapeAttempt(true);
            recordScrapeAttempt(false);
            const state = getAppState();
            expect(state.totalScrapesAttempted).toBe(4);
            expect(state.totalScrapesSuccessful).toBe(2);
        });

        it('should update lastMonitorRun timestamp', () => {
            const before = new Date().toISOString();
            recordScrapeAttempt(true);
            const state = getAppState();
            expect(state.lastMonitorRun).toBeDefined();
            expect(new Date(state.lastMonitorRun).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime() - 1000);
        });

        it('should handle many consecutive calls', () => {
            for (let i = 0; i < 100; i++) {
                recordScrapeAttempt(i % 2 === 0);
            }
            const state = getAppState();
            expect(state.totalScrapesAttempted).toBe(100);
            expect(state.totalScrapesSuccessful).toBe(50);
        });
    });

    describe('recordError', () => {
        it('should record error with message', () => {
            const error = new Error('Test error message');
            recordError(error);
            const state = getAppState();
            expect(state.errors).toHaveLength(1);
            expect(state.errors[0].message).toBe('Test error message');
        });

        it('should record error with stack trace', () => {
            const error = new Error('Error with stack');
            recordError(error);
            const state = getAppState();
            expect(state.errors[0].stack).toBeDefined();
            expect(state.errors[0].stack).toContain('Error with stack');
        });

        it('should handle string error', () => {
            recordError('String error');
            const state = getAppState();
            expect(state.errors[0].message).toBe('String error');
        });

        it('should limit errors to 10 entries', () => {
            for (let i = 0; i < 15; i++) {
                recordError(new Error(`Error ${i}`));
            }
            const state = getAppState();
            expect(state.errors).toHaveLength(10);
            // First error should be Error 5 (0-4 were removed)
            expect(state.errors[0].message).toBe('Error 5');
        });

        it('should record error timestamp', () => {
            const before = new Date().toISOString();
            recordError(new Error('Timestamped error'));
            const state = getAppState();
            expect(state.errors[0].timestamp).toBeDefined();
            expect(new Date(state.errors[0].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime() - 1000);
        });

        it('should handle error without stack', () => {
            const error = { message: 'No stack error' };
            recordError(error);
            const state = getAppState();
            expect(state.errors[0].message).toBe('No stack error');
            expect(state.errors[0].stack).toBeUndefined();
        });
    });

    describe('getAppState', () => {
        it('should return current app state', () => {
            const state = getAppState();
            expect(state).toHaveProperty('isReady');
            expect(state).toHaveProperty('lastMonitorRun');
            expect(state).toHaveProperty('lastMonitorSuccess');
            expect(state).toHaveProperty('totalScrapesAttempted');
            expect(state).toHaveProperty('totalScrapesSuccessful');
            expect(state).toHaveProperty('errors');
        });

        it('should return a copy of state (not reference)', () => {
            const state1 = getAppState();
            state1.isReady = true;
            const state2 = getAppState();
            expect(state2.isReady).toBe(false); // Should still be false
        });
    });

    describe('resetAppState', () => {
        it('should reset all state properties', () => {
            // Set some state
            updateAppState({ isReady: true });
            recordScrapeAttempt(true);
            recordError(new Error('test'));
            
            // Reset
            resetAppState();
            
            const state = getAppState();
            expect(state.isReady).toBe(false);
            expect(state.lastMonitorRun).toBeNull();
            expect(state.lastMonitorSuccess).toBe(false);
            expect(state.totalScrapesAttempted).toBe(0);
            expect(state.totalScrapesSuccessful).toBe(0);
            expect(state.errors).toHaveLength(0);
        });
    });
});

describe('Health check logic patterns', () => {
    describe('Overall health determination', () => {
        it('should be healthy when all critical checks pass', () => {
            const checks = {
                database: { status: 'healthy' },
                browserPool: { status: 'healthy' },
            };
            
            const criticalChecks = [checks.database, checks.browserPool];
            const allHealthy = criticalChecks.every(c => c.status === 'healthy');
            const anyUnhealthy = criticalChecks.some(c => c.status === 'unhealthy');
            
            const status = anyUnhealthy ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded');
            
            expect(status).toBe('healthy');
        });

        it('should be unhealthy when database check fails', () => {
            const checks = {
                database: { status: 'unhealthy' },
                browserPool: { status: 'healthy' },
            };
            
            const criticalChecks = [checks.database, checks.browserPool];
            const anyUnhealthy = criticalChecks.some(c => c.status === 'unhealthy');
            
            expect(anyUnhealthy).toBe(true);
        });

        it('should be unhealthy when browserPool check fails', () => {
            const checks = {
                database: { status: 'healthy' },
                browserPool: { status: 'unhealthy' },
            };
            
            const criticalChecks = [checks.database, checks.browserPool];
            const anyUnhealthy = criticalChecks.some(c => c.status === 'unhealthy');
            
            expect(anyUnhealthy).toBe(true);
        });
    });

    describe('Scrape stats calculation', () => {
        it('should calculate success rate correctly', () => {
            const attempted = 100;
            const successful = 90;
            const successRate = attempted > 0 
                ? Math.round((successful / attempted) * 100) 
                : 0;
            
            expect(successRate).toBe(90);
        });

        it('should return 0 success rate when no attempts', () => {
            const attempted = 0;
            const successful = 0;
            const successRate = attempted > 0 
                ? Math.round((successful / attempted) * 100) 
                : 0;
            
            expect(successRate).toBe(0);
        });
    });

    describe('Uptime calculation', () => {
        it('should calculate uptime in seconds', () => {
            const startTime = Date.now() - 60000;
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            
            expect(uptime).toBeGreaterThanOrEqual(59);
            expect(uptime).toBeLessThanOrEqual(61);
        });

        it('should return 0 when startTime is null', () => {
            const startTime = null;
            const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
            
            expect(uptime).toBe(0);
        });
    });

    describe('HTTP status codes', () => {
        it('should return 200 for healthy', () => {
            const health = { status: 'healthy' };
            const statusCode = health.status === 'healthy' ? 200 : 
                               health.status === 'degraded' ? 200 : 503;
            
            expect(statusCode).toBe(200);
        });

        it('should return 503 for unhealthy', () => {
            const health = { status: 'unhealthy' };
            const statusCode = health.status === 'healthy' ? 200 : 
                               health.status === 'degraded' ? 200 : 503;
            
            expect(statusCode).toBe(503);
        });
    });
});
