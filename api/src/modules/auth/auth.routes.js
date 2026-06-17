import { Router } from 'express';

import { env } from '../../config/index.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { loginRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { AppError } from '../../utils/AppError.js';

import { authController } from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  resetCompleteSchema,
  resetStartSchema,
} from './auth.validators.js';

export const authRouter = Router();

/* ================ CSRF guard for /refresh ================
 *
 * The refresh token cookie is the one piece of cookie-borne state we have, so
 * /refresh is the only CSRF surface. We require a same-list Origin header on it
 * — defense-in-depth on top of `SameSite=Lax`.
 *
 * For non-browser clients that don't send Origin (mobile, server-to-server),
 * absence of Origin is allowed; SameSite=Lax has nothing to defend against
 * since they're not browsers.
 */
function csrfOriginCheck(req, _res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  if (env.CORS_ORIGINS.includes(origin)) return next();
  return next(AppError.forbidden('Bad origin', 'CSRF_BAD_ORIGIN'));
}

/* ----- Public routes ----- */

/**
 * @openapi
 * /v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Email + password login
 *     description: |
 *       Issues a JWT access token + sets a `refresh` cookie scoped to `/v1/auth`.
 *       Brute-force protected: 8 failures lock the account for 15 minutes.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Logged in
 *         headers:
 *           Set-Cookie:
 *             description: Httponly refresh cookie scoped to /v1/auth
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/LoginResponse' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post('/login', loginRateLimit, validate(loginSchema), authController.login);

/**
 * @openapi
 * /v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token, return a fresh access token
 *     description: |
 *       Reads the `refresh` cookie. Rotates to a new refresh token; the old
 *       one is single-use. Replaying a used token revokes the entire session
 *       family (token-reuse detection).
 *     security: []
 *     responses:
 *       200:
 *         description: Rotated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
authRouter.post('/refresh', csrfOriginCheck, validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current session
 *     security: []
 *     responses:
 *       204: { description: Logged out }
 */
authRouter.post('/logout', authController.logout);

/**
 * @openapi
 * /v1/auth/password/reset/start:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset link
 *     description: |
 *       Always 200 even if the email does not exist (prevents enumeration).
 *       The reset token is delivered out-of-band via email and stored in
 *       Redis with a TTL.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Email queued (regardless of existence) }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post(
  '/password/reset/start',
  loginRateLimit,
  validate(resetStartSchema),
  authController.passwordResetStart,
);

/**
 * @openapi
 * /v1/auth/password/reset/complete:
 *   post:
 *     tags: [Auth]
 *     summary: Complete a password reset using the emailed token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       204: { description: Password updated; all sessions revoked }
 *       400: { $ref: '#/components/responses/ValidationError' }
 */
authRouter.post(
  '/password/reset/complete',
  validate(resetCompleteSchema),
  authController.passwordResetComplete,
);

/* ----- Authenticated probes ----- */

/**
 * @openapi
 * /v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Identity of the current bearer
 *     responses:
 *       200:
 *         description: Identity
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Envelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.get('/me', authMiddleware, authController.me);
