import path from 'node:path';

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { env } from './env.js';

/**
 * Production logger — winston with structured JSON in prod, pretty colored
 * output in dev. Daily rotated files in prod (size+time capped). Same
 * `logger.info(msg, meta)` API the bootstrap version had — call sites don't
 * change.
 *
 * SECURITY — never call `logger.info('credentials', { password })`. Always
 * scrub sensitive fields BEFORE passing them to the logger. Phase 9 adds an
 * automatic redactor for known keys.
 */

const isProd = env.NODE_ENV === 'production';
const isStaging = env.NODE_ENV === 'staging';

/* ============================================================
 *  Formatters
 * ============================================================ */

const baseFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.splat(),
);

const jsonFormat = winston.format.combine(
  baseFormat,
  winston.format((info) => ({
    ...info,
    service: env.APP_NAME,
    version: env.APP_VERSION,
    env: env.NODE_ENV,
  }))(),
  winston.format.json(),
);

const prettyFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, stack, ...rest } = info;
    const id = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
    const cleanRest = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
    const trace = stack ? `\n${stack}` : '';
    return `${timestamp} ${level}${id} ${message}${cleanRest}${trace}`;
  }),
);

/* ============================================================
 *  Transports
 * ============================================================ */

/** @type {winston.transport[]} */
const transports = [
  new winston.transports.Console({
    format: isProd || isStaging ? jsonFormat : prettyFormat,
    handleExceptions: true,
    handleRejections: false, // handled in server.js
  }),
];

if (isProd || isStaging) {
  // Combined log
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
  );

  // Errors-only log (kept longer for incident retrospectives)
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '50m',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat,
    }),
  );
}

/* ============================================================
 *  Logger
 * ============================================================ */

const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  defaultMeta: { service: env.APP_NAME },
  transports,
  exitOnError: false,
});

/**
 * Public logger surface. Intentionally narrow — only the levels we use.
 *
 * `child(defaults)` returns a sub-logger that bakes default metadata into
 * every line (used by the request-scoped logger in middleware/logger.js).
 */
export const logger = {
  error: (msg, meta) => winstonLogger.error(msg, meta),
  warn: (msg, meta) => winstonLogger.warn(msg, meta),
  info: (msg, meta) => winstonLogger.info(msg, meta),
  http: (msg, meta) => winstonLogger.http(msg, meta),
  debug: (msg, meta) => winstonLogger.debug(msg, meta),
  child(defaults) {
    const c = winstonLogger.child(defaults);
    return {
      error: (msg, meta) => c.error(msg, meta),
      warn: (msg, meta) => c.warn(msg, meta),
      info: (msg, meta) => c.info(msg, meta),
      http: (msg, meta) => c.http(msg, meta),
      debug: (msg, meta) => c.debug(msg, meta),
    };
  },
};
