/**
 * OAuth provider configuration stub.
 *
 * Wire actual flows when FEATURE_OAUTH_GOOGLE / FEATURE_OAUTH_GITHUB flip on.
 * Suggested surface (already documented in BACKEND_PHASES.md Phase 4):
 *
 *   GET /v1/auth/oauth/:provider
 *     → state cookie + redirect to provider's authUrl with PKCE
 *
 *   GET /v1/auth/oauth/:provider/callback
 *     → exchange code, fetch user info, find-or-create the User row,
 *       issue access + refresh tokens (same path as password login)
 *
 * Recommendation: use `openid-client` (PKCE-by-default, RFC-compliant) instead
 * of hand-rolling axios calls. Keeps the hairy parts of OAuth correct.
 */
export const oauthProviders = {
  google: {
    enabled: false,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    enabled: false,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
};
