"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Field } from "@/components/ui";

export default function Register() {
  const { login } = useAuth();
  const router = useRouter();
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")), password = String(f.get("password"));
    setBusy(true); setErr("");
    try {
      await api("/auth/register/", { body: { full_name: f.get("full_name"), email, password } });
      await login(email, password, "public");
      router.replace("/dashboard");
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-7">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <Field label="Full name"><input name="full_name" required className="input" autoComplete="name" /></Field>
        <Field label="Email"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
        <Field label="Password (8+ characters)"><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        <p className="text-center text-sm text-ink/60">Already registered? <Link href="/login" className="font-semibold text-brand">Sign in</Link></p>
      </form>
    </div>
  );
}
