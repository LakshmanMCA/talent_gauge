"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorText } from "@/lib/api";
import { Spinner, ErrorBox } from "./ui";

type Q = { id: number; prompt: string; options: string[]; marks: string };
type Ans = { selected: number | null; marked: boolean };
type Started = { attempt_id: number; expires_at: string; questions: Q[]; answers: Record<string, Ans> };

const PATHS = {
  public: { start: (id: string) => `/public/attempts/start/${id}/`, base: (a: number) => `/public/attempts/${a}`, done: (a: number) => `/results/${a}` },
  school: { start: (id: string) => `/school-exams/my/start/${id}/`, base: (a: number) => `/school-exams/my/attempts/${a}`, done: () => `/student?submitted=1` },
};

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};

export default function ExamRunner({ mode, id }: { mode: "public" | "school"; id: string }) {
  const P = PATHS[mode];
  const router = useRouter();
  const [data, setData] = useState<Started | null>(null);
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [ans, setAns] = useState<Record<number, Ans>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [save, setSave] = useState<"saved" | "saving" | "error">("saved");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {  // start is idempotent: refresh/resume returns the same attempt and saved answers
    api<Started>(P.start(id), { method: "POST", body: {} })
      .then((d) => {
        setData(d);
        setAns(Object.fromEntries(Object.entries(d.answers).map(([k, v]) => [Number(k), v])));
      }).catch((e) => setError(errorText(e)));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async () => {
    if (!data || submitted.current) return;
    submitted.current = true; setSubmitting(true);
    try { await api(`${P.base(data.attempt_id)}/submit/`, { method: "POST", body: {} }); router.replace(P.done(data.attempt_id)); }
    catch (e) { submitted.current = false; setSubmitting(false); setError(errorText(e)); }
  }, [data, P, router]);

  // Countdown derived from the server deadline, so refreshing never resets time.
  useEffect(() => {
    if (!data) return;
    const end = new Date(data.expires_at).getTime();
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data, submit]);

  useEffect(() => {  // guard against accidental tab close mid-exam
    const h = (e: BeforeUnloadEvent) => { if (!submitted.current) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const questions = data?.questions ?? [];
  const q = questions[idx];
  const stats = useMemo(() => {
    let answered = 0, marked = 0;
    for (const a of Object.values(ans)) { if (a.selected !== null) answered++; if (a.marked) marked++; }
    return { answered, marked, unanswered: questions.length - answered };
  }, [ans, questions.length]);

  async function persist(qid: number, next: Ans) {
    if (!data) return;
    setAns((p) => ({ ...p, [qid]: next }));           // optimistic
    setSave("saving");
    try { await api(`${P.base(data.attempt_id)}/answer/`, { body: { question_id: qid, ...next } }); setSave("saved"); }
    catch (e) { setSave("error"); if (String(errorText(e)).includes("Time is up")) submit(); }
  }

  if (error && !data) return <ErrorBox message={error} onRetry={() => location.reload()} />;
  if (!data || !q) return <Spinner label="Preparing your exam" />;
  const cur = ans[q.id] ?? { selected: null, marked: false };
  const urgent = left !== null && left <= 300;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink/60">Question {idx + 1} of {questions.length} · {q.marks} mark(s)</p>
          <span aria-live="off" className={`rounded-lg px-3 py-1 font-mono text-sm text-white ${urgent ? "bg-bad" : "bg-royal"}`}>{left === null ? "--:--" : fmt(left)}</span>
        </div>
        <h2 className="mt-5 text-xl font-semibold leading-snug">{q.prompt}</h2>
        <div role="radiogroup" aria-label="Options" className="mt-5 space-y-3">
          {q.options.map((o, i) => (
            <button key={i} role="radio" aria-checked={cur.selected === i} onClick={() => persist(q.id, { ...cur, selected: i })}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${cur.selected === i ? "border-brand bg-brand-soft font-semibold" : "border-ink/15 hover:bg-brand-wash"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm ${cur.selected === i ? "border-brand bg-brand text-white" : "border-ink/25"}`}>{String.fromCharCode(65 + i)}</span>{o}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
          <button className="btn-ghost" onClick={() => persist(q.id, { ...cur, marked: !cur.marked })}>{cur.marked ? "Unmark review" : "Mark for review"}</button>
          {cur.selected !== null && <button className="btn-ghost" onClick={() => persist(q.id, { selected: null, marked: cur.marked })}>Clear</button>}
          <button className="btn-primary ml-auto" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>Save &amp; next</button>
        </div>
        <p className={`mt-4 text-xs ${save === "error" ? "font-semibold text-bad" : "text-ink/50"}`} aria-live="polite">
          {save === "saving" ? "Saving…" : save === "error" ? "Could not save. Re-select your answer to retry." : "All changes saved"}
        </p>
      </section>

      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <h3 className="font-semibold">Question palette</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {questions.map((x, i) => {
            const a = ans[x.id];
            const tone = i === idx ? "bg-brand text-white" : a?.marked ? "bg-warn/85 text-white" : a?.selected != null ? "bg-ok text-white" : "bg-ink/10";
            return <button key={x.id} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}`} aria-current={i === idx} className={`h-9 rounded-lg text-sm font-semibold ${tone}`}>{i + 1}</button>;
          })}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-ok/10 p-2"><dd className="text-lg font-bold text-ok">{stats.answered}</dd><dt>Answered</dt></div>
          <div className="rounded-lg bg-warn/10 p-2"><dd className="text-lg font-bold text-warn">{stats.marked}</dd><dt>Review</dt></div>
          <div className="rounded-lg bg-ink/5 p-2"><dd className="text-lg font-bold">{stats.unanswered}</dd><dt>Left</dt></div>
        </dl>
        <button className="btn-danger mt-5 w-full" onClick={() => setConfirm(true)}>Submit exam</button>
      </aside>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="sub-t" className="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 id="sub-t" className="text-lg font-bold">Submit your exam?</h3>
            <p className="mt-2 text-sm text-ink/70">{stats.answered} answered, {stats.unanswered} unanswered, {stats.marked} marked for review. You cannot change answers after submitting.</p>
            {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Keep working</button>
              <button className="btn-danger" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Yes, submit"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
