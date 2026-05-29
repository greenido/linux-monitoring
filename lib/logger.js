const pino = require('pino');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = (process.env.LOG_FORMAT || 'json').toLowerCase();

const baseOptions = {
    level: LOG_LEVEL,
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
    },
    base: {
        service: 'public-linux-monitor',
        env: process.env.NODE_ENV || 'development',
    },
};

function buildRootLogger() {
    if (LOG_FORMAT === 'pretty') {
        const transport = pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                singleLine: true,
            },
        });
        return pino(baseOptions, transport);
    }

    return pino(baseOptions);
}

const rootLogger = buildRootLogger();

function getLogger(component) {
    if (!component) {
        return rootLogger;
    }

    return rootLogger.child({ component });
}

module.exports = {
    getLogger,
};
