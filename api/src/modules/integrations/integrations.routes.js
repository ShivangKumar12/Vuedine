import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { integrationsController } from './integrations.controller.js';
import { connectSchema, providerParamSchema } from './integrations.validators.js';

export const integrationsRouter = Router();

integrationsRouter.use(authMiddleware);
integrationsRouter.use(userRateLimit);

const VIEW = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];
const MANAGE = ['SUPER_ADMIN', 'OWNER', 'ADMIN'];

/**
 * @openapi
 * /v1/integrations:
 *   get:
 *     tags: [Integrations]
 *     summary: Marketplace catalog merged with this tenant's connection state
 *     responses:
 *       200: { description: Integration list }
 */
integrationsRouter.get('/', requireRole(...VIEW), integrationsController.list);

/**
 * @openapi
 * /v1/integrations/{provider}:
 *   get:
 *     tags: [Integrations]
 *     summary: Single integration (catalog + connection state)
 *     parameters:
 *       - { name: provider, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Integration }
 *       404: { description: Unknown provider }
 */
integrationsRouter.get('/:provider', requireRole(...VIEW), validate(providerParamSchema), integrationsController.get);

/**
 * @openapi
 * /v1/integrations/{provider}/connect:
 *   post:
 *     tags: [Integrations]
 *     summary: Connect an integration (credentials encrypted at rest)
 *     responses:
 *       201: { description: Connected }
 *       400: { description: Missing credentials / not available }
 */
integrationsRouter.post('/:provider/connect', requireRole(...MANAGE), validate(connectSchema), integrationsController.connect);

/**
 * @openapi
 * /v1/integrations/{provider}/disconnect:
 *   post:
 *     tags: [Integrations]
 *     summary: Disconnect an integration (wipes stored credentials)
 *     responses:
 *       200: { description: Disconnected }
 */
integrationsRouter.post('/:provider/disconnect', requireRole(...MANAGE), validate(providerParamSchema), integrationsController.disconnect);

/**
 * @openapi
 * /v1/integrations/{provider}/test:
 *   post:
 *     tags: [Integrations]
 *     summary: Provider-specific connection ping
 *     responses:
 *       200: { description: Healthy }
 *       400: { description: Test failed / not connected }
 */
integrationsRouter.post('/:provider/test', requireRole(...MANAGE), validate(providerParamSchema), integrationsController.test);

/**
 * @openapi
 * /v1/integrations/{provider}/sync:
 *   post:
 *     tags: [Integrations]
 *     summary: Queue a manual menu / availability sync
 *     responses:
 *       202: { description: Sync queued }
 *       400: { description: Sync unsupported / not connected }
 */
integrationsRouter.post('/:provider/sync', requireRole(...MANAGE), validate(providerParamSchema), integrationsController.sync);
