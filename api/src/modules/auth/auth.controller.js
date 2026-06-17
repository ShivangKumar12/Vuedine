import { config, env } from '../../config/index.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/envelope.js';

import { authService } from './auth.service.js';
import { tokens } from './tokens.js';

const REFRESH_COOKIE = 'refresh';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      tenantSlug: req.body.tenantSlug,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, tokens.refreshCookieOptions(config.isProd));
    res.json(ok(req, { user: result.user, accessToken: result.accessToken }));
  }),

  refresh: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const result = await authService.refresh({
      refreshToken,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, tokens.refreshCookieOptions(config.isProd));
    res.json(ok(req, { accessToken: result.accessToken }));
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    await authService.logout({
      refreshToken,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    res.json(ok(req, null));
  }),

  passwordResetStart: asyncHandler(async (req, res) => {
    // We always respond 200, regardless of whether the email exists.
    const issued = await authService.startPasswordReset(req.body.email);
    if (issued) {
      // Background email — don't block the HTTP response on SMTP latency.
      const baseUrl = config.cors.origins[0] ?? 'http://localhost:5173';
      await enqueueEmail({
        to: req.body.email,
        subject: 'Reset your Vuedine password',
        template: 'password-reset',
        data: {
          name: '',
          ttlMinutes: env.PASSWORD_RESET_TTL_MIN,
          resetUrl: `${baseUrl}/reset?token=${encodeURIComponent(issued.token)}`,
        },
        requestId: req.id,
      });
    }
    res.json(ok(req, null));
  }),

  passwordResetComplete: asyncHandler(async (req, res) => {
    await authService.completePasswordReset({
      token: req.body.token,
      newPassword: req.body.newPassword,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.json(ok(req, null));
  }),

  // Authenticated probe — returns the JWT-derived identity. Useful for
  // the frontend to confirm "am I still logged in?" cheaply.
  me: asyncHandler(async (req, res) => {
    res.json(ok(req, { user: req.user }));
  }),
};
