"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useDebounced, useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";
import type { Page } from "@/lib/api";

type T = { id: number; title: string; description: string; category_name: string; duration_minutes: number; question_count: number; is_premium: boolean };
type Cat = { id: number; name: string };

function Browse() {
  const sp = useSearchParams(); const router = useRouter(); const { user } = useAuth();
  const cat = sp.get("category") ?? "";
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ ...(cat && { category: cat }), ...(dq && { search: dq }) }).toString();
  const tests = useFetch<Page<T>>(`/public/tests/?${qs}`);
  const cats = useFetch<Cat[]>("/public/categories/");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Practice tests</h1>
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search tests" aria-label="Search tests" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-xs" aria-label="Category" value={cat} onChange={(e) => router.replace(e.target.value ? `/tests?category=${e.target.value}` : "/tests")}>
          <option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {tests.error && <ErrorBox message={tests.error} onRetry={tests.reload} />}
      <div className="grid gap-4 md:grid-cols-2">
        {tests.loading && [0, 1].map((i) => <Skeleton key={i} className="h-36" />)}
        {tests.data?.results.map((t) => (
          <article key={t.id} className="card flex flex-col p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-royal">{t.category_name}</p>
            <h2 className="mt-1 text-lg font-bold">{t.title}</h2>
            <p className="mt-1 text-sm text-ink/60">{t.question_count} questions · {t.duration_minutes} min</p>
            <div className="mt-4">
              {user?.role === "public_user" ? <Link href={`/exam/${t.id}`} className="btn-primary">Start test</Link>
                : <Link href={user ? "/" : "/login"} className="btn-ghost">{user ? "Learner account needed" : "Sign in to start"}</Link>}
            </div>
          </article>))}
      </div>
      {tests.data?.results.length === 0 && <Empty title="No tests found" hint="Try another category or search term." />}
    </div>
  );
}
export default function TestsPage() { return <Suspense><Browse /></Suspense>; }
