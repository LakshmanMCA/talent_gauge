"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";
import { Badge, ConfirmButton, Modal, PageHeader, Td, Th } from "@/components/admin";

type S = { id: number; name: string; registration_number: string; email: string; phone: string;
  address: string; status: string; review_note: string; member_count: number; created_at: string };

const TABS = ["", "pending", "approved", "correction", "rejected"] as const;
const TONE: Record<string, "warn" | "good" | "bad" | "muted"> = {
  pending: "warn", approved: "good", rejected: "bad", correction: "muted",
};

function Schools() {
  const { user } = useRequireRole(["super_admin"]);
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<S | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const path = `/platform/schools/${status ? `?status=${status}` : ""}${q ? `${status ? "&" : "?"}search=${encodeURIComponent(q)}` : ""}`;
  const list = useFetch<Page<S>>(user ? path : null);

  async function decide(decision: "approve" | "reject" | "correction") {
    if (!detail) return;
    if (decision !== "approve" && !note.trim()) { setErr("A note is required for this decision."); return; }
    setBusy(true); setErr("");
    try {
      await api(`/platform/schools/${detail.id}/review/`, { body: { decision, note: note.trim() } });
      setDetail(null); setNote(""); list.reload();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Schools" hint="Review registrations and manage tenant status." />
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setStatus(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === t ? "bg-brand text-white" : "bg-white text-ink/70 border border-brand/15 hover:bg-brand-soft"}`}>
            {t ? t[0].toUpperCase() + t.slice(1) : "All"}
          </button>))}
        <input className="input ml-auto max-w-xs" placeholder="Search name, reg. no., email…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search schools" />
      </div>
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : list.data?.results.length === 0
        ? <Empty title="No schools found" hint="Adjust the filters or wait for new registrations." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>School</Th><Th>Registration</Th><Th>Members</Th><Th>Status</Th><Th>Applied</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {list.data?.results.map((s) => (
                <tr key={s.id} className="hover:bg-brand-wash/40">
                  <Td><button className="text-left" onClick={() => { setDetail(s); setNote(""); setErr(""); }}>
                    <p className="font-semibold text-brand hover:underline">{s.name}</p><p className="text-xs text-ink/50">{s.email}</p></button></Td>
                  <Td className="font-mono text-xs">{s.registration_number}</Td>
                  <Td>{s.member_count}</Td>
                  <Td><Badge tone={TONE[s.status] ?? "muted"}>{s.status}</Badge></Td>
                  <Td className="text-ink/60">{new Date(s.created_at).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    {s.status === "pending" || s.status === "correction" ? (
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setDetail(s); setNote(""); setErr(""); }}>Review</button>
                      </div>) : <span className="text-xs text-ink/40">—</span>}
                  </Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink/50">Registration no.</dt><dd className="font-mono">{detail.registration_number}</dd></div>
            <div><dt className="text-xs text-ink/50">Status</dt><dd><Badge tone={TONE[detail.status] ?? "muted"}>{detail.status}</Badge></dd></div>
            <div><dt className="text-xs text-ink/50">Email</dt><dd>{detail.email}</dd></div>
            <div><dt className="text-xs text-ink/50">Phone</dt><dd>{detail.phone || "—"}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-ink/50">Address</dt><dd className="whitespace-pre-line">{detail.address || "—"}</dd></div>
            {detail.review_note && <div className="col-span-2"><dt className="text-xs text-ink/50">Previous review note</dt><dd>{detail.review_note}</dd></div>}
          </dl>
          {detail.status !== "approved" && detail.status !== "rejected" && (
            <div className="space-y-3 border-t border-brand/10 pt-4">
              <label className="block"><span className="label">Note to the school {detail.status !== "pending" ? "(required)" : "(required for reject / correction)"}</span>
                <textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} /></label>
              {err && <p role="alert" className="text-sm text-bad">{err}</p>}
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => decide("approve")}>Approve school</button>
                <button className="btn-ghost" disabled={busy} onClick={() => decide("correction")}>Request correction</button>
                <ConfirmButton label="Reject" confirmLabel="Reject this application?" onConfirm={() => decide("reject")} />
              </div>
            </div>)}
          {err && detail.status === "approved" && <p role="alert" className="text-sm text-bad">{err}</p>}
        </Modal>)}
    </div>
  );
}

export default function SchoolsPage() {
  return <Suspense fallback={null}><Schools /></Suspense>;
}
