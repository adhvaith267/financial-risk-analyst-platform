<div align="center">

# Riskora

**AI-powered financial risk analyst platform.**
Ask a question in plain English — get a numbers-first answer backed by a trained ML model, deterministic quant engines, and an LLM that only synthesises, never invents.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-ReAct%20agent-1C3C3C)](https://www.langchain.com/langgraph)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Kimi%20K2-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon SageMaker](https://img.shields.io/badge/SageMaker-LightGBM%20PD-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/sagemaker/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

**Live → [riskora.online](https://riskora.online)**

</div>

---

## What it does

Riskora combines three risk engines with a LangGraph ReAct agent on Amazon Bedrock to answer questions like *"Assess borrower B1001"* or *"What happens to portfolio P001 in a recession?"*

| Engine | What it computes |
|---|---|
| **Credit Risk** | PD (via SageMaker LightGBM), LGD, EAD, Expected Loss + SHAP drivers |
| **Market Risk** | Historical-simulation VaR, Expected Shortfall, volatility, drawdown, HHI |
| **Stress Testing** | Combined equity + rate + default shock across portfolio and loan book |

The LLM reads tool outputs and explains them in plain language. It never computes a number itself.

---

## Architecture

```
  Browser
    │  HTTPS
    ▼
  Nginx  (EC2 t3.small)
    ├── /          → React SPA
    └── /api/*     → FastAPI :8000
                        │
                   LangGraph ReAct Agent
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
    Credit Risk    Market Risk    Stress Test
    Engine         Engine         Engine
          │             │              │
          └─────────────┴──────────────┘
                        │
                   RDS PostgreSQL
                   (borrowers, loans, portfolios,
                    market_prices, risk_results …)
          │
          ▼
    SageMaker Endpoint          Amazon Bedrock
    LightGBM PD model           Kimi K2 Thinking
    (real-time inference)       (synthesis only)
```

---

## Risk Engines

### Credit Risk
Computes the four Basel-aligned credit risk metrics for any borrower:

- **PD (Probability of Default)** — LightGBM model deployed on SageMaker, trained on the Give Me Some Credit dataset, Optuna-tuned and isotonic-calibrated (Brier score 0.1421 → 0.0487). Returns a probability in [0, 1].
- **LGD (Loss Given Default)** — deterministic, based on loan collateral and seniority.
- **EAD (Exposure at Default)** — outstanding principal + accrued interest at the assessment date.
- **EL (Expected Loss)** — `PD × LGD × EAD`. The single number that captures total credit exposure.
- **SHAP drivers** — top features that pushed the PD up or down for that specific borrower.

### Market Risk
Historical-simulation approach — no distributional assumptions, just 2 years of daily price data:

- **VaR (Value at Risk)** — the loss not exceeded with 95% confidence over a 1-day horizon.
- **ES (Expected Shortfall / CVaR)** — average loss in the worst 5% of days. More conservative than VaR, captures tail risk.
- **Volatility** — annualised daily return standard deviation.
- **Max Drawdown** — largest peak-to-trough decline in the period.
- **HHI (Herfindahl-Hirschman Index)** — portfolio concentration score. 1.0 = fully concentrated, approaches 0 = perfectly diversified.

### Stress Testing
Applies three simultaneous shocks and recomputes the full portfolio P&L:

- **Equity shock** — configurable percentage drop applied to all equity holdings.
- **Rate shock** — basis-point shift applied to bond holdings via modified duration.
- **Default shock** — forces a subset of borrowers to default, realising LGD × EAD as a loss.

Returns pre-shock vs post-shock portfolio value, loss breakdown by component, and per-borrower impact.

---

## AI Agent

The agent is a LangGraph ReAct loop backed by Amazon Bedrock (Kimi K2 Thinking).

It has five tools:

| Tool | What it does |
|---|---|
| `get_borrower` | Fetches borrower profile + active loan from the database |
| `get_portfolio` | Fetches portfolio holdings from the database |
| `assess_credit_risk` | Runs the full credit risk engine for a borrower |
| `assess_market_risk` | Runs the market risk engine for a portfolio |
| `run_stress_scenario` | Applies a shock scenario to a portfolio and loan book |

The LLM decides which tools to call and in what order based on the question. It then receives all tool outputs as structured JSON and writes a plain-language answer. It never produces a number that wasn't first computed by a tool.

Example flow for *"Assess borrower B1001 and show the recession impact on P001"*:
```
Question
  → assess_credit_risk(B1001)   [SageMaker + credit engine]
  → run_stress_scenario(P001)   [stress engine]
  → Bedrock synthesises both outputs into a single answer
```

---

## Data Model

| Table | Contents |
|---|---|
| `borrowers` | Credit profiles (GMSC feature set — exact SageMaker input shape) |
| `loans` | Active and closed loans |
| `payments` | Payment history |
| `portfolios` | Named portfolios |
| `portfolio_holdings` | Asset quantities per portfolio |
| `assets` | Asset metadata (equity / bond / cash) |
| `market_prices` | Daily close prices (2-year history) |
| `risk_results` | Persisted credit and market assessments |
| `stress_results` | Persisted stress-test results |

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/dashboard/summary` | Headline KPIs + recent analyses |
| `GET` | `/api/credit/borrowers` | List all borrowers |
| `GET` | `/api/credit/borrowers/{id}/assess` | PD / LGD / EAD / EL + SHAP drivers |
| `GET` | `/api/market/portfolios` | List portfolios |
| `GET` | `/api/market/portfolios/{id}/risk` | VaR / ES / volatility / drawdown |
| `POST` | `/api/stress/portfolios/{id}/run` | Run a shock scenario |
| `POST` | `/api/agent/ask` | Natural-language question → answer + trace |

---

## Related Repository

PD model training and deployment:
[`adhvaith267/credit-default-pd-model`](https://github.com/adhvaith267/credit-default-pd-model)

- LightGBM trained on Give Me Some Credit dataset
- Optuna hyperparameter tuning, isotonic calibration
- Brier score: 0.1421 → 0.0487 after calibration
- SHAP global + local explanations
- Deployed to `gmsc-pd-endpoint` on Amazon SageMaker
