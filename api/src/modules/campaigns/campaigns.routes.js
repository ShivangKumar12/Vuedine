import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { campaignsController } from './campaigns.controller.js';
import {
  createSchema,
  eventsSchema,
  idParamSchema,
  listSchema,
  previewAudienceSchema,
  scheduleSchema,
  updateSchema,
} from './campaigns.validators.js';

export const campaignsRouter = Router();

campaignsRouter.use(authMiddleware);
campaignsRouter.use(userRateLimit);

// crm.message — campaign create + send
const CRM_MESSAGE = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];

/**
 * @openapi
 * /v1/campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: List campaigns
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a campaign (draft)
 *     responses:
 *       201: { description: Created }
 */
campaignsRouter.get('/', requireRole(...CRM_MESSAGE), validate(listSchema), campaignsController.list);
campaignsRouter.post('/', requireRole(...CRM_MESSAGE), validate(createSchema), campaignsController.create);

/**
 * @openapi
 * /v1/campaigns/preview-audience:
 *   post:
 *     tags: [Campaigns]
 *     summary: Count + sample subscribers for a segment query
 *     responses:
 *       200: { description: Count + sample }
 */
campaignsRouter.post('/preview-audience', requireRole(...CRM_MESSAGE), validate(previewAudienceSchema), campaignsController.previewAudience);

/**
 * @openapi
 * /v1/campaigns/{id}:
 *   get: { tags: [Campaigns], summary: Fetch a campaign, responses: { 200: { description: Campaign } } }
 *   patch: { tags: [Campaigns], summary: Update a draft/scheduled campaign, responses: { 200: { description: Updated } } }
 *   delete: { tags: [Campaigns], summary: Soft-delete a campaign, responses: { 204: { description: Deleted } } }
 */
campaignsRouter.get('/:id', requireRole(...CRM_MESSAGE), validate(idParamSchema), campaignsController.getById);
campaignsRouter.patch('/:id', requireRole(...CRM_MESSAGE), validate(updateSchema), campaignsController.update);
campaignsRouter.delete('/:id', requireRole(...CRM_MESSAGE), validate(idParamSchema), campaignsController.remove);

/**
 * @openapi
 * /v1/campaigns/{id}/send-now:
 *   post: { tags: [Campaigns], summary: Send immediately, responses: { 200: { description: Sent } } }
 */
campaignsRouter.post('/:id/send-now', requireRole(...CRM_MESSAGE), validate(idParamSchema), campaignsController.sendNow);

/**
 * @openapi
 * /v1/campaigns/{id}/schedule:
 *   post: { tags: [Campaigns], summary: Schedule for a future time, responses: { 200: { description: Scheduled } } }
 */
campaignsRouter.post('/:id/schedule', requireRole(...CRM_MESSAGE), validate(scheduleSchema), campaignsController.schedule);

/**
 * @openapi
 * /v1/campaigns/{id}/cancel:
 *   post: { tags: [Campaigns], summary: Cancel a draft/scheduled campaign, responses: { 200: { description: Cancelled } } }
 */
campaignsRouter.post('/:id/cancel', requireRole(...CRM_MESSAGE), validate(idParamSchema), campaignsController.cancel);

/**
 * @openapi
 * /v1/campaigns/{id}/events:
 *   get: { tags: [Campaigns], summary: Per-recipient delivery events, responses: { 200: { description: Events } } }
 */
campaignsRouter.get('/:id/events', requireRole(...CRM_MESSAGE), validate(eventsSchema), campaignsController.events);
