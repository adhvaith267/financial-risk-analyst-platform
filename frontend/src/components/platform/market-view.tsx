import { useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { runMarketAnalysis, RiskoraApiError, type MarketResult } from "@/lib/riskora-api";
import {
  ColumnChart,
  EmptyState,
  ErrorState,
  Field,
  LineChart,
  LoadingState,
  Metric,
  Panel,
  ResultBlock,
  ViewHeader,
} from "./ui";
import { asMoney, asPct, buttonClass, inputClass } from "./presentation";

export function MarketRiskView() {
  const [portfolioId, setPortfolioId] = useState("");
  const [confidence, setConfidence] = useState("95");
  const [window, setWindow] = useState("250");
  const [validation, setValidation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<MarketResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!portfolioId.trim()) {
      setValidation("Select a portfolio before running the market engine.");
      return;
    }
    setValidation("");
    setStatus("loading");
    setError("");
    try {
      const data = await runMarketAnalysis({
        portfolio_id: portfolioId.trim(),
        confidence_level: Number(confidence) / 100,
        lookback_days: Number(window) || 250,
      });
      setResult(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  const composition = result?.composition ?? [];
  const points = result?.history.map(({ value }) => value) ?? [];

  return (
    <div className="space-y-8">
      <ViewHeader
        title="Market risk"
        subtitle="Portfolio volatility, value at risk, expected shortfall, drawdown, composition, and market sensitivity."
      />

      <Panel title="Analysis controls">
        <form
          onSubmit={onSubmit}
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] md:items-end"
        >
          <Field label="Portfolio">
            <input
              className={inputClass}
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              placeholder="P001"
            />
          </Field>
          <Field label="Confidence (%)">
            <input
              className={inputClass}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
            />
          </Field>
          <Field label="Lookback (days)">
            <input
              className={inputClass}
              value={window}
              onChange={(e) => setWindow(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
            />
          </Field>
          <button type="submit" className={buttonClass} disabled={status === "loading"}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Run analysis
          </button>
        </form>
        {validation ? (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {validation}
          </p>
        ) : null}
      </Panel>

      {status === "idle" ? (
        <EmptyState label="No analysis yet. Select a portfolio and run the market engine." />
      ) : null}
      {status === "loading" ? <LoadingState label="Running the market engine…" /> : null}
      {status === "error" ? <ErrorState message={error} /> : null}

      {status === "ready" && result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Value at risk"
              value={asMoney(result.var)}
              hint={result.var_confidence}
            />
            <Metric label="Expected shortfall" value={asMoney(result.expected_shortfall)} />
            <Metric label="Volatility" value={asPct(result.volatility)} />
            <Metric label="Maximum drawdown" value={asPct(result.max_drawdown)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Portfolio composition">
              {composition.length > 0 ? (
                <ColumnChart data={composition} />
              ) : (
                <EmptyState label="No composition returned." />
              )}
            </Panel>
            <Panel title="Historical value">
              {points.length > 1 ? (
                <LineChart points={points} />
              ) : (
                <EmptyState label="No historical series returned." />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Risk contribution">
              {result.risk_contributions ? (
                <ResultBlock data={result.risk_contributions} />
              ) : (
                <EmptyState label="No contributions returned." />
              )}
            </Panel>
            <Panel title="Concentration / correlation">
              {result.concentration ? (
                <ResultBlock data={result.concentration} />
              ) : (
                <EmptyState label="No concentration data returned." />
              )}
            </Panel>
            <Panel title="Evidence and explanation">
              {result.explanation ? (
                <ResultBlock data={result.explanation} />
              ) : (
                <EmptyState label="No explanation returned." />
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
