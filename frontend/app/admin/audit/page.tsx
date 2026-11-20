"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";
import { PageHeader, Td, Th } from "@/components/admin";

type A = { id: number; action: string; target: string; actor_email: string | null;
  detail: Record<string, unknown>; created_at: string };

function Audit() {
  const { user } = useRequireRole(["super_admin"]);
  const params = useSearchParams();
  const [action, setAction] = useState(params.get("action") ?? "");
  const list = useFetch<Page<A>>(user ? `/platform/audit/${action ? `?action=${encodeURIComponent(action)}` : ""}` : null);
  if (!user) return null;
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" hint="Security-sensitive platform actions, newest first." />
      <input className="input max-w-xs" placeholder="Filter by action, e.g. school.approve" value={action}
        onChange={(e) => setAction(e.target.value)} aria-label="Filter audit actions" />
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : list.data?.results.length === 0 ? <Empty title="No audit events" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>When</Th><Th>Action</Th><Th>Target</Th><Th>Actor</Th><Th>Detail</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {list.data?.results.map((a) => (
                <tr key={a.id} className="hover:bg-brand-wash/40">
                  <Td className="whitespace-nowrap text-ink/60">{new Date(a.created_at).toLocaleString()}</Td>
                  <Td><span className="font-mono text-xs">{a.action}</span></Td>
                  <Td className="font-mono text-xs">{a.target || "—"}</Td>
                  <Td className="text-ink/60">{a.actor_email ?? "system"}</Td>
                  <Td className="max-w-xs truncate font-mono text-xs text-ink/50">{JSON.stringify(a.detail)}</Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}

export default function AuditPage() {
  return <Suspense fallback={null}><Audit /></Suspense>;
}
