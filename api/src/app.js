import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { config, env } from './config/index.js';
import { logger } from './config/logger.js';
import { pingDb } from './db/prisma.js';
import { pingRedis } from './db/redis.js';
import { openapiSpec } from './docs/openapi.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { attachLogger } from './middleware/logger.middleware.js';
import { metricsMiddleware } from './middleware/metrics.middleware.js';
import { globalRateLimit } from './middleware/rateLimit.middleware.js';
import { requireRole } from './middleware/rbac.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import { applySecurityHardening } from './middleware/security.middleware.js';
import { qrScanRouter } from './modules/qrCodes/qrScan.routes.js';
import { refreshQueueDepth, registry as metricsRegistry } from './observability/metrics.js';
import { attachSentryToApp } from './observability/sentry.js';
import { v1Router } from './routes.v1.js';
import { AppError } from './utils/AppError.js';

/**
 * Build the Express application. No HTTP listener here — that lives in server.js
 * so we can integration-test the app without binding a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Trust the first proxy (Nginx). With X-Forwarded-For, req.ip becomes the real client IP
  // — critical for rate limiting. Setting `true` here would let any client spoof their IP.
  app.set('trust proxy', 1);

  /* ============================================================
   *  Security headers
   *
   *  CSP is strict in prod (locks scripts/styles/images to same-origin
   *  + the documented CDN). Disabled in dev so Vite previews and Swagger
   *  work without trial-and-error nonce wiring.
   *
   *  Permissions-Policy locks down sensors/payment APIs the API has no
   *  business invoking — defense in depth in case the API ever serves an
   *  HTML page (it shouldn't).
   * ============================================================ */
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https://cdn.vuedine.com'],
              connectSrc: ["'self'", 'https://api.vuedine.com', 'wss://api.vuedine.com'],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: config.isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  /* ============================================================
   *  CORS — strict whitelist
   * ============================================================ */
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / healthcheck (no Origin header)
        if (!origin) return cb(null, true);
        if (config.cors.origins.includes(origin)) return cb(null, true);
        cb(AppError.forbidden(`Origin ${origin} not allowed`, 'CORS_BLOCKED'));
      },
      credentials: true,
      maxAge: 86400,
    }),
  );

  /* ============================================================
   *  Common middleware
   * ============================================================ */
  app.use(compression());
  // Webhook routes need the raw body (Buffer) for HMAC verification — skip the
  // JSON/urlencoded parsers for them so express.raw() in the router sees the body.
  const jsonParser = express.json({ limit: '1mb' });
  const urlencodedParser = express.urlencoded({ extended: true, limit: '1mb' });
  const isWebhook = (req) => req.path.startsWith('/v1/webhooks/');
  app.use((req, res, next) => (isWebhook(req) ? next() : jsonParser(req, res, next)));
  app.use((req, res, next) => (isWebhook(req) ? next() : urlencodedParser(req, res, next)));
  app.use(cookieParser());
  app.use(requestId);
  app.use(attachLogger);
  app.use(metricsMiddleware);

  /* ============================================================
   *  Security hardening — runs AFTER body parsers (so we have parsed
   *  objects to walk) and BEFORE route handlers.
   *    - Strip $-prefixed and prototype-pollution keys
   *    - Block HTTP Parameter Pollution
   *  See: src/middleware/security.middleware.js
   * ============================================================ */
  applySecurityHardening(app);

  /* ============================================================
   *  HTTP access log via morgan, piped into our logger
   * ============================================================ */
  morgan.token('id', (req) => req.id);
  app.use(
    morgan(':id :remote-addr :method :url :status :res[content-length] - :response-time ms', {
      stream: { write: (message) => logger.http(message.trim()) },
    }),
  );

  /* ============================================================
   *  Global rate limit (Redis sliding window)
   *  ----
   *  Mounted before any route. Each route can layer additional limiters
   *  (loginRateLimit, userRateLimit) for stricter caps.
   *
   *  Failure mode: if Redis is unavailable, the limiter logs a warning and
   *  fails open. Better than 503'ing the whole API on a Redis blip.
   * ============================================================ */
  app.use(globalRateLimit);

  /* ============================================================
   *  Health probes (lightweight — no DB / Redis calls)
   * ============================================================ */
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: config.appName,
      version: config.appVersion,
      env: config.env,
    });
  });

  // /ready pings real downstream dependencies. Returns 503 if any are unhealthy.
  // Used by orchestrators (Kubernetes readinessProbe) to take a pod out of rotation
  // when its DB / Redis is degraded — without restarting it.
  app.get('/ready', async (_req, res) => {
    const result = { status: 'ready', db: 'unknown', redis: 'unknown' };
    let healthy = true;

    try {
      await pingDb();
      result.db = 'ok';
    } catch (err) {
      result.db = 'down';
      result.dbError = err.message;
      healthy = false;
    }

    try {
      const ok = await pingRedis();
      result.redis = ok ? 'ok' : 'down';
      if (!ok) healthy = false;
    } catch (err) {
      result.redis = 'down';
      result.redisError = err.message;
      healthy = false;
    }

    if (!healthy) {
      result.status = 'degraded';
      return res.status(503).json(result);
    }
    res.json(result);
  });

  /* ============================================================
   *  Feature routers
   * ============================================================ */
  app.use('/v1', v1Router);

  // Public QR scan resolver (no /v1 prefix, no auth) — records scan + redirects.
  app.use('/m', qrScanRouter);

  /* ============================================================
   *  API documentation — Swagger UI + raw OpenAPI spec.
   *  ----
   *  In dev/staging the docs are open so engineers can poke around.
   *  In prod they're gated to SUPER_ADMIN/OWNER/ADMIN to avoid handing
   *  reconnaissance to anyone who finds /docs. Public-API products with
   *  intentionally open docs would lift this gate per route group.
   * ============================================================ */
  const swaggerUiOptions = {
    customSiteTitle: 'Vuedine API',
    customCss: '.swagger-ui .topbar { background: #EC1B7C; }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      docExpansion: 'list',
    },
  };

  if (config.isProd) {
    app.use(
      '/docs',
      authMiddleware,
      requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
      swaggerUi.serve,
      swaggerUi.setup(openapiSpec, swaggerUiOptions),
    );
    app.get(
      '/docs.json',
      authMiddleware,
      requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
      (_req, res) => res.json(openapiSpec),
    );
  } else {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));
    app.get('/docs.json', (_req, res) => res.json(openapiSpec));
  }

  /* ============================================================
   *  Prometheus /metrics endpoint
   *  ----
   *  🔒 SECURITY — gated by either:
   *    1. Bearer token matching METRICS_AUTH_TOKEN (preferred for prod scrape)
   *    2. SUPER_ADMIN/OWNER JWT (for ad-hoc human inspection)
   *
   *  Public exposure leaks request paths + error rates → reconnaissance.
   *  Always one of the two gates must pass.
   * ============================================================ */
  if (env.PROMETHEUS_ENABLED) {
    app.get('/metrics', async (req, res, next) => {
      try {
        const auth = req.get('authorization') ?? '';
        const bearer = auth.replace(/^Bearer\s+/i, '');

        if (env.METRICS_AUTH_TOKEN && bearer === env.METRICS_AUTH_TOKEN) {
          res.set('Content-Type', metricsRegistry.contentType);
          return res.end(await metricsRegistry.metrics());
        }

        // Fall through to JWT-based access for human inspection.
        return authMiddleware(req, res, async (err) => {
          if (err) return next(err);
          requireRole('SUPER_ADMIN', 'OWNER')(req, res, async (err2) => {
            if (err2) return next(err2);
            res.set('Content-Type', metricsRegistry.contentType);
            res.end(await metricsRegistry.metrics());
          });
        });
      } catch (err) {
        next(err);
      }
    });

    // Periodic queue depth refresher.
    const interval = setInterval(() => {
      refreshQueueDepth().catch(() => {});
    }, 5_000);
    interval.unref();
    // Expose so tests / graceful shutdown can clear it.
    app.locals.metricsInterval = interval;
  }

  /* ============================================================
   *  Sentry error handler — runs BEFORE our custom error handler so
   *  uncaught errors get reported before being shaped for the client.
   * ============================================================ */
  attachSentryToApp(app);

  /* ============================================================
   *  404 — must come AFTER all real routes
   * ============================================================ */
  app.use((req, _res, next) => {
    next(AppError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
  });

  /* ============================================================
   *  Final error handler
   *  ----
   *  Operational errors (AppError) surface their message + code to clients.
   *  Programmer errors get a generic 500 in production (no stack leak).
   * ============================================================ */
  // eslint-disable-next-line no-unused-vars -- Express identifies the error handler by arity
  app.use((err, req, res, _next) => {
    const isOperational = err instanceof AppError && err.isOperational;
    const status = isOperational ? err.statusCode : 500;

    const body = {
      success: false,
      data: null,
      error: {
        code: isOperational ? err.code : 'INTERNAL',
        message: isOperational || !config.isProd ? err.message : 'Something went wrong',
        ...(isOperational && err.details ? { details: err.details } : {}),
      },
      requestId: req.id,
    };

    if (status >= 500) {
      logger.error(err.message, {
        stack: err.stack,
        requestId: req.id,
        path: req.path,
        method: req.method,
      });
    } else {
      logger.warn(err.message, {
        code: body.error.code,
        requestId: req.id,
        path: req.path,
        method: req.method,
      });
    }

    res.status(status).json(body);
  });

  return app;
}
