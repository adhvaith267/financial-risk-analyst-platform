/**
 * Riskora API client.
 *
 * Set VITE_RISKORA_API_URL to point at a different backend origin; when unset
 * requests go to the same origin (Nginx proxies /api/ to FastAPI).
 */

const BASE =
  (import.meta.env["VITE_RISKORA_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
const REQUEST_TIMEOUT_MS = 30_000;

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

  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
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
    let detail = `Request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as {
        detail?: string | { msg?: string }[];
        message?: string;
        request_id?: string;
      };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail.map((item) => item.msg ?? "Invalid request").join("; ");
      } else if (body.message) {
        detail = body.message;
      }
      if (body.request_id) detail = `${detail} (request ${body.request_id})`;
    } catch {
      /* The response did not contain a JSON error body. */
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

const apiGet = <T>(path: string) => request<T>(path);
const apiPost = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

type BackendDashboardSummary = {
  borrower_count: number;
  loan_count: number;
  portfolio_count: number;
  stress_test_count: number;
  total_portfolio_value: number;
  total_exposure: number;
  high_risk_borrower_count: number;
  headline_portfolio_id: string | null;
  headline_annualized_volatility: number | null;
  headline_var_95: number | null;
  headline_expected_shortfall_95: number | null;
  headline_max_drawdown: number | null;
  top_risk_drivers: { driver: string; count: number }[];
  recent_analyses: {
    entity_type: string;
    entity_id: string;
    risk_type: string;
    label: string;
    computed_at: string;
  }[];
};

export type DashboardSummary = {
  portfolio_value: number;
  total_exposure: number;
  high_risk_borrowers: number;
  var: number | null;
  var_confidence: string;
  expected_shortfall: number | null;
  annualized_volatility: number | null;
  max_drawdown: number | null;
  signals_monitored: number;
  top_risk_drivers: { name: string; contribution: number }[];
  recent_analyses: BackendDashboardSummary["recent_analyses"];
};

/** GET /api/dashboard/summary. */
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const raw = await apiGet<BackendDashboardSummary>("/api/dashboard/summary");
  return {
    portfolio_value: raw.total_portfolio_value,
    total_exposure: raw.total_exposure,
    high_risk_borrowers: raw.high_risk_borrower_count,
    var: raw.headline_var_95,
    var_confidence: "95%, 1d",
    expected_shortfall: raw.headline_expected_shortfall_95,
    annualized_volatility: raw.headline_annualized_volatility,
    max_drawdown: raw.headline_max_drawdown,
    signals_monitored: raw.borrower_count + raw.portfolio_count,
    top_risk_drivers: raw.top_risk_drivers.map(({ driver, count }) => ({
      name: driver,
      contribution: count,
    })),
    recent_analyses: raw.recent_analyses,
  };
};

type BackendBorrowerProfile = {
  borrower_id: string;
  name: string;
  age: number;
  monthly_income: number | null;
  revolving_utilization: number;
  debt_ratio: number;
  total_delinquencies: number;
  outstanding_balance: number | null;
  loan_type: string | null;
};

type BackendCreditAssessment = {
  borrower_id: string;
  borrower: BackendBorrowerProfile;
  pd: number;
  lgd: number;
  ead: number;
  expected_loss: number;
  status: string;
  model_version: string;
  risk_drivers: string[];
  decline_threshold: number;
};

export type CreditResult = {
  probability_of_default: number;
  decline_threshold: number;
  loss_given_default: number;
  exposure_at_default: number;
  expected_loss: number;
  risk_grade: string;
  borrower_profile: {
    borrower_id: string;
    name: string;
    age: number;
    annual_income: string | undefined;
    loan_amount: string | undefined;
    debt_to_income: string;
    revolving_utilization: number;
    loan_type: string | null;
    total_delinquencies: number;
  };
  risk_drivers: Record<string, string> | undefined;
  evidence: Record<string, string>;
  methodology: Record<string, string>;
};

/** GET /api/credit/borrowers/{borrower_id}/assess. */
export const runCreditAnalysis = async ({
  borrower_id,
}: {
  borrower_id: string;
}): Promise<CreditResult> => {
  const borrowerId = borrower_id.trim().toUpperCase();
  if (!borrowerId) throw new RiskoraApiError("borrower_id is required", 400);

  const raw = await apiGet<BackendCreditAssessment>(
    `/api/credit/borrowers/${encodeURIComponent(borrowerId)}/assess`,
  );
  const borrower = raw.borrower;
  const riskDrivers = raw.risk_drivers.length
    ? Object.fromEntries(raw.risk_drivers.map((driver, index) => [`Driver ${index + 1}`, driver]))
    : undefined;

  return {
    probability_of_default: raw.pd,
    decline_threshold: raw.decline_threshold,
    loss_given_default: raw.lgd,
    exposure_at_default: raw.ead,
    expected_loss: raw.expected_loss,
    risk_grade: raw.status,
    borrower_profile: {
      borrower_id: borrower.borrower_id,
      name: borrower.name,
      age: borrower.age,
      annual_income:
        borrower.monthly_income === null
          ? undefined
          : `$${(borrower.monthly_income * 12).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
      loan_amount:
        borrower.outstanding_balance === null
          ? undefined
          : `$${borrower.outstanding_balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
      debt_to_income: borrower.debt_ratio.toFixed(3),
      revolving_utilization: borrower.revolving_utilization,
      loan_type: borrower.loan_type,
      total_delinquencies: borrower.total_delinquencies,
    },
    risk_drivers: riskDrivers,
    evidence: { "Model version": raw.model_version, Methodology: "PD × LGD × EAD" },
    methodology: {
      PD: "SageMaker model endpoint",
      LGD: "1 − recovery rate",
      "Expected loss": "PD × LGD × EAD",
    },
  };
};

type BackendMarketResponse = {
  portfolio_value: number;
  annualized_volatility: number;
  max_drawdown: number;
  hhi: number;
  max_position_weight: number;
  weights: Record<string, number>;
  correlation_matrix: Record<string, Record<string, number>>;
  value_history: { date: string; value: number }[];
  risk_drivers: string[];
  confidence_level: number;
  selected_var: number;
  selected_expected_shortfall: number;
};

export type MarketResult = {
  var: number;
  var_confidence: string;
  expected_shortfall: number;
  volatility: number;
  max_drawdown: number;
  portfolio_value: number;
  composition: { label: string; value: number }[];
  history: { date: string; value: number }[];
  concentration: Record<string, string>;
  correlation: Record<string, Record<string, number>>;
  risk_contributions: Record<string, string>;
  explanation: Record<string, string> | undefined;
};

/** GET /api/market/portfolios/{portfolio_id}/risk. */
export const runMarketAnalysis = async ({
  portfolio_id,
  confidence_level,
  lookback_days,
}: {
  portfolio_id: string;
  confidence_level: number;
  lookback_days: number;
}): Promise<MarketResult> => {
  const portfolioId = portfolio_id.trim().toUpperCase();
  if (!portfolioId) throw new RiskoraApiError("portfolio_id is required", 400);

  const query = new URLSearchParams({
    confidence_level: String(confidence_level),
    lookback_days: String(lookback_days),
  });
  const raw = await apiGet<BackendMarketResponse>(
    `/api/market/portfolios/${encodeURIComponent(portfolioId)}/risk?${query.toString()}`,
  );

  return {
    var: raw.selected_var,
    var_confidence: `${(raw.confidence_level * 100).toFixed(1)}%, 1d`,
    expected_shortfall: raw.selected_expected_shortfall,
    volatility: raw.annualized_volatility,
    max_drawdown: raw.max_drawdown,
    portfolio_value: raw.portfolio_value,
    composition: Object.entries(raw.weights).map(([label, weight]) => ({
      label,
      value: weight * raw.portfolio_value,
    })),
    history: raw.value_history,
    concentration: {
      "HHI (concentration)": raw.hhi.toFixed(4),
      "Largest position weight": `${(raw.max_position_weight * 100).toFixed(1)}%`,
    },
    correlation: raw.correlation_matrix,
    risk_contributions: Object.fromEntries(
      Object.entries(raw.weights).map(([label, weight]) => [
        label,
        `${(weight * 100).toFixed(1)}%`,
      ]),
    ),
    explanation: raw.risk_drivers.length
      ? Object.fromEntries(raw.risk_drivers.map((driver, index) => [`Driver ${index + 1}`, driver]))
      : undefined,
  };
};

type BackendStressResponse = {
  scenario_name: string;
  equity_shock: number;
  rate_shock_bps: number;
  default_shock: number;
  market_loss: number;
  credit_loss: number;
  combined_loss: number;
  baseline_portfolio_value: number;
  stressed_portfolio_value: number;
  vulnerabilities: string[];
};

export type StressResult = {
  baseline_value: number;
  stressed_value: number;
  market_loss: number;
  credit_loss: number;
  total_loss: number;
  loss_pct: number;
  scenario_comparison: Record<string, string>;
  explanation: Record<string, string> | undefined;
};

/** POST /api/stress/portfolios/{portfolio_id}/run. */
export const runStressTest = async ({
  target_id,
  scenarios,
  equity_shock_pct,
  rate_shock_bps,
  default_rate_shock_pct,
}: {
  target_id: string;
  scenarios: string[];
  equity_shock_pct: number;
  rate_shock_bps: number;
  default_rate_shock_pct: number;
}): Promise<StressResult> => {
  const portfolioId = target_id.trim().toUpperCase();
  if (!portfolioId) throw new RiskoraApiError("portfolio/target ID is required", 400);

  const body = {
    scenario_name: scenarios.join(", "),
    equity_shock: equity_shock_pct / 100,
    rate_shock_bps,
    default_shock: default_rate_shock_pct / 100,
  };
  const raw = await apiPost<BackendStressResponse>(
    `/api/stress/portfolios/${encodeURIComponent(portfolioId)}/run`,
    body,
  );
  const baseline = raw.baseline_portfolio_value;
  const stressed = raw.stressed_portfolio_value;
  const combinedLoss = raw.combined_loss;

  return {
    baseline_value: baseline,
    stressed_value: stressed,
    market_loss: raw.market_loss,
    credit_loss: raw.credit_loss,
    total_loss: combinedLoss,
    loss_pct: baseline > 0 ? -(combinedLoss / baseline) : 0,
    scenario_comparison: {
      "Equity shock": `${(raw.equity_shock * 100).toFixed(1)}%`,
      "Rate shock (bps)": String(raw.rate_shock_bps),
      "Default-rate shock": `+${(raw.default_shock * 100).toFixed(1)}%`,
      "Baseline portfolio value": `$${baseline.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      "Stressed portfolio value": `$${stressed.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    },
    explanation: raw.vulnerabilities.length
      ? Object.fromEntries(
          raw.vulnerabilities.map((item, index) => [`Vulnerability ${index + 1}`, item]),
        )
      : undefined,
  };
};

type BackendAgentResponse = {
  answer: string;
  trace: { tool: string; label: string; status: string }[];
};

export type AgentResponse = {
  title: string;
  answer: string;
  trace: BackendAgentResponse["trace"];
};

/** POST /api/agent/ask. */
export const askAgent = async ({ question }: { question: string }): Promise<AgentResponse> => {
  const raw = await apiPost<BackendAgentResponse>("/api/agent/ask", { question });
  return {
    title: "Riskora AI Analysis",
    answer: raw.answer,
    trace: raw.trace,
  };
};
