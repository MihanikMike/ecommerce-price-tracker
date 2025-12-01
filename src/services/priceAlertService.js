/**
 * Price Alert Service
 * Handles notification logic for price alerts
 */

import logger from "../utils/logger.js";
import config from "../config/index.js";
import { sendPriceAlertEmail, verifyEmailConfig } from "./emailService.js";

/**
 * Alert notification channels
 */
export const ALERT_CHANNELS = {
    LOG: 'log',
    WEBHOOK: 'webhook',
    EMAIL: 'email',
};

/**
 * Alert configuration from environment
 */
function getAlertConfig() {
    return {
        enabled: process.env.PRICE_ALERTS_ENABLED === 'true',
        channels: (process.env.PRICE_ALERT_CHANNELS || 'log').split(',').map(c => c.trim()),
        webhookUrl: process.env.PRICE_ALERT_WEBHOOK_URL || null,
        emailRecipients: process.env.PRICE_ALERT_EMAIL_RECIPIENTS 
            ? process.env.PRICE_ALERT_EMAIL_RECIPIENTS.split(',').map(e => e.trim())
            : [],
        minAlertInterval: parseInt(process.env.PRICE_ALERT_MIN_INTERVAL) || 3600, // 1 hour default
    };
}

// Track recent alerts to prevent spam
const recentAlerts = new Map();

/**
 * Check if we should send an alert (rate limiting)
 * @param {number} productId - Product ID
 * @param {string} alertType - Type of alert (price_drop, price_increase)
 * @returns {boolean} Whether alert should be sent
 */
export function shouldSendAlert(productId, alertType) {
    const alertConfig = getAlertConfig();
    if (!alertConfig.enabled) {
        return false;
    }

    const alertKey = `${productId}:${alertType}`;
    const lastAlertTime = recentAlerts.get(alertKey);
    const now = Date.now();

    if (lastAlertTime && (now - lastAlertTime) < alertConfig.minAlertInterval * 1000) {
        logger.debug({ productId, alertType, lastAlertTime }, 'Alert rate limited');
        return false;
    }

    return true;
}

/**
 * Mark alert as sent (for rate limiting)
 * @param {number} productId - Product ID
 * @param {string} alertType - Type of alert
 */
export function markAlertSent(productId, alertType) {
    const alertKey = `${productId}:${alertType}`;
    recentAlerts.set(alertKey, Date.now());
}

/**
 * Clear alert rate limit (for testing)
 * @param {number} productId - Product ID
 * @param {string} alertType - Type of alert
 */
