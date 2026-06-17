/**
 * Wraps an async route handler so thrown errors flow into Express's
 * error pipeline without try/catch boilerplate at every call site.
 *
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await service.list();
 *     res.json({ data: items });
 *   }));
 *
 * Errors propagate to the global error middleware in app.js.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
