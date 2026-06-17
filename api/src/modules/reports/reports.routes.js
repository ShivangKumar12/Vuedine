import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

import { reportsController } from './reports.controller.js';
import {
  dashboardSchema,
  exportSchema,
  itemsPopularitySchema,
  salesSchema,
  staffSchema,
  topCustomersSchema,
} from './reports.validators.js';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);
reportsRouter.use(userRateLimit);

const VIEW = ['SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER'];

/**
 * @openapi
 * /v1/reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Dashboard aggregate payload (KPIs, status, sales, customers, items)
 *     parameters:
 *       - { name: from, in: query, schema: { type: string } }
 *       - { name: to, in: query, schema: { type: string } }
 *       - { name: branchId, in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Dashboard payload }
 */
reportsRouter.get('/dashboard', requireRole(...VIEW), validate(dashboardSchema), reportsController.dashboard);

/**
 * @openapi
 * /v1/reports/sales:
 *   get:
 *     tags: [Reports]
 *     summary: Sales report — KPIs, hourly, payment/type mix, paginated rows
 *     responses:
 *       200: { description: Sales report }
 */
reportsRouter.get(
  '/sales',
  requireRole('SUPER_ADMIN', 'OWNER', 'ADMIN', 'MANAGER', 'CASHIER'),
  validate(salesSchema),
  reportsController.sales,
);

/**
 * @openapi
 * /v1/reports/sales/export:
 *   get:
 *     tags: [Reports]
 *     summary: Export sales report (csv | excel | pdf | gst); async=true to queue+email
 *     responses:
 *       200: { description: File stream }
 *       202: { description: Export queued }
 */
reportsRouter.get('/sales/export', requireRole(...VIEW), validate(exportSchema), reportsController.exportSales);

/**
 * @openapi
 * /v1/reports/items/popularity:
 *   get: { tags: [Reports], summary: Item popularity, responses: { 200: { description: List } } }
 */
reportsRouter.get('/items/popularity', requireRole(...VIEW), validate(itemsPopularitySchema), reportsController.itemsPopularity);

/**
 * @openapi
 * /v1/reports/customers/top:
 *   get: { tags: [Reports], summary: Top customers by spend, responses: { 200: { description: List } } }
 */
reportsRouter.get('/customers/top', requireRole(...VIEW), validate(topCustomersSchema), reportsController.topCustomers);

/**
 * @openapi
 * /v1/reports/staff/performance:
 *   get: { tags: [Reports], summary: Per-cashier sales performance, responses: { 200: { description: Stats } } }
 */
reportsRouter.get('/staff/performance', requireRole(...VIEW), validate(staffSchema), reportsController.staffPerformance);
