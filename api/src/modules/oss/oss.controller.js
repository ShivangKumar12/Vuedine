import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { ossService } from './oss.service.js';

export const ossController = {
  getTokens: asyncHandler(async (req, res) => {
    const data = await ossService.getTokens({ branchSlug: req.params.branchSlug });
    res.json(ok(req, data));
  }),
};
