"use client";
import { useState } from "react";
import { api, errorText, Page } from "@/lib/api";
import { useRequireRole } from "@/lib/auth";
import { useFetch } from "@/lib/hooks";
import { Empty, ErrorBox, Field, Skeleton } from "@/components/ui";
import { Badge, ConfirmButton, Modal, PageHeader, Td, Th } from "@/components/admin";

type C = { id: number; parent: number | null; name: string; slug: string; description: string;
  icon: string; is_published: boolean; position: number; test_count: number };
type Form = { name: string; slug: string; parent: string; description: string; icon: string; position: string; is_published: boolean };
const blank: Form = { name: "", slug: "", parent: "", description: "", icon: "", position: "0", is_published: true };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function Categories() {
  const { user } = useRequireRole(["super_admin"]);
  const list = useFetch<Page<C>>(user ? "/public/admin/categories/" : null);
  const [editing, setEditing] = useState<C | null | "new">(null);
  const [form, setForm] = useState<Form>(blank);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function open(c: C | null) {
    setEditing(c ?? "new");
    setForm(c ? { name: c.name, slug: c.slug, parent: c.parent ? String(c.parent) : "", description: c.description,
      icon: c.icon, position: String(c.position), is_published: c.is_published } : blank);
    setErr("");
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) { setErr("Name and slug are required."); return; }
    setBusy(true); setErr("");
    const body = { name: form.name.trim(), slug: form.slug.trim(), parent: form.parent ? Number(form.parent) : null,
      description: form.description, icon: form.icon, position: Number(form.position) || 0, is_published: form.is_published };
    try {
      if (editing === "new") await api("/public/admin/categories/", { body });
      else await api(`/public/admin/categories/${(editing as C).id}/`, { method: "PATCH", body });
      setEditing(null); list.reload();
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  async function remove(c: C) {
    try { await api(`/public/admin/categories/${c.id}/`, { method: "DELETE" }); list.reload(); }
    catch (e) { setErr(errorText(e)); }
  }
  if (!user) return null;
  const cats = list.data?.results ?? [];
  const nameOf = (id: number | null) => cats.find((c) => c.id === id)?.name ?? "—";
  return (
    <div className="space-y-6">
      <PageHeader title="Public categories" hint="Top-level and nested categories learners browse. Unpublished categories are hidden." actions={
        <button className="btn-primary" onClick={() => open(null)}>+ New category</button>} />
      {err && !editing && <p role="alert" className="text-sm text-bad">{err}</p>}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.loading ? <Skeleton className="h-64" /> : cats.length === 0 ? <Empty title="No categories yet" hint="Create the first category learners will see." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-brand/10 bg-brand-wash/60"><tr>
              <Th>Category</Th><Th>Parent</Th><Th>Tests</Th><Th>Order</Th><Th>Status</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody className="divide-y divide-brand/10">
              {cats.map((c) => (
                <tr key={c.id} className="hover:bg-brand-wash/40">
                  <Td><p className="font-semibold">{c.icon ? `${c.icon} ` : ""}{c.name}</p><p className="text-xs text-ink/50">/{c.slug}</p></Td>
                  <Td className="text-ink/60">{nameOf(c.parent)}</Td>
                  <Td>{c.test_count}</Td>
                  <Td>{c.position}</Td>
                  <Td>{c.is_published ? <Badge tone="good">published</Badge> : <Badge tone="muted">hidden</Badge>}</Td>
                  <Td className="text-right"><div className="flex justify-end gap-2">
                    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => open(c)}>Edit</button>
                    <ConfirmButton label="Delete" confirmLabel={`Delete "${c.name}"? Tests using it will block deletion.`} onConfirm={() => remove(c)} />
                  </div></Td>
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {editing && (
        <Modal title={editing === "new" ? "New category" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing === "new" && !f.slug ? slugify(e.target.value) : f.slug }))} /></Field>
              <Field label="Slug"><input className="input font-mono" value={form.slug} onChange={set("slug")} /></Field>
              <Field label="Parent category">
                <select className="input" value={form.parent} onChange={set("parent")}>
                  <option value="">— top level —</option>
                  {cats.filter((c) => editing !== "new" && c.id !== (editing as C).id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></Field>
              <Field label="Icon (emoji or short text)"><input className="input" value={form.icon} onChange={set("icon")} placeholder="e.g. 🧮" /></Field>
              <Field label="Position"><input className="input" type="number" min={0} value={form.position} onChange={set("position")} /></Field>
              <Field label="Status">
                <select className="input" value={String(form.is_published)} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.value === "true" }))}>
                  <option value="true">Published</option><option value="false">Hidden</option>
                </select></Field>
            </div>
            <Field label="Description"><textarea className="input min-h-[70px]" value={form.description} onChange={set("description")} /></Field>
            {err && <p role="alert" className="text-sm text-bad">{err}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save category"}</button>
            </div>
          </div>
        </Modal>)}
    </div>
  );
}
