import Papa from 'papaparse';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';
import { offsetMeta } from '../../utils/pagination.js';

import { usersService } from './users.service.js';

export const usersController = {
  list: asyncHandler(async (req, res) => {
    const { rows, total } = await usersService.list({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })));
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await usersService.getById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, user));
  }),

  invite: asyncHandler(async (req, res) => {
    const origin = req.get('Origin') ?? req.get('Referer') ?? 'https://app.vuedine.com';
    const result = await usersService.invite({ tenantId: req.tenantId, body: req.body, actor: req.user, origin });
    res.status(201).json(ok(req, result));
  }),

  resolveInvite: asyncHandler(async (req, res) => {
    const payload = await usersService.resolveInvite({ token: req.params.token });
    res.json(ok(req, payload));
  }),

  acceptInvite: asyncHandler(async (req, res) => {
    const user = await usersService.acceptInvite({ token: req.params.token, body: req.body });
    res.json(ok(req, user));
  }),

  update: asyncHandler(async (req, res) => {
    const user = await usersService.update({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, user));
  }),

  suspend: asyncHandler(async (req, res) => {
    const user = await usersService.suspend({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, user));
  }),

  restore: asyncHandler(async (req, res) => {
    const user = await usersService.restore({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.json(ok(req, user));
  }),

  remove: asyncHandler(async (req, res) => {
    await usersService.remove({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),

  assignRole: asyncHandler(async (req, res) => {
    const user = await usersService.assignRole({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, user));
  }),

  resetPin: asyncHandler(async (req, res) => {
    const user = await usersService.resetPin({ tenantId: req.tenantId, id: req.params.id, pin: req.body.pin, actor: req.user });
    res.json(ok(req, user));
  }),

  verifyPin: asyncHandler(async (req, res) => {
    const result = await usersService.verifyPin({ tenantId: req.tenantId, id: req.params.id, pin: req.body.pin, actor: req.user });
    res.json(ok(req, result));
  }),

  getActivity: asyncHandler(async (req, res) => {
    const logs = await usersService.getActivity({ tenantId: req.tenantId, id: req.params.id, take: req.query.take });
    res.json(ok(req, logs));
  }),

  // Customers
  listCustomers: asyncHandler(async (req, res) => {
    const { rows, total } = await usersService.listCustomers({ tenantId: req.tenantId, query: req.query });
    res.json(ok(req, rows, offsetMeta({ page: req.query.page, pageSize: req.query.pageSize, total })));
  }),

  getCustomerById: asyncHandler(async (req, res) => {
    const c = await usersService.getCustomerById({ tenantId: req.tenantId, id: req.params.id });
    res.json(ok(req, c));
  }),

  updateCustomerTags: asyncHandler(async (req, res) => {
    const c = await usersService.updateCustomerTags({ tenantId: req.tenantId, id: req.params.id, tags: req.body.tags, actor: req.user });
    res.json(ok(req, c));
  }),

  updateCustomerPreferences: asyncHandler(async (req, res) => {
    const c = await usersService.updateCustomerPreferences({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, c));
  }),

  anonymize: asyncHandler(async (req, res) => {
    await usersService.anonymize({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),

  importCustomers: asyncHandler(async (req, res) => {
    let rows = Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows && typeof req.body.csv === 'string') {
      const parsed = Papa.parse(req.body.csv.trim(), { header: true, skipEmptyLines: true });
      rows = parsed.data;
    }
    const result = await usersService.importCustomers({ tenantId: req.tenantId, rows: rows ?? [], actor: req.user });
    res.json(ok(req, result));
  }),

  bulkCustomers: asyncHandler(async (req, res) => {
    const result = await usersService.bulkUpdateCustomers({
      tenantId: req.tenantId,
      ids: req.body.ids,
      action: req.body.action,
      tags: req.body.tags,
      channels: req.body.channels,
      actor: req.user,
    });
    res.json(ok(req, result));
  }),

  // Subscribers
  createSubscriber: asyncHandler(async (req, res) => {
    const s = await usersService.createSubscriber({ tenantId: req.tenantId, body: req.body, actor: req.user });
    res.status(201).json(ok(req, s));
  }),

  updateSubscriber: asyncHandler(async (req, res) => {
    const s = await usersService.updateSubscriberProfile({ tenantId: req.tenantId, id: req.params.id, body: req.body, actor: req.user });
    res.json(ok(req, s));
  }),

  deleteSubscriber: asyncHandler(async (req, res) => {
    await usersService.deleteSubscriber({ tenantId: req.tenantId, id: req.params.id, actor: req.user });
    res.status(204).end();
  }),
};
