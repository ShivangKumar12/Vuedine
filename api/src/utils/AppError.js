/**
 * Operational, expected error.
 *
 * Distinguished from programmer bugs by `isOperational = true`.
 * The error middleware surfaces `message` and `code` to clients;
 * programmer errors get a generic 500 in production (no stack leak).
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ statusCode?: number, code?: string, details?: unknown, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code ?? 'INTERNAL';
    this.details = opts.details;
    this.isOperational = true;
    if (opts.cause) this.cause = opts.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new AppError(message, { statusCode: 400, code, details });
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, { statusCode: 401, code });
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, { statusCode: 403, code });
  }

  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(message, { statusCode: 404, code });
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, { statusCode: 409, code });
  }

  static payloadTooLarge(message = 'Payload too large', code = 'PAYLOAD_TOO_LARGE') {
    return new AppError(message, { statusCode: 413, code });
  }

  static unsupportedMedia(message = 'Unsupported media type', code = 'UNSUPPORTED_MEDIA') {
    return new AppError(message, { statusCode: 415, code });
  }

  static tooMany(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new AppError(message, { statusCode: 429, code });
  }

  static dependencyDown(message = 'Upstream dependency unavailable', code = 'DEPENDENCY_DOWN') {
    return new AppError(message, { statusCode: 503, code });
  }
}
