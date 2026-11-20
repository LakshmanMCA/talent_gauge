"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth, useRequireRole } from "@/lib/auth";
import { Spinner } from "./ui";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/admin", label: "Overview", icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" /> },
  { href: "/admin/schools", label: "Schools", icon: <Icon d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /> },
  { href: "/admin/content/categories", label: "Categories", icon: <Icon d="M4 6h16M4 12h16M4 18h10" /> },
  { href: "/admin/content/questions", label: "Question bank", icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  { href: "/admin/content/tests", label: "Public tests", icon: <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4" /> },
  { href: "/admin/users", label: "Users", icon: <Icon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  { href: "/admin/audit", label: "Audit log", icon: <Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /> },
  { href: "/admin/system", label: "System", icon: <Icon d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /> },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Sidebar console shell for the Super Admin portal (doc §3.3). */
export function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading } = useRequireRole(["super_admin"]);
  const { logout } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  if (loading || !user) return <Spinner label="Loading console" />;

  const item = (n: typeof NAV[number]) => {
    const active = path === n.href || (n.href !== "/admin" && path.startsWith(n.href));
    return (
      <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-brand text-white shadow-sm" : "text-ink/70 hover:bg-brand-soft hover:text-brand"}`}>
        <span className="shrink-0 [&>svg]:block">{n.icon}</span>{n.label}
      </Link>
    );
  };

  return (
    <div className="-mx-4 -my-8 md:flex">
      <button className="btn-ghost fixed bottom-4 right-4 z-40 shadow-lg md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Close menu" : "Menu"}
      </button>
      <aside className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-brand/10 bg-white p-4 pt-20 md:static md:z-auto md:flex md:pt-4`}>
        <p className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-ink/40">Platform console</p>
        <nav className="flex-1 space-y-1 overflow-y-auto">{NAV.map(item)}</nav>
        <div className="mt-4 border-t border-brand/10 pt-4">
          <p className="truncate px-3 text-sm font-semibold">{user.full_name}</p>
          <p className="truncate px-3 text-xs text-ink/50">{user.email}</p>
          <button onClick={logout} className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-bad hover:bg-bad/10">Sign out</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-ink/30 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}

export function PageHeader({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>{hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "good" | "warn" | "bad" | "muted" }) {
  const tones = {
    brand: "bg-brand-soft text-brand", good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800", bad: "bg-red-100 text-red-700", muted: "bg-ink/10 text-ink/60",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`card w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-brand-soft" aria-label="Close">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className = "btn-danger", children }: {
  label: string; confirmLabel?: string; onConfirm: () => void; className?: string; children?: ReactNode;
}) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button className={className} onClick={() => setAsk(true)}>{label}</button>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-ink/60">{confirmLabel ?? "Are you sure?"}</span>
      <button className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => { setAsk(false); onConfirm(); }}>Yes, {label.toLowerCase()}</button>
      <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setAsk(false)}>Cancel</button>
    </span>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink/50 ${className}`}>{children}</th>;
}
export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
