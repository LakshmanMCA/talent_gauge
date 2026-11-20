"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, tokens } from "./api";

export type Role = "super_admin" | "public_user" | "school_admin" | "teacher" | "student";
export type User = { id: number; email: string; full_name: string; role: Role; school: number | null };
type Portal = "public" | "school" | "platform";

type Ctx = {
  user: User | null; loading: boolean;
  login: (email: string, password: string, portal: Portal) => Promise<User>;
  logout: () => void;
};
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export const homeFor = (r: Role) =>
  ({ super_admin: "/admin", public_user: "/dashboard", school_admin: "/school", teacher: "/school", student: "/student" })[r];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.access && !tokens.refresh) { setLoading(false); return; }
    api<User>("/auth/me/").then(setUser).catch(() => tokens.clear()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, portal: Portal) => {
    const d = await api<{ access: string; refresh: string; user: User }>("/auth/login/", { body: { email, password, portal } });
    tokens.set(d.access, d.refresh);
    setUser(d.user);
    return d.user;
  }, []);
  const logout = useCallback(() => { tokens.clear(); setUser(null); window.location.href = "/"; }, []);

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

/** UX-only route guard; the backend remains the authority on access. */
export function useRequireRole(roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!roles.includes(user.role)) router.replace(homeFor(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, roles.join()]);
  return { user: user && roles.includes(user.role) ? user : null, loading };
}