export function clearAlertRateLimit(productId, alertType) {
    const alertKey = `${productId}:${alertType}`;
    recentAlerts.delete(alertKey);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits() {
    recentAlerts.clear();
}

/**
 * Format alert message
 * @param {Object} alertData - Alert data
 * @returns {Object} Formatted alert
 */
export function formatAlertMessage(alertData) {
    const {
        productId,
        title,
        url,
        oldPrice,
        newPrice,
        percentChange,
        absoluteChange,
        direction,
        severity,
        site,
    } = alertData;

    const emoji = direction === 'down' ? '📉' : '📈';
    const action = direction === 'down' ? 'dropped' : 'increased';
    const sign = direction === 'down' ? '' : '+';

    return {
        subject: `${emoji} Price ${action} ${sign}${percentChange.toFixed(1)}%: ${title}`,
        body: [
            `Product: ${title}`,
            `Site: ${site || 'Unknown'}`,
            `Old Price: $${oldPrice.toFixed(2)}`,
            `New Price: $${newPrice.toFixed(2)}`,
            `Change: ${sign}$${Math.abs(absoluteChange).toFixed(2)} (${sign}${percentChange.toFixed(1)}%)`,
            `Severity: ${severity}`,
            `URL: ${url}`,
        ].join('\n'),
        html: `
            <h2>${emoji} Price Alert</h2>
            <p><strong>${title}</strong></p>
            <table>
                <tr><td>Site:</td><td>${site || 'Unknown'}</td></tr>
                <tr><td>Old Price:</td><td>$${oldPrice.toFixed(2)}</td></tr>
                <tr><td>New Price:</td><td><strong>$${newPrice.toFixed(2)}</strong></td></tr>
                <tr><td>Change:</td><td>${sign}$${Math.abs(absoluteChange).toFixed(2)} (${sign}${percentChange.toFixed(1)}%)</td></tr>
                <tr><td>Severity:</td><td>${severity}</td></tr>
            </table>
            <p><a href="${url}">View Product</a></p>
        `,
        data: alertData,
    };
}

/**
 * Send alert via log channel
 * @param {Object} formattedAlert - Formatted alert message
 */
async function sendLogAlert(formattedAlert) {
    const { data } = formattedAlert;
    const logLevel = data.severity === 'high' ? 'warn' : 'info';
    
    logger[logLevel]({
        type: 'PRICE_ALERT',
        productId: data.productId,
        title: data.title,
        oldPrice: data.oldPrice,
        newPrice: data.newPrice,
        percentChange: data.percentChange,
        direction: data.direction,
        severity: data.severity,
        url: data.url,
    }, formattedAlert.subject);
}

/**
 * Send alert via webhook channel
 * @param {Object} formattedAlert - Formatted alert message
 * @param {string} webhookUrl - Webhook URL
 */
async function sendWebhookAlert(formattedAlert, webhookUrl) {
    if (!webhookUrl) {
        logger.warn('Webhook URL not configured for price alerts');
        return { success: false, error: 'No webhook URL configured' };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: formattedAlert.subject,
                attachments: [{
                    color: formattedAlert.data.direction === 'down' ? '#00ff00' : '#ff0000',
                    title: formattedAlert.data.title,
                    title_link: formattedAlert.data.url,
                    fields: [
                        { title: 'Old Price', value: `$${formattedAlert.data.oldPrice.toFixed(2)}`, short: true },
                        { title: 'New Price', value: `$${formattedAlert.data.newPrice.toFixed(2)}`, short: true },
                        { title: 'Change', value: `${formattedAlert.data.percentChange.toFixed(1)}%`, short: true },
                        { title: 'Severity', value: formattedAlert.data.severity, short: true },
                    ],
                }],
            }),
        });

        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}`);
        }

        logger.info({ webhookUrl: webhookUrl.substring(0, 50) }, 'Webhook alert sent successfully');
        return { success: true };
    } catch (error) {
        logger.error({ error: error.message, webhookUrl: webhookUrl.substring(0, 50) }, 'Failed to send webhook alert');
        return { success: false, error: error.message };
    }
}

/**
 * Send alert via email channel
 * @param {Object} formattedAlert - Formatted alert message
 * @param {Array<string>} recipients - Email recipients
 */
async function sendEmailAlert(formattedAlert, recipients) {
    if (!recipients || recipients.length === 0) {
        logger.warn('No email recipients configured for price alerts');
        return { success: false, error: 'No email recipients configured' };
    }

    try {
        // Use the email service to send the alert
        const result = await sendPriceAlertEmail(formattedAlert.data, recipients);
        
        if (result.success) {
            logger.info({ 
                recipients, 
                subject: formattedAlert.subject,
                messageId: result.messageId,
            }, 'Email alert sent successfully');
        } else {
            logger.warn({ 
                recipients, 
                error: result.error,
            }, 'Email alert failed');
        }
        
        return result;
    } catch (error) {
        logger.error({ error: error.message, recipients }, 'Email alert error');
        return { success: false, error: error.message };
    }
}

/**
 * Send price alert through configured channels
 * @param {Object} alertData - Alert data
 * @returns {Promise<Object>} Send results
 */
export async function sendPriceAlert(alertData) {
    const alertConfig = getAlertConfig();
    
    if (!alertConfig.enabled) {
        logger.debug({ productId: alertData.productId }, 'Price alerts disabled');
        return { sent: false, reason: 'alerts_disabled' };
    }

    const { productId, direction } = alertData;
    const alertType = direction === 'down' ? 'price_drop' : 'price_increase';

    if (!shouldSendAlert(productId, alertType)) {
        return { sent: false, reason: 'rate_limited' };
    }

    const formattedAlert = formatAlertMessage(alertData);
    const results = {
        sent: true,
        channels: {},
    };

    for (const channel of alertConfig.channels) {
        try {
            switch (channel) {
                case ALERT_CHANNELS.LOG:
                    await sendLogAlert(formattedAlert);
                    results.channels[channel] = { success: true };
                    break;
                case ALERT_CHANNELS.WEBHOOK:
                    results.channels[channel] = await sendWebhookAlert(formattedAlert, alertConfig.webhookUrl);
                    break;
                case ALERT_CHANNELS.EMAIL:
                    results.channels[channel] = await sendEmailAlert(formattedAlert, alertConfig.emailRecipients);
                    break;
                default:
                    logger.warn({ channel }, 'Unknown alert channel');
                    results.channels[channel] = { success: false, error: 'Unknown channel' };
            }
        } catch (error) {
            logger.error({ error: error.message, channel }, 'Alert channel failed');
            results.channels[channel] = { success: false, error: error.message };
        }
    }

    // Mark as sent for rate limiting
    markAlertSent(productId, alertType);

    return results;
}

/**
 * Create alert from price change detection result
 * @param {Object} product - Product info
 * @param {Object} changeResult - Result from detectPriceChange
 * @returns {Object} Alert data
 */
export function createAlertFromChange(product, changeResult) {
    if (!changeResult.detected || !changeResult.alert?.shouldAlert) {
        return null;
    }

    return {
        productId: changeResult.productId,
        title: product.title,
        url: product.url,
        site: product.site,
        oldPrice: changeResult.oldPrice,
        newPrice: changeResult.newPrice,
        percentChange: changeResult.change.percentChange,
        absoluteChange: changeResult.change.absoluteChange,
        direction: changeResult.change.direction,
        severity: changeResult.alert.severity,
        alertReason: changeResult.alert.reason,
    };
}

export default {
    ALERT_CHANNELS,
    shouldSendAlert,
    markAlertSent,
    clearAlertRateLimit,
    clearAllRateLimits,
    formatAlertMessage,
    sendPriceAlert,
    createAlertFromChange,
};
