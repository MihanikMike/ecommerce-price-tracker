#!/usr/bin/env node

/**
 * Email Alerts CLI
 * 
 * Manage and test email notifications for price alerts.
 * 
 * Usage:
 *   node src/cli/email-alerts.js status          Show email configuration status
 *   node src/cli/email-alerts.js test            Send a test email
 *   node src/cli/email-alerts.js test-alert      Send a test price alert
 *   node src/cli/email-alerts.js digest          Send a test daily digest
 *   node src/cli/email-alerts.js help            Show this help
 */

import { 
    getEmailConfig, 
    verifyEmailConfig, 
    sendEmail,
    sendPriceAlertEmail,
    sendDailyDigestEmail,
    EMAIL_PROVIDERS,
} from '../services/emailService.js';
import logger from '../utils/logger.js';

function print(msg) {
    console.log(msg);
}

async function showStatus() {
    print('\n📧 Email Configuration Status\n');
    print('='.repeat(60));
    
    const config = getEmailConfig();
    
    print(`\nEnabled: ${config.enabled ? '✅ Yes' : '❌ No'}`);
    print(`Provider: ${config.provider}`);
    print(`From: "${config.fromName}" <${config.from}>`);
    
    // Provider-specific info
    print('\nProvider Configuration:');
    switch (config.provider) {
        case EMAIL_PROVIDERS.SMTP:
            print(`  Host: ${config.smtp.host}`);
            print(`  Port: ${config.smtp.port}`);
            print(`  Secure: ${config.smtp.secure}`);
            print(`  Auth: ${config.smtp.user ? '✅ Configured' : '❌ Not configured'}`);
            break;
        case EMAIL_PROVIDERS.GMAIL:
            print(`  User: ${config.gmail.user || '❌ Not set'}`);
            print(`  App Password: ${config.gmail.appPassword ? '✅ Set' : '❌ Not set'}`);
            break;
        case EMAIL_PROVIDERS.SENDGRID:
            print(`  API Key: ${config.sendgrid.apiKey ? '✅ Set' : '❌ Not set'}`);
            break;
        case EMAIL_PROVIDERS.SES:
            print(`  Region: ${config.ses.region}`);
            print(`  Access Key: ${config.ses.accessKeyId ? '✅ Set' : '❌ Not set'}`);
            break;
        case EMAIL_PROVIDERS.MAILGUN:
            print(`  Domain: ${config.mailgun.domain || '❌ Not set'}`);
            print(`  API Key: ${config.mailgun.apiKey ? '✅ Set' : '❌ Not set'}`);
            break;
        case EMAIL_PROVIDERS.MAILRU:
            print(`  User: ${config.mailru.user || '❌ Not set'}`);
            print(`  App Password: ${config.mailru.appPassword ? '✅ Set' : '❌ Not set'}`);
            break;
    }
    
    // Verify configuration
    if (config.enabled) {
        print('\nVerifying connection...');
        const verification = await verifyEmailConfig();
        if (verification.success) {
            print('✅ Email configuration verified successfully!');
        } else {
            print(`❌ Verification failed: ${verification.error}`);
        }
    }
    
    print('\n' + '='.repeat(60));
    print('\nEnvironment Variables for Email:');
    print('  EMAIL_ENABLED=true                    # Enable email');
    print('  EMAIL_PROVIDER=smtp|gmail|sendgrid|mailru  # Provider');
    print('  EMAIL_FROM=alerts@example.com         # From address');
    print('  EMAIL_FROM_NAME=Price Tracker         # From name');
    print('  PRICE_ALERT_EMAIL_RECIPIENTS=a@b.com  # Recipients (comma-separated)');
    print('');
    print('For SMTP:');
    print('  SMTP_HOST=smtp.example.com');
    print('  SMTP_PORT=587');
    print('  SMTP_USER=username');
    print('  SMTP_PASS=password');
    print('');
    print('For Gmail (use App Password):');
    print('  GMAIL_USER=your.email@gmail.com');
    print('  GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx');
    print('');
    print('For SendGrid:');
    print('  SENDGRID_API_KEY=SG.xxxxx');
    print('');
    print('For AWS SES:');
    print('  AWS_SES_REGION=us-east-1');
    print('  AWS_SES_ACCESS_KEY_ID=AKIAXXXXXXXX');
    print('  AWS_SES_SECRET_ACCESS_KEY=xxxxx');
    print('');
    print('For Mailgun:');
    print('  MAILGUN_API_KEY=key-xxxxx');
    print('  MAILGUN_DOMAIN=mg.example.com');
    print('');
    print('For Mail.ru:');
    print('  MAILRU_USER=your.email@mail.ru');
    print('  MAILRU_APP_PASSWORD=your-app-password');
    print('');
}

