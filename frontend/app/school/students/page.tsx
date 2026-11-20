"use client";
import { FormEvent, useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useDebounced, useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Field, Skeleton } from "@/components/ui";

type S = { id: number; admission_no: string; full_name: string; email: string; class_name: string | null };
type C = { id: number; name: string; section: string };
const ROLES = ["school_admin"] as const;

export default function Students() {
  const { user } = useRequireRole([...ROLES]);
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useFetch<Page<S>>(user ? `/academics/students/?page=${page}&search=${encodeURIComponent(dq)}` : null);
  const classes = useFetch<Page<C>>(user ? "/academics/classes/?page_size=100" : null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const form = e.currentTarget;
    try { await api("/academics/students/", { body: Object.fromEntries(new FormData(form)) }); form.reset(); list.reload(); }
    catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Students</h1>
      <form onSubmit={add} className="card grid gap-4 p-5 md:grid-cols-5">
        <Field label="Full name"><input name="full_name" required className="input" /></Field>
        <Field label="Email"><input name="email" type="email" required className="input" /></Field>
        <Field label="Temp password"><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
        <Field label="Class"><select name="school_class" required className="input"><option value="">Select</option>
          {classes.data?.results.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}</select></Field>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={busy}>{busy ? "Adding…" : "Add student"}</button></div>
        {err && <p role="alert" className="text-sm text-bad md:col-span-5">{err}</p>}
      </form>
      <input className="input max-w-sm" placeholder="Search name, email or admission no." aria-label="Search students" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading && <Skeleton className="h-40" />}
      {list.data && (list.data.results.length === 0 ? <Empty title="No students found" /> : (
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase"><tr>{["Admission", "Name", "Email", "Class"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-brand/10">{list.data.results.map((s) => (
            <tr key={s.id}><td className="p-3 font-mono">{s.admission_no}</td><td className="p-3 font-medium">{s.full_name}</td><td className="p-3">{s.email}</td><td className="p-3">{s.class_name ?? "—"}</td></tr>))}</tbody></table></div>))}
      <div className="flex items-center justify-between text-sm">
        <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="btn-ghost" disabled={!list.data?.next} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
