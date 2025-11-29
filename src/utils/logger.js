import pino from "pino";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import config from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default log directory
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Ensure log directory exists
if (config.log.toFile && !fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Build Pino transport configuration based on settings
 */
function buildTransport() {
    const targets = [];

    // Console output (pretty in dev, JSON in prod)
    if (config.log.toConsole !== false) {
        if (config.log.prettyPrint) {
            targets.push({
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
                level: config.log.level,
            });
        } else {
            targets.push({
                target: 'pino/file',
                options: { destination: 1 }, // stdout
                level: config.log.level,
            });
        }
    }

    // File output with rotation
    if (config.log.toFile) {
        targets.push({
            target: 'pino-roll',
            options: {
                file: path.join(LOG_DIR, 'app'),
                frequency: config.log.rotationFrequency || 'daily', // 'daily', 'hourly', or number (ms)
                mkdir: true,
                size: config.log.maxFileSize || '10m', // 10 MB
                extension: '.log',
                dateFormat: 'yyyy-MM-dd',
            },
            level: config.log.level,
        });

        // Separate error log file
        if (config.log.separateErrorLog) {
            targets.push({
                target: 'pino-roll',
                options: {
                    file: path.join(LOG_DIR, 'error'),
                    frequency: config.log.rotationFrequency || 'daily',
                    mkdir: true,
                    size: config.log.maxFileSize || '10m',
                    extension: '.log',
                    dateFormat: 'yyyy-MM-dd',
                },
                level: 'error', // Only errors and above
            });
        }
    }

    // If no targets, default to stdout
    if (targets.length === 0) {
        return undefined;
    }

    // Single target doesn't need multistream
    if (targets.length === 1) {
        return targets[0];
    }

    // Multiple targets use pino.transport with targets array
    return {
        targets,
    };
}

const transport = buildTransport();

const logger = pino({
    level: config.log.level,
    transport,
    base: {
        env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

// Log startup info (only if file logging is enabled)
if (config.log.toFile) {
    logger.info({
        logDir: LOG_DIR,
        rotationFrequency: config.log.rotationFrequency || 'daily',
        maxFileSize: config.log.maxFileSize || '10m',
    }, 'File logging enabled with rotation');
}

export default logger;
export { LOG_DIR };