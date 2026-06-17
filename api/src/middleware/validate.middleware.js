import { ZodError } from 'zod';

import { AppError } from '../utils/AppError.js';

/**
 * zod-backed request validator. Schema covers any of body/query/params.
 *
 * Mutates `req` to the parsed (typed, coerced) values, so downstream handlers
 * use the cleaned input — never the raw one.
 *
 *   const schema = z.object({
 *     body: z.object({ email: z.string().email() }),
 *     query: z.object({ page: z.coerce.number().min(1).default(1) }).optional(),
 *   });
 *   router.post('/items', validate(schema), controller.create);
 *
 * On failure, throws a 400 AppError with `code = VALIDATION_FAILED` and a
 * structured `details` payload that the frontend can show field-by-field.
 */
export function validate(schema) {
  return (req, _res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed?.body !== undefined) req.body = parsed.body;
      if (parsed?.query !== undefined) req.query = parsed.query;
      if (parsed?.params !== undefined) req.params = parsed.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(AppError.badRequest('Validation failed', 'VALIDATION_FAILED', err.flatten()));
      }
      next(err);
    }
  };
}
