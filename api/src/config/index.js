import { env } from './env.js';

/**
 * Application config singleton — built once from the validated env.
 * Frozen so downstream code can't accidentally mutate global state.
 */
export const config = Object.freeze({
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isStaging: env.NODE_ENV === 'staging',
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,
  logLevel: env.LOG_LEVEL,
  cors: { origins: env.CORS_ORIGINS },
  features: {
    realtimeOrders: env.FEATURE_REALTIME_ORDERS,
    oauthGoogle: env.FEATURE_OAUTH_GOOGLE,
    oauthGithub: env.FEATURE_OAUTH_GITHUB,
  },
});

export { env };