async function sendTestEmail() {
    print('\n📧 Sending Test Email\n');
    
    const config = getEmailConfig();
    
    if (!config.enabled) {
        print('❌ Email is not enabled. Set EMAIL_ENABLED=true');
        return;
    }
    
    const recipients = process.env.PRICE_ALERT_EMAIL_RECIPIENTS?.split(',').map(e => e.trim());
    if (!recipients || recipients.length === 0) {
        print('❌ No recipients configured. Set PRICE_ALERT_EMAIL_RECIPIENTS');
        return;
    }
    
    print(`Sending to: ${recipients.join(', ')}`);
    
    const result = await sendEmail({
        to: recipients,
        subject: '✅ Price Tracker Test Email',
        text: 'This is a test email from Price Tracker.\n\nIf you received this, email notifications are working correctly!',
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h1 style="color: #00aa00;">✅ Test Email Successful!</h1>
                <p>This is a test email from <strong>Price Tracker</strong>.</p>
                <p>If you received this, email notifications are working correctly!</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Sent at: ${new Date().toISOString()}
                </p>
            </div>
        `,
    });
    
    if (result.success) {
        print(`\n✅ Test email sent successfully!`);
        print(`   Message ID: ${result.messageId}`);
    } else {
        print(`\n❌ Failed to send email: ${result.error}`);
    }
}

async function sendTestPriceAlert() {
    print('\n📧 Sending Test Price Alert\n');
    
    const config = getEmailConfig();
    
    if (!config.enabled) {
        print('❌ Email is not enabled. Set EMAIL_ENABLED=true');
        return;
    }
    
    const recipients = process.env.PRICE_ALERT_EMAIL_RECIPIENTS?.split(',').map(e => e.trim());
    if (!recipients || recipients.length === 0) {
        print('❌ No recipients configured. Set PRICE_ALERT_EMAIL_RECIPIENTS');
        return;
    }
    
    print(`Sending to: ${recipients.join(', ')}`);
    
    // Create a fake price alert
    const testAlert = {
        productId: 999,
        title: 'Apple AirPods Pro (2nd Generation) - TEST ALERT',
        url: 'https://www.amazon.com/dp/BXXXXXXXXX',
        site: 'Amazon',
        oldPrice: 249.99,
        newPrice: 189.99,
        percentChange: -24.0,
        absoluteChange: -60.00,
        direction: 'down',
        severity: 'high',
    };
    
    const result = await sendPriceAlertEmail(testAlert, recipients);
    
    if (result.success) {
        print(`\n✅ Test price alert sent successfully!`);
        print(`   Message ID: ${result.messageId}`);
    } else {
        print(`\n❌ Failed to send alert: ${result.error}`);
    }
}

async function sendTestDigest() {
    print('\n📧 Sending Test Daily Digest\n');
    
    const config = getEmailConfig();
    
    if (!config.enabled) {
        print('❌ Email is not enabled. Set EMAIL_ENABLED=true');
        return;
    }
    
    const recipients = process.env.PRICE_ALERT_EMAIL_RECIPIENTS?.split(',').map(e => e.trim());
    if (!recipients || recipients.length === 0) {
        print('❌ No recipients configured. Set PRICE_ALERT_EMAIL_RECIPIENTS');
        return;
    }
    
    print(`Sending to: ${recipients.join(', ')}`);
    
    // Create fake price changes for the digest
    const testChanges = [
        {
            title: 'Apple AirPods Pro (2nd Generation)',
            url: 'https://www.amazon.com/dp/BXXXXXXXXX',
            site: 'Amazon',
            oldPrice: 249.99,
            newPrice: 189.99,
            percentChange: -24.0,
            direction: 'down',
        },
        {
            title: 'Sony WH-1000XM5 Wireless Headphones',
            url: 'https://www.target.com/p/-/A-XXXXXXX',
            site: 'Target',
            oldPrice: 399.99,
            newPrice: 329.99,
            percentChange: -17.5,
            direction: 'down',
        },
        {
            title: 'Nintendo Switch OLED Model',
            url: 'https://www.walmart.com/ip/XXXXXXX',
            site: 'Walmart',
            oldPrice: 349.00,
            newPrice: 379.00,
            percentChange: 8.6,
            direction: 'up',
        },
        {
            title: 'Samsung 65" OLED 4K TV',
            url: 'https://www.bestbuy.com/site/XXXXXXX',
            site: 'Best Buy',
            oldPrice: 1799.99,
            newPrice: 1499.99,
            percentChange: -16.7,
            direction: 'down',
        },
    ];
    
    const result = await sendDailyDigestEmail(testChanges, recipients);
    
    if (result.success) {
        print(`\n✅ Test daily digest sent successfully!`);
        print(`   Message ID: ${result.messageId}`);
    } else {
        print(`\n❌ Failed to send digest: ${result.error}`);
    }
}

function showHelp() {
    print(`
Email Alerts CLI

Usage:
  node src/cli/email-alerts.js <command>

Commands:
  status        Show email configuration status
  test          Send a simple test email
  test-alert    Send a test price drop alert
  digest        Send a test daily digest email
  help          Show this help

Environment Variables:
  EMAIL_ENABLED=true                     Enable email notifications
  EMAIL_PROVIDER=smtp                    Provider: smtp|gmail|sendgrid|ses|mailgun
  EMAIL_FROM=alerts@example.com          From email address
  EMAIL_FROM_NAME=Price Tracker          From display name
  PRICE_ALERT_EMAIL_RECIPIENTS=a@b.com   Recipients (comma-separated)

SMTP Configuration:
  SMTP_HOST=smtp.example.com             SMTP server hostname
  SMTP_PORT=587                          SMTP port
  SMTP_USER=username                     SMTP username
  SMTP_PASS=password                     SMTP password
  SMTP_SECURE=false                      Use TLS

Gmail Configuration (use App Password):
  GMAIL_USER=your.email@gmail.com        Gmail address
  GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx      Gmail App Password

SendGrid Configuration:
  SENDGRID_API_KEY=SG.xxxxx              SendGrid API key

Examples:
  # Check email status
  node src/cli/email-alerts.js status

  # Test email with Gmail
  EMAIL_ENABLED=true \\
  EMAIL_PROVIDER=gmail \\
  GMAIL_USER=you@gmail.com \\
  GMAIL_APP_PASSWORD=your-app-password \\
  PRICE_ALERT_EMAIL_RECIPIENTS=you@gmail.com \\
  node src/cli/email-alerts.js test
`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'status':
        showStatus();
        break;
    case 'test':
        sendTestEmail().catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
        break;
    case 'test-alert':
        sendTestPriceAlert().catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
        break;
    case 'digest':
        sendTestDigest().catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
        break;
    case 'help':
    case '--help':
    case '-h':
    default:
        showHelp();
        break;
}
