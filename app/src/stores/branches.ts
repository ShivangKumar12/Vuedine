import { createStore } from './store';

/**
 * Branches store — single source of truth for the branch list and the
 * currently-selected branch (driven by the topbar BranchSelector).
 *
 * The selected branch id is persisted in localStorage so a refresh keeps
 * the user on the same view. On first load (no stored value), the first
 * live branch wins.
 */

export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  qrSlug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
  isLive: boolean;
  timezoneCode: string | null;
  defaultPrep: number;
  serviceCharge: number | string;
  taxInclusive: boolean;
  diningSections: string[];
  openingHours: Record<string, [string, string] | string[]> | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tables: number };
};

type State = {
  list: Branch[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
};

const STORAGE_KEY = 'vuedine.branch.active.v1';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const store = createStore<State>({
  list: [],
  activeId: readStored(),
  loading: false,
  error: null,
});

export const branchesStore = {
  use: () => store.use(),
  get: () => store.get(),

  setLoading(loading: boolean) {
    store.set((s) => ({ ...s, loading, error: loading ? null : s.error }));
  },

  setError(error: string | null) {
    store.set((s) => ({ ...s, error, loading: false }));
  },

  setList(list: Branch[]) {
    const stored = readStored();
    const active =
      list.find((b) => b.id === stored)?.id ??
      list.find((b) => b.isLive)?.id ??
      list[0]?.id ??
      null;
    if (active && active !== stored) writeStored(active);
    store.set({ list, activeId: active, loading: false, error: null });
  },

  setActive(id: string | null) {
    writeStored(id);
    store.set((s) => ({ ...s, activeId: id }));
  },

  upsert(branch: Branch) {
    store.set((s) => {
      const idx = s.list.findIndex((b) => b.id === branch.id);
      if (idx === -1) return { ...s, list: [...s.list, branch] };
      const next = s.list.slice();
      next[idx] = branch;
      return { ...s, list: next };
    });
  },

  remove(id: string) {
    store.set((s) => {
      const list = s.list.filter((b) => b.id !== id);
      const activeId = s.activeId === id ? (list[0]?.id ?? null) : s.activeId;
      if (activeId !== s.activeId) writeStored(activeId);
      return { ...s, list, activeId };
    });
  },

  clear() {
    writeStored(null);
    store.set({ list: [], activeId: null, loading: false, error: null });
  },

  /** Helper for components that want the resolved active branch object. */
  getActive(): Branch | null {
    const s = store.get();
    return s.list.find((b) => b.id === s.activeId) ?? null;
  },
};
