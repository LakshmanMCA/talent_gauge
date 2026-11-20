"use client";
import Link from "next/link";
import { useFetch } from "@/lib/hooks";
import { useRequireRole } from "@/lib/auth";
import { Empty, ErrorBox, LineChart, Skeleton, Stat } from "@/components/ui";

type D = { tests_taken: number; average_score: number; accuracy: number; streak_days: number; trend: number[];
  recent: { attempt_id: number; test__title: string; percentage: string; passed: boolean; created_at: string }[] };
type LB = { name: string; average: number; tests: number }[];
const ROLES = ["public_user"] as const;

export default function Dashboard() {
  const { user } = useRequireRole([...ROLES]);
  const d = useFetch<D>(user ? "/results/public/dashboard/" : null);
  const lb = useFetch<LB>(user ? "/results/public/leaderboard/" : null);
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold">Hi, {user.full_name.split(" ")[0]}</h1><p className="text-ink/60">Here is how your practice is going.</p></div>
        <Link href="/tests" className="btn-primary">Take a test</Link>
      </div>
      {d.error && <ErrorBox message={d.error} onRetry={d.reload} />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {d.loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />) : d.data && (<>
          <Stat label="Tests taken" value={d.data.tests_taken} />
          <Stat label="Average score" value={`${d.data.average_score}%`} />
          <Stat label="Accuracy" value={`${d.data.accuracy}%`} hint="correct of answered" />
          <Stat label="Day streak" value={d.data.streak_days} />
        </>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2"><h2 className="font-semibold">Score trend</h2>{d.data && <LineChart data={d.data.trend} />}</section>
        <section className="card p-5"><h2 className="font-semibold">Top learners</h2>
          <ol className="mt-3 space-y-2">{lb.data?.map((r, i) => (
            <li key={i} className="flex justify-between text-sm"><span>{i + 1}. {r.name}</span><span className="font-semibold">{r.average}%</span></li>))}
            {lb.data?.length === 0 && <p className="text-sm text-ink/50">No scores yet.</p>}</ol>
        </section>
      </div>
      <section>
        <h2 className="mb-3 text-xl font-bold">Recent results</h2>
        {d.data && d.data.recent.length === 0 ? <Empty title="No tests yet" hint="Your results will appear here." action={<Link href="/tests" className="btn-primary mt-2">Browse tests</Link>} /> : (
          <div className="card divide-y divide-brand/10">
            {d.data?.recent.map((r) => (
              <Link key={r.attempt_id} href={`/results/${r.attempt_id}`} className="flex items-center justify-between p-4 hover:bg-brand-wash">
                <div><p className="font-medium">{r.test__title}</p><p className="text-xs text-ink/50">{new Date(r.created_at).toLocaleDateString()}</p></div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${r.passed ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>{r.percentage}%</span>
              </Link>))}
          </div>)}
      </section>
    </div>
  );
}
