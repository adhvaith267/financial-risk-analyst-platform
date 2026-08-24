import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bot, LineChart as LineIcon, RefreshCw, Waves } from "lucide-react";
import { getDashboardSummary, RiskoraApiError } from "@/lib/riskora-api";
import {
  BarRow,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  ResultBlock,
  ViewHeader,
} from "./ui";
import type { PlatformView } from "./types";
import { asMoney, asPct, ghostButtonClass } from "./presentation";

type Driver = { name?: string; label?: string; contribution?: number; value?: number };

type Summary = Record<string, unknown> & {
  portfolio_value?: unknown;
  total_exposure?: unknown;
  high_risk_borrowers?: unknown;
  var?: unknown;
  var_confidence?: unknown;
  expected_shortfall?: unknown;
  annualized_volatility?: unknown;
  max_drawdown?: unknown;
  top_risk_drivers?: unknown;
  recent_analyses?: unknown;
};

const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

const QUICK_ACTIONS: { view: PlatformView; label: string; icon: typeof BarChart3 }[] = [
  { view: "credit", label: "Credit risk", icon: BarChart3 },
  { view: "market", label: "Market risk", icon: LineIcon },
  { view: "stress", label: "Stress testing", icon: Waves },
  { view: "ai", label: "Riskora AI", icon: Bot },
];

function Drivers({ data }: { data: unknown }) {
  if (Array.isArray(data)) {
    const rows = (data as Driver[]).map((d) => ({
      name: d.name ?? d.label ?? "—",
      contribution: Number(d.contribution ?? d.value ?? 0),
    }));
    const total = rows.reduce((a, r) => a + r.contribution, 0) || 1;
    const max = Math.max(...rows.map((r) => r.contribution), 0.0001);
    return (
      <div className="divide-y divide-hairline/60">
        {rows.map((r) => (
          <BarRow
            key={r.name}
            label={r.name}
            value={`${((r.contribution / total) * 100).toFixed(1)}% of portfolio risk`}
            ratio={r.contribution / max}
          />
        ))}
      </div>
    );
  }
  if (data && typeof data === "object") return <ResultBlock data={data} />;
  return <EmptyState label="No drivers returned." />;
}

function RecentAnalyses({ data }: { data: unknown }) {
  if (Array.isArray(data) && data.length > 0) {
    const rows = data as Record<string, unknown>[];
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return (
      <DataTable
        columns={keys.map((k, i) => ({
          key: k,
          label: k.replace(/_/g, " "),
          align: i === keys.length - 1 ? "right" : "left",
        }))}
        rows={rows}
      />
    );
  }
  if (data && typeof data === "object") return <ResultBlock data={data} />;
  return <EmptyState label="No recent analyses." />;
}

export function DashboardView({ onNavigate }: { onNavigate: (view: PlatformView) => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const result = await getDashboardSummary<Summary>();
      setData(result);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isEmpty = status === "ready" && (!data || Object.keys(data).length === 0);

  return (
    <div className="space-y-8">
      <ViewHeader
        title="Dashboard"
        subtitle="One operating view of portfolio exposure, market movement, and credit quality."
        actions={
          <button type="button" onClick={() => void load()} className={ghostButtonClass}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {status === "loading" ? <LoadingState label="Loading portfolio summary…" /> : null}
      {status === "error" ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {isEmpty ? <EmptyState label="The summary endpoint returned no data yet." /> : null}

      {status === "ready" && data && !isEmpty ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Portfolio value" value={asMoney(data.portfolio_value)} />
            <Metric label="Total exposure" value={asMoney(data.total_exposure)} />
            <Metric label="High-risk borrowers" value={show(data.high_risk_borrowers)} />
            <Metric
              label="Value at risk"
              value={asMoney(data.var ?? data["value_at_risk"])}
              hint={data.var_confidence ? String(data.var_confidence) : undefined}
            />
            <Metric label="Expected shortfall" value={asMoney(data.expected_shortfall)} />
            <Metric label="Annualized volatility" value={asPct(data.annualized_volatility)} />
            <Metric label="Maximum drawdown" value={asPct(data.max_drawdown)} />
            <Metric label="Signals monitored" value={show(data["signals_monitored"] ?? "—")} />
          </div>

          <Panel title="Top risk drivers — share of portfolio risk">
            <Drivers data={data.top_risk_drivers} />
          </Panel>

          <Panel title="Recent analyses">
            <RecentAnalyses data={data.recent_analyses} />
          </Panel>
        </>
      ) : null}

      <Panel title="Quick actions">
        <div className="flex flex-wrap gap-3">
          {QUICK_ACTIONS.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
              className={ghostButtonClass}
            >
              <Icon className="h-4 w-4 text-lime" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
