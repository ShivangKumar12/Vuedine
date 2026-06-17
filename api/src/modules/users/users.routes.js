import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { usersController } from './users.controller.js';
import {
  acceptInviteSchema,
  activitySchema,
  assignRoleSchema,
  bulkCustomersSchema,
  customerListSchema,
  customerPrefsSchema,
  customerTagsSchema,
  idParamSchema,
  importCustomersSchema,
  inviteSchema,
  listSchema,
  pinSchema,
  subscriberUpsertSchema,
  updateUserSchema,
  verifyPinSchema,
} from './users.validators.js';

export const usersRouter = Router();

/* ============================================================
 *  Public invite endpoints — no auth required
 * ============================================================ */

/**
 * @openapi
 * /v1/users/invite/{token}:
 *   get:
 *     tags: [Users]
 *     summary: Resolve invite token — returns invite payload (public)
 *     security: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invite payload }
 *       404: { description: Not found or expired }
 */
usersRouter.get('/invite/:token', usersController.resolveInvite);

/**
 * @openapi
 * /v1/users/invite/{token}/accept:
 *   post:
 *     tags: [Users]
 *     summary: Accept invite — sets password + activates account (public)
 *     security: []
 *     responses:
 *       200: { description: Activated user }
 */
usersRouter.post('/invite/:token/accept', validate(acceptInviteSchema), usersController.acceptInvite);

/* ============================================================
 *  All remaining routes require auth
 * ============================================================ */
usersRouter.use(authMiddleware);
usersRouter.use(userRateLimit);

/* ---- Staff list + invite ---- */

/**
 * @openapi
 * /v1/users:
 *   get:
 *     tags: [Users]
 *     summary: List users (staff + customers)
 *     parameters:
 *       - $ref: '#/components/parameters/Page'
 *       - $ref: '#/components/parameters/PageSize'
 *       - $ref: '#/components/parameters/Search'
 *       - name: group
 *         in: query
 *         schema: { type: string, enum: [All, Staff, Customers] }
 *       - name: role
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [ACTIVE, INVITED, SUSPENDED] }
 *     responses:
 *       200: { description: Page of users }
 *   post:
 *     tags: [Users]
 *     summary: Invite a new staff member (sends invite email)
 *     responses:
 *       201: { description: User created (Invited status) }
 */
usersRouter.get(
  '/',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(listSchema),
  usersController.list,
);

usersRouter.post(
  '/invite',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(inviteSchema),
  usersController.invite,
);

/* ---- Per-user ---- */
/* NOTE: bare `/:id` CRUD routes are registered at the BOTTOM of this file so
 * literal collection paths like `/customers` and `/subscribers` aren't
 * swallowed by the `:id` param matcher. */

/**
 * @openapi
 * /v1/users/{id}/suspend:
 *   post:
 *     tags: [Users]
 *     summary: Suspend user (force-revokes their sessions)
 *     responses:
 *       200: { description: Updated }
 */
usersRouter.post(
  '/:id/suspend',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  usersController.suspend,
);

/**
 * @openapi
 * /v1/users/{id}/restore:
 *   post:
 *     tags: [Users]
 *     summary: Restore a suspended user
 *     responses:
 *       200: { description: Updated }
 */
usersRouter.post(
  '/:id/restore',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  usersController.restore,
);

/**
 * @openapi
 * /v1/users/{id}/role:
 *   post:
 *     tags: [Users]
 *     summary: Assign role (enum or custom Role id)
 *     responses:
 *       200: { description: Updated + sessions force-revoked }
 */
usersRouter.post(
  '/:id/role',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(assignRoleSchema),
  usersController.assignRole,
);

/**
 * @openapi
 * /v1/users/{id}/reset-pin:
 *   post:
 *     tags: [Users]
 *     summary: Set / reset a user's 4-digit POS PIN
 *     responses:
 *       200: { description: Updated }
 */
usersRouter.post(
  '/:id/reset-pin',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(pinSchema),
  usersController.resetPin,
);

/**
 * @openapi
 * /v1/users/{id}/verify-pin:
 *   post:
 *     tags: [Users]
 *     summary: Verify a user's 4-digit POS PIN (locks after 5 wrong attempts)
 *     responses:
 *       200: { description: PIN verified }
 *       401: { description: Incorrect PIN }
 *       403: { description: PIN locked after too many attempts }
 */
usersRouter.post(
  '/:id/verify-pin',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'CHEF'),
  validate(verifyPinSchema),
  usersController.verifyPin,
);

/**
 * @openapi
 * /v1/users/{id}/activity:
 *   get:
 *     tags: [Users]
 *     summary: Audit log for a specific user
 *     responses:
 *       200: { description: Audit entries }
 */
usersRouter.get(
  '/:id/activity',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(activitySchema),
  usersController.getActivity,
);

/* ============================================================
 *  Customer routes
 * ============================================================ */

/**
 * @openapi
 * /v1/customers:
 *   get:
 *     tags: [Users]
 *     summary: List customers (supports segment, tier, search)
 *     responses:
 *       200: { description: Page }
 */
usersRouter.get(
  '/customers',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  validate(customerListSchema),
  usersController.listCustomers,
);

/**
 * @openapi
 * /v1/users/customers/import:
 *   post:
 *     tags: [Users]
 *     summary: Bulk-import customers from CSV (dedupe + validation)
 *     responses:
 *       200: { description: Import summary }
 */
usersRouter.post(
  '/customers/import',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(importCustomersSchema),
  usersController.importCustomers,
);

/**
 * @openapi
 * /v1/users/customers/bulk:
 *   post:
 *     tags: [Users]
 *     summary: Bulk update customers (subscribe/unsubscribe/tag/channels/delete)
 *     responses:
 *       200: { description: Affected count }
 */
usersRouter.post(
  '/customers/bulk',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(bulkCustomersSchema),
  usersController.bulkCustomers,
);

usersRouter.get(
  '/customers/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(idParamSchema),
  usersController.getCustomerById,
);

usersRouter.patch(
  '/customers/:id/tags',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(customerTagsSchema),
  usersController.updateCustomerTags,
);

usersRouter.patch(
  '/customers/:id/preferences',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(customerPrefsSchema),
  usersController.updateCustomerPreferences,
);

usersRouter.post(
  '/customers/:id/anonymize',
  requireRole('SUPER_ADMIN', 'OWNER'),
  validate(idParamSchema),
  usersController.anonymize,
);

/* ============================================================
 *  Subscriber CRUD  (/v1/subscribers proxied here)
 * ============================================================ */
usersRouter.post(
  '/subscribers',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(subscriberUpsertSchema),
  usersController.createSubscriber,
);

usersRouter.patch(
  '/subscribers/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(subscriberUpsertSchema),
  usersController.updateSubscriber,
);

usersRouter.delete(
  '/subscribers/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  usersController.deleteSubscriber,
);

/* ============================================================
 *  Bare /:id CRUD — registered LAST so literal collection paths
 *  (/customers, /subscribers) take precedence over the :id matcher.
 * ============================================================ */

/**
 * @openapi
 * /v1/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Fetch a single user
 *     responses:
 *       200: { description: User }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     tags: [Users]
 *     summary: Update user fields (name, phone, branchIds, salary …)
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (cannot delete Owner)
 *     responses:
 *       204: { description: Deleted }
 */
usersRouter.get('/:id', validate(idParamSchema), usersController.getById);

usersRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'),
  validate(updateUserSchema),
  usersController.update,
);

usersRouter.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN'),
  validate(idParamSchema),
  usersController.remove,
);
