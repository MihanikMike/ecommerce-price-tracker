/**
 * Email Service
 * 
 * Handles email notifications for price alerts using nodemailer.
 * Supports multiple providers: SMTP, Gmail, SendGrid, AWS SES, Mailgun
 * 
 * Configuration via environment variables:
 *   EMAIL_PROVIDER=smtp|gmail|sendgrid|ses|mailgun
 *   EMAIL_FROM=alerts@example.com
 *   EMAIL_FROM_NAME=Price Tracker
 *   
 * For SMTP:
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=user
 *   SMTP_PASS=password
 *   SMTP_SECURE=false
 * 
 * For Gmail:
 *   GMAIL_USER=your.email@gmail.com
 *   GMAIL_APP_PASSWORD=your-app-password
 * 
 * For SendGrid:
 *   SENDGRID_API_KEY=SG.xxxxx
 * 
 * For AWS SES:
 *   AWS_SES_REGION=us-east-1
 *   AWS_ACCESS_KEY_ID=xxxxx
 *   AWS_SECRET_ACCESS_KEY=xxxxx
 * 
 * For Mailgun:
 *   MAILGUN_API_KEY=key-xxxxx
 *   MAILGUN_DOMAIN=mg.example.com
 */

import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// Supported email providers
export const EMAIL_PROVIDERS = {
    SMTP: 'smtp',
    GMAIL: 'gmail',
    SENDGRID: 'sendgrid',
    SES: 'ses',
    MAILGUN: 'mailgun',
    MAILRU: 'mailru',
    TEST: 'test', // For testing - logs only
};

// Cached transporter instance
let transporter = null;

/**
 * Get email configuration from environment
 */
export function getEmailConfig() {
    return {
        enabled: process.env.EMAIL_ENABLED === 'true',
        provider: process.env.EMAIL_PROVIDER || EMAIL_PROVIDERS.SMTP,
        from: process.env.EMAIL_FROM || 'price-tracker@localhost',
        fromName: process.env.EMAIL_FROM_NAME || 'Price Tracker',
        
        // SMTP settings
        smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
        
        // Gmail settings (use App Password, not regular password)
        gmail: {
            user: process.env.GMAIL_USER || '',
            appPassword: process.env.GMAIL_APP_PASSWORD || '',
        },
        
        // SendGrid settings
        sendgrid: {
            apiKey: process.env.SENDGRID_API_KEY || '',
        },
        
        // AWS SES settings
        ses: {
            region: process.env.AWS_SES_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
        
        // Mailgun settings
        mailgun: {
            apiKey: process.env.MAILGUN_API_KEY || '',
            domain: process.env.MAILGUN_DOMAIN || '',
        },
        
        // Mail.ru settings (use App Password from mail.ru account settings)
        mailru: {
            user: process.env.MAILRU_USER || '',
            appPassword: process.env.MAILRU_APP_PASSWORD || '',
        },
    };
}

/**
 * Create nodemailer transporter based on provider
 */
export function createTransporter(config = null) {
    const emailConfig = config || getEmailConfig();
    const { provider } = emailConfig;
    
    logger.debug({ provider }, 'Creating email transporter');
    
    switch (provider) {
        case EMAIL_PROVIDERS.SMTP:
            return nodemailer.createTransport({
                host: emailConfig.smtp.host,
                port: emailConfig.smtp.port,
                secure: emailConfig.smtp.secure,
                auth: emailConfig.smtp.user ? {
                    user: emailConfig.smtp.user,
                    pass: emailConfig.smtp.pass,
                } : undefined,
            });
            
        case EMAIL_PROVIDERS.GMAIL:
            return nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailConfig.gmail.user,
                    pass: emailConfig.gmail.appPassword,
                },
            });
            
        case EMAIL_PROVIDERS.SENDGRID:
            return nodemailer.createTransport({
                host: 'smtp.sendgrid.net',
                port: 587,
                auth: {
                    user: 'apikey',
                    pass: emailConfig.sendgrid.apiKey,
                },
            });
            
        case EMAIL_PROVIDERS.SES:
            return nodemailer.createTransport({
                SES: {
                    ses: {
                        region: emailConfig.ses.region,
                        credentials: {
                            accessKeyId: emailConfig.ses.accessKeyId,
                            secretAccessKey: emailConfig.ses.secretAccessKey,
                        },
                    },
                    aws: { SendRawEmailCommand: {} },
                },
            });
            
        case EMAIL_PROVIDERS.MAILGUN:
            return nodemailer.createTransport({
                host: 'smtp.mailgun.org',
                port: 587,
                auth: {
                    user: `postmaster@${emailConfig.mailgun.domain}`,
                    pass: emailConfig.mailgun.apiKey,
                },
            });
            
        case EMAIL_PROVIDERS.MAILRU:
            // Mail.ru SMTP settings
            // Requires App Password from: https://account.mail.ru/user/2-step-auth/passwords
            return nodemailer.createTransport({
                host: 'smtp.mail.ru',
                port: 465,
                secure: true, // SSL
                auth: {
                    user: emailConfig.mailru.user,
                    pass: emailConfig.mailru.appPassword,
                },
            });
            
        case EMAIL_PROVIDERS.TEST:
            // Test mode - uses JSON transport (logs to console)
            return nodemailer.createTransport({
                jsonTransport: true,
            });
            
        default:
            throw new Error(`Unknown email provider: ${provider}`);
    }
}

