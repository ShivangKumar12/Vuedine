import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { segmentsController } from './segments.controller.js';
import { createSegmentSchema, idParamSchema, previewSchema } from './segments.validators.js';

export const segmentsRouter = Router();

segmentsRouter.use(authMiddleware);
segmentsRouter.use(userRateLimit);

const CRM_VIEW = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];
const CRM_MANAGE = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];

/**
 * @openapi
 * /v1/segments:
 *   get:
 *     tags: [Segments]
 *     summary: List built-in + saved audience segments with live counts
 *     responses:
 *       200: { description: Segments }
 *   post:
 *     tags: [Segments]
 *     summary: Save a named custom segment rule
 *     responses:
 *       201: { description: Created }
 */
segmentsRouter.get('/', requireRole(...CRM_VIEW), segmentsController.list);
segmentsRouter.post('/', requireRole(...CRM_MANAGE), validate(createSegmentSchema), segmentsController.create);

/**
 * @openapi
 * /v1/segments/preview:
 *   post:
 *     tags: [Segments]
 *     summary: Count + sample subscribers for a segment rule
 *     responses:
 *       200: { description: Count + sample }
 */
segmentsRouter.post('/preview', requireRole(...CRM_VIEW), validate(previewSchema), segmentsController.preview);

segmentsRouter.delete('/:id', requireRole(...CRM_MANAGE), validate(idParamSchema), segmentsController.remove);
