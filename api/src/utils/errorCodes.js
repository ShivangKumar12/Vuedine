/**
 * Single source of truth for error codes the API emits.
 *
 * Frontends key off `code` (stable contract), never `message` (English copy).
 * New codes are added here, not invented per-controller.
 *
 * The error middleware in app.js uses AppError instances directly — this
 * registry is for documentation, OpenAPI generation, and consistency checks.
 */
export const ErrorCodes = Object.freeze({
  // 4xx ─── client errors
  BAD_REQUEST: { status: 400, code: 'BAD_REQUEST', message: 'Bad request' },
  VALIDATION_FAILED: { status: 400, code: 'VALIDATION_FAILED', message: 'Validation failed' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' },
  NO_TOKEN: { status: 401, code: 'NO_TOKEN', message: 'Missing bearer token' },
  BAD_TOKEN: { status: 401, code: 'BAD_TOKEN', message: 'Invalid token' },
  TOKEN_EXPIRED: { status: 401, code: 'TOKEN_EXPIRED', message: 'Access token expired' },
  SESSION_REVOKED: { status: 401, code: 'SESSION_REVOKED', message: 'Session revoked' },
  TOKEN_REUSE: { status: 401, code: 'TOKEN_REUSE', message: 'Refresh token reuse detected' },
  INVALID_CREDENTIALS: {
    status: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  },
  ACCOUNT_LOCKED: { status: 401, code: 'ACCOUNT_LOCKED', message: 'Account temporarily locked' },
  ACCOUNT_NOT_ACTIVE: { status: 401, code: 'ACCOUNT_NOT_ACTIVE', message: 'Account not active' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Forbidden' },
  INSUFFICIENT_ROLE: {
    status: 403,
    code: 'INSUFFICIENT_ROLE',
    message: 'Insufficient role for this action',
  },
  BRANCH_FORBIDDEN: {
    status: 403,
    code: 'BRANCH_FORBIDDEN',
    message: 'No access to this branch',
  },
  CSRF_BAD_ORIGIN: { status: 403, code: 'CSRF_BAD_ORIGIN', message: 'Bad origin header' },
  CORS_BLOCKED: { status: 403, code: 'CORS_BLOCKED', message: 'CORS origin not allowed' },
  IP_BLOCKED: { status: 403, code: 'IP_BLOCKED', message: 'IP blocked' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: 'Resource not found' },
  ROUTE_NOT_FOUND: { status: 404, code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
  ITEM_NOT_FOUND: { status: 404, code: 'ITEM_NOT_FOUND', message: 'Item not found' },
  CONFLICT: { status: 409, code: 'CONFLICT', message: 'Conflict' },
  ITEM_DUPLICATE: { status: 409, code: 'ITEM_DUPLICATE', message: 'Item with this name exists' },
  PAYLOAD_TOO_LARGE: { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' },
  UNSUPPORTED_MEDIA: { status: 415, code: 'UNSUPPORTED_MEDIA', message: 'Unsupported media' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests' },

  // 5xx ─── server errors
  INTERNAL: { status: 500, code: 'INTERNAL', message: 'Internal server error' },
  DEPENDENCY_DOWN: {
    status: 503,
    code: 'DEPENDENCY_DOWN',
    message: 'Upstream dependency unavailable',
  },
});
