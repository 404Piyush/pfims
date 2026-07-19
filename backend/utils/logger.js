const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const base = {
  service: 'pfims-backend',
  env: process.env.NODE_ENV || 'development',
  rev: process.env.GIT_SHA || 'local',
};

const transport = isDev
  ? {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    }
  : undefined;

let logger;

try {
  logger = pino({ ...base, level: process.env.LOG_LEVEL || 'info' }, transport ? pino.transport(transport) : undefined);
} catch (_e) {
  // If pino-pretty isn't installed in prod, fall back to plain pino.
  logger = pino({ ...base, level: process.env.LOG_LEVEL || 'info' });
}

// Optional Sentry integration — loaded only if SENTRY_DSN is set. Keeps dev
// dependency-free when DSN is empty.
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    });
    const origError = logger.error.bind(logger);
    logger.error = (obj, msg) => {
      const err = obj && obj.err ? obj.err : obj;
      if (err instanceof Error) Sentry.captureException(err);
      return origError(obj, msg);
    };
    logger.info({ event: 'sentry_initialized', dsn: 'set' }, 'sentry');
  } catch (e) {
    logger.warn({ event: 'sentry_init_failed', err: e.message }, 'sentry');
  }
}

module.exports = logger;
