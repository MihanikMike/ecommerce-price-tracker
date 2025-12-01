import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ALERT_CHANNELS,
  formatAlertMessage,
  shouldSendAlert,
  markAlertSent,
  clearAlertRateLimit,
  clearAllRateLimits,
  createAlertFromChange,
  sendPriceAlert,
} from '../../../src/services/priceAlertService.js';

/**
 * Tests for Price Alert Service
 * Tests the actual priceAlertService module functions
 */

describe('priceAlertService', () => {
  beforeEach(() => {
    // Clear rate limits before each test
    clearAllRateLimits();
    // Reset env vars for testing
    delete process.env.PRICE_ALERTS_ENABLED;
    delete process.env.PRICE_ALERT_MIN_INTERVAL;
  });

  afterEach(() => {
    clearAllRateLimits();
  });

  describe('ALERT_CHANNELS', () => {
    it('should have correct channel values', () => {
      expect(ALERT_CHANNELS.LOG).toBe('log');
      expect(ALERT_CHANNELS.WEBHOOK).toBe('webhook');
      expect(ALERT_CHANNELS.EMAIL).toBe('email');
    });
  });

  describe('formatAlertMessage', () => {
    it('should format price drop alert correctly', () => {
      const alertData = {
        productId: 1,
        title: 'Test Product',
        url: 'https://amazon.com/dp/TEST123',
        oldPrice: 100,
        newPrice: 80,
        percentChange: -20,
        absoluteChange: -20,
        direction: 'down',
        severity: 'high',
        site: 'Amazon',
      };

      const formatted = formatAlertMessage(alertData);

      expect(formatted.subject).toContain('📉');
      expect(formatted.subject).toContain('dropped');
      expect(formatted.subject).toContain('20.0%');
      expect(formatted.subject).toContain('Test Product');
      expect(formatted.body).toContain('Old Price: $100.00');
      expect(formatted.body).toContain('New Price: $80.00');
      expect(formatted.body).toContain('Severity: high');
      expect(formatted.html).toContain('Price Alert');
      expect(formatted.data).toEqual(alertData);
    });

    it('should format price increase alert correctly', () => {
      const alertData = {
        productId: 2,
        title: 'Another Product',
        url: 'https://example.com/product',
        oldPrice: 50,
        newPrice: 75,
        percentChange: 50,
        absoluteChange: 25,
        direction: 'up',
        severity: 'medium',
        site: 'Example',
      };

      const formatted = formatAlertMessage(alertData);

      expect(formatted.subject).toContain('📈');
      expect(formatted.subject).toContain('increased');
      expect(formatted.subject).toContain('+50.0%');
      expect(formatted.body).toContain('Old Price: $50.00');
      expect(formatted.body).toContain('New Price: $75.00');
      expect(formatted.body).toContain('Change: +$25.00 (+50.0%)');
    });

    it('should handle missing site gracefully', () => {
      const alertData = {
        productId: 3,
        title: 'No Site Product',
        url: 'https://unknown.com/product',
        oldPrice: 100,
        newPrice: 90,
        percentChange: -10,
        absoluteChange: -10,
        direction: 'down',
        severity: 'low',
        site: null,
      };

      const formatted = formatAlertMessage(alertData);

      expect(formatted.body).toContain('Site: Unknown');
      expect(formatted.html).toContain('Site:</td><td>Unknown');
    });

    it('should format currency with two decimal places', () => {
      const alertData = {
        productId: 4,
        title: 'Decimal Test',
        url: 'https://test.com/product',
        oldPrice: 99.99,
        newPrice: 89.49,
        percentChange: -10.5,
        absoluteChange: -10.50,
        direction: 'down',
        severity: 'medium',
        site: 'Test',
      };

      const formatted = formatAlertMessage(alertData);

      expect(formatted.body).toContain('Old Price: $99.99');
      expect(formatted.body).toContain('New Price: $89.49');
      expect(formatted.body).toContain('Change: $10.50');
    });

    it('should include URL in body and HTML', () => {
      const alertData = {
        productId: 5,
        title: 'URL Test',
        url: 'https://amazon.com/dp/URLTEST123',
        oldPrice: 50,
        newPrice: 40,
        percentChange: -20,
        absoluteChange: -10,
        direction: 'down',
        severity: 'medium',
        site: 'Amazon',
      };

      const formatted = formatAlertMessage(alertData);

      expect(formatted.body).toContain('URL: https://amazon.com/dp/URLTEST123');
      expect(formatted.html).toContain('href="https://amazon.com/dp/URLTEST123"');
    });
  });

  describe('shouldSendAlert', () => {
    it('should return false when alerts are disabled', () => {
      process.env.PRICE_ALERTS_ENABLED = 'false';
      
      const result = shouldSendAlert(1, 'price_drop');
      
      expect(result).toBe(false);
    });

    it('should return true when alerts are enabled and no recent alert', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      
      const result = shouldSendAlert(1, 'price_drop');
      
      expect(result).toBe(true);
    });

    it('should return false when alert was sent recently', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600'; // 1 hour
      
      // Mark an alert as sent
      markAlertSent(1, 'price_drop');
      
      // Should be rate limited
      const result = shouldSendAlert(1, 'price_drop');
      
      expect(result).toBe(false);
    });

    it('should allow different alert types for same product', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      
      markAlertSent(1, 'price_drop');
      
      // Different alert type should still be allowed
      const result = shouldSendAlert(1, 'price_increase');
      
      expect(result).toBe(true);
    });

    it('should allow same alert type for different products', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      
      markAlertSent(1, 'price_drop');
      
      // Different product should still be allowed
      const result = shouldSendAlert(2, 'price_drop');
      
      expect(result).toBe(true);
    });
  });

  describe('markAlertSent', () => {
    it('should rate limit subsequent alerts', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600';
      
      // First check should pass
      expect(shouldSendAlert(1, 'price_drop')).toBe(true);
      
      // Mark as sent
      markAlertSent(1, 'price_drop');
      
      // Second check should fail
      expect(shouldSendAlert(1, 'price_drop')).toBe(false);
    });
  });

  describe('clearAlertRateLimit', () => {
    it('should clear rate limit for specific product/type', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600';
      
      markAlertSent(1, 'price_drop');
      expect(shouldSendAlert(1, 'price_drop')).toBe(false);
      
      clearAlertRateLimit(1, 'price_drop');
      
      expect(shouldSendAlert(1, 'price_drop')).toBe(true);
    });

    it('should not affect other rate limits', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600';
      
      markAlertSent(1, 'price_drop');
      markAlertSent(2, 'price_drop');
      
      clearAlertRateLimit(1, 'price_drop');
      
      expect(shouldSendAlert(1, 'price_drop')).toBe(true);
      expect(shouldSendAlert(2, 'price_drop')).toBe(false);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600';
      
      markAlertSent(1, 'price_drop');
      markAlertSent(2, 'price_increase');
      markAlertSent(3, 'price_drop');
      
      clearAllRateLimits();
      
      expect(shouldSendAlert(1, 'price_drop')).toBe(true);
      expect(shouldSendAlert(2, 'price_increase')).toBe(true);
      expect(shouldSendAlert(3, 'price_drop')).toBe(true);
    });
  });

  describe('createAlertFromChange', () => {
    const mockProduct = {
      id: 1,
      title: 'Test Product',
      url: 'https://amazon.com/dp/TEST',
      site: 'Amazon',
    };

    it('should return null when change not detected', () => {
      const changeResult = {
        detected: false,
        reason: 'below_threshold',
      };

      const alert = createAlertFromChange(mockProduct, changeResult);

      expect(alert).toBeNull();
    });

    it('should return null when alert should not be sent', () => {
      const changeResult = {
        detected: true,
        alert: { shouldAlert: false },
      };

      const alert = createAlertFromChange(mockProduct, changeResult);

      expect(alert).toBeNull();
    });

    it('should create alert from valid price drop', () => {
      const changeResult = {
        detected: true,
        productId: 1,
        oldPrice: 100,
        newPrice: 80,
        change: {
          percentChange: -20,
          absoluteChange: -20,
          direction: 'down',
        },
        alert: {
          shouldAlert: true,
          severity: 'high',
          reason: 'price_drop',
        },
      };

      const alert = createAlertFromChange(mockProduct, changeResult);

      expect(alert).not.toBeNull();
      expect(alert.productId).toBe(1);
      expect(alert.title).toBe('Test Product');
      expect(alert.oldPrice).toBe(100);
      expect(alert.newPrice).toBe(80);
      expect(alert.percentChange).toBe(-20);
      expect(alert.direction).toBe('down');
      expect(alert.severity).toBe('high');
      expect(alert.alertReason).toBe('price_drop');
    });

    it('should create alert from valid price increase', () => {
      const changeResult = {
        detected: true,
        productId: 2,
        oldPrice: 50,
        newPrice: 75,
        change: {
          percentChange: 50,
          absoluteChange: 25,
          direction: 'up',
        },
        alert: {
          shouldAlert: true,
          severity: 'medium',
          reason: 'price_increase',
        },
      };

      const alert = createAlertFromChange(mockProduct, changeResult);

      expect(alert).not.toBeNull();
      expect(alert.oldPrice).toBe(50);
      expect(alert.newPrice).toBe(75);
      expect(alert.direction).toBe('up');
      expect(alert.alertReason).toBe('price_increase');
    });
  });

  describe('sendPriceAlert', () => {
    beforeEach(() => {
      clearAllRateLimits();
    });

    it('should return alerts_disabled when alerts are not enabled', async () => {
      delete process.env.PRICE_ALERTS_ENABLED;
      
      const alertData = {
        productId: 1,
        title: 'Test Product',
        url: 'https://amazon.com/dp/TEST',
        oldPrice: 100,
        newPrice: 80,
        percentChange: -20,
        absoluteChange: -20,
        direction: 'down',
        severity: 'high',
        site: 'Amazon',
      };

      const result = await sendPriceAlert(alertData);
      
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('alerts_disabled');
    });

    it('should return rate_limited when product was recently alerted', async () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_CHANNELS = 'log';
      process.env.PRICE_ALERT_MIN_INTERVAL = '3600';
      
      const alertData = {
        productId: 1,
        title: 'Test Product',
        url: 'https://amazon.com/dp/TEST',
        oldPrice: 100,
        newPrice: 80,
        percentChange: -20,
        absoluteChange: -20,
        direction: 'down',
        severity: 'high',
        site: 'Amazon',
      };

      // Mark as sent first
      markAlertSent(1, 'price_drop');
      
      const result = await sendPriceAlert(alertData);
      
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('rate_limited');
    });

    it('should send alert via log channel when enabled', async () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_CHANNELS = 'log';
      process.env.PRICE_ALERT_MIN_INTERVAL = '0';
      
      const alertData = {
        productId: 999,
        title: 'Log Test Product',
        url: 'https://amazon.com/dp/LOG-TEST',
        oldPrice: 100,
        newPrice: 75,
        percentChange: -25,
        absoluteChange: -25,
        direction: 'down',
        severity: 'high',
        site: 'Amazon',
      };

      const result = await sendPriceAlert(alertData);
      
      expect(result.sent).toBe(true);
      expect(result.channels).toBeDefined();
      expect(result.channels.log).toBeDefined();
      expect(result.channels.log.success).toBe(true);
    });

    it('should send alert for price increase', async () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_CHANNELS = 'log';
      process.env.PRICE_ALERT_MIN_INTERVAL = '0';
      
      const alertData = {
        productId: 888,
        title: 'Increase Test',
        url: 'https://amazon.com/dp/INC-TEST',
        oldPrice: 100,
        newPrice: 150,
        percentChange: 50,
        absoluteChange: 50,
        direction: 'up',
        severity: 'medium',
        site: 'Amazon',
      };

      const result = await sendPriceAlert(alertData);
      
      expect(result.sent).toBe(true);
    });

    it('should handle unknown channel gracefully', async () => {
      process.env.PRICE_ALERTS_ENABLED = 'true';
      process.env.PRICE_ALERT_CHANNELS = 'unknown_channel';
      process.env.PRICE_ALERT_MIN_INTERVAL = '0';
      
      const alertData = {
        productId: 777,
        title: 'Unknown Channel Test',
        url: 'https://amazon.com/dp/UNKNOWN',
        oldPrice: 100,
        newPrice: 80,
        percentChange: -20,
        absoluteChange: -20,
        direction: 'down',
        severity: 'high',
        site: 'Amazon',
      };

      const result = await sendPriceAlert(alertData);
      
      expect(result.sent).toBe(true);
      expect(result.channels.unknown_channel).toBeDefined();
      expect(result.channels.unknown_channel.success).toBe(false);
    });
  });
});
