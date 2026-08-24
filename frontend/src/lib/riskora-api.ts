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
 * Set VITE_RISKORA_API_URL to point at a different backend origin; when unset
 * requests go to the same origin (Nginx proxies /api/ → FastAPI).
 */

const BASE =
  (import.meta.env["VITE_RISKORA_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const REQUEST_TIMEOUT_MS = 30_000;
const ACCESS_TOKEN_KEY = "riskora_access_token";

export class RiskoraApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RiskoraApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "The request timed out. The service may be busy or unavailable."
        : "Riskora API is unavailable. Check the backend service and try again.";
    throw new RiskoraApiError(message, 0);
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    let detail = `Request failed with status ${response.status}.`;
    try {
      const errBody = (await response.json()) as {
        detail?: string | { msg?: string; loc?: unknown[] }[];
        message?: string;
        request_id?: string;
      };
      if (typeof errBody.detail === "string") {
        detail = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        detail = errBody.detail.map((item) => item.msg ?? "Invalid request").join("; ");
      } else {
        detail = errBody.message ?? detail;
      }
      if (errBody.request_id) detail = `${detail} (request ${errBody.request_id})`;
    } catch {
      /* response had no JSON body */
    }
    throw new RiskoraApiError(detail, response.status);
  }

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch {
    throw new RiskoraApiError(
      "The API returned an invalid response. Check the backend logs and try again.",
      response.status,
    );
  }
}

export const hasAccessToken = () => Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY));

export const clearAccessToken = () => sessionStorage.removeItem(ACCESS_TOKEN_KEY);

export const getCurrentUser = async () =>
  request<{ username: string; role: string }>("/api/auth/me");

export const logout = async () => {
  clearAccessToken();
  try {
    await request<void>("/api/auth/logout", { method: "POST" });
  } catch {
    // Local credentials are already cleared; an expired server cookie is harmless.
  }
};

export const login = async (username: string, password: string): Promise<void> => {
  const body = new URLSearchParams({ username, password });
  const response = await request<{ access_token: string }>("/api/auth/token", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  sessionStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
};

const apiGet = <T>(path: string) => request<T>(path);

const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

/* ---- Endpoint wrappers ------------------------------------------- */

/** GET /api/dashboard/summary */
export const getDashboardSummary = async <T = unknown>(): Promise<T> => {
  const raw = await apiGet<Record<string, unknown>>("/api/dashboard/summary");
  return shapeDashboardResponse(raw) as T;
};

function shapeDashboardResponse(raw: Record<string, unknown>): Record<string, unknown> {
  // The backend uses different field names than the UI expects.
  // Map them here so DashboardView metrics display real data.
  return {
    ...raw,
    portfolio_value: raw["total_portfolio_value"] ?? raw["portfolio_value"],
    total_exposure: raw["total_exposure"],
    high_risk_borrowers: raw["high_risk_borrower_count"] ?? raw["high_risk_borrowers"],
    var: raw["headline_var_95"] ?? raw["var"],
    var_confidence: "95%, 1d",
    expected_shortfall: raw["headline_expected_shortfall_95"] ?? raw["expected_shortfall"],
    annualized_volatility: raw["headline_annualized_volatility"] ?? raw["annualized_volatility"],
    max_drawdown: raw["headline_max_drawdown"] ?? raw["max_drawdown"],
    signals_monitored:
      ((raw["borrower_count"] as number) ?? 0) + ((raw["portfolio_count"] as number) ?? 0),
    // top_risk_drivers: array of { driver, count } → remap to { name, contribution }
    top_risk_drivers: Array.isArray(raw["top_risk_drivers"])
      ? (raw["top_risk_drivers"] as Record<string, unknown>[]).map((d) => ({
          name: d["driver"] ?? d["name"] ?? "—",
          contribution: Number(d["count"] ?? d["contribution"] ?? 0),
        }))
      : raw["top_risk_drivers"],
    recent_analyses: raw["recent_analyses"],
  };
}

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
  const borrowerId = String(payload["borrower_id"] ?? "")
    .trim()
    .toUpperCase();
  if (!borrowerId) throw new RiskoraApiError("borrower_id is required", 400);

  const raw = await apiGet<Record<string, unknown>>(
    `/api/credit/borrowers/${encodeURIComponent(borrowerId)}/assess`,
  );

  // The backend returns { borrower: {...}, pd, lgd, ead, expected_loss, status, risk_drivers, ... }
  // Map to the shape the UI components expect.
  return shapeCreditResponse(raw) as T;
};

function shapeCreditResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const borrower = (raw["borrower"] as Record<string, unknown> | undefined) ?? {};

  // risk_drivers from real API is an array of strings; convert to object for ResultBlock
  const riskDriversRaw = raw["risk_drivers"];
  const riskDriversObj =
    Array.isArray(riskDriversRaw) && riskDriversRaw.length > 0
      ? riskDriversRaw.reduce<Record<string, string>>((acc, d, i) => {
          acc[`Driver ${i + 1}`] = String(d);
          return acc;
        }, {})
      : Array.isArray(riskDriversRaw) && riskDriversRaw.length === 0
        ? undefined
        : riskDriversRaw;

  return {
    ...raw,
    // UI expects probability_of_default, decline_threshold, etc.
    probability_of_default: raw["pd"] ?? raw["probability_of_default"],
    decline_threshold: raw["decline_threshold"] ?? 0.1,
    loss_given_default: raw["lgd"] ?? raw["loss_given_default"],
    exposure_at_default: raw["ead"] ?? raw["exposure_at_default"],
    expected_loss: raw["expected_loss"],
    risk_grade: raw["status"] ?? raw["risk_grade"],
    // Build borrower_profile from nested borrower object
    borrower_profile:
      Object.keys(borrower).length > 0
        ? {
            borrower_id: borrower["borrower_id"],
            name: borrower["name"],
            age: borrower["age"],
            annual_income:
              borrower["monthly_income"] != null
                ? `$${(Number(borrower["monthly_income"]) * 12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : undefined,
            credit_score: borrower["credit_score"],
            loan_amount:
              borrower["outstanding_balance"] != null
                ? `$${Number(borrower["outstanding_balance"]).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : undefined,
            debt_to_income:
              borrower["debt_ratio"] != null
                ? String(Number(borrower["debt_ratio"]).toFixed(3))
                : undefined,
            revolving_utilization: borrower["revolving_utilization"],
            loan_type: borrower["loan_type"],
            total_delinquencies: borrower["total_delinquencies"],
          }
        : raw["borrower_profile"],
    risk_drivers: riskDriversObj,
    model_version: raw["model_version"],
    evidence:
      raw["evidence"] ??
      (raw["model_version"]
        ? { "Model version": String(raw["model_version"]), Methodology: "PD × LGD × EAD" }
        : undefined),
    methodology: raw["methodology"] ?? {
      PD: "SageMaker XGBoost scorecard",
      LGD: "1 − recovery rate",
      "Expected loss": "PD × LGD × EAD",
    },
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
  const portfolioId = String(payload["portfolio_id"] ?? "")
    .trim()
    .toUpperCase();
  if (!portfolioId) throw new RiskoraApiError("portfolio_id is required", 400);

  const confidenceLevel = Number(payload["confidence_level"] ?? 0.95);
  const lookbackDays = Number(payload["lookback_days"] ?? 250);
  const query = new URLSearchParams({
    confidence_level: String(confidenceLevel),
    lookback_days: String(lookbackDays),
  });

  const raw = await apiGet<Record<string, unknown>>(
    `/api/market/portfolios/${encodeURIComponent(portfolioId)}/risk?${query.toString()}`,
  );

  return shapeMarketResponse(raw) as T;
};

function shapeMarketResponse(raw: Record<string, unknown>): Record<string, unknown> {
  // Convert weights dict { AAPL: 0.23, ... } to composition array [{ symbol, value }]
  const composition =
    raw["composition"] ??
    raw["holdings"] ??
    (raw["weights"] && typeof raw["weights"] === "object" && !Array.isArray(raw["weights"])
      ? Object.entries(raw["weights"] as Record<string, number>).map(([symbol, weight]) => ({
          symbol,
          value: weight * Number(raw["portfolio_value"] ?? 0),
        }))
      : undefined);

  // history can be value_history [{date, value}] or price_history
  const history = raw["history"] ?? raw["value_history"] ?? raw["price_history"];

  // risk_drivers from real API is an array of strings; show as object for ResultBlock
  const riskDriversRaw = raw["risk_drivers"];
  const explanation =
    raw["explanation"] ??
    (Array.isArray(riskDriversRaw)
      ? riskDriversRaw.reduce<Record<string, string>>((acc, d, i) => {
          acc[`Driver ${i + 1}`] = String(d);
          return acc;
        }, {})
      : riskDriversRaw);

  return {
    ...raw,
    var: raw["selected_var"] ?? raw["historical_var_95"] ?? raw["var"],
    var_confidence: raw["confidence_level"]
      ? `${(Number(raw["confidence_level"]) * 100).toFixed(1)}%, 1d`
      : "95%, 1d",
    expected_shortfall:
      raw["selected_expected_shortfall"] ??
      raw["expected_shortfall_95"] ??
      raw["expected_shortfall"],
    volatility: raw["annualized_volatility"] ?? raw["volatility"],
    max_drawdown: raw["max_drawdown"],
    portfolio_value: raw["portfolio_value"],
    composition,
    history,
    concentration: raw["concentration"] ?? {
      "HHI (concentration)": String(Number(raw["hhi"] ?? 0).toFixed(4)),
      "Largest position weight": `${(Number(raw["max_position_weight"] ?? 0) * 100).toFixed(1)}%`,
    },
    risk_contributions:
      raw["risk_contributions"] ??
      (raw["weights"]
        ? Object.fromEntries(
            Object.entries(raw["weights"] as Record<string, number>).map(([k, v]) => [
              k,
              `${(v * 100).toFixed(1)}%`,
            ]),
          )
        : undefined),
    explanation,
    correlation: raw["correlation_matrix"] ?? raw["correlation"],
  };
}

/**
 * Stress test.
 * Real backend: POST /api/stress/portfolios/{portfolio_id}/run
 * Body: { scenario_name, equity_shock, rate_shock_bps, default_shock }
 * The new UI sends { target_id, scenarios, equity_shock_pct, rate_shock_bps, default_rate_shock_pct }
 */
export const runStressTest = async <T = unknown>(payload: Record<string, unknown>): Promise<T> => {
  const portfolioId = String(payload["target_id"] ?? payload["portfolio_id"] ?? "")
    .trim()
    .toUpperCase();
  if (!portfolioId) throw new RiskoraApiError("portfolio/target ID is required", 400);

  const scenarios = Array.isArray(payload["scenarios"])
    ? (payload["scenarios"] as string[])
    : ["custom"];

  const body = {
    scenario_name: scenarios.join(", "),
    equity_shock: Number(payload["equity_shock_pct"] ?? payload["equity_shock"] ?? -20) / 100,
    rate_shock_bps: Number(payload["rate_shock_bps"] ?? 200),
    default_shock: Number(payload["default_rate_shock_pct"] ?? payload["default_shock"] ?? 2) / 100,
  };

  const raw = await apiPost<Record<string, unknown>>(
    `/api/stress/portfolios/${encodeURIComponent(portfolioId)}/run`,
    body,
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
      "Equity shock": `${(Number(raw["equity_shock"] ?? 0) * 100).toFixed(1)}%`,
      "Rate shock (bps)": String(raw["rate_shock_bps"] ?? ""),
      "Default-rate shock": `+${(Number(raw["default_shock"] ?? 0) * 100).toFixed(1)}%`,
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
export const askAgent = async <T = unknown>(payload: Record<string, unknown>): Promise<T> => {
  const raw = await apiPost<Record<string, unknown>>("/api/agent/ask", payload);
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
