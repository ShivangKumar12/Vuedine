import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { apiKeysController } from './apiKeys.controller.js';
import { issueApiKeySchema, revokeApiKeySchema } from './apiKeys.validators.js';

/**
 * Tenant-scoped API key management.
 *
 * Issuance is gated to OWNER / ADMIN — these keys carry tenant authority.
 * SUPER_ADMIN may also issue (platform support) but that path adds an
 * audit trail entry.
 */
export const apiKeysRouter = Router();

apiKeysRouter.use(authMiddleware);
apiKeysRouter.use(requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'));

/**
 * @openapi
 * /v1/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List API keys for the current tenant
 *     description: |
 *       Returns metadata only. The raw key value is never persisted and never
 *       returned by this endpoint — it is shown once at issuance.
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ApiKey' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [API Keys]
 *     summary: Issue a new API key
 *     description: |
 *       Returns the raw `key` value ONCE in the response. Capture it now;
 *       there is no recovery path. Subsequent reads via GET will not include
 *       the raw value.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scopes]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 80
 *                 example: POS hardware integration
 *               scopes:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum:
 *                     - orders:read
 *                     - orders:write
 *                     - items:read
 *                     - items:write
 *                     - payments:read
 *                     - webhooks:write
 *                     - reports:read
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               envTag:
 *                 type: string
 *                 enum: [live, test]
 *                 default: live
 *     responses:
 *       201:
 *         description: Issued; raw key returned ONCE in `data.key`
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [id, key, prefix]
 *                       properties:
 *                         id:        { type: string }
 *                         key:       { type: string, example: 'sk_live_abc1...' }
 *                         prefix:    { type: string }
 *                         expiresAt: { type: string, format: date-time, nullable: true }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
apiKeysRouter.get('/', apiKeysController.list);

apiKeysRouter.post('/', validate(issueApiKeySchema), apiKeysController.issue);

/**
 * @openapi
 * /v1/api-keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: Revoke an API key (idempotent first call, 404 thereafter)
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Revoked }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
apiKeysRouter.delete('/:id', validate(revokeApiKeySchema), apiKeysController.revoke);
