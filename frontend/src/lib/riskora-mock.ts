/**
 * Mock Riskora data.
 *
 * Used as a fallback whenever the real backend is unreachable so the platform
 * views stay demonstrable. Shapes mirror the real backend contracts.
 */

export const mockDashboardSummary = {
  portfolio_value: 367457.82,
  total_exposure: 1100000,
  high_risk_borrowers: 1,
  var: 7206.34,
  var_confidence: "95%, 1d",
  expected_shortfall: 9041.12,
  annualized_volatility: 0.1093,
  max_drawdown: -0.2031,
  top_risk_drivers: [
    { name: "MSFT", contribution: 0.283 },
    { name: "AAPL", contribution: 0.262 },
    { name: "JPM", contribution: 0.195 },
    { name: "TLT", contribution: 0.123 },
    { name: "Credit book", contribution: 0.087 },
    { name: "Cash", contribution: 0.05 },
  ],
  recent_analyses: [
    { type: "Credit", entity: "B1001", result: "Low risk · EL $27.37", date: "2026-08-20 14:02" },
    { type: "Market", entity: "P001", result: "VaR $7,206.34", date: "2026-08-20 11:47" },
    { type: "Stress", entity: "P001", result: "Total loss $77,624.43", date: "2026-08-19 17:20" },
    { type: "Credit", entity: "B1005", result: "High risk · EL $1,842.10", date: "2026-08-19 09:31" },
    { type: "Market", entity: "P002", result: "VaR $3,118.90", date: "2026-08-18 16:05" },
  ],
};

export const mockCreditAnalysis = {
  borrower_id: "B1001",
  probability_of_default: 0.0023,
  decline_threshold: 0.05,
  loss_given_default: 0.35,
  exposure_at_default: 34400.6,
  expected_loss: 27.37,
  risk_grade: "Low Risk",
  borrower_profile: {
    borrower_id: "B1001",
    annual_income: "$86,000.00",
    credit_score: 712,
    loan_amount: "$34,400.60",
    debt_to_income: "0.28",
    employment_years: 6,
  },
  risk_drivers: {
    "Debt to income": "0.28 (threshold 0.40)",
    "Credit score": "712, stable over 12 months",
    "Employment history": "6 years, no gaps",
    "Payment behaviour": "No delinquencies in 24 months",
  },
  evidence: {
    financials: "FY25 income verification",
    bureau: "Composite score 712",
    peer_set: "12 comparable borrowers",
  },
  methodology: {
    pd: "Logistic scorecard calibrated on 10y default history",
    lgd: "Collateral-adjusted workout recovery model",
    expected_loss: "PD x LGD x EAD",
  },
};

const history = Array.from({ length: 60 }, (_, i) => ({
  t: i,
  value: Number(
    (367457.82 * (1 + Math.sin(i / 4.1) * 0.02 + Math.sin(i / 11) * 0.035 - i * 0.0009)).toFixed(2),
  ),
}));

export const mockMarketAnalysis = {
  portfolio_id: "P001",
  var: 7206.34,
  var_confidence: "95%, 1d",
  expected_shortfall: 9041.12,
  volatility: 0.1093,
  max_drawdown: -0.2031,
  portfolio_value: 367457.82,
  composition: [
    { symbol: "AAPL", value: 96240 },
    { symbol: "CASH", value: 50000 },
    { symbol: "JPM", value: 71830 },
    { symbol: "MSFT", value: 104120 },
    { symbol: "TLT", value: 45267.82 },
  ],
  history,
  risk_contributions: {
    Equities: "58%",
    Credit: "24%",
    Rates: "13%",
    Cash: "5%",
  },
  concentration: {
    "Top 2 positions": "54.5% of portfolio",
    "Largest position": "MSFT 28.3%",
    "Average pairwise correlation": "0.42",
  },
  explanation:
    "Risk is dominated by equity beta; the tail estimate widens because correlations rise in stressed windows.",
};

export const mockStressRun = {
  baseline_value: 367457.82,
  stressed_value: 289833.39,
  market_loss: 61318.09,
  credit_loss: 16306.34,
  total_loss: 77624.43,
  loss_pct: -0.2113,
  scenario_comparison: {
    "Equity shock (-20%)": "-14.8%",
    "Rate shock (+200bps)": "-4.1%",
    "Default-rate shock (+2%)": "-2.2%",
    Combined: "-21.1%",
  },
  explanation:
    "Equity drawdown drives most of the loss. Rate shocks compound through duration exposure in the credit sleeve.",
};

export const mockAgentAnswer = (question: string) => {
  const match = question.match(/B\d{4}/i);
  const borrower = match ? match[0].toUpperCase() : "B1001";
  return {
    title: `Risk assessment — borrower ${borrower}`,
    summary: `Borrower ${borrower} is currently a low-risk exposure. Expected loss is small relative to the outstanding balance, and no early-warning indicator has been triggered in the last four quarters.`,
    points: [
      { label: "Expected loss", value: "$27.37 on $34,400.60 exposure (0.08% of balance)" },
      { label: "Probability of default", value: "0.23% over a 12-month horizon" },
      { label: "Loss given default", value: "35.00%, collateral-adjusted" },
      { label: "Primary drivers", value: "Debt-to-income 0.28, credit score 712, 6 years employment" },
    ],
    recommendation:
      "Maintain the current limit. Re-run the assessment if debt-to-income exceeds 0.40 or the credit score falls below 660.",
    evidence: [
      "Credit engine — PD x LGD x EAD scorecard, run 2026-08-20 14:02",
      "Borrower record B1001 — income verification, FY25",
      "Bureau file — composite score 712, no delinquencies (24m)",
      "Portfolio P001 — exposure map and concentration snapshot",
    ],
    methodology: {
      credit: "PD x LGD x EAD",
      market: "Historical simulation VaR, 2y window",
      stress: "Deterministic multi-factor shock overlay",
    },
  };
};

export function mockFor(path: string, body?: unknown): unknown | undefined {
  if (path.startsWith("/api/dashboard/summary")) return mockDashboardSummary;
  if (path.startsWith("/api/credit/analyze")) return mockCreditAnalysis;
  if (path.startsWith("/api/market/analyze")) return mockMarketAnalysis;
  if (path.startsWith("/api/stress/run")) return mockStressRun;
  if (path.startsWith("/api/agent/ask")) {
    const q = (body as { question?: string; query?: string } | undefined)?.question ?? "this question";
    return mockAgentAnswer(q);
  }
  return undefined;
}
