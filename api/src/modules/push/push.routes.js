import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { pushController } from './push.controller.js';
import { idParamSchema, subscribeSchema } from './push.validators.js';

export const pushRouter = Router();

pushRouter.use(authMiddleware);
pushRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/push/public-key:
 *   get:
 *     tags: [Push]
 *     summary: VAPID public key for browser subscription
 *     responses:
 *       200: { description: Public key }
 */
pushRouter.get('/public-key', pushController.publicKey);

/**
 * @openapi
 * /v1/push/subscriptions:
 *   get:
 *     tags: [Push]
 *     summary: List the caller's push subscriptions
 *     responses:
 *       200: { description: List }
 */
pushRouter.get('/subscriptions', pushController.list);

/**
 * @openapi
 * /v1/push/subscribe:
 *   post:
 *     tags: [Push]
 *     summary: Register a web push endpoint
 *     responses:
 *       201: { description: Subscribed }
 */
pushRouter.post('/subscribe', validate(subscribeSchema), pushController.subscribe);

/**
 * @openapi
 * /v1/push/subscribe/{id}:
 *   delete:
 *     tags: [Push]
 *     summary: Remove a push subscription
 *     responses:
 *       204: { description: Removed }
 */
pushRouter.delete('/subscribe/:id', validate(idParamSchema), pushController.unsubscribe);

/**
 * @openapi
 * /v1/push/test:
 *   post:
 *     tags: [Push]
 *     summary: Send a test push to your own devices
 *     responses:
 *       200: { description: Result }
 */
pushRouter.post('/test', pushController.test);
