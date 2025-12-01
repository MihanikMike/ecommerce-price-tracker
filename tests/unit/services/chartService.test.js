/**
 * Chart Service Tests
 * Tests for pure functions in chartService
 */

import { describe, it, expect } from '@jest/globals';
import {
    TIME_RANGES,
    calculatePriceStats,
} from '../../../src/services/chartService.js';

describe('chartService', () => {
    describe('TIME_RANGES', () => {
        it('should have all expected time ranges', () => {
            expect(TIME_RANGES['24h']).toEqual({ hours: 24, label: 'Last 24 Hours' });
            expect(TIME_RANGES['7d']).toEqual({ days: 7, label: 'Last 7 Days' });
            expect(TIME_RANGES['30d']).toEqual({ days: 30, label: 'Last 30 Days' });
            expect(TIME_RANGES['90d']).toEqual({ days: 90, label: 'Last 90 Days' });
            expect(TIME_RANGES['1y']).toEqual({ days: 365, label: 'Last Year' });
            expect(TIME_RANGES['all']).toEqual({ days: null, label: 'All Time' });
        });
        
        it('should have 6 time ranges', () => {
            expect(Object.keys(TIME_RANGES)).toHaveLength(6);
        });
    });

    describe('calculatePriceStats', () => {
        describe('empty/null input handling', () => {
            it('should return null values for empty array', () => {
                const stats = calculatePriceStats([]);
                expect(stats.min).toBeNull();
                expect(stats.max).toBeNull();
                expect(stats.avg).toBeNull();
                expect(stats.current).toBeNull();
                expect(stats.first).toBeNull();
                expect(stats.change).toBeNull();
                expect(stats.changePercent).toBeNull();
            });

            it('should return null values for null input', () => {
                const stats = calculatePriceStats(null);
                expect(stats.min).toBeNull();
                expect(stats.max).toBeNull();
            });

            it('should return null values for undefined input', () => {
                const stats = calculatePriceStats(undefined);
                expect(stats.min).toBeNull();
                expect(stats.max).toBeNull();
            });
        });
        
        describe('basic calculations', () => {
            it('should calculate min correctly', () => {
                const prices = [100, 95, 90, 105, 110];
                const stats = calculatePriceStats(prices);
                expect(stats.min).toBe(90);
            });
            
            it('should calculate max correctly', () => {
                const prices = [100, 95, 90, 105, 110];
                const stats = calculatePriceStats(prices);
                expect(stats.max).toBe(110);
            });
            
            it('should calculate average correctly', () => {
                const prices = [100, 95, 90, 105, 110];
                const stats = calculatePriceStats(prices);
                expect(stats.avg).toBe(100); // (100+95+90+105+110)/5 = 100
            });
            
            it('should identify current price as last in array', () => {
                const prices = [100, 95, 90, 105, 110];
                const stats = calculatePriceStats(prices);
                expect(stats.current).toBe(110);
            });
            
            it('should identify first price correctly', () => {
                const prices = [100, 95, 90, 105, 110];
                const stats = calculatePriceStats(prices);
                expect(stats.first).toBe(100);
            });
        });
        
        describe('price change calculations', () => {
            it('should calculate positive price change', () => {
                const prices = [100, 120]; // 20% increase
                const stats = calculatePriceStats(prices);
                
                expect(stats.change).toBe(20);
                expect(stats.changePercent).toBe(20);
            });

            it('should calculate negative price change', () => {
                const prices = [100, 80]; // 20% decrease
                const stats = calculatePriceStats(prices);
                
                expect(stats.change).toBe(-20);
                expect(stats.changePercent).toBe(-20);
            });
            
            it('should handle no change', () => {
                const prices = [100, 100];
                const stats = calculatePriceStats(prices);
                
                expect(stats.change).toBe(0);
                expect(stats.changePercent).toBe(0);
            });
            
            it('should handle zero starting price', () => {
                const prices = [0, 100];
                const stats = calculatePriceStats(prices);
                
                expect(stats.change).toBe(100);
                expect(stats.changePercent).toBe(0); // Can't calculate percent from 0
            });
        });
        
        describe('single value handling', () => {
            it('should handle single price', () => {
                const prices = [99.99];
                const stats = calculatePriceStats(prices);
                
                expect(stats.min).toBe(99.99);
                expect(stats.max).toBe(99.99);
                expect(stats.avg).toBe(99.99);
                expect(stats.current).toBe(99.99);
                expect(stats.first).toBe(99.99);
                expect(stats.change).toBe(0);
                expect(stats.changePercent).toBe(0);
            });
        });

        describe('rounding', () => {
            it('should round values to 2 decimal places', () => {
                const prices = [99.999, 100.001, 100.005];
                const stats = calculatePriceStats(prices);
                
                // Average = (99.999 + 100.001 + 100.005) / 3 = 100.001666...
                expect(stats.avg).toBe(100);
            });
            
            it('should round change percent correctly', () => {
                const prices = [100, 133.333]; // 33.333% increase
                const stats = calculatePriceStats(prices);
                
                expect(stats.changePercent).toBe(33.33);
            });
            
            it('should preserve decimal precision for prices', () => {
                const prices = [29.99, 24.99];
                const stats = calculatePriceStats(prices);
                
                expect(stats.min).toBe(24.99);
                expect(stats.max).toBe(29.99);
            });
        });
        
        describe('large datasets', () => {
            it('should handle many prices', () => {
                const prices = Array.from({ length: 1000 }, (_, i) => 100 + (i % 50));
                const stats = calculatePriceStats(prices);
                
                expect(stats.min).toBe(100);
                expect(stats.max).toBe(149);
                expect(stats.current).toBe(149); // Last element is 100 + (999 % 50) = 149
            });
        });
        
        describe('extreme values', () => {
            it('should handle very small prices', () => {
                const prices = [0.01, 0.02, 0.015];
                const stats = calculatePriceStats(prices);
                
                expect(stats.min).toBe(0.01);
                expect(stats.max).toBe(0.02);
            });
            
            it('should handle very large prices', () => {
                const prices = [10000, 15000, 12500];
                const stats = calculatePriceStats(prices);
                
                expect(stats.min).toBe(10000);
                expect(stats.max).toBe(15000);
                expect(stats.avg).toBe(12500);
            });
        });
    });
});
