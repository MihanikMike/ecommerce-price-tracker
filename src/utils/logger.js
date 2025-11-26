import pino from "pino";
import config from "../config/index.js";

const logger = pino({
    level: config.log.level,
    transport: config.log.prettyPrint ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        }
    } : undefined,
    base: {
        env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;