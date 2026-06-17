import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { kdsService } from './kds.service.js';

export const kdsController = {
  listTickets: asyncHandler(async (req, res) => {
    const tickets = await kdsService.listTickets({
      tenantId: req.tenantId,
      branchId: req.query.branchId,
      station: req.query.station,
    });
    res.json(ok(req, tickets));
  }),
};
