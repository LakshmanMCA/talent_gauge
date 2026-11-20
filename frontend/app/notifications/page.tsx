"use client";
import Link from "next/link";
import { useState } from "react";
import { api, Page } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";

type N = { id: number; kind: string; title: string; body: string; link: string; is_read: boolean; created_at: string };
type Pref = { in_app: boolean; email: boolean };

export default function Notifications() {
  const { user } = useAuth();
  const [only, setOnly] = useState(false);
  const list = useFetch<Page<N>>(user ? `/notifications/${only ? "?is_read=false" : ""}` : null);
  const pref = useFetch<Pref>(user ? "/notifications/preferences/" : null);

  async function readAll() { await api("/notifications/read-all/", { method: "POST", body: {} }); list.reload(); }
  async function read(id: number) {
    list.setData((p) => p && { ...p, results: p.results.map((n) => (n.id === id ? { ...n, is_read: true } : n)) });
    api(`/notifications/${id}/read/`, { method: "POST", body: {} }).catch(() => {});
  }
  async function toggle(k: keyof Pref) {
    if (!pref.data) return;
    const next = { ...pref.data, [k]: !pref.data[k] };
    pref.setData(next);
    api("/notifications/preferences/", { method: "PATCH", body: next }).catch(pref.reload);
  }
  if (!user) return <Empty title="Sign in to see notifications" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Notifications</h1>
        <div className="flex gap-2"><button className="btn-ghost" onClick={() => setOnly(!only)}>{only ? "Show all" : "Unread only"}</button><button className="btn-ghost" onClick={readAll}>Mark all read</button></div>
      </div>
      {pref.data && (
        <div className="card flex flex-wrap gap-6 p-4 text-sm">
          {(["in_app", "email"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={pref.data![k]} onChange={() => toggle(k)} className="h-4 w-4 accent-brand" />{k === "in_app" ? "In-app alerts" : "Email alerts"}</label>))}
        </div>)}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
      {list.data?.results.length === 0 && <Empty title="You are all caught up" />}
      <div className="card divide-y divide-brand/10">
        {list.data?.results.map((n) => (
          <Link key={n.id} href={n.link || "#"} onClick={() => read(n.id)} className={`flex gap-3 p-4 hover:bg-brand-wash ${n.is_read ? "" : "bg-brand-soft/50"}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-brand"}`} aria-label={n.is_read ? "" : "unread"} />
            <div><p className="font-semibold">{n.title}</p><p className="text-sm text-ink/70">{n.body}</p><p className="mt-1 text-xs text-ink/40">{new Date(n.created_at).toLocaleString()}</p></div>
          </Link>))}
      </div>
    </div>
  );
}
