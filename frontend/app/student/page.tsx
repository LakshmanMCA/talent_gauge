"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Skeleton } from "@/components/ui";

type E = { id: number; title: string; subject_name: string; duration_minutes: number; start_at: string; end_at: string };
type R = { attempt_id: number; exam_title: string; percentage: string; passed: boolean; correct: number; created_at: string };
const ROLES = ["student"] as const;

function Inner() {
  const { user } = useRequireRole([...ROLES]);
  const submitted = useSearchParams().get("submitted");
  const ex = useFetch<Page<E>>(user ? "/school-exams/my/exams/" : null);
  const rs = useFetch<Page<R>>(user ? "/school-exams/my/results/" : null);
  if (!user) return null;
  const now = Date.now();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">My exams</h1>
      {submitted && <p role="status" className="card border-ok/30 p-4 text-ok">Exam submitted. Results appear below once your school releases them.</p>}
      {ex.error && <ErrorBox message={ex.error} onRetry={ex.reload} />}
      {ex.loading && <Skeleton className="h-28" />}
      {ex.data?.results.length === 0 && <Empty title="No exams scheduled" hint="Exams for your class will show up here." />}
      <div className="grid gap-4 md:grid-cols-2">{ex.data?.results.map((e) => {
        const open = new Date(e.start_at).getTime() <= now && now <= new Date(e.end_at).getTime();
        return (<article key={e.id} className="card p-5"><p className="text-xs font-semibold uppercase text-royal">{e.subject_name}</p>
          <h2 className="text-lg font-bold">{e.title}</h2>
          <p className="mt-1 text-sm text-ink/60">{e.duration_minutes} min · opens {new Date(e.start_at).toLocaleString()}</p>
          <div className="mt-4">{open ? <Link href={`/student/exam/${e.id}`} className="btn-primary">Start / resume</Link> : <button className="btn-ghost" disabled>Not open</button>}</div></article>);
      })}</div>
      <section><h2 className="mb-3 text-xl font-bold">Results</h2>
        {rs.data?.results.length === 0 ? <p className="text-sm text-ink/50">No released results yet.</p> : (
          <div className="card divide-y divide-brand/10">{rs.data?.results.map((r) => (
            <div key={r.attempt_id} className="flex items-center justify-between p-4"><span className="font-medium">{r.exam_title}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${r.passed ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>{r.percentage}%</span></div>))}</div>)}
      </section>
    </div>
  );
}
export default function Student() { return <Suspense><Inner /></Suspense>; }
