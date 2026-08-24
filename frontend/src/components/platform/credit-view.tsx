import { useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { runCreditAnalysis, RiskoraApiError, type CreditResult } from "@/lib/riskora-api";
import {
  EmptyState,
  ErrorState,
  Field,
  Gauge,
  LoadingState,
  Metric,
  Panel,
  ResultBlock,
  ViewHeader,
} from "./ui";
import { asMoney, asPct, buttonClass, inputClass } from "./presentation";

const show = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

export function CreditRiskView() {
  const [borrowerId, setBorrowerId] = useState("");
  const [horizon, setHorizon] = useState("12");
  const [validation, setValidation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreditResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!borrowerId.trim()) {
      setValidation("Enter a borrower or entity identifier to run the credit engine.");
      return;
    }
    setValidation("");
    setStatus("loading");
    setError("");
    try {
      const data = await runCreditAnalysis({ borrower_id: borrowerId.trim() });
      setResult(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof RiskoraApiError ? err.message : "Unexpected error.");
      setStatus("error");
    }
  }

  const pd =
    typeof result?.probability_of_default === "number" ? result.probability_of_default : undefined;
  const threshold =
    typeof result?.decline_threshold === "number" ? result.decline_threshold : undefined;

  return (
    <div className="space-y-8">
      <ViewHeader
        title="Credit risk"
        subtitle="Borrower exposure through probability of default, loss given default, exposure at default, expected loss, and the drivers behind the grade."
      />

      <Panel title="Analysis inputs">
        <form
          onSubmit={onSubmit}
          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end"
        >
          <Field label="Borrower / entity">
            <input
              className={inputClass}
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              placeholder="B1001"
              aria-invalid={Boolean(validation)}
            />
          </Field>
          <Field label="Horizon (months)">
            <input
              className={inputClass}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value.replace(/[^\d]/g, ""))}
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
        <EmptyState label="No analysis yet. Choose a borrower and run the credit engine." />
      ) : null}
      {status === "loading" ? <LoadingState label="Running the credit engine…" /> : null}
      {status === "error" ? <ErrorState message={error} /> : null}

      {status === "ready" && result ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Panel title="Borrower profile">
              {result.borrower_profile ? (
                <ResultBlock data={result.borrower_profile} />
              ) : (
                <EmptyState label="No borrower profile returned." />
              )}
            </Panel>

            <Panel title="Probability of default">
              {pd !== undefined ? (
                <div className="pt-2">
                  <Gauge
                    value={pd}
                    max={Math.max((threshold ?? 0.05) * 2, pd * 1.5, 0.02)}
                    threshold={threshold}
                    label={asPct(pd)}
                    caption={
                      threshold !== undefined
                        ? `${show(result.risk_grade)} · decline threshold ${asPct(threshold, 2)}`
                        : show(result.risk_grade)
                    }
                  />
                </div>
              ) : (
                <p className="num text-2xl text-foreground">
                  {show(result.probability_of_default)}
                </p>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="LGD" value={asPct(result.loss_given_default)} />
            <Metric label="EAD" value={asMoney(result.exposure_at_default)} />
            <Metric label="Expected loss" value={asMoney(result.expected_loss)} />
            <Metric label="Risk grade" value={show(result.risk_grade)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Main risk drivers">
              {result.risk_drivers ? (
                <ResultBlock data={result.risk_drivers} />
              ) : (
                <EmptyState label="No drivers returned." />
              )}
            </Panel>
            <Panel title="Evidence">
              {result.evidence ? (
                <ResultBlock data={result.evidence} />
              ) : (
                <EmptyState label="No evidence returned." />
              )}
            </Panel>
            <Panel title="Methodology">
              {result.methodology ? (
                <ResultBlock data={result.methodology} />
              ) : (
                <EmptyState label="No methodology returned." />
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
