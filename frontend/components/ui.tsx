import { ReactNode } from "react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-ink/60">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-brand/10 ${className}`} aria-hidden />;
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink/60">{hint}</p>}
      {action}
    </div>
  );
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex items-center justify-between gap-4 border-bad/30 p-4 text-sm text-bad">
      <span>{message}</span>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

/** Inline SVG line chart: zero dependencies, data from the API. */
export function LineChart({ data, height = 120 }: { data: number[]; height?: number }) {
  if (data.length < 2) return <p className="py-6 text-sm text-ink/50">Take two or more tests to see your trend.</p>;
  const w = 400, max = 100, step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - (v / max) * (height - 12) - 6] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img" aria-label={`Score trend: ${data.join(", ")} percent`}>
      <path d={`${d} L${w},${height} L0,${height} Z`} className="fill-brand/10" />
      <path d={d} className="fill-none stroke-brand" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" className="fill-white stroke-brand" strokeWidth="2" />)}
    </svg>
  );
}

export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <p className="py-4 text-sm text-ink/50">No results yet.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-sm"><span>{r.label}</span><span className="font-semibold">{r.value}%</span></div>
          <div className="h-2 rounded-full bg-brand/10"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(r.value, 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
