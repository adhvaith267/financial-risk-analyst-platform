import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bot, LineChart as LineIcon, RefreshCw, Waves } from "lucide-react";
import { getDashboardSummary, RiskoraApiError, type DashboardSummary } from "@/lib/riskora-api";
import {
  BarRow,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  ViewHeader,
} from "./ui";
import type { PlatformView } from "./types";
import { asMoney, asPct, ghostButtonClass } from "./presentation";

const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

const QUICK_ACTIONS: { view: PlatformView; label: string; icon: typeof BarChart3 }[] = [
  { view: "credit", label: "Credit risk", icon: BarChart3 },
  { view: "market", label: "Market risk", icon: LineIcon },
  { view: "stress", label: "Stress testing", icon: Waves },
  { view: "ai", label: "Riskora AI", icon: Bot },
];

function Drivers({ data }: { data: DashboardSummary["top_risk_drivers"] }) {
  if (data.length === 0) return <EmptyState label="No drivers returned." />;

  const total = data.reduce((sum, driver) => sum + driver.contribution, 0) || 1;
  const max = Math.max(...data.map((driver) => driver.contribution), 0.0001);
  return (
    <div className="divide-y divide-hairline/60">
      {data.map((driver) => (
        <BarRow
          key={driver.name}
          label={driver.name}
          value={`${((driver.contribution / total) * 100).toFixed(1)}% of portfolio risk`}
          ratio={driver.contribution / max}
        />
      ))}
    </div>
  );
}

function RecentAnalyses({ data }: { data: DashboardSummary["recent_analyses"] }) {
  if (data.length === 0) return <EmptyState label="No recent analyses." />;

  const keys = Object.keys(data[0]);
  return (
    <DataTable
      columns={keys.map((key, index) => ({
        key,
        label: key.replace(/_/g, " "),
        align: index === keys.length - 1 ? "right" : "left",
      }))}
      rows={data}
    />
  );
}

export function DashboardView({ onNavigate }: { onNavigate: (view: PlatformView) => void }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const result = await getDashboardSummary();
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

  const isEmpty = status === "ready" && !data;

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
            <Metric label="Value at risk" value={asMoney(data.var)} hint={data.var_confidence} />
            <Metric label="Expected shortfall" value={asMoney(data.expected_shortfall)} />
            <Metric label="Annualized volatility" value={asPct(data.annualized_volatility)} />
            <Metric label="Maximum drawdown" value={asPct(data.max_drawdown)} />
            <Metric label="Signals monitored" value={show(data.signals_monitored)} />
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
