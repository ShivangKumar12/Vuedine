import { api } from '../lib/api';
import { authStore, type AuthUser } from '../stores/auth';
import { branchesStore } from '../stores/branches';

type LoginResponse = {
  user: AuthUser;
  accessToken: string;
};

type MeResponse = { user: AuthUser };

export const authApi = {
  async login(email: string, password: string): Promise<AuthUser> {
    authStore.beginAuthenticating();
    try {
      const result = await api.post<LoginResponse>('/v1/auth/login', { email, password });
      authStore.signedIn(result.accessToken, result.user);
      return result.user;
    } catch (err) {
      authStore.signOut();
      throw err;
    }
  },

  /** Silent refresh — used on app boot to restore session from the cookie. */
  async restoreSession(): Promise<AuthUser | null> {
    try {
      const refresh = await api.post<{ accessToken: string }>(
        '/v1/auth/refresh',
        {},
        { skipRefresh: true },
      );
      authStore.setAccessToken(refresh.accessToken);
      const me = await api.get<MeResponse>('/v1/auth/me');
      authStore.setUser(me.user);
      return me.user;
    } catch {
      authStore.signOut();
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/v1/auth/logout', {});
    } catch {
      // ignore — local sign-out happens regardless
    }
    authStore.signOut();
    branchesStore.clear();
  },

  me(): Promise<MeResponse> {
    return api.get<MeResponse>('/v1/auth/me');
  },
};
