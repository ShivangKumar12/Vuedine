import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Sentry integration stub.
 *
 * Disabled by default — flip on by setting `SENTRY_DSN` in the env.
 * Lazy-loaded so we don't pull the Sentry SDK at boot when it isn't needed
 * (saves ~10 MB of memory in dev).
 *
 * Wire-up order matters: call `initSentry()` BEFORE express imports, then
 * mount `sentryRequestHandler()` early in app.js and `sentryErrorHandler()`
 * just before the global error middleware.
 */

let _sentry = null;
let _initialized = false;

export async function initSentry() {
  if (_initialized) return _sentry;
  _initialized = true;

  if (!env.SENTRY_DSN) {
    logger.debug('sentry.disabled', { reason: 'SENTRY_DSN not set' });
    return null;
  }

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      release: `${env.APP_NAME}@${env.APP_VERSION}`,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Scrub sensitive request fields by default.
      sendDefaultPii: false,
    });
    _sentry = Sentry;
    logger.info('sentry.initialized', { release: `${env.APP_NAME}@${env.APP_VERSION}` });
    return Sentry;
  } catch (err) {
    logger.warn('sentry.init_failed', { message: err.message });
    return null;
  }
}

/** Call from app.js after `initSentry()` resolves. No-op if Sentry is off. */
export function attachSentryToApp(app) {
  if (!_sentry) return;
  // The setup helpers exist in @sentry/node 8+. Older versions require
  // `app.use(Sentry.Handlers.requestHandler())` etc. — adjust if pinning a
  // different version.
  if (typeof _sentry.setupExpressErrorHandler === 'function') {
    _sentry.setupExpressErrorHandler(app);
  }
}
