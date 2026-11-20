"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/admin";

type Health = { db: string; cache: string };
const HEALTH_URL = `${API.replace(/\/api\/v1\/?$/, "")}/health/`;

export default function System() {
  useRequireRole(["super_admin"]);
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(HEALTH_URL).then((r) => r.json()).then(setH).catch(() => setErr(true));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="System" hint="Service health and platform configuration." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">API health</h2>
          {err ? <Badge tone="bad">unreachable</Badge> : !h ? <p className="text-sm text-ink/50">Checking…</p> : (
            <div className="flex gap-3">
              <Badge tone={h.db === "ok" ? "good" : "bad"}>database: {h.db}</Badge>
              <Badge tone={h.cache === "ok" ? "good" : "warn"}>cache: {h.cache}</Badge>
            </div>)}
          <p className="mt-3 text-xs text-ink/50">{HEALTH_URL}</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Background workers</h2>
          <p className="text-sm text-ink/60">
            Celery workers handle notifications, reports and scheduled jobs. In local development without Redis they run eagerly inside the web process.
          </p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Plans &amp; billing</h2>
          <p className="text-sm text-ink/60">
            Subscription plans and entitlements are designed but deferred until billing scope is approved (project doc §25). Premium tests are already flagged per-test.
          </p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-semibold">API documentation</h2>
          <p className="text-sm text-ink/60">Interactive OpenAPI docs for every endpoint.</p>
          <a className="btn-ghost mt-3 !px-3 !py-1.5 text-xs" href={HEALTH_URL.replace("/health/", "/api/docs/")} target="_blank" rel="noreferrer">Open API docs ↗</a>
        </section>
      </div>
    </div>
  );
}
