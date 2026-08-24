import { useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { runStressTest, RiskoraApiError, type StressResult } from "@/lib/riskora-api";
import {
  BarRow,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Metric,
  Panel,
  ResultBlock,
  ViewHeader,
} from "./ui";
import { asMoney, asPct, buttonClass, inputClass } from "./presentation";

const SCENARIOS = [
  { id: "recession", label: "Recession" },
  { id: "equity_shock", label: "Equity shock" },
  { id: "rate_shock", label: "Interest-rate shock" },
  { id: "fx_shock", label: "FX shock" },
  { id: "credit_deterioration", label: "Credit deterioration" },
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="num text-sm text-lime">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-lime"
      />
    </div>
  );
}

export function StressTestingView() {
  const [targetId, setTargetId] = useState("");
  const [selected, setSelected] = useState<string[]>(["recession"]);
  const [equityShock, setEquityShock] = useState(-20);
  const [rateShock, setRateShock] = useState(200);
  const [defaultShock, setDefaultShock] = useState(2);
  const [validation, setValidation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<StressResult | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!targetId.trim()) {
      setValidation("Enter the portfolio or borrower the scenario applies to.");
      return;
    }
    if (selected.length === 0) {
      setValidation("Select at least one scenario.");
      return;
    }
    setValidation("");
    setStatus("loading");
    setError("");
    try {
      const data = await runStressTest({
        target_id: targetId.trim(),
        scenarios: selected,
        equity_shock_pct: equityShock,
        rate_shock_bps: rateShock,
        default_rate_shock_pct: defaultShock,
      });
      setResult(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  const baseline = result?.baseline_value;
  const stressed = result?.stressed_value;

  return (
    <div className="space-y-8">
      <ViewHeader
        title="Stress testing"
        subtitle="Model equity, interest-rate, and default-rate shocks to understand how exposure changes under pressure."
      />

      <Panel title="Scenario configuration">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Field label="Portfolio / borrower">
              <input
                className={inputClass}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="P001"
              />
            </Field>
            <button type="submit" className={buttonClass} disabled={status === "loading"}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Run stress test
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Slider
              label="Equity shock"
              value={equityShock}
              min={-60}
              max={0}
              step={1}
              suffix="%"
              onChange={setEquityShock}
            />
            <Slider
              label="Rate shock"
              value={rateShock}
              min={-300}
              max={500}
              step={25}
              suffix=" bps"
              onChange={setRateShock}
            />
            <Slider
              label="Default-rate shock"
              value={defaultShock}
              min={0}
              max={10}
              step={0.5}
              suffix="%"
              onChange={setDefaultShock}
            />
          </div>

          <fieldset>
            <legend className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Scenarios
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {SCENARIOS.map((s) => {
                const active = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(s.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      active
                        ? "border-lime/60 bg-forest-raised text-lime"
                        : "border-hairline-strong text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>
        {validation ? (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {validation}
          </p>
        ) : null}
      </Panel>

      {status === "idle" ? (
        <EmptyState label="No stress run yet. Configure a scenario and run the engine." />
      ) : null}
      {status === "loading" ? <LoadingState label="Running the stress engine…" /> : null}
      {status === "error" ? <ErrorState message={error} /> : null}

      {status === "ready" && result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Market loss" value={asMoney(result.market_loss)} />
            <Metric label="Credit loss" value={asMoney(result.credit_loss)} />
            <Metric label="Total loss" value={asMoney(result.total_loss)} />
            <Metric label="Portfolio impact" value={asPct(result.loss_pct)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Baseline vs stressed portfolio value">
              {baseline !== undefined && stressed !== undefined ? (
                <div className="divide-y divide-hairline/60">
                  <BarRow label="Baseline" value={asMoney(baseline)} ratio={1} tone="muted" />
                  <BarRow label="Stressed" value={asMoney(stressed)} ratio={stressed / baseline} />
                </div>
              ) : (
                <EmptyState label="No portfolio values returned." />
              )}
            </Panel>
            <Panel title="Scenario comparison">
              {result.scenario_comparison ? (
                <ResultBlock data={result.scenario_comparison} />
              ) : (
                <EmptyState label="No comparison returned." />
              )}
            </Panel>
          </div>

          <Panel title="What changed">
            {result.explanation ? (
              <ResultBlock data={result.explanation} />
            ) : (
              <EmptyState label="No explanation returned." />
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
