import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

/* eslint-disable no-process-env -- one-shot opt-in lookup */

/**
 * OpenTelemetry distributed tracing stub.
 *
 * Disabled by default. Enable by setting `OTEL_EXPORTER_OTLP_ENDPOINT`
 * (e.g. `http://otel-collector:4318/v1/traces`).
 *
 * 🔴 IMPORTANT — must be initialized BEFORE any other module imports so the
 * auto-instrumentations can monkey-patch them. Call from server.js as the
 * first statement.
 */

let _sdk = null;

export async function initTracing() {
  if (_sdk) return _sdk;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.debug('tracing.disabled', { reason: 'OTEL_EXPORTER_OTLP_ENDPOINT not set' });
    return null;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } =
      await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

    _sdk = new NodeSDK({
      serviceName: env.APP_NAME,
      traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Filesystem instrumentation is noisy and rarely useful.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    _sdk.start();
    logger.info('tracing.initialized', {
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
    return _sdk;
  } catch (err) {
    logger.warn('tracing.init_failed', { message: err.message });
    return null;
  }
}

export async function shutdownTracing() {
  if (_sdk) {
    try {
      await _sdk.shutdown();
    } catch (err) {
      logger.warn('tracing.shutdown_failed', { message: err.message });
    }
    _sdk = null;
  }
}
