"use client";
import { useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useDebounced, useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Field, Skeleton } from "@/components/ui";
import { Badge, ConfirmButton, Modal, PageHeader, Td, Th } from "@/components/admin";

type Q = { id: number; category: number; prompt: string; options: string[]; correct_index: number;
  explanation: string; marks: string; difficulty: string; is_active: boolean };
type C = { id: number; name: string };
type Form = { category: string; prompt: string; options: string[]; correct_index: number;
  explanation: string; marks: string; difficulty: string; is_active: boolean };
const blank: Form = { category: "", prompt: "", options: ["", "", "", ""], correct_index: 0,
  explanation: "", marks: "1", difficulty: "medium", is_active: true };
const DIFF_TONE: Record<string, "good" | "warn" | "bad"> = { easy: "good", medium: "warn", hard: "bad" };

export default function Questions() {
  const { user } = useRequireRole(["super_admin"]);
  const [cat, setCat] = useState("");
  const [diff, setDiff] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const qs = `?${[cat && `category=${cat}`, diff && `difficulty=${diff}`, q && `search=${encodeURIComponent(q)}`].filter(Boolean).join("&")}`;
  const list = useFetch<Page<Q>>(user ? `/public/admin/questions/${qs === "?" ? "" : qs}` : null);
  const cats = useFetch<Page<C>>(user ? "/public/admin/categories/" : null);
  const [editing, setEditing] = useState<Q | null | "new">(null);
  const [form, setForm] = useState<Form>(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function open(x: Q | null) {
    setEditing(x ?? "new");
    setForm(x ? { category: String(x.category), prompt: x.prompt, options: [...x.options],
      correct_index: x.correct_index, explanation: x.explanation, marks: String(x.marks),
      difficulty: x.difficulty, is_active: x.is_active } : { ...blank, category: cat || "" });
    setErr("");
  }
  const setOpt = (i: number, v: string) => setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) }));

  async function save() {
    if (!form.category || !form.prompt.trim()) { setErr("Category and question text are required."); return; }
    if (form.options.filter((o) => o.trim()).length < 2) { setErr("Provide at least two non-empty options."); return; }
    if (form.correct_index >= form.options.length) { setErr("Correct answer is out of range."); return; }
    setBusy(true); setErr("");
    const body = { category: Number(form.category), prompt: form.prompt.trim(),
      options: form.options.map((o) => o.trim()), correct_index: form.correct_index,
      explanation: form.explanation, marks: form.marks, difficulty: form.difficulty, is_active: form.is_active };
    try {
      if (editing === "new") await api("/public/admin/questions/", { body });
      else await api(`/public/admin/questions/${(editing as Q).id}/`, { method: "PATCH", body });
      setEditing(null); list.reload();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  async function remove(x: Q) {
    try { await api(`/public/admin/questions/${x.id}/`, { method: "DELETE" }); list.reload(); }
    catch (e) { setErr(errorText(e)); }
  }
  if (!user) return null;
  const catName = (id: number) => cats.data?.results.find((c) => c.id === id)?.name ?? `#${id}`;
  return (
    <div className="space-y-6">
      <PageHeader title="Public question bank" hint="MCQs available for public tests. Deactivated questions stay in historical attempts." actions={
        <button className="btn-primary" onClick={() => open(null)}>+ New question</button>} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-[220px]" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {cats.data?.results.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Filter by difficulty">
          <option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
        <input className="input ml-auto max-w-xs" placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search questions" />
      </div>
      {err && !editing && <p role="alert" className="text-sm text-bad">{err}</p>}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : list.data?.results.length === 0 ? <Empty title="No questions" hint="Add questions before building tests." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>Question</Th><Th>Category</Th><Th>Difficulty</Th><Th>Marks</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {list.data?.results.map((x) => (
                <tr key={x.id} className="hover:bg-brand-wash/40">
                  <Td className="max-w-md"><p className="line-clamp-2">{x.prompt}</p>
                    <p className="mt-0.5 text-xs text-ink/50">{x.options[x.correct_index] ?? ""} ✓</p></Td>
                  <Td className="text-ink/60">{catName(x.category)}</Td>
                  <Td><Badge tone={DIFF_TONE[x.difficulty] ?? "muted"}>{x.difficulty}</Badge></Td>
                  <Td>{x.marks}</Td>
                  <Td>{x.is_active ? <Badge tone="good">active</Badge> : <Badge tone="muted">inactive</Badge>}</Td>
                  <Td className="text-right"><div className="flex justify-end gap-2">
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => open(x)}>Edit</button>
                    <ConfirmButton label="Delete" confirmLabel="Delete this question? Tests using it will block deletion." onConfirm={() => remove(x)} />
                  </div></Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {editing && (
        <Modal title={editing === "new" ? "New question" : "Edit question"} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category">
                <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">Select…</option>
                  {cats.data?.results.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></Field>
              <Field label="Difficulty">
                <select className="input" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select></Field>
              <Field label="Marks"><input className="input" type="number" min="0.25" step="0.25" value={form.marks} onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))} /></Field>
            </div>
            <Field label="Question"><textarea className="input min-h-[70px]" value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} /></Field>
            <fieldset><legend className="label">Options — select the correct one</legend>
              <div className="space-y-2">
                {form.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={form.correct_index === i} onChange={() => setForm((f) => ({ ...f, correct_index: i }))} aria-label={`Option ${i + 1} is correct`} />
                    <input className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
                    {form.options.length > 2 && <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i), correct_index: f.correct_index >= i && f.correct_index > 0 ? f.correct_index - 1 : 0 }))}>✕</button>}
                  </div>))}
                {form.options.length < 6 && <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ""] }))}>+ Add option</button>}
              </div></fieldset>
            <Field label="Explanation (shown after submission)"><textarea className="input min-h-[60px]" value={form.explanation} onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active (available for new tests)</label>
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save question"}</button>
            </div>
          </div>
        </Modal>)}
    </div>
  );
}
