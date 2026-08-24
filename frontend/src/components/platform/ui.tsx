import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function ViewHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
      <div>
        <h1 className="text-3xl leading-none text-foreground">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-hairline bg-forest p-5 ${className}`}>
      {title ? (
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-forest p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="num mt-3 text-2xl text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Running the engine…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-forest p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-lime" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-foreground"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
        The request did not complete
      </p>
      <p className="mt-2 text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-hairline-strong px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-forest-raised"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-hairline-strong p-8 text-sm text-muted-foreground">
      <Inbox className="h-4 w-4" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

/** Renders whatever shape the backend returns, without inventing values. */
export function ResultBlock({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  if (typeof data !== "object") {
    return <p className="num text-sm text-foreground">{String(data)}</p>;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <dl className="divide-y divide-hairline">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-wrap items-start justify-between gap-4 py-2.5">
          <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {key.replace(/_/g, " ")}
          </dt>
          <dd className="num max-w-[60%] break-words text-right text-sm text-foreground">
            {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- charts ---------- */

/** Horizontal contribution bar. */
export function BarRow({
  label,
  value,
  ratio,
  tone = "lime",
}: {
  label: string;
  value: string;
  ratio: number;
  tone?: "lime" | "muted";
}) {
  const width = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm text-foreground">{label}</span>
        <span className="num text-xs text-muted-foreground">{value}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background:
              tone === "lime" ? "var(--lime)" : "color-mix(in oklch, var(--lime) 45%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

/** Simple data table with mono numerals. */
export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, unknown>[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-hairline/60 last:border-b-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-3 py-3 text-foreground/90 ${
                    c.align === "right" ? "num text-right" : ""
                  }`}
                >
                  {row[c.key] === undefined || row[c.key] === null ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vertical bar chart. */
export function ColumnChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-56 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="num text-[10px] text-muted-foreground">
            {d.value >= 1000 ? `$${Math.round(d.value / 1000)}k` : d.value.toFixed(0)}
          </span>
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${(d.value / max) * 100}%`,
              background: "color-mix(in oklch, var(--lime) 80%, transparent)",
            }}
          />
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Line chart with optional threshold line. */
export function LineChart({
  points,
  threshold,
  thresholdLabel,
}: {
  points: number[];
  threshold?: number | undefined;
  thresholdLabel?: string | undefined;
}) {
  if (points.length < 2) return <EmptyState label="No series returned." />;
  const min = Math.min(...points, ...(threshold !== undefined ? [threshold] : []));
  const max = Math.max(...points, ...(threshold !== undefined ? [threshold] : []));
  const span = max - min || 1;
  const y = (v: number) => 100 - ((v - min) / span) * 100;
  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * 100).toFixed(2)} ${y(v).toFixed(2)}`,
    )
    .join(" ");
  const area = `${d} L100 100 L0 100 Z`;

  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-56 w-full">
        <path d={area} fill="color-mix(in oklch, var(--lime) 12%, transparent)" />
        <path
          d={d}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {threshold !== undefined ? (
          <line
            x1="0"
            x2="100"
            y1={y(threshold)}
            y2={y(threshold)}
            stroke="var(--destructive)"
            strokeWidth="1"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {threshold !== undefined && thresholdLabel ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">
          {thresholdLabel}
        </p>
      ) : null}
    </div>
  );
}

/** Radial gauge with a decision threshold marker. */
export function Gauge({
  value,
  max,
  threshold,
  label,
  caption,
}: {
  value: number;
  max: number;
  threshold?: number | undefined;
  label: string;
  caption?: string | undefined;
}) {
  const r = 46;
  const circ = Math.PI * r; // half circle
  const clamp = (n: number) => Math.max(0, Math.min(1, n / max));
  const angle = (n: number) => 180 * clamp(n);
  const tx = 50 + r * Math.cos(Math.PI - (Math.PI * angle(threshold ?? 0)) / 180);
  const ty = 55 - r * Math.sin(Math.PI - (Math.PI * angle(threshold ?? 0)) / 180);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 62" className="w-full max-w-xs">
        <path
          d={`M4 55 A ${r} ${r} 0 0 1 96 55`}
          fill="none"
          stroke="color-mix(in oklch, var(--foreground) 12%, transparent)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d={`M4 55 A ${r} ${r} 0 0 1 96 55`}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circ * clamp(value)} ${circ}`}
        />
        {threshold !== undefined ? (
          <line
            x1={tx}
            y1={ty}
            x2={50 + (r + 8) * Math.cos(Math.PI - (Math.PI * angle(threshold)) / 180)}
            y2={55 - (r + 8) * Math.sin(Math.PI - (Math.PI * angle(threshold)) / 180)}
            stroke="var(--destructive)"
            strokeWidth="1.5"
          />
        ) : null}
      </svg>
      <p className="num -mt-4 text-3xl text-foreground">{label}</p>
      {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
