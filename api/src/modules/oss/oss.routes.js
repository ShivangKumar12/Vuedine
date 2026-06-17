import { Router } from 'express';
import { z } from 'zod';

import { globalRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { ossController } from './oss.controller.js';

const slugSchema = z.object({
  params: z.object({ branchSlug: z.string().min(2).max(80) }),
});

export const ossRouter = Router();

ossRouter.use(globalRateLimit);

/**
 * @openapi
 * /v1/oss/{branchSlug}/tokens:
 *   get:
 *     tags: [OSS]
 *     summary: Public order-status board for a branch (token-only)
 *     security: []
 *     parameters:
 *       - name: branchSlug
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Preparing + Ready buckets }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
ossRouter.get(
  '/:branchSlug/tokens',
  validate(slugSchema),
  ossController.getTokens,
);
