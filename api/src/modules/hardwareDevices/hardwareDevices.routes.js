import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { hardwareDevicesController } from './hardwareDevices.controller.js';
import { createSchema, idParamSchema, listSchema, updateSchema } from './hardwareDevices.validators.js';

export const hardwareDevicesRouter = Router();

hardwareDevicesRouter.use(authMiddleware);
hardwareDevicesRouter.use(userRateLimit);

/**
 * @openapi
 * /v1/hardware-devices:
 *   get:
 *     tags: [Settings]
 *     summary: List hardware devices (printers, KDS, drawers, scales)
 *     parameters:
 *       - name: branchId
 *         in: query
 *         schema: { type: string }
 *       - name: type
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 *   post:
 *     tags: [Settings]
 *     summary: Register a hardware device
 *     responses:
 *       201: { description: Created }
 */
hardwareDevicesRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(listSchema),
  hardwareDevicesController.list,
);

hardwareDevicesRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(createSchema),
  hardwareDevicesController.create,
);

/**
 * @openapi
 * /v1/hardware-devices/{id}:
 *   get:
 *     tags: [Settings]
 *     summary: Fetch a device
 *     responses:
 *       200: { description: Device }
 *   patch:
 *     tags: [Settings]
 *     summary: Update a device (rotates pairing token if IP/MAC changes)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Settings]
 *     summary: Soft-delete a device
 *     responses:
 *       204: { description: Deleted }
 */
hardwareDevicesRouter.get('/:id', validate(idParamSchema), hardwareDevicesController.getById);

hardwareDevicesRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(updateSchema),
  hardwareDevicesController.update,
);

hardwareDevicesRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  hardwareDevicesController.remove,
);

/**
 * @openapi
 * /v1/hardware-devices/{id}/pair:
 *   post:
 *     tags: [Settings]
 *     summary: Issue a fresh pairing token (returned once)
 *     responses:
 *       200: { description: Device with pairingToken }
 */
hardwareDevicesRouter.post(
  '/:id/pair',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  hardwareDevicesController.pair,
);

/**
 * @openapi
 * /v1/hardware-devices/{id}/heartbeat:
 *   post:
 *     tags: [Settings]
 *     summary: Mark a device seen now (test / keep-alive)
 *     responses:
 *       200: { description: Device }
 */
hardwareDevicesRouter.post(
  '/:id/heartbeat',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(idParamSchema),
  hardwareDevicesController.heartbeat,
);
