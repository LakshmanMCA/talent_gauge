"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, errorText } from "@/lib/api";
import { Field } from "@/components/ui";

export default function SchoolSignup() {
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/schools/register/", { body: Object.fromEntries(new FormData(e.currentTarget)) }); setDone(true); }
    catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }
  if (done) return (
    <div className="card mx-auto max-w-lg p-8 text-center"><h1 className="text-2xl font-bold">Application received</h1>
      <p className="mt-2 text-ink/70">Our team will review your school. You can sign in through the School portal once it is approved.</p>
      <Link href="/" className="btn-primary mt-5">Back home</Link></div>);
  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-4 p-7">
      <h1 className="text-2xl font-bold">Register your school</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School name"><input name="school_name" required className="input" /></Field>
        <Field label="Registration number"><input name="registration_number" required className="input" /></Field>
        <Field label="School email"><input name="school_email" type="email" required className="input" /></Field>
        <Field label="Phone"><input name="phone" className="input" /></Field>
      </div>
      <Field label="Address"><textarea name="address" rows={2} className="input" /></Field>
      <h2 className="pt-2 font-semibold">School administrator</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Full name"><input name="admin_name" required className="input" /></Field>
        <Field label="Email"><input name="admin_email" type="email" required className="input" /></Field>
        <Field label="Password"><input name="admin_password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit for approval"}</button>
    </form>
  );
}
