import { Router } from 'express';

import { aiRouter } from './modules/ai/ai.routes.js';
import { apiKeysRouter } from './modules/apiKeys/apiKeys.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { subscriptionRouter, invoicesRouter } from './modules/billing/billing.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { campaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { conversationsRouter } from './modules/conversations/conversations.routes.js';
import { debugRouter } from './modules/debug/debug.routes.js';
import { hardwareDevicesRouter } from './modules/hardwareDevices/hardwareDevices.routes.js';
import { integrationsRouter } from './modules/integrations/integrations.routes.js';
import { itemsRouter } from './modules/items/items.routes.js';
import { kdsRouter } from './modules/kds/kds.routes.js';
import { notificationPreferencesRouter } from './modules/notificationPreferences/notificationPreferences.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { ossRouter } from './modules/oss/oss.routes.js';
import { paymentMethodConfigsRouter } from './modules/paymentMethodConfigs/paymentMethodConfigs.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { paymentSettingsRouter } from './modules/paymentSettings/paymentSettings.routes.js';
import { promotionsRouter } from './modules/promotions/promotions.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { pushRouter } from './modules/push/push.routes.js';
import { qrCodesRouter } from './modules/qrCodes/qrCodes.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { rolesRouter } from './modules/roles/roles.routes.js';
import { segmentsRouter } from './modules/segments/segments.routes.js';
import { sessionsRouter } from './modules/sessions/sessions.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { shiftsRouter } from './modules/shifts/shifts.routes.js';
import { tablesRouter } from './modules/tables/tables.routes.js';
import { taxSlabsRouter } from './modules/taxSlabs/taxSlabs.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { webhooksRouter } from './modules/webhooks/webhooks.routes.js';

/**
 * v1 router aggregator. Each feature module mounts its own router here.
 * URL versioning gives us a single, unambiguous deprecation knob.
 */
export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/shifts', shiftsRouter);
v1Router.use('/items', itemsRouter);
v1Router.use('/branches', branchesRouter);
v1Router.use('/orders', ordersRouter);
v1Router.use('/kds', kdsRouter);
v1Router.use('/oss', ossRouter);
v1Router.use('/table-sessions', sessionsRouter);
v1Router.use('/public', publicRouter);
v1Router.use('/settings/payments', paymentSettingsRouter);
v1Router.use('/settings', settingsRouter);
v1Router.use('/tax-slabs', taxSlabsRouter);
v1Router.use('/payment-method-configs', paymentMethodConfigsRouter);
v1Router.use('/hardware-devices', hardwareDevicesRouter);
v1Router.use('/notification-preferences', notificationPreferencesRouter);
v1Router.use('/qr-codes', qrCodesRouter);
v1Router.use('/campaigns', campaignsRouter);
v1Router.use('/segments', segmentsRouter);
v1Router.use('/push', pushRouter);
v1Router.use('/conversations', conversationsRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/integrations', integrationsRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/subscription', subscriptionRouter);
v1Router.use('/invoices', invoicesRouter);
v1Router.use('/webhooks', webhooksRouter);
// paymentsRouter exposes /transactions, /orders/:id/payments, /payments/:id,
// /settlements — mounted at the v1 root because the resource lives under
// multiple sibling paths.
v1Router.use('/', paymentsRouter);
// promotionsRouter exposes /promotions + /cart paths — mounted at the v1 root.
v1Router.use('/', promotionsRouter);
v1Router.use('/api-keys', apiKeysRouter);
v1Router.use('/debug', debugRouter);
// tablesRouter mounts its own paths (/tables, /branches/:branchId/tables, /tables/:id, ...)
// since the resource lives under both branch-scoped and id-scoped URLs. Mounted LAST
// because its router-level `authMiddleware` would otherwise 401 every public request
// that falls through to it.
v1Router.use('/', tablesRouter);

// Future modules wired in Phase 5+:
// v1Router.use('/orders', ordersRouter);
// v1Router.use('/tables', tablesRouter);
// ...
