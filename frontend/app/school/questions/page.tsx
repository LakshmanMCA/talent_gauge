"use client";
import { FormEvent, useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, Field } from "@/components/ui";

type Sub = { id: number; name: string };
type Q = { id: number; prompt: string; options: string[]; correct_index: number };
const ROLES = ["school_admin", "teacher"] as const;

export default function Questions() {
  const { user } = useRequireRole([...ROLES]);
  const subjects = useFetch<Page<Sub>>(user ? "/academics/subjects/?page_size=100" : null);
  const list = useFetch<Page<Q>>(user ? "/school-exams/questions/" : null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const form = e.currentTarget; const f = new FormData(form);
    const options = ["a", "b", "c", "d"].map((k) => String(f.get(k) ?? "").trim()).filter(Boolean);
    try {
      await api("/school-exams/questions/", { body: { subject: Number(f.get("subject")), prompt: f.get("prompt"), options, correct_index: Number(f.get("correct")), marks: f.get("marks") || 1 } });
      form.reset(); list.reload();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Question bank</h1>
      <form onSubmit={add} className="card space-y-4 p-5">
        <Field label="Question"><textarea name="prompt" required rows={2} className="input" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">{["a", "b", "c", "d"].map((k, i) => <Field key={k} label={`Option ${k.toUpperCase()}`}><input name={k} required={i < 2} className="input" /></Field>)}</div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Subject"><select name="subject" required className="input"><option value="">Select</option>{subjects.data?.results.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Correct option"><select name="correct" className="input">{["A", "B", "C", "D"].map((l, i) => <option key={l} value={i}>{l}</option>)}</select></Field>
          <Field label="Marks"><input name="marks" type="number" step="0.5" min="0.5" defaultValue={1} className="input" /></Field>
          <div className="flex items-end"><button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Add question"}</button></div>
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </form>
      {list.data?.results.length === 0 && <Empty title="No questions yet" />}
      <div className="space-y-3">{list.data?.results.map((q) => (
        <article key={q.id} className="card p-4"><p className="font-medium">{q.prompt}</p>
          <p className="mt-1 text-sm text-ink/60">Answer: {q.options[q.correct_index]}</p></article>))}</div>
    </div>
  );
}
