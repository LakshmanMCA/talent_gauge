"use client";
import { useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";
import { Badge, PageHeader, Td, Th } from "@/components/admin";

type U = { id: number; email: string; full_name: string; role: string; school: number | null;
  school_name: string | null; is_active: boolean; date_joined: string };

const ROLES = ["", "super_admin", "school_admin", "teacher", "student", "public_user"] as const;
const ROLE_TONE: Record<string, "brand" | "good" | "warn" | "muted" | "bad"> = {
  super_admin: "bad", school_admin: "brand", teacher: "good", student: "warn", public_user: "muted",
};

export default function AdminUsers() {
  const { user } = useRequireRole(["super_admin"]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const qs = `?${role ? `role=${role}&` : ""}${q ? `search=${encodeURIComponent(q)}` : ""}`.replace("?&", "?").replace(/\?$/, "");
  const list = useFetch<Page<U>>(user ? `/platform/users/${qs}` : null);

  async function setActive(u: U) {
    try { await api(`/platform/users/${u.id}/status/`, { method: "PATCH", body: { is_active: !u.is_active } }); list.reload(); }
    catch (e) { setErr(errorText(e)); }
  }
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Users" hint="Every account on the platform. Deactivated users cannot sign in." />
      <div className="flex flex-wrap items-center gap-2">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${role === r ? "bg-brand text-white" : "bg-white text-ink/70 border border-brand/15 hover:bg-brand-soft"}`}>
            {r ? r.replace("_", " ") : "All roles"}
          </button>))}
        <input className="input ml-auto max-w-xs" placeholder="Search name or email…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : list.data?.results.length === 0
        ? <Empty title="No users found" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>User</Th><Th>Role</Th><Th>School</Th><Th>Status</Th><Th>Joined</Th><Th className="text-right">Action</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {list.data?.results.map((u) => (
                <tr key={u.id} className="hover:bg-brand-wash/40">
                  <Td><p className="font-semibold">{u.full_name}</p><p className="text-xs text-ink/50">{u.email}</p></Td>
                  <Td><Badge tone={ROLE_TONE[u.role] ?? "muted"}>{u.role.replace("_", " ")}</Badge></Td>
                  <Td className="text-ink/60">{u.school_name ?? "—"}</Td>
                  <Td>{u.is_active ? <Badge tone="good">active</Badge> : <Badge tone="bad">disabled</Badge>}</Td>
                  <Td className="text-ink/60">{new Date(u.date_joined).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    {u.id === user.id ? <span className="text-xs text-ink/40">you</span> : (
                      <button className={`btn-ghost !px-3 !py-1.5 text-xs ${u.is_active ? "!text-bad" : "!text-emerald-700"}`}
                        onClick={() => setActive(u)}>{u.is_active ? "Disable" : "Enable"}</button>)}
                  </Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}
