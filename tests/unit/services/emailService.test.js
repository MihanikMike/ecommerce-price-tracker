/**
 * Email Service Tests
 */

import { jest } from '@jest/globals';

// Mock nodemailer before importing emailService
jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: jest.fn(() => ({
            sendMail: jest.fn(),
            verify: jest.fn(),
            close: jest.fn(),
        })),
    },
}));

// Import after mocking
const { default: nodemailer } = await import('nodemailer');
const {
    EMAIL_PROVIDERS,
    getEmailConfig,
    createTransporter,
    resetTransporter,
    verifyEmailConfig,
    sendEmail,
    sendPriceAlertEmail,
    sendDailyDigestEmail,
} = await import('../../../src/services/emailService.js');

describe('emailService', () => {
    let mockTransport;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        resetTransporter();
        
        // Create mock transport
        mockTransport = {
            sendMail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
            verify: jest.fn().mockResolvedValue(true),
            close: jest.fn(),
        };
        
        nodemailer.createTransport.mockReturnValue(mockTransport);
    });
    
    afterEach(() => {
        // Clean up environment
        delete process.env.EMAIL_ENABLED;
        delete process.env.EMAIL_PROVIDER;
        delete process.env.EMAIL_FROM;
        delete process.env.EMAIL_FROM_NAME;
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_PORT;
        resetTransporter();
    });

    describe('EMAIL_PROVIDERS', () => {
        it('should have all expected providers', () => {
            expect(EMAIL_PROVIDERS.SMTP).toBe('smtp');
            expect(EMAIL_PROVIDERS.GMAIL).toBe('gmail');
            expect(EMAIL_PROVIDERS.SENDGRID).toBe('sendgrid');
            expect(EMAIL_PROVIDERS.SES).toBe('ses');
            expect(EMAIL_PROVIDERS.MAILRU).toBe('mailru');
            expect(EMAIL_PROVIDERS.MAILGUN).toBe('mailgun');
            expect(EMAIL_PROVIDERS.TEST).toBe('test');
        });
    });

    describe('getEmailConfig', () => {
        it('should return default config when no env vars set', () => {
            const config = getEmailConfig();
            
            expect(config.enabled).toBe(false);
            expect(config.provider).toBe('smtp');
            expect(config.from).toBe('price-tracker@localhost');
            expect(config.fromName).toBe('Price Tracker');
        });
        
        it('should return config from environment variables', () => {
            process.env.EMAIL_ENABLED = 'true';
            process.env.EMAIL_PROVIDER = 'gmail';
            process.env.EMAIL_FROM = 'test@example.com';
            process.env.EMAIL_FROM_NAME = 'Test Alerts';
            
            const config = getEmailConfig();
            
            expect(config.enabled).toBe(true);
            expect(config.provider).toBe('gmail');
            expect(config.from).toBe('test@example.com');
            expect(config.fromName).toBe('Test Alerts');
        });
        
        it('should include SMTP settings', () => {
            process.env.SMTP_HOST = 'mail.example.com';
            process.env.SMTP_PORT = '465';
            process.env.SMTP_SECURE = 'true';
            process.env.SMTP_USER = 'user@example.com';
            process.env.SMTP_PASS = 'secret123';
            
            const config = getEmailConfig();
            
            expect(config.smtp.host).toBe('mail.example.com');
            expect(config.smtp.port).toBe(465);
            expect(config.smtp.secure).toBe(true);
            expect(config.smtp.user).toBe('user@example.com');
            expect(config.smtp.pass).toBe('secret123');
        });
    });

    describe('createTransporter', () => {
        it('should create SMTP transporter', () => {
            const config = {
                provider: EMAIL_PROVIDERS.SMTP,
                smtp: {
                    host: 'smtp.example.com',
                    port: 587,
                    secure: false,
                    user: 'user',
                    pass: 'pass',
                },
            };
            
            createTransporter(config);
            
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.example.com',
                port: 587,
                secure: false,
                auth: { user: 'user', pass: 'pass' },
            });
        });
        
        it('should create Gmail transporter', () => {
            const config = {
                provider: EMAIL_PROVIDERS.GMAIL,
                gmail: {
                    user: 'user@gmail.com',
                    appPassword: 'app-pass',
                },
            };
            
            createTransporter(config);
            
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                service: 'gmail',
                auth: { user: 'user@gmail.com', pass: 'app-pass' },
            });
        });
        
        it('should create SendGrid transporter', () => {
            const config = {
                provider: EMAIL_PROVIDERS.SENDGRID,
                sendgrid: {
                    apiKey: 'SG.xxxxx',
                },
            };
            
            createTransporter(config);
            
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.sendgrid.net',
                port: 587,
                auth: { user: 'apikey', pass: 'SG.xxxxx' },
            });
        });
        
        it('should create Mail.ru transporter', () => {
            const config = {
                provider: EMAIL_PROVIDERS.MAILRU,
                mailru: {
                    user: 'user@mail.ru',
                    appPassword: 'app-pass',
                },
            };
            
            createTransporter(config);
            
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                host: 'smtp.mail.ru',
                port: 465,
                secure: true,
                auth: { user: 'user@mail.ru', pass: 'app-pass' },
            });
        });
        
        it('should create test transporter', () => {
            const config = {
                provider: EMAIL_PROVIDERS.TEST,
            };
            
            createTransporter(config);
            
            expect(nodemailer.createTransport).toHaveBeenCalledWith({
                jsonTransport: true,
            });
        });
        
        it('should throw for unknown provider', () => {
            const config = {
                provider: 'unknown',
            };
            
            expect(() => createTransporter(config)).toThrow('Unknown email provider: unknown');
        });
    });

    describe('verifyEmailConfig', () => {
        it('should return false when email not enabled', async () => {
            process.env.EMAIL_ENABLED = 'false';
            
            const result = await verifyEmailConfig();
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Email not enabled');
        });
        
        it('should verify successfully when config is valid', async () => {
            process.env.EMAIL_ENABLED = 'true';
            process.env.EMAIL_PROVIDER = 'smtp';
            
            const result = await verifyEmailConfig();
            
            expect(result.success).toBe(true);
            expect(mockTransport.verify).toHaveBeenCalled();
        });
        
        it('should return error when verification fails', async () => {
            process.env.EMAIL_ENABLED = 'true';
            mockTransport.verify.mockRejectedValue(new Error('Connection refused'));
            
            const result = await verifyEmailConfig();
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection refused');
        });
    });

    describe('sendEmail', () => {
        it('should not send when email disabled', async () => {
            process.env.EMAIL_ENABLED = 'false';
            
            const result = await sendEmail({
                to: 'test@example.com',
                subject: 'Test',
                text: 'Hello',
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Email not enabled');
            expect(mockTransport.sendMail).not.toHaveBeenCalled();
        });
        
        it('should return error when no recipients', async () => {
            process.env.EMAIL_ENABLED = 'true';
            
            const result = await sendEmail({
                to: [],
                subject: 'Test',
                text: 'Hello',
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('No recipients specified');
        });
        
        it('should send email successfully', async () => {
            process.env.EMAIL_ENABLED = 'true';
            process.env.EMAIL_FROM = 'from@example.com';
            process.env.EMAIL_FROM_NAME = 'Test';
            
            const result = await sendEmail({
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body',
                html: '<p>Test body</p>',
            });
            
            expect(result.success).toBe(true);
            expect(result.messageId).toBe('test-123');
            expect(mockTransport.sendMail).toHaveBeenCalledWith({
                from: '"Test" <from@example.com>',
                to: 'recipient@example.com',
                subject: 'Test Subject',
                text: 'Test body',
                html: '<p>Test body</p>',
            });
        });
        
        it('should handle multiple recipients', async () => {
            process.env.EMAIL_ENABLED = 'true';
            
            const result = await sendEmail({
                to: ['a@example.com', 'b@example.com'],
                subject: 'Test',
                text: 'Hello',
            });
            
            expect(result.success).toBe(true);
            expect(mockTransport.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'a@example.com, b@example.com',
                })
            );
        });
        
        it('should handle send errors', async () => {
            process.env.EMAIL_ENABLED = 'true';
            mockTransport.sendMail.mockRejectedValue(new Error('SMTP error'));
            
            const result = await sendEmail({
                to: 'test@example.com',
                subject: 'Test',
                text: 'Hello',
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('SMTP error');
        });
    });

    describe('sendPriceAlertEmail', () => {
        const mockAlertData = {
            productId: 1,
            title: 'Test Product',
            url: 'https://example.com/product',
            site: 'Amazon',
            oldPrice: 100.00,
            newPrice: 80.00,
            percentChange: -20.0,
            absoluteChange: -20.00,
            direction: 'down',
            severity: 'high',
        };
        
        beforeEach(() => {
            process.env.EMAIL_ENABLED = 'true';
        });
        
        it('should send price alert email for price drop', async () => {
            const result = await sendPriceAlertEmail(mockAlertData, ['test@example.com']);
            
            expect(result.success).toBe(true);
            expect(mockTransport.sendMail).toHaveBeenCalled();
            
            const callArgs = mockTransport.sendMail.mock.calls[0][0];
            expect(callArgs.subject).toContain('dropped');
            expect(callArgs.subject).toContain('20.0%');
            expect(callArgs.text).toContain('Test Product');
            expect(callArgs.text).toContain('$100.00');
            expect(callArgs.text).toContain('$80.00');
            expect(callArgs.html).toContain('Price Drop');
        });
        
        it('should send price alert email for price increase', async () => {
            const increaseAlert = {
                ...mockAlertData,
                oldPrice: 80.00,
                newPrice: 100.00,
                percentChange: 25.0,
                absoluteChange: 20.00,
                direction: 'up',
            };
            
            const result = await sendPriceAlertEmail(increaseAlert, ['test@example.com']);
            
            expect(result.success).toBe(true);
            const callArgs = mockTransport.sendMail.mock.calls[0][0];
            expect(callArgs.subject).toContain('increased');
        });
    });

    describe('sendDailyDigestEmail', () => {
        const mockPriceChanges = [
            {
                title: 'Product A',
                url: 'https://example.com/a',
                site: 'Amazon',
                oldPrice: 100.00,
                newPrice: 80.00,
                percentChange: -20.0,
                direction: 'down',
            },
            {
                title: 'Product B',
                url: 'https://example.com/b',
                site: 'Target',
                oldPrice: 50.00,
                newPrice: 60.00,
                percentChange: 20.0,
                direction: 'up',
            },
        ];
        
        beforeEach(() => {
            process.env.EMAIL_ENABLED = 'true';
        });
        
        it('should return error when no price changes', async () => {
            const result = await sendDailyDigestEmail([], ['test@example.com']);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('No price changes to report');
        });
        
        it('should send daily digest email', async () => {
            const result = await sendDailyDigestEmail(mockPriceChanges, ['test@example.com']);
            
            expect(result.success).toBe(true);
            expect(mockTransport.sendMail).toHaveBeenCalled();
            
            const callArgs = mockTransport.sendMail.mock.calls[0][0];
            expect(callArgs.subject).toContain('Daily Price Digest');
            expect(callArgs.subject).toContain('1 drops');
            expect(callArgs.subject).toContain('1 increases');
            expect(callArgs.text).toContain('Product A');
            expect(callArgs.text).toContain('Product B');
            expect(callArgs.html).toContain('Price Drops');
            expect(callArgs.html).toContain('Price Increases');
        });
    });
    
    describe('resetTransporter', () => {
        it('should reset transporter singleton', () => {
            process.env.EMAIL_ENABLED = 'true';
            
            // First call creates transporter
            createTransporter();
            expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
            
            // Reset
            resetTransporter();
            
            // Should create new transporter
            createTransporter();
            expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
        });
    });
});
