"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { errorText } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { Field } from "@/components/ui";

const PORTALS = [["public", "Learner"], ["school", "School"], ["platform", "Platform admin"]] as const;

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [portal, setPortal] = useState<"public" | "school" | "platform">("public");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const u = await login(String(f.get("email")), String(f.get("password")), portal);
      router.replace(homeFor(u.role));
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-7">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <div role="tablist" aria-label="Portal" className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-brand-soft p-1">
          {PORTALS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={portal === k} onClick={() => setPortal(k)}
              className={`rounded-lg px-2 py-2 text-sm font-medium ${portal === k ? "bg-white text-brand shadow-sm" : "text-ink/60"}`}>{l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Email"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
          <Field label="Password">
            <div className="relative">
              <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" className="input pr-16" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-sm font-medium text-brand">{show ? "Hide" : "Show"}</button>
            </div>
          </Field>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-center text-sm text-ink/60">New learner? <Link href="/register" className="font-semibold text-brand">Create an account</Link></p>
      </div>
    </div>
  );
}
