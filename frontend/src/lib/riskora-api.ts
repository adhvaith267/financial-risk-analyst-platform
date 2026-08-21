/**
 * Riskora API client.
 *
 * Adapted to match the real Riskora backend endpoints:
 *   GET  /api/dashboard/summary
 *   GET  /api/credit/borrowers
 *   GET  /api/credit/borrowers/{id}/assess
 *   GET  /api/market/portfolios
 *   GET  /api/market/portfolios/{id}/risk
 *   POST /api/stress/portfolios/{id}/run
 *   POST /api/agent/ask
 *
 * Falls back to mock data if the backend is unreachable so the UI stays
 * demonstrable in development without a running backend.
 *
 * Set VITE_RISKORA_API_URL to point at a different backend origin; when unset
 * requests go to the same origin (Nginx proxies /api/ → FastAPI).
 */

import { mockFor } from "./riskora-mock";

const BASE =
  (import.meta.env["VITE_RISKORA_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";

export class RiskoraApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RiskoraApiError";
    this.status = status;
  }
}

const DELAY = 420;

async function fallback<T>(mockKey: string, body?: unknown): Promise<T> {
  const mock = mockFor(mockKey, body);
  if (mock === undefined)
    return Promise.reject(new RiskoraApiError("No data available for this request.", 0));
  await new Promise((r) => setTimeout(r, DELAY));
  return mock as T;
}

async function request<T>(path: string, init?: RequestInit, mockKey?: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return fallback<T>(mockKey ?? path, body);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const errBody = (await response.json()) as { detail?: string; message?: string };
      detail = errBody.detail ?? errBody.message ?? detail;
    } catch {
      /* response had no JSON body */
    }
    if (response.status === 404 || response.status >= 500)
      return fallback<T>(mockKey ?? path, body);
    throw new RiskoraApiError(detail, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    return fallback<T>(mockKey ?? path, body);
  }
}

const apiGet = <T>(path: string, mockKey?: string) =>
  request<T>(path, undefined, mockKey ?? path);

const apiPost = <T>(path: string, body: unknown, mockKey?: string) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) }, mockKey ?? path, body);

/* ---- Endpoint wrappers ------------------------------------------- */

/** GET /api/dashboard/summary */
export const getDashboardSummary = <T = unknown>() =>
  apiGet<T>("/api/dashboard/summary");

/**
 * Credit risk assessment.
 * Real backend: GET /api/credit/borrowers/{borrower_id}/assess
 * The new UI sends { borrower_id, horizon_months } — we extract borrower_id
 * and make the correct GET request. The backend returns CreditAssessmentResponse
 * which we reshape to match what the UI components expect.
 */
export const runCreditAnalysis = async <T = unknown>(
  payload: Record<string, unknown>,
): Promise<T> => {
  const borrowerId = String(payload["borrower_id"] ?? "").trim();
  if (!borrowerId) throw new RiskoraApiError("borrower_id is required", 400);

  const raw = await apiGet<Record<string, unknown>>(
    `/api/credit/borrowers/${encodeURIComponent(borrowerId)}/assess`,
    "/api/credit/analyze",
  );

  // The backend returns { borrower: {...}, pd, lgd, ead, expected_loss, status, risk_drivers, ... }
  // Map to the shape the UI components expect.
  return shapeCreditResponse(raw) as T;
};

function shapeCreditResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = (raw["borrower"] as Record<string, unknown> | undefined) ?? {};
  return {
    ...raw,
    // UI expects probability_of_default, decline_threshold, etc.
    probability_of_default: raw["pd"] ?? raw["probability_of_default"],
    decline_threshold: raw["decline_threshold"] ?? 0.05,
    loss_given_default: raw["lgd"] ?? raw["loss_given_default"],
    exposure_at_default: raw["ead"] ?? raw["exposure_at_default"],
    expected_loss: raw["expected_loss"],
    risk_grade: raw["status"] ?? raw["risk_grade"],
    // Build borrower_profile from nested borrower object
    borrower_profile: Object.keys(borrower).length > 0
      ? {
          borrower_id: borrower["borrower_id"],
          name: borrower["name"],
          annual_income: borrower["monthly_income"] != null
            ? `$${(Number(borrower["monthly_income"]) * 12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : undefined,
          credit_score: borrower["credit_score"],
          loan_amount: borrower["outstanding_balance"] != null
            ? `$${Number(borrower["outstanding_balance"]).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : undefined,
          debt_to_income: borrower["debt_ratio"] != null
            ? String(Number(borrower["debt_ratio"]).toFixed(2))
            : undefined,
          revolving_utilization: borrower["revolving_utilization"],
          age: borrower["age"],
          loan_type: borrower["loan_type"],
          total_delinquencies: borrower["total_delinquencies"],
        }
      : raw["borrower_profile"],
    // Keep risk_drivers, evidence, methodology from the raw response
    risk_drivers: raw["risk_drivers"],
    evidence: raw["evidence"],
    methodology: raw["methodology"],
  };
}