/**
 * Get or create the transporter singleton
 */
export function getTransporter() {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
}

/**
 * Reset transporter (for testing or config changes)
 */
export function resetTransporter() {
    if (transporter) {
        transporter.close?.();
        transporter = null;
    }
}

/**
 * Verify email configuration works
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyEmailConfig() {
    const config = getEmailConfig();
    
    if (!config.enabled) {
        return { success: false, error: 'Email not enabled' };
    }
    
    if (config.provider === EMAIL_PROVIDERS.TEST) {
        return { success: true, note: 'Test mode - emails will be logged' };
    }
    
    try {
        const transport = getTransporter();
        await transport.verify();
        logger.info({ provider: config.provider }, 'Email configuration verified');
        return { success: true };
    } catch (error) {
        logger.error({ error: error.message, provider: config.provider }, 'Email verification failed');
        return { success: false, error: error.message };
    }
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string|Array<string>} options.to - Recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, text, html }) {
    const config = getEmailConfig();
    
    if (!config.enabled) {
        logger.debug({ to, subject }, 'Email not sent - disabled');
        return { success: false, error: 'Email not enabled' };
    }
    
    // Normalize recipients
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0 || !recipients[0]) {
        return { success: false, error: 'No recipients specified' };
    }
    
    const mailOptions = {
        from: `"${config.fromName}" <${config.from}>`,
        to: recipients.join(', '),
        subject,
        text,
        html,
    };
    
    try {
        const transport = getTransporter();
        const info = await transport.sendMail(mailOptions);
        
        // For test transport, log the message
        if (config.provider === EMAIL_PROVIDERS.TEST) {
            logger.info({ 
                to: recipients, 
                subject,
                message: JSON.parse(info.message),
            }, 'Test email logged');
            return { success: true, messageId: 'test-' + Date.now() };
        }
        
        logger.info({ 
            to: recipients, 
            subject, 
            messageId: info.messageId,
        }, 'Email sent successfully');
        
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        logger.error({ 
            error: error.message, 
            to: recipients, 
            subject,
        }, 'Failed to send email');
        
        return { success: false, error: error.message };
    }
}

/**
 * Send a price alert email
 * @param {Object} alertData - Alert data
 * @param {Array<string>} recipients - Email recipients
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendPriceAlertEmail(alertData, recipients) {
    const {
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
    const sign = direction === 'down' ? '-' : '+';
    const color = direction === 'down' ? '#00aa00' : '#ff0000';
    const bgColor = direction === 'down' ? '#e6ffe6' : '#ffe6e6';
    
    const subject = `${emoji} Price ${action} ${Math.abs(percentChange).toFixed(1)}%: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`;
    
    const text = `
Price Alert!

Product: ${title}
Site: ${site || 'Unknown'}

Price Change:
  Old Price: $${oldPrice.toFixed(2)}
  New Price: $${newPrice.toFixed(2)}
  Change: ${sign}$${Math.abs(absoluteChange).toFixed(2)} (${sign}${Math.abs(percentChange).toFixed(1)}%)

Severity: ${severity.toUpperCase()}

View Product: ${url}

---
You received this alert because you're tracking this product with Price Tracker.
To stop receiving alerts, update your notification settings.
    `.trim();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${bgColor}; border-left: 4px solid ${color}; padding: 20px; margin-bottom: 20px; border-radius: 4px;">
        <h1 style="margin: 0 0 10px 0; font-size: 24px; color: ${color};">
            ${emoji} Price ${action.charAt(0).toUpperCase() + action.slice(1)}!
        </h1>
        <p style="margin: 0; font-size: 16px; color: #666;">
            ${sign}${Math.abs(percentChange).toFixed(1)}% (${sign}$${Math.abs(absoluteChange).toFixed(2)})
        </p>
    </div>
    
    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #333;">
            ${title}
        </h2>
        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
            Site: <strong>${site || 'Unknown'}</strong>
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #666;">Old Price:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; text-decoration: line-through; color: #999;">
                    $${oldPrice.toFixed(2)}
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #666;">New Price:</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 20px; color: ${color};">
                    $${newPrice.toFixed(2)}
                </td>
            </tr>
            <tr>
                <td style="padding: 10px; color: #666;">Savings:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold; color: ${color};">
                    ${sign}$${Math.abs(absoluteChange).toFixed(2)} (${sign}${Math.abs(percentChange).toFixed(1)}%)
                </td>
            </tr>
        </table>
        
        <div style="text-align: center; margin-top: 20px;">
            <a href="${url}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Product →
            </a>
        </div>
    </div>
    
    <div style="background: #fff3cd; padding: 10px 15px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #ffc107;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Alert Severity:</strong> ${severity.toUpperCase()}
        </p>
    </div>
    
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
        <p>You received this alert because you're tracking this product with Price Tracker.</p>
        <p>To stop receiving alerts, update your notification settings.</p>
    </div>
</body>
</html>
    `.trim();
    
    return sendEmail({ to: recipients, subject, text, html });
}

/**
 * Send a daily digest of price changes
 * @param {Array<Object>} priceChanges - Array of price change objects
 * @param {Array<string>} recipients - Email recipients
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendDailyDigestEmail(priceChanges, recipients) {
    if (!priceChanges || priceChanges.length === 0) {
        return { success: false, error: 'No price changes to report' };
    }
    
    const drops = priceChanges.filter(p => p.direction === 'down');
    const increases = priceChanges.filter(p => p.direction === 'up');
    
    const subject = `📊 Daily Price Digest: ${drops.length} drops, ${increases.length} increases`;
    
    const formatChange = (change) => {
        const sign = change.direction === 'down' ? '-' : '+';
        return `• ${change.title.substring(0, 40)}${change.title.length > 40 ? '...' : ''}\n` +
               `  $${change.oldPrice.toFixed(2)} → $${change.newPrice.toFixed(2)} (${sign}${Math.abs(change.percentChange).toFixed(1)}%)\n`;
    };
    
    let text = `Daily Price Digest\n${'='.repeat(50)}\n\n`;
    
    if (drops.length > 0) {
        text += `📉 PRICE DROPS (${drops.length})\n${'-'.repeat(30)}\n`;
        drops.forEach(d => text += formatChange(d));
        text += '\n';
    }
    
    if (increases.length > 0) {
        text += `📈 PRICE INCREASES (${increases.length})\n${'-'.repeat(30)}\n`;
        increases.forEach(i => text += formatChange(i));
        text += '\n';
    }
    
    text += `\n---\nGenerated by Price Tracker`;
    
    // Generate HTML version
    const formatHtmlRow = (change) => {
        const color = change.direction === 'down' ? '#00aa00' : '#ff0000';
        const sign = change.direction === 'down' ? '-' : '+';
        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <a href="${change.url}" style="color: #333; text-decoration: none;">${change.title.substring(0, 50)}${change.title.length > 50 ? '...' : ''}</a>
                    <br><small style="color: #666;">${change.site || 'Unknown'}</small>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; text-decoration: line-through; color: #999;">
                    $${change.oldPrice.toFixed(2)}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">
                    $${change.newPrice.toFixed(2)}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${color}; font-weight: bold;">
                    ${sign}${Math.abs(change.percentChange).toFixed(1)}%
                </td>
            </tr>
        `;
    };
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">📊 Daily Price Digest</h1>
    
    <div style="display: flex; gap: 20px; margin: 20px 0;">
        <div style="flex: 1; background: #e6ffe6; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #00aa00;">${drops.length}</div>
            <div style="color: #666;">Price Drops</div>
        </div>
        <div style="flex: 1; background: #ffe6e6; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #ff0000;">${increases.length}</div>
            <div style="color: #666;">Price Increases</div>
        </div>
    </div>
    
    ${drops.length > 0 ? `
    <h2 style="color: #00aa00; margin-top: 30px;">📉 Price Drops</h2>
    <table style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="background: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: right;">Was</th>
                <th style="padding: 10px; text-align: right;">Now</th>
                <th style="padding: 10px; text-align: right;">Change</th>
            </tr>
        </thead>
        <tbody>
            ${drops.map(formatHtmlRow).join('')}
        </tbody>
    </table>
    ` : ''}
    
    ${increases.length > 0 ? `
    <h2 style="color: #ff0000; margin-top: 30px;">📈 Price Increases</h2>
    <table style="width: 100%; border-collapse: collapse;">
        <thead>
            <tr style="background: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: right;">Was</th>
                <th style="padding: 10px; text-align: right;">Now</th>
                <th style="padding: 10px; text-align: right;">Change</th>
            </tr>
        </thead>
        <tbody>
            ${increases.map(formatHtmlRow).join('')}
        </tbody>
    </table>
    ` : ''}
    
    <div style="text-align: center; padding-top: 30px; border-top: 1px solid #eee; margin-top: 30px; color: #999; font-size: 12px;">
        <p>Generated by Price Tracker</p>
    </div>
</body>
</html>
    `.trim();
    
    return sendEmail({ to: recipients, subject, text, html });
}

export default {
    EMAIL_PROVIDERS,
    getEmailConfig,
    createTransporter,
    getTransporter,
    resetTransporter,
    verifyEmailConfig,
    sendEmail,
    sendPriceAlertEmail,
    sendDailyDigestEmail,
};
