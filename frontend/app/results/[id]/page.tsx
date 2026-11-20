"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { ErrorBox, Spinner, Stat } from "@/components/ui";
import type { Page } from "@/lib/api";

type R = { attempt_id: number; test_title: string; correct: number; incorrect: number; unanswered: number; obtained: string; total: string; percentage: string; passed: boolean; time_taken_seconds: number };
type Rev = { id: number; prompt: string; options: string[]; correct: number; selected: number | null; explanation: string }[];
const ROLES = ["public_user"] as const;

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const { user } = useRequireRole([...ROLES]);
  const list = useFetch<Page<R>>(user ? "/public/results/?page_size=100" : null);
  const rev = useFetch<Rev>(user ? `/public/attempts/${id}/review/` : null);
  if (!user || list.loading) return <Spinner />;
  const r = list.data?.results.find((x) => x.attempt_id === Number(id));
  if (!r) return <ErrorBox message={list.error ?? "Result not found."} />;

  return (
    <div className="space-y-8">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div><p className="text-sm text-ink/60">{r.test_title}</p><h1 className="text-4xl font-extrabold">{r.percentage}%</h1>
          <p className={`mt-1 font-semibold ${r.passed ? "text-ok" : "text-bad"}`}>{r.passed ? "Passed" : "Not passed yet"}</p></div>
        <Link href="/tests" className="btn-primary">Try another test</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Correct" value={r.correct} /><Stat label="Incorrect" value={r.incorrect} />
        <Stat label="Unanswered" value={r.unanswered} /><Stat label="Marks" value={`${r.obtained}/${r.total}`} hint={`${Math.round(r.time_taken_seconds / 60)} min taken`} />
      </div>
      <section>
        <h2 className="mb-3 text-xl font-bold">Review answers</h2>
        <div className="space-y-4">
          {rev.data?.map((q, i) => (
            <article key={q.id} className="card p-5">
              <p className="font-semibold">{i + 1}. {q.prompt}</p>
              <ul className="mt-3 space-y-2">{q.options.map((o, k) => (
                <li key={k} className={`rounded-lg border px-3 py-2 text-sm ${k === q.correct ? "border-ok bg-ok/10 font-semibold" : k === q.selected ? "border-bad bg-bad/10" : "border-ink/10"}`}>
                  {o}{k === q.correct && " ✓ correct"}{k === q.selected && k !== q.correct && " — your answer"}</li>))}</ul>
              {q.explanation && <p className="mt-3 rounded-lg bg-brand-soft p-3 text-sm">{q.explanation}</p>}
            </article>))}
        </div>
      </section>
    </div>
  );
}
