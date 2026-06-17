import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { conversationsController } from './conversations.controller.js';
import {
  assignSchema,
  idParamSchema,
  listSchema,
  replySchema,
  starSchema,
  statusSchema,
  tagsSchema,
} from './conversations.validators.js';

export const conversationsRouter = Router();

conversationsRouter.use(authMiddleware);
conversationsRouter.use(userRateLimit);

// crm.message — any logged-in staff can handle the inbox
const CRM = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF'];

/**
 * @openapi
 * /v1/conversations:
 *   get:
 *     tags: [Messages]
 *     summary: List conversations (filter by status/channel/search) + stats
 *     responses:
 *       200: { description: List }
 */
conversationsRouter.get('/', requireRole(...CRM), validate(listSchema), conversationsController.list);

/**
 * @openapi
 * /v1/conversations/{id}:
 *   get:
 *     tags: [Messages]
 *     summary: Fetch a conversation with its messages (marks read)
 *     responses:
 *       200: { description: Conversation }
 */
conversationsRouter.get('/:id', requireRole(...CRM), validate(idParamSchema), conversationsController.getById);

/**
 * @openapi
 * /v1/conversations/{id}/messages:
 *   post:
 *     tags: [Messages]
 *     summary: Reply to a conversation
 *     responses:
 *       201: { description: Message }
 */
conversationsRouter.post('/:id/messages', requireRole(...CRM), validate(replySchema), conversationsController.reply);

/**
 * @openapi
 * /v1/conversations/{id}/assign:
 *   post: { tags: [Messages], summary: Assign an agent, responses: { 200: { description: Updated } } }
 */
conversationsRouter.post('/:id/assign', requireRole(...CRM), validate(assignSchema), conversationsController.assign);

/**
 * @openapi
 * /v1/conversations/{id}/status:
 *   patch: { tags: [Messages], summary: Set open/pending/resolved, responses: { 200: { description: Updated } } }
 */
conversationsRouter.patch('/:id/status', requireRole(...CRM), validate(statusSchema), conversationsController.setStatus);

/**
 * @openapi
 * /v1/conversations/{id}/tags:
 *   patch: { tags: [Messages], summary: Set conversation tags, responses: { 200: { description: Updated } } }
 */
conversationsRouter.patch('/:id/tags', requireRole(...CRM), validate(tagsSchema), conversationsController.setTags);

/**
 * @openapi
 * /v1/conversations/{id}/star:
 *   patch: { tags: [Messages], summary: Toggle/set star, responses: { 200: { description: Updated } } }
 */
conversationsRouter.patch('/:id/star', requireRole(...CRM), validate(starSchema), conversationsController.star);
