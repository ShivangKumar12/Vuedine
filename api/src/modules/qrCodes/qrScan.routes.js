import { Router } from 'express';

import { scanRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

import { qrCodesService } from './qrCodes.service.js';
import { scanParamSchema } from './qrCodes.validators.js';

/**
 * Public QR scan resolver — mounted at /m (NOT under /v1, no auth).
 *
 *   GET /m/:branchSlug/:token
 *
 * Records a scan, emits `qr:scan`, then 302-redirects the scanner to the
 * guest PWA. A regenerated/inactive/unknown token renders an "invalidated"
 * page instead of redirecting (Phase G acceptance + pitfall #2).
 * Rate-limited per IP to prevent inflated metrics (pitfall #3).
 */
export const qrScanRouter = Router();

function invalidatedPage(res, { code = 410, title, message }) {
  res.status(code).type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f6f6;
    display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{max-width:420px;background:#fff;border-radius:18px;padding:40px;text-align:center;
    box-shadow:0 8px 40px rgba(0,0,0,.08);}
  h1{font-size:22px;margin:0 0 8px;color:#0F172A;}
  p{color:#64748B;font-size:15px;line-height:1.5;margin:0;}
  .badge{font-size:40px;margin-bottom:8px;}
</style></head>
<body><div class="card"><div class="badge">⚠️</div><h1>${title}</h1><p>${message}</p></div></body></html>`);
}

qrScanRouter.get(
  '/:branchSlug/:token',
  scanRateLimit,
  validate(scanParamSchema),
  asyncHandler(async (req, res) => {
    const result = await qrCodesService.resolveScan({
      branchSlug: req.params.branchSlug,
      token: req.params.token,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null,
      referrer: req.get('referer') ?? null,
    });

    if (result.status === 'ok') {
      return res.redirect(302, result.redirect);
    }
    if (result.status === 'invalidated') {
      return invalidatedPage(res, {
        code: 410,
        title: 'This QR code is no longer active',
        message: 'It looks like this code was regenerated or deactivated. Please scan the latest code at your table or counter.',
      });
    }
    return invalidatedPage(res, {
      code: 404,
      title: 'QR code not found',
      message: "We couldn't find this QR code. Please check with the staff for an up-to-date code.",
    });
  }),
);
