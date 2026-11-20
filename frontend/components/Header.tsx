"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";

function Bell() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = () => api<{ unread: number }>("/notifications/unread-count/").then((d) => alive && setN(d.unread)).catch(() => {});
    tick();
    const t = setInterval(() => document.visibilityState === "visible" && tick(), 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <Link href="/notifications" className="relative rounded-xl p-2 hover:bg-brand-soft" aria-label={`Notifications, ${n} unread`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      </svg>
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-[18px] text-white">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}

const NAV: Record<string, { href: string; label: string }[]> = {
  public_user: [{ href: "/dashboard", label: "Dashboard" }, { href: "/tests", label: "Tests" }],
  student: [{ href: "/student", label: "My exams" }],
  teacher: [{ href: "/school", label: "Overview" }, { href: "/school/questions", label: "Questions" }, { href: "/school/exams", label: "Exams" }],
  school_admin: [{ href: "/school", label: "Overview" }, { href: "/school/students", label: "Students" }, { href: "/school/questions", label: "Questions" }, { href: "/school/exams", label: "Exams" }],
  super_admin: [{ href: "/admin", label: "Console" }],
};

export default function Header() {
  const { user, logout } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const links = user ? NAV[user.role] ?? [] : [{ href: "/tests", label: "Tests" }, { href: "/school-signup", label: "For schools" }];

  return (
    <header className="sticky top-0 z-30 border-b border-brand/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={user ? homeFor(user.role) : "/"} className="flex items-center gap-2 text-lg font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">TG</span> Talent Gauge
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}
              className={`rounded-xl px-3 py-2 text-sm font-medium hover:bg-brand-soft ${path === l.href ? "bg-brand-soft text-brand" : ""}`}>{l.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (<><Bell /><button onClick={logout} className="btn-ghost hidden md:inline-flex">Sign out</button></>) : (
            <><Link href="/login" className="btn-ghost hidden md:inline-flex">Sign in</Link><Link href="/register" className="btn-primary hidden md:inline-flex">Get started</Link></>)}
          <button className="rounded-xl p-2 md:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-brand/10 bg-white p-3 md:hidden">
          {links.map((l) => <Link key={l.href} href={l.href} className="block rounded-xl px-3 py-3 font-medium hover:bg-brand-soft">{l.label}</Link>)}
          {user ? <button onClick={logout} className="mt-2 w-full rounded-xl px-3 py-3 text-left font-medium text-bad">Sign out</button>
            : <Link href="/login" className="block rounded-xl px-3 py-3 font-medium">Sign in</Link>}
        </div>
      )}
    </header>
  );
}
