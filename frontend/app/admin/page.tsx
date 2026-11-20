"use client";
import { useState } from "react";
import Link from "next/link";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton, Stat } from "@/components/ui";
import { Badge, PageHeader, Td, Th } from "@/components/admin";

type M = {
  schools: Record<string, number>; pending: number; users_by_role: Record<string, number>;
  public_users: number; public_tests: number; public_questions: number;
  public_attempts: number; public_results: number;
};
type S = { id: number; name: string; registration_number: string; email: string; status: string; created_at: string };
type A = { id: number; action: string; target: string; actor_email: string | null; detail: Record<string, unknown>; created_at: string };

const STATUS_TONE: Record<string, "warn" | "good" | "bad" | "muted"> = {
  pending: "warn", approved: "good", rejected: "bad", correction: "muted",
};

export default function AdminOverview() {
  const { user } = useRequireRole(["super_admin"]);
  const m = useFetch<M>(user ? "/platform/metrics/" : null);
  const pend = useFetch<Page<S>>(user ? "/platform/schools/?status=pending" : null);
  const audit = useFetch<Page<A>>(user ? "/platform/audit/" : null);
  const [err, setErr] = useState("");

  async function review(id: number, decision: "approve" | "reject") {
    let note = "";
    if (decision === "reject") { note = prompt("Reason for rejection (sent to the school):") ?? ""; if (!note) return; }
    try { await api(`/platform/schools/${id}/review/`, { body: { decision, note } }); pend.reload(); m.reload(); audit.reload(); }
    catch (e) { setErr(errorText(e)); }
  }
  if (!user) return null;
  const d = m.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Platform overview" hint="Schools, public content and activity across Talent Gauge." />
      {m.error && <ErrorBox message={m.error} onRetry={m.reload} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {m.loading ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />) : d && (<>
          <Stat label="Schools pending" value={d.pending} hint="Awaiting review" />
          <Stat label="Approved schools" value={d.schools?.approved ?? 0} />
          <Stat label="Learners" value={d.public_users} />
          <Stat label="Published tests" value={d.public_tests} />
          <Stat label="Question bank" value={d.public_questions} />
          <Stat label="Public attempts" value={d.public_attempts} />
        </>)}
      </div>

      {d && <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Schools by status</h2>
          <Link href="/admin/schools" className="text-sm font-medium text-brand hover:underline">Manage schools →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(d.schools ?? {}).map(([s, n]) => <Badge key={s} tone={STATUS_TONE[s] ?? "muted"}>{s}: {n}</Badge>)}
          {Object.keys(d.schools ?? {}).length === 0 && <p className="text-sm text-ink/50">No schools registered yet.</p>}
        </div>
      </section>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Pending school applications</h2>
          <Link href="/admin/schools?status=pending" className="text-sm font-medium text-brand hover:underline">View all →</Link>
        </div>
        {err && <p role="alert" className="mb-2 text-sm text-bad">{err}</p>}
        {pend.error && <ErrorBox message={pend.error} onRetry={pend.reload} />}
        {pend.data?.results.length === 0 && <Empty title="No pending applications" hint="New school registrations will appear here for review." />}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr><Th>School</Th><Th>Registration</Th><Th>Applied</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody className="divide-y divide-brand/10">
              {pend.data?.results.map((s) => (
                <tr key={s.id}>
                  <Td><p className="font-semibold">{s.name}</p><p className="text-xs text-ink/50">{s.email}</p></Td>
                  <Td className="font-mono text-xs">{s.registration_number}</Td>
                  <Td className="text-ink/60">{new Date(s.created_at).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => review(s.id, "reject")}>Reject</button>
                      <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => review(s.id, "approve")}>Approve</button>
                    </div>
                  </Td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent audit events</h2>
          <Link href="/admin/audit" className="text-sm font-medium text-brand hover:underline">Full log →</Link>
        </div>
        <div className="card divide-y divide-brand/10 text-sm">
          {audit.data?.results.slice(0, 10).map((a) => (
            <div key={a.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span className="font-mono text-xs">{a.action} #{a.target}</span>
              <span className="text-xs text-ink/50">{a.actor_email} · {new Date(a.created_at).toLocaleString()}</span>
            </div>))}
          {audit.data?.results.length === 0 && <p className="p-4 text-sm text-ink/50">No events recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
