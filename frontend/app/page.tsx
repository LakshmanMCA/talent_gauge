"use client";
import Link from "next/link";
import { useFetch } from "@/lib/hooks";
import { Skeleton } from "@/components/ui";

type Cat = { id: number; name: string; slug: string; description: string; test_count: number };
type Home = { tests: number; questions: number; learners: number; categories: number };

/** Decorative preview of the exam screen: the one memorable element of the page. */
function ExamPreview() {
  return (
    <div className="card relative mx-auto w-full max-w-md rotate-1 p-5" aria-hidden>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Question 12 of 50</span>
        <span className="rounded-lg bg-royal px-3 py-1 font-mono text-white">01:29:45</span>
      </div>
      <p className="mt-4 font-medium">A train covers 150 km in 2.5 hours. What is its average speed?</p>
      <div className="mt-3 space-y-2">
        {["50 km/h", "60 km/h", "75 km/h", "90 km/h"].map((o, i) => (
          <div key={o} className={`rounded-xl border px-4 py-2.5 text-sm ${i === 1 ? "border-brand bg-brand-soft font-semibold" : "border-ink/10"}`}>{o}</div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-10 gap-1.5">
        {Array.from({ length: 30 }, (_, i) => (
          <span key={i} className={`h-5 rounded ${i < 11 ? "bg-ok/80" : i === 11 ? "bg-brand" : i === 14 ? "bg-warn/80" : "bg-ink/10"}`} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const stats = useFetch<Home>("/public/home/");
  const cats = useFetch<Cat[]>("/public/categories/");

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 py-6 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Practice like it is the real exam.</h1>
          <p className="mt-4 max-w-md text-lg text-ink/70">Timed mock tests in aptitude, reasoning, English and tech, with instant scoring and review. Schools run secure exams for their own classes.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Create free account</Link>
            <Link href="/school-signup" className="btn-ghost">Register your school</Link>
          </div>
          <dl className="mt-9 grid max-w-md grid-cols-3 gap-4">
            {stats.loading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />) : stats.data && [
              ["Tests", stats.data.tests], ["Questions", stats.data.questions], ["Learners", stats.data.learners]].map(([k, v]) => (
              <div key={k as string}><dd className="text-2xl font-bold">{(v as number).toLocaleString()}</dd><dt className="text-sm text-ink/60">{k}</dt></div>))}
          </dl>
        </div>
        <ExamPreview />
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="text-2xl font-bold">Pick a category</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
          {cats.data?.map((c) => (
            <Link key={c.id} href={`/tests?category=${c.id}`} className="card p-5 transition-shadow hover:shadow-lg">
              <h3 className="font-semibold">{c.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-ink/60">{c.description || "Timed practice with instant results."}</p>
              <p className="mt-3 text-sm font-medium text-brand">{c.test_count} {c.test_count === 1 ? "test" : "tests"}</p>
            </Link>
          ))}
          {cats.error && <p className="text-sm text-bad">{cats.error}</p>}
        </div>
      </section>
    </div>
  );
}
