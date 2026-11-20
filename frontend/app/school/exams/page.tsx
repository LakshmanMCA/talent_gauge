"use client";
import { useState } from "react";
import { API, api, errorText, Page, tokens } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";

type E = { id: number; title: string; status: string; start_at: string; end_at: string; question_count: number; duration_minutes: number };
const ROLES = ["school_admin", "teacher"] as const;
const tone: Record<string, string> = { draft: "bg-ink/10", published: "bg-ok/15 text-ok", completed: "bg-royal/15 text-royal", cancelled: "bg-bad/10 text-bad" };

export default function Exams() {
  const { user } = useRequireRole([...ROLES]);
  const list = useFetch<Page<E>>(user ? "/school-exams/exams/" : null);
  const [msg, setMsg] = useState("");

  async function publish(id: number) {
    setMsg("");
    try { await api(`/school-exams/exams/${id}/publish/`, { method: "POST", body: {} }); list.reload(); } catch (e) { setMsg(errorText(e)); }
  }
  async function exportCsv(id: number) {   // authenticated download: header token, then blob
    const r = await fetch(`${API}/results/school/exams/${id}/export/`, { headers: { Authorization: `Bearer ${tokens.access}` } });
    if (!r.ok) return setMsg("Export failed.");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: `exam-${id}-results.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  }
  if (!user) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Exams</h1>
      <p className="text-sm text-ink/60">Create exams through the API docs or admin; publishing notifies every student in the class.</p>
      {msg && <p role="alert" className="text-sm text-bad">{msg}</p>}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading && <Skeleton className="h-32" />}
      {list.data?.results.length === 0 && <Empty title="No exams yet" />}
      <div className="space-y-3">{list.data?.results.map((e) => (
        <article key={e.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div><h2 className="font-semibold">{e.title}</h2>
            <p className="text-sm text-ink/60">{e.question_count} questions · {e.duration_minutes} min · {new Date(e.start_at).toLocaleString()}</p></div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${tone[e.status]}`}>{e.status}</span>
            {e.status === "draft" && <button className="btn-primary" onClick={() => publish(e.id)}>Publish</button>}
            {user.role === "school_admin" && e.status !== "draft" && <button className="btn-ghost" onClick={() => exportCsv(e.id)}>Export CSV</button>}
          </div>
        </article>))}</div>
    </div>
  );
}
