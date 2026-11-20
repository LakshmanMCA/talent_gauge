export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown> | null) {
    super(message);
  }
}

const isBrowser = typeof window !== "undefined";
export const tokens = {
  get access() { return isBrowser ? localStorage.getItem("tg_access") : null; },
  get refresh() { return isBrowser ? localStorage.getItem("tg_refresh") : null; },
  set(access: string, refresh?: string) {
    localStorage.setItem("tg_access", access);
    if (refresh) localStorage.setItem("tg_refresh", refresh);
  },
  clear() { localStorage.removeItem("tg_access"); localStorage.removeItem("tg_refresh"); },
};

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!tokens.refresh) return false;
  refreshing ??= fetch(`${API}/auth/refresh/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  }).then(async (r) => {
    if (!r.ok) return false;
    const d = await r.json();
    tokens.set(d.access, d.refresh);
    return true;
  }).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  const res = await fetch(`${API}${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"), headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && retry && (await tryRefresh())) return api<T>(path, opts, false);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? "Something went wrong.", data?.error?.details);
  return data as T;
}

export type Page<T> = { count: number; next: string | null; results: T[] };

/** Flatten DRF field errors into one readable message. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.details && typeof e.details === "object") {
      const first = Object.values(e.details)[0];
      return String(Array.isArray(first) ? first[0] : first);
    }
    return e.message;
  }
  return "Network problem. Check your connection and try again.";
}
