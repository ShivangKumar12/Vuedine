import { createStore } from './store';

/**
 * Auth store — access token (in-memory) + current user identity.
 *
 * The refresh cookie is httpOnly and lives on the server; we never read it.
 * Access token is intentionally NOT persisted (XSS exposure). On a hard
 * reload we attempt a silent refresh; if it succeeds the user stays logged
 * in, otherwise they get bounced to /login.
 */

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'CHEF' | 'CUSTOMER';
  tenantId: string | null;
  branchIds: string[];
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
};

const store = createStore<AuthState>({
  accessToken: null,
  user: null,
  status: 'idle',
});

export const authStore = {
  use: () => store.use(),
  get: () => store.get(),

  getAccessToken() {
    return store.get().accessToken;
  },

  setAccessToken(token: string) {
    store.set((s) => ({ ...s, accessToken: token, status: 'authenticated' }));
  },

  setUser(user: AuthUser | null) {
    store.set((s) => ({ ...s, user, status: user ? 'authenticated' : 'unauthenticated' }));
  },

  beginAuthenticating() {
    store.set((s) => ({ ...s, status: 'authenticating' }));
  },

  signedIn(token: string, user: AuthUser) {
    store.set({ accessToken: token, user, status: 'authenticated' });
  },

  signOut() {
    store.set({ accessToken: null, user: null, status: 'unauthenticated' });
  },
};
