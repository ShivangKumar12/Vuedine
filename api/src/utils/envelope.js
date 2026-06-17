/**
 * Standard success response envelope.
 *
 *   { success: true, data: T, meta?: M, error: null, requestId: string }
 *
 * Errors are shaped by the global error handler in app.js — this helper is
 * for the success path. Importing it from controllers keeps the shape
 * consistent without each controller hand-rolling the JSON.
 */
export function ok(req, data, meta) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    error: null,
    requestId: req.id,
  };
}
