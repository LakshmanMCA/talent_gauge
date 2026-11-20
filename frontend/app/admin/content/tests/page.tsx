"use client";
import { useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Field, Skeleton } from "@/components/ui";
import { Badge, ConfirmButton, Modal, PageHeader, Td, Th } from "@/components/admin";

type T = { id: number; category: number; title: string; description: string; duration_minutes: number;
  pass_percentage: string; negative_marks: string; is_published: boolean; is_premium: boolean;
  max_attempts: number; blueprint: { count?: number; difficulty?: string } | null;
  selected_question_ids: number[]; question_count: number };
type C = { id: number; name: string };
type Q = { id: number; prompt: string; difficulty: string; is_active: boolean; category: number };
type Form = { category: string; title: string; description: string; duration_minutes: string;
  pass_percentage: string; negative_marks: string; is_premium: boolean; max_attempts: string;
  useBlueprint: boolean; bpCount: string; bpDifficulty: string; question_ids: number[] };
const blank: Form = { category: "", title: "", description: "", duration_minutes: "30", pass_percentage: "40",
  negative_marks: "0", is_premium: false, max_attempts: "0", useBlueprint: false, bpCount: "10", bpDifficulty: "",
  question_ids: [] };

export default function Tests() {
  const { user } = useRequireRole(["super_admin"]);
  const list = useFetch<Page<T>>(user ? "/public/admin/tests/" : null);
  const cats = useFetch<Page<C>>(user ? "/public/admin/categories/" : null);
  const [editing, setEditing] = useState<T | null | "new">(null);
  const [form, setForm] = useState<Form>(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pubFilter, setPubFilter] = useState("");

  const bankCat = form.category || (editing !== "new" && editing ? String(editing.category) : "");
  const questions = useFetch<Page<Q>>(user && bankCat ? `/public/admin/questions/?category=${bankCat}&page_size=100` : null);

  function open(t: T | null) {
    setEditing(t ?? "new");
    setForm(t ? { category: String(t.category), title: t.title, description: t.description,
      duration_minutes: String(t.duration_minutes), pass_percentage: String(t.pass_percentage),
      negative_marks: String(t.negative_marks), is_premium: t.is_premium, max_attempts: String(t.max_attempts),
      useBlueprint: !!t.blueprint, bpCount: String(t.blueprint?.count ?? 10), bpDifficulty: t.blueprint?.difficulty ?? "",
      question_ids: [...t.selected_question_ids] } : { ...blank, category: "" });
    setErr("");
  }

  async function save() {
    if (!form.category || !form.title.trim()) { setErr("Category and title are required."); return; }
    if (!form.useBlueprint && form.question_ids.length === 0) { setErr("Select at least one question or enable a random blueprint."); return; }
    setBusy(true); setErr("");
    const body: Record<string, unknown> = {
      category: Number(form.category), title: form.title.trim(), description: form.description,
      duration_minutes: Number(form.duration_minutes) || 30, pass_percentage: form.pass_percentage,
      negative_marks: form.negative_marks, is_premium: form.is_premium, max_attempts: Number(form.max_attempts) || 0,
      blueprint: form.useBlueprint ? { count: Number(form.bpCount) || 10, ...(form.bpDifficulty ? { difficulty: form.bpDifficulty } : {}) } : null,
      question_ids: form.useBlueprint ? [] : form.question_ids,
    };
    try {
      if (editing === "new") await api("/public/admin/tests/", { body });
      else await api(`/public/admin/tests/${(editing as T).id}/`, { method: "PATCH", body });
      setEditing(null); list.reload();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  async function publish(t: T, on: boolean) {
    try {
      if (on) await api(`/public/admin/tests/${t.id}/publish/`, { body: {} });
      else await api(`/public/admin/tests/${t.id}/`, { method: "PATCH", body: { is_published: false } });
      list.reload();
    } catch (e) { setErr(errorText(e)); }
  }
  async function remove(t: T) {
    try { await api(`/public/admin/tests/${t.id}/`, { method: "DELETE" }); list.reload(); }
    catch (e) { setErr(errorText(e)); }
  }
  if (!user) return null;
  const filtered = (list.data?.results ?? []).filter((t) => !pubFilter || String(t.is_published) === pubFilter);
  const toggleQ = (id: number) => setForm((f) => ({ ...f, question_ids: f.question_ids.includes(id) ? f.question_ids.filter((x) => x !== id) : [...f.question_ids, id] }));
  return (
    <div className="space-y-6">
      <PageHeader title="Public tests" hint="Build timed mock tests from the question bank, then publish." actions={
        <button className="btn-primary" onClick={() => open(null)}>+ New test</button>} />
      <div className="flex gap-2">
        {[["", "All"], ["true", "Published"], ["false", "Drafts"]].map(([v, l]) => (
          <button key={v} onClick={() => setPubFilter(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${pubFilter === v ? "bg-brand text-white" : "bg-white text-ink/70 border border-brand/15 hover:bg-brand-soft"}`}>{l}</button>))}
      </div>
      {err && !editing && <p role="alert" className="text-sm text-bad">{err}</p>}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : filtered.length === 0 ? <Empty title="No tests" hint="Create a test to offer learners a timed mock." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>Test</Th><Th>Category</Th><Th>Questions</Th><Th>Duration</Th><Th>Pass</Th><Th>Access</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-brand-wash/40">
                  <Td><p className="font-semibold">{t.title}</p>{t.blueprint && <p className="text-xs text-ink/50">random draw ×{t.blueprint.count}</p>}</Td>
                  <Td className="text-ink/60">{cats.data?.results.find((c) => c.id === t.category)?.name ?? `#${t.category}`}</Td>
                  <Td>{t.question_count}</Td>
                  <Td>{t.duration_minutes} min</Td>
                  <Td>{t.pass_percentage}%</Td>
                  <Td>{t.is_premium ? <Badge tone="warn">premium</Badge> : <Badge tone="good">free</Badge>}</Td>
                  <Td>{t.is_published ? <Badge tone="good">published</Badge> : <Badge tone="muted">draft</Badge>}</Td>
                  <Td className="text-right"><div className="flex flex-wrap justify-end gap-2">
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => open(t)}>Edit</button>
                    {t.is_published
                      ? <button className="btn-ghost !px-3 !py-1.5 text-xs !text-amber-700" onClick={() => publish(t, false)}>Unpublish</button>
                      : <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => publish(t, true)}>Publish</button>}
                    <ConfirmButton label="Delete" confirmLabel="Delete this test? Attempts history is preserved." onConfirm={() => remove(t)} />
                  </div></Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {editing && (
        <Modal title={editing === "new" ? "New public test" : `Edit ${editing.title}`} onClose={() => setEditing(null)} wide>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, question_ids: [] }))}>
                  <option value="">Select…</option>
                  {cats.data?.results.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></Field>
              <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            </div>
            <Field label="Description"><textarea className="input min-h-[60px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Duration (min)"><input className="input" type="number" min="1" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} /></Field>
              <Field label="Pass %"><input className="input" type="number" min="0" max="100" value={form.pass_percentage} onChange={(e) => setForm((f) => ({ ...f, pass_percentage: e.target.value }))} /></Field>
              <Field label="Negative marks"><input className="input" type="number" min="0" step="0.25" value={form.negative_marks} onChange={(e) => setForm((f) => ({ ...f, negative_marks: e.target.value }))} /></Field>
              <Field label="Max attempts (0 = unlimited)"><input className="input" type="number" min="0" value={form.max_attempts} onChange={(e) => setForm((f) => ({ ...f, max_attempts: e.target.value }))} /></Field>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_premium} onChange={(e) => setForm((f) => ({ ...f, is_premium: e.target.checked }))} /> Premium only</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.useBlueprint} onChange={(e) => setForm((f) => ({ ...f, useBlueprint: e.target.checked }))} /> Random blueprint instead of fixed questions</label>
            </div>
            {form.useBlueprint && (
              <div className="grid gap-4 rounded-xl bg-brand-wash/60 p-4 sm:grid-cols-2">
                <Field label="Questions per attempt"><input className="input" type="number" min="1" value={form.bpCount} onChange={(e) => setForm((f) => ({ ...f, bpCount: e.target.value }))} /></Field>
                <Field label="Difficulty (optional)">
                  <select className="input" value={form.bpDifficulty} onChange={(e) => setForm((f) => ({ ...f, bpDifficulty: e.target.value }))}>
                    <option value="">Any</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </select></Field>
              </div>)}
            {!form.useBlueprint && bankCat && (
              <fieldset><legend className="label">Questions ({form.question_ids.length} selected)</legend>
                {questions.loading ? <Skeleton className="h-32" /> : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-brand/15 p-2">
                    {questions.data?.results.map((x) => (
                      <label key={x.id} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-brand-soft ${!x.is_active ? "opacity-50" : ""}`}>
                        <input type="checkbox" className="mt-1" checked={form.question_ids.includes(x.id)} onChange={() => toggleQ(x.id)} />
                        <span>{x.prompt}<span className="ml-2 text-xs text-ink/50">{x.difficulty}{!x.is_active ? " · inactive" : ""}</span></span>
                      </label>))}
                    {questions.data?.results.length === 0 && <p className="p-3 text-sm text-ink/50">No questions in this category yet.</p>}
                  </div>)}
              </fieldset>)}
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save test"}</button>
            </div>
          </div>
        </Modal>)}
    </div>
  );
}
