import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { aiController } from './ai.controller.js';
import { chatSchema, contextQuerySchema } from './ai.validators.js';

export const aiRouter = Router();

aiRouter.use(authMiddleware);
aiRouter.use(userRateLimit);

const VIEW = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];

/**
 * @openapi
 * /v1/ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Context-grounded chat with Vuedine AI (consumes AI quota)
 *     responses:
 *       200: { description: Assistant reply + usage }
 *       402: { description: AI quota exceeded / not on plan }
 */
aiRouter.post('/chat', requireRole(...VIEW), validate(chatSchema), aiController.chat);

/**
 * @openapi
 * /v1/ai/suggestions:
 *   get:
 *     tags: [AI]
 *     summary: Smart suggestions (pricing, staffing, inventory) grounded on real data
 *     parameters:
 *       - { name: branchId, in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Suggestions + context }
 */
aiRouter.get('/suggestions', requireRole(...VIEW), validate(contextQuerySchema), aiController.suggestions);

/**
 * @openapi
 * /v1/ai/usage:
 *   get:
 *     tags: [AI]
 *     summary: Current AI quota usage for the tenant
 *     responses:
 *       200: { description: Usage snapshot }
 */
aiRouter.get('/usage', requireRole(...VIEW), aiController.usage);