/**
 * Market risk assessment.
 * Real backend: GET /api/market/portfolios/{portfolio_id}/risk
 * The new UI sends { portfolio_id, confidence_level, lookback_days }.
 * We extract portfolio_id and make the correct GET request.
 */
export const runMarketAnalysis = async <T = unknown>(
  payload: Record<string, unknown>,
): Promise<T> => {
  const portfolioId = String(payload["portfolio_id"] ?? "").trim();
  if (!portfolioId) throw new RiskoraApiError("portfolio_id is required", 400);

  const raw = await apiGet<Record<string, unknown>>(
    `/api/market/portfolios/${encodeURIComponent(portfolioId)}/risk`,
    "/api/market/analyze",
  );

  return shapeMarketResponse(raw) as T;
};

function shapeMarketResponse(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    // Map backend field names to what the UI expects
    var: raw["historical_var_95"] ?? raw["var"],
    var_confidence: "95%, 1d",
    expected_shortfall: raw["expected_shortfall_95"] ?? raw["expected_shortfall"],
    volatility: raw["annualized_volatility"] ?? raw["volatility"],
    max_drawdown: raw["max_drawdown"],
    portfolio_value: raw["portfolio_value"],
    composition: raw["composition"] ?? raw["holdings"],
    history: raw["price_history"] ?? raw["history"],
    // Concentration / risk contribution info
    concentration: raw["concentration"] ?? raw["risk_factors"],
    risk_contributions: raw["risk_contributions"],
    explanation: raw["explanation"] ?? raw["risk_drivers"],
  };
}

/**
 * Stress test.
 * Real backend: POST /api/stress/portfolios/{portfolio_id}/run
 * Body: { scenario_name, equity_shock, rate_shock_bps, default_shock }
 * The new UI sends { target_id, scenarios, equity_shock_pct, rate_shock_bps, default_rate_shock_pct }
 */
export const runStressTest = async <T = unknown>(
  payload: Record<string, unknown>,
): Promise<T> => {
  const portfolioId = String(payload["target_id"] ?? payload["portfolio_id"] ?? "").trim();
  if (!portfolioId) throw new RiskoraApiError("portfolio/target ID is required", 400);

  const scenarios = Array.isArray(payload["scenarios"])
    ? (payload["scenarios"] as string[])
    : ["custom"];

  const body = {
    scenario_name: scenarios.join(", "),
    equity_shock: Number(payload["equity_shock_pct"] ?? payload["equity_shock"] ?? -20) / 100,
    rate_shock_bps: Number(payload["rate_shock_bps"] ?? 200),
    default_shock:
      Number(payload["default_rate_shock_pct"] ?? payload["default_shock"] ?? 2) / 100,
  };

  const raw = await apiPost<Record<string, unknown>>(
    `/api/stress/portfolios/${encodeURIComponent(portfolioId)}/run`,
    body,
    "/api/stress/run",
  );

  return shapeStressResponse(raw) as T;
};

function shapeStressResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const baseline = Number(raw["baseline_portfolio_value"] ?? 0);
  const stressed = Number(raw["stressed_portfolio_value"] ?? 0);
  const marketLoss = Number(raw["market_loss"] ?? 0);
  const creditLoss = Number(raw["credit_loss"] ?? 0);
  const combinedLoss = Number(raw["combined_loss"] ?? marketLoss + creditLoss);
  const lossPct = baseline > 0 ? -(combinedLoss / baseline) : 0;

  return {
    ...raw,
    baseline_value: baseline,
    stressed_value: stressed,
    market_loss: marketLoss,
    credit_loss: creditLoss,
    total_loss: combinedLoss,
    loss_pct: lossPct,
    scenario_comparison: raw["scenario_comparison"] ?? {
      "Equity shock": `${((Number(raw["equity_shock"] ?? 0)) * 100).toFixed(1)}%`,
      "Rate shock (bps)": String(raw["rate_shock_bps"] ?? ""),
      "Default-rate shock": `+${((Number(raw["default_shock"] ?? 0)) * 100).toFixed(1)}%`,
      "Baseline portfolio value": `$${baseline.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      "Stressed portfolio value": `$${stressed.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    },
    explanation: raw["vulnerabilities"] ?? raw["explanation"],
  };
}

/**
 * AI analyst.
 * Real backend: POST /api/agent/ask  { question: string }
 * Returns: { answer: string, trace: [...] }
 */
export const askAgent = async <T = unknown>(
  payload: Record<string, unknown>,
): Promise<T> => {
  const raw = await apiPost<Record<string, unknown>>("/api/agent/ask", payload, "/api/agent/ask");
  return shapeAgentResponse(raw) as T;
};

function shapeAgentResponse(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    // Backend returns { answer, trace }. UI expects { summary/answer, trace, title }
    title: "Riskora AI Analysis",
    summary: raw["answer"] ?? raw["summary"],
    answer: raw["answer"],
    trace: raw["trace"],
    evidence: undefined, // backend doesn't return separate evidence
    methodology: undefined,
    points: [],
    recommendation: undefined,
  };
}
