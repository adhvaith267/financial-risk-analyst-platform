<div align="center">

# Riskora

**AI-powered financial risk analyst platform**

Riskora brings credit risk, portfolio market risk, stress testing, and tool-grounded AI analysis into one connected workspace.

[![Live Website](https://img.shields.io/badge/Live%20Website-riskora.online-0F766E?style=for-the-badge)](https://riskora.online)

**Backend**

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Uvicorn](https://img.shields.io/badge/Uvicorn-ASGI-499848?logo=gunicorn&logoColor=white)](https://www.uvicorn.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![uv](https://img.shields.io/badge/uv-package%20manager-DE5FE9)](https://github.com/astral-sh/uv)

**Frontend**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TanStack Router](https://img.shields.io/badge/TanStack%20Router-1.x-FF4154)](https://tanstack.com/router)

**AI & ML**

[![LangGraph](https://img.shields.io/badge/LangGraph-ReAct%20Agent-1C3C3C)](https://www.langchain.com/langgraph)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Kimi%20K2-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon SageMaker](https://img.shields.io/badge/Amazon%20SageMaker-LightGBM%20PD-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/sagemaker/)

**Infrastructure**

[![EC2](https://img.shields.io/badge/AWS%20EC2-t3.small-FF9900?logo=amazonec2&logoColor=white)](https://aws.amazon.com/ec2/)
[![RDS](https://img.shields.io/badge/AWS%20RDS-PostgreSQL%2017-527FFF?logo=amazonrds&logoColor=white)](https://aws.amazon.com/rds/)
[![Nginx](https://img.shields.io/badge/Nginx-reverse%20proxy-009639?logo=nginx&logoColor=white)](https://nginx.org/)

</div>

---

## Table of contents

1. [Overview](#overview)
2. [Repository structure](#repository-structure)
3. [Architecture](#architecture)
4. [Core risk engines](#core-risk-engines)
5. [AI analyst](#ai-analyst)
6. [API reference](#api-reference)
7. [Data model](#data-model)
8. [Technology stack](#technology-stack)
9. [Local development setup](#local-development-setup)
10. [Deployment (EC2)](#deployment-ec2)
11. [Environment variables](#environment-variables)
12. [Running tests](#running-tests)
13. [Drawbacks and known limitations](#drawbacks-and-known-limitations)
14. [Issues that could have arisen](#issues-that-could-have-arisen)

---

## Overview

Riskora is a full-stack financial risk platform built as a personal project to demonstrate the integration of classical quantitative risk methods with modern ML inference and LLM-based reasoning.

| Area | What is implemented |
| --- | --- |
| Credit Risk | SageMaker-hosted LightGBM model for probability of default (PD), with deterministic LGD, EAD, and expected-loss calculation layered on top |
| Market Risk | Historical-simulation VaR, parametric VaR, expected shortfall, drawdown, HHI concentration, and pairwise correlation, computed from stored daily prices |
| Stress Testing | Combined equity price shock, interest-rate duration shock, and default-rate shock applied simultaneously to the market portfolio and the full active credit book |
| AI Analyst | LangGraph ReAct agent backed by Amazon Bedrock (Kimi K2) that selects and calls the risk tools, then returns a grounded answer with its full tool-execution trace |
| Dashboard | Aggregated KPIs, recent analyses, and top risk drivers surfaced from stored results — no re-running the ML model on page load |

The frontend is a React SPA (TypeScript, TanStack Router, Tailwind CSS v4) served as static files by Nginx. The backend is a FastAPI service with SQLAlchemy and Alembic, running on the same EC2 instance behind Nginx's `/api/` reverse proxy.

---

## Repository structure

```
financial-risk-analyst-platform/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # FastAPI route handlers (one file per domain)
│   │   │   ├── credit.py
│   │   │   ├── market.py
│   │   │   ├── stress.py
│   │   │   ├── agent.py
│   │   │   └── dashboard.py
│   │   ├── agent/
│   │   │   ├── graph.py        # LangGraph ReAct agent (build, invoke, trace)
│   │   │   └── tools.py        # Five tools the agent can call
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic settings (reads .env / env vars)
│   │   │   └── db.py           # SQLAlchemy engine and session factory
│   │   ├── engines/
│   │   │   ├── credit_risk.py  # PD via SageMaker + LGD/EAD/EL
│   │   │   ├── market_risk.py  # Historical-sim VaR, ES, drawdown, HHI
│   │   │   └── stress.py       # Combined equity/rate/default shock engine
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── borrower.py     # Borrower, Loan, Payment
│   │   │   ├── market.py       # Asset, MarketPrice, Portfolio, PortfolioHolding
│   │   │   └── risk.py         # RiskResult, StressResult (persisted outputs)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   │   ├── credit.py
│   │   │   ├── market.py
│   │   │   ├── stress.py
│   │   │   ├── agent.py
│   │   │   └── dashboard.py
│   │   ├── services/
│   │   │   └── sagemaker_client.py  # Thin boto3 wrapper for gmsc-pd-endpoint
│   │   └── main.py             # FastAPI app, CORS middleware, router registration
│   ├── alembic/                # DB migration scripts
│   ├── scripts/
│   │   └── seed_demo_data.py   # Loads borrowers from S3, creates demo portfolio
│   ├── tests/                  # pytest test suite
│   ├── pyproject.toml          # Python dependencies (managed with uv)
│   └── .env.example            # Template for required environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── platform/       # The five platform views and shared UI primitives
│   │   │   │   ├── ui.tsx          # All hand-rolled UI: Panel, Metric, Gauge, charts…
│   │   │   │   ├── dashboard-view.tsx
│   │   │   │   ├── credit-view.tsx
│   │   │   │   ├── market-view.tsx
│   │   │   │   ├── stress-view.tsx
│   │   │   │   └── ai-view.tsx
│   │   │   └── riskora/        # Landing page components (logo, header, footer…)
│   │   ├── lib/
│   │   │   ├── riskora-api.ts  # Axios-free API client + response shaping
│   │   │   └── riskora-mock.ts # Fallback mock data used when backend is down
│   │   ├── routes/
│   │   │   ├── __root.tsx      # App shell (404 + error boundaries)
│   │   │   ├── index.tsx       # Landing page (/)
│   │   │   └── platform.tsx    # Platform SPA (/platform)
│   │   └── main.tsx            # React entry point
│   ├── package.json
│   └── vite.config.ts          # Dev proxy: /api → localhost:8000
│
├── deployment/
│   ├── aws/
│   │   ├── ec2-setup.sh        # Full provision script for a fresh Amazon Linux 2023 instance
│   │   └── ec2-provision.sh    # Re-deploy script (pull + rebuild + restart)
│   ├── nginx/
│   │   └── financial-risk.conf # Nginx config (HTTP→HTTPS redirect, SPA, /api proxy)
│   └── systemd/
│       └── financial-risk-api.service  # systemd unit for FastAPI/Uvicorn
│
├── infra/
│   ├── fra-dev-iam-policy.json # IAM policy for the dev CLI user
│   └── scripts/
│       ├── 01_provision_rds.sh # Creates the RDS PostgreSQL instance
│       ├── 02_write_env.sh     # Writes /etc/financial-risk-analyst/env on EC2
│       └── 03_allow_dev_ip.sh  # Opens port 5432 from your current IP to RDS SG
│
└── README.md
```

---

## Architecture

### Application architecture

```
riskora.online (DNS A record → EC2 Elastic IP 15.206.37.142)
        │
        │ HTTPS :443  (Let's Encrypt certificate)
        ▼
   EC2 t3.small  —  Amazon Linux 2023  —  ap-south-1
        │
        ├── Nginx
        │     ├── /          → React SPA static files (frontend/dist/)
        │     └── /api/*     → FastAPI :8000 (reverse proxy, strips /api prefix)
        │
        ├── FastAPI :8000  (systemd service, 2 Uvicorn workers, localhost only)
        │     ├── Credit Risk engine  → SageMaker  gmsc-pd-endpoint
        │     ├── Market Risk engine  → RDS PostgreSQL
        │     ├── Stress Test engine  → RDS + SageMaker
        │     └── LangGraph ReAct agent
        │           ├── Tool: get_borrower         → RDS
        │           ├── Tool: get_portfolio         → RDS
        │           ├── Tool: assess_credit_risk    → Credit engine
        │           ├── Tool: assess_market_risk    → Market engine
        │           └── Tool: run_stress_scenario   → Stress engine
        │                 └── LLM: Amazon Bedrock  moonshot.kimi-k2-thinking
        │
        ├── RDS PostgreSQL 17  (db.t4g.micro, private subnet)
        │     fra-postgres-dev  —  only reachable from fra-app-sg
        │
        └── SageMaker  gmsc-pd-endpoint  (ml.m5.xlarge, real-time)
              LightGBM PD model — gmsc-xgb-v1 — from financial-risk-analyst-ml repo
```

FastAPI is bound to `127.0.0.1:8000` and is not reachable directly from the internet. All traffic goes through Nginx. RDS is in a private subnet with a security group that only accepts connections from the EC2 instance's security group (`fra-app-sg`). SageMaker is invoked via the boto3 SDK using the EC2 instance's IAM role (`FRA-EC2Role`) — no access keys are stored on the instance.

### Request flow

```
Browser → Nginx /api/credit/borrowers/B1001/assess
        → FastAPI /credit/borrowers/B1001/assess
        → credit_risk engine
        → PDModelClient.predict()  →  SageMaker gmsc-pd-endpoint
        ← { pd, status, model_version, risk_drivers }
        ← engine computes LGD = 1 − recovery_rate, EAD, EL = PD × LGD × EAD
        → RiskResult persisted to RDS
        ← CreditAssessmentResponse  →  Nginx  →  Browser
```

---

## Core risk engines

### Credit risk

`backend/app/engines/credit_risk.py`

The SageMaker endpoint (`gmsc-pd-endpoint`) hosts a LightGBM model trained on the Give Me Some Credit (GMSC) dataset. The model takes 10 borrower features and returns:

- `pd` — probability of default (0–1)
- `status` — `APPROVED` or `DECLINED` based on the configured threshold
- `model_version` — the model artifact version string
- `risk_drivers` — top SHAP feature contributors when `explain=True`

The backend then computes three deterministic quantities:

| Metric | Formula | Source |
| --- | --- | --- |
| Loss Given Default (LGD) | `1 − recovery_rate` | Loan record or default (0.60) |
| Exposure at Default (EAD) | `loan.outstanding_balance` | Loan record |
| Expected Loss (EL) | `PD × LGD × EAD` | Derived |

The SageMaker model predicts only PD. No dollar amounts are predicted by ML — they are always computed deterministically from the PD.

### Market risk

`backend/app/engines/market_risk.py`

The engine loads daily close prices and current holdings from RDS, then runs a historical-simulation approach:

1. Computes daily portfolio returns by weighting each asset's return by its current dollar weight.
2. From those returns, derives: daily volatility, annualized volatility (`σ × √252`), historical VaR at 95% and 99%, parametric VaR at 95% (`1.645 × σ × V`), expected shortfall at 95% (mean of returns beyond the 5th percentile), and maximum drawdown.
3. Computes the pairwise correlation matrix and the HHI concentration index.
4. Derives plain-language risk drivers: any position ≥ 20% of portfolio value, any pair of holdings with correlation ≥ 0.70.

The portfolio value history returned to the frontend is today's holdings priced at each historical date — it is a reconstruction of what the current portfolio would have been worth, not an actual NAV track record.

### Stress testing

`backend/app/engines/stress.py`

A single stress run applies three simultaneous shocks:

| Shock | Mechanism |
| --- | --- |
| Equity shock (e.g. −20%) | Applied as a direct price multiplier to all equity holdings |
| Interest-rate shock (e.g. +200 bps) | Translated to a bond price move using `ΔP/P ≈ −duration × Δy`, where duration is fixed at 17 years (modeled on a 20+ year Treasury ETF) |
| Default-rate shock (e.g. +2%) | Applied as a relative PD increase to every active borrower in the loan book via a batched SageMaker call; the delta EL is the credit loss |

Outputs: market loss, credit loss, combined loss, baseline and stressed portfolio value, baseline and stressed total expected loss.

The market and credit books are intentionally separate in the data model — the stress test always applies the credit shock firm-wide (all active loans), not just to the loans associated with a specific portfolio.

---

## AI analyst

`backend/app/agent/`

The AI analyst is a LangGraph `create_react_agent` loop backed by `ChatBedrockConverse` (Kimi K2 Thinking on Amazon Bedrock, `moonshot.kimi-k2-thinking`).

### Tools

| Tool | What it does |
| --- | --- |
| `get_borrower` | Fetches borrower profile and active loan from RDS |
| `get_portfolio` | Fetches portfolio holdings from RDS |
| `assess_credit_risk` | Calls the credit risk engine (SageMaker + LGD/EAD/EL) |
| `assess_market_risk` | Calls the market risk engine |
| `run_stress_scenario` | Calls the stress testing engine |

Each tool opens its own short-lived SQLAlchemy session rather than sharing one across tool calls. This is required because LangGraph's `ToolNode` may invoke multiple tools concurrently in separate threads, and SQLAlchemy sessions are not thread-safe.

### How the trace is built

The `/api/agent/ask` endpoint returns a `trace` array alongside the answer. The trace is reconstructed from the actual LangGraph message history — `AIMessage.tool_calls` gives the call order and arguments, and the matching `ToolMessage` (matched by `tool_call_id`) gives whether the call succeeded. Tools that handle failures gracefully (e.g. borrower not found) return a JSON `{"error": "..."}` string rather than raising an exception, so the trace parser checks both `ToolMessage.status` and the response body.

### System prompt design

The system prompt enforces that the agent must never calculate any risk number itself — every number in its answer must come from a tool result. If a tool returns an error (borrower not found, endpoint unavailable), the agent is instructed to say so rather than estimate.

The current model (Kimi K2 Thinking) returns its chain-of-thought inline as `<think>...</think>` blocks. The `_extract_text` function in `graph.py` strips these before returning the answer to the user.

---

## API reference

The FastAPI app is mounted with `root_path="/api"`, so all routes are available under `/api/` through Nginx. Locally (direct to Uvicorn), the `/api` prefix is absent.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/dashboard/summary` | Aggregated KPIs, top risk drivers, recent analyses |
| `GET` | `/api/credit/borrowers` | List all borrowers with active-loan flag |
| `GET` | `/api/credit/borrowers/{borrower_id}/assess` | Run credit assessment; `?explain=true` for SHAP drivers |
| `GET` | `/api/market/portfolios` | List all portfolios |
| `GET` | `/api/market/portfolios/{portfolio_id}/risk` | Run market risk assessment |
| `POST` | `/api/stress/portfolios/{portfolio_id}/run` | Run stress scenario (body: `scenario_name`, `equity_shock`, `rate_shock_bps`, `default_shock`) |
| `POST` | `/api/agent/ask` | Ask the AI analyst (body: `{ "question": "..." }`) |

Borrower and portfolio IDs are case-insensitive in the frontend client — they are uppercased before the request is sent. The backend stores and queries them as uppercase (`B1001`, `P001`).

---

## Data model

The schema has two parallel books that share no foreign key — the **credit book** (borrowers, loans, payments) and the **market book** (assets, market prices, portfolios, holdings). Stress tests and audit results sit alongside both books and reference them loosely via string IDs.

```
╔══════════════════════════════════════╗     ╔══════════════════════════════════════════╗
║  CREDIT BOOK                         ║     ║  MARKET BOOK                             ║
╠══════════════════════════════════════╣     ╠══════════════════════════════════════════╣
║                                      ║     ║                                          ║
║  ┌─────────────────────────────┐     ║     ║  ┌───────────────────────────────┐       ║
║  │         borrowers           │     ║     ║  │           assets              │       ║
║  ├─────────────────────────────┤     ║     ║  ├───────────────────────────────┤       ║
║  │ PK  borrower_id  VARCHAR    │     ║     ║  │ PK  asset_id        VARCHAR   │       ║
║  │     name         VARCHAR    │     ║     ║  │     name            VARCHAR   │       ║
║  │     age          INTEGER    │     ║     ║  │     asset_class     VARCHAR   │       ║
║  │     revolving_utilization.. │     ║     ║  │         (equity|bond|cash)    │       ║
║  │     number_30_59_days_past  │     ║     ║  └───────────────┬───────────────┘       ║
║  │     debt_ratio   FLOAT      │     ║     ║                  │ 1                     ║
║  │     monthly_income  FLOAT   │     ║     ║                  │                       ║
║  │     number_open_credit..    │     ║     ║                  │ N                     ║
║  │     number_90_days_late     │     ║     ║  ┌───────────────▼───────────────┐       ║
║  │     number_re_loans         │     ║     ║  │        market_prices          │       ║
║  │     number_60_89_days_past  │     ║     ║  ├───────────────────────────────┤       ║
║  │     number_of_dependents    │     ║     ║  │ PK  id           SERIAL       │       ║
║  │     created_at   TIMESTAMPZ │     ║     ║  │ FK  asset_id     VARCHAR      │       ║
║  └──────────────┬──────────────┘     ║     ║  │     price_date   DATE         │       ║
║                 │ 1                  ║     ║  │     close_price  FLOAT        │       ║
║                 │                    ║     ║  └───────────────────────────────┘       ║
║                 │ N                  ║     ║                                          ║
║  ┌──────────────▼──────────────┐     ║     ║  ┌───────────────────────────────┐       ║
║  │           loans             │     ║     ║  │         portfolios            │       ║
║  ├─────────────────────────────┤     ║     ║  ├───────────────────────────────┤       ║
║  │ PK  loan_id      VARCHAR    │     ║     ║  │ PK  portfolio_id  VARCHAR     │       ║
║  │ FK  borrower_id  VARCHAR    │     ║     ║  │     name          VARCHAR     │       ║
║  │     loan_type    VARCHAR    │     ║     ║  └───────────────┬───────────────┘       ║
║  │     outstanding_balance     │     ║     ║                  │ 1                     ║
║  │       FLOAT  ← EAD proxy   │     ║     ║                  │                       ║
║  │     recovery_rate  FLOAT    │     ║     ║                  │ N                     ║
║  │       ← LGD = 1 − rate     │     ║     ║  ┌───────────────▼───────────────┐       ║
║  │     origination_date  DATE  │     ║     ║  │      portfolio_holdings       │       ║
║  │     status  VARCHAR         │     ║     ║  ├───────────────────────────────┤       ║
║  │       (active|closed)       │     ║     ║  │ PK  id            SERIAL      │       ║
║  └──────────────┬──────────────┘     ║     ║  │ FK  portfolio_id  VARCHAR ────┼──┐   ║
║                 │ 1                  ║     ║  │ FK  asset_id      VARCHAR ────┼──┘   ║
║                 │                    ║     ║  │     quantity      FLOAT       │       ║
║                 │ N                  ║     ║  │     as_of_date    DATE        │       ║
║  ┌──────────────▼──────────────┐     ║     ║  └───────────────────────────────┘       ║
║  │          payments           │     ║     ║                                          ║
║  ├─────────────────────────────┤     ║     ╚══════════════════════════════════════════╝
║  │ PK  payment_id   SERIAL     │     ║
║  │ FK  loan_id      VARCHAR    │     ║     ╔══════════════════════════════════════════╗
║  │     payment_date DATE       │     ║     ║  AUDIT / RESULTS                         ║
║  │     amount       FLOAT      │     ║     ╠══════════════════════════════════════════╣
║  │     status       VARCHAR    │     ║     ║                                          ║
║  │       (paid|missed|...)     │     ║     ║  ┌───────────────────────────────┐       ║
║  └─────────────────────────────┘     ║     ║  │         risk_results          │       ║
║                                      ║     ║  ├───────────────────────────────┤       ║
╚══════════════════════════════════════╝     ║  │ PK  id           SERIAL       │       ║
                                             ║  │     entity_type  VARCHAR      │       ║
                                             ║  │       (borrower|portfolio)    │       ║
                                             ║  │     entity_id    VARCHAR ·····│·· loose ref to
                                             ║  │     risk_type    VARCHAR      │       ║  borrower_id
                                             ║  │       (credit|market)         │       ║  or portfolio_id
                                             ║  │     payload      JSON         │       ║
                                             ║  │       pd/lgd/ead/el           │       ║
                                             ║  │       var/es/volatility/...   │       ║
                                             ║  │     computed_at  TIMESTAMPZ   │       ║
                                             ║  └───────────────────────────────┘       ║
                                             ║                                          ║
                                             ║  ┌───────────────────────────────┐       ║
                                             ║  │        stress_results         │       ║
                                             ║  ├───────────────────────────────┤       ║
                                             ║  │ PK  id             SERIAL     │       ║
                                             ║  │     portfolio_id   VARCHAR ···│·· loose ref
                                             ║  │     scenario_name  VARCHAR    │       ║
                                             ║  │     shocks         JSON       │       ║
                                             ║  │       equity_shock            │       ║
                                             ║  │       rate_shock_bps          │       ║
                                             ║  │       default_shock           │       ║
                                             ║  │     market_loss    FLOAT      │       ║
                                             ║  │     credit_loss    FLOAT      │       ║
                                             ║  │     combined_loss  FLOAT      │       ║
                                             ║  │     computed_at    TIMESTAMPZ │       ║
                                             ║  └───────────────────────────────┘       ║
                                             ║                                          ║
                                             ╚══════════════════════════════════════════╝

  Legend
  ──────
  PK   Primary key           FK   Foreign key (enforced by DB)
  ·    Loose reference       1    One side of a relationship
  N    Many side             SERIAL  Auto-incrementing integer
```

There is no foreign key between portfolios and loans. The credit book (borrowers + loans) and the market book (portfolios + holdings) are parallel, not nested. The stress test always applies the default shock firm-wide across all active loans, regardless of which portfolio ID is passed in the URL.

---

## Technology stack

### Backend

| Technology | Role |
| --- | --- |
| Python 3.11 | Runtime |
| FastAPI 0.115 | HTTP framework, automatic OpenAPI docs |
| Uvicorn | ASGI server (2 workers in production) |
| Pydantic v2 | Request/response validation and settings management |
| SQLAlchemy 2 | ORM (async-compatible, but used synchronously here) |
| Alembic | Database migration tool |
| psycopg 3 | PostgreSQL driver (binary package) |
| boto3 | AWS SDK — SageMaker Runtime and Bedrock invocation |
| NumPy, pandas, SciPy | Quantitative risk calculations |
| LangGraph 0.2 | ReAct agent graph orchestration |
| LangChain Core 0.3 | Message types, tool primitives |
| LangChain AWS 0.2 | `ChatBedrockConverse` model adapter |
| uv | Fast Python package manager (replaces pip + venv) |

### Frontend

| Technology | Role |
| --- | --- |
| React 19 | UI library |
| TypeScript 5.8 | Type safety |
| Vite 6 | Build tool and dev server |
| TanStack Router 1.x | File-based routing with type-safe navigation |
| TanStack Query 5.x | Server state management (wired in root, used for future expansion) |
| Tailwind CSS v4 | Utility-first styling |
| Lucide React | Icon library |
| clsx + tailwind-merge | Conditional class merging |

### AWS services

| Service | Usage |
| --- | --- |
| EC2 t3.small | Hosts Nginx + FastAPI on Amazon Linux 2023 |
| Elastic IP | Static IP for the EC2 instance (15.206.37.142) |
| RDS PostgreSQL 17 (db.t4g.micro) | Primary data store, private subnet |
| SageMaker (ml.m5.xlarge) | Hosts the LightGBM PD model (`gmsc-pd-endpoint`) |
| Amazon Bedrock | Hosts the LLM (`moonshot.kimi-k2-thinking`) per-request |
| S3 | Stores ML model artifacts and the borrower seed CSV |
| IAM | EC2 instance role (`FRA-EC2Role`) with least-privilege SageMaker + Bedrock access |

### Tooling

| Tool | Usage |
| --- | --- |
| Nginx | Reverse proxy and static file server |
| systemd | Manages the FastAPI service (`financial-risk-api.service`) |
| Let's Encrypt / Certbot | HTTPS certificate with auto-renewal |
| Alembic | Database migrations |
| pytest | Backend test suite |
| Ruff | Python linter and formatter |
| AWS CLI (profile: `fra-dev`) | Infrastructure management from a dev laptop |

---

## Local development setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- [uv](https://github.com/astral-sh/uv) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- AWS CLI configured with a profile that has SageMaker + Bedrock + RDS access
- A running PostgreSQL instance (local or RDS with your IP allowed)

### Backend

```bash
cd backend

# Create virtualenv and install dependencies
uv sync

# Copy the env template and fill in DB credentials + AWS config
cp .env.example .env
# Edit .env: set DB_HOST, DB_PASSWORD, AWS_PROFILE, etc.

# Run database migrations
uv run alembic upgrade head

# Seed demo data (requires S3 access and a running SageMaker endpoint)
uv run python scripts/seed_demo_data.py

# Start the development server
uv run uvicorn app.main:app --reload --port 8000
# API available at http://localhost:8000
# OpenAPI docs at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (proxies /api/* → localhost:8000 automatically)
npm run dev
# App available at http://localhost:5173
```

The Vite dev server is configured to proxy all `/api/*` requests to `http://localhost:8000` (see `vite.config.ts`). You do not need Nginx locally.

### Without a running backend

If the backend is unreachable, the frontend automatically falls back to the mock data in `src/lib/riskora-mock.ts`. The mock always returns the same fixed response, which makes it obvious something is wrong. Remove or skip the fallback in `riskora-api.ts` if you want hard errors during development.

---

## Deployment (EC2)

Full setup instructions are in `deployment/aws/ec2-setup.sh` (run once on a fresh instance) and `deployment/aws/ec2-provision.sh` (re-deploy after code changes).

### Quick re-deploy after a code change

```bash
# SSH into the instance
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@15.206.37.142

cd /var/www/financial-risk-analyst

# Pull latest code
git pull origin main

# Rebuild frontend (if frontend changed)
cd frontend && npm ci && npm run build

# Restart backend (if backend changed)
sudo systemctl restart financial-risk-api

# Reload Nginx config (if nginx conf changed)
sudo cp deployment/nginx/financial-risk.conf /etc/nginx/conf.d/financial-risk.conf
sudo nginx -t && sudo systemctl reload nginx
```

### Service management

```bash
# FastAPI service
sudo systemctl status  financial-risk-api
sudo systemctl restart financial-risk-api
sudo journalctl -u     financial-risk-api -f        # live logs
sudo journalctl -u     financial-risk-api -n 100

# Nginx
sudo systemctl status  nginx
sudo systemctl reload  nginx
```

### Cost-saving: pausing the infrastructure

The SageMaker endpoint (`ml.m5.xlarge`) costs ~$5.50/day and is the dominant cost item. Delete it when not in use:

```bash
# Delete SageMaker endpoint (model config and artifacts are preserved in S3)
aws sagemaker delete-endpoint --profile fra-dev --region ap-south-1 \
  --endpoint-name gmsc-pd-endpoint

# Stop EC2 instance (EBS still billed ~$0.80/mo; Elastic IP is free while associated)
aws ec2 stop-instances --profile fra-dev --region ap-south-1 \
  --instance-ids i-05ab2e470d0c8d247

# Stop RDS (auto-restarts after 7 days)
aws rds stop-db-instance --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev
```

---

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in the required values. On EC2, the env file lives at `/etc/financial-risk-analyst/env` and is read by the systemd service.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DB_HOST` | Yes | — | RDS PostgreSQL endpoint hostname |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | No | `fra` | Database name |
| `DB_USER` | No | `fra_admin` | Database user |
| `DB_PASSWORD` | Yes | — | Database password |
| `AWS_REGION` | No | `ap-south-1` | AWS region for SageMaker and Bedrock |
| `SAGEMAKER_ENDPOINT_NAME` | No | `gmsc-pd-endpoint` | SageMaker endpoint to invoke for PD |
| `BEDROCK_MODEL_ID` | No | `moonshot.kimi-k2-thinking` | Bedrock model ID for the AI analyst |
| `DEFAULT_RECOVERY_RATE` | No | `0.60` | Recovery rate assumption when a loan has no specific value |
| `CREDIT_DECLINE_THRESHOLD` | No | `0.10` | PD above which a borrower is DECLINED |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated CORS origins (leave empty in production behind Nginx) |

On EC2 with `FRA-EC2Role` attached, do not set `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. boto3 picks up the instance role automatically. For local dev, set `AWS_PROFILE=fra-dev` in your `.env`.

---

## Running tests

```bash
cd backend

# Allow your laptop IP to reach RDS first (if testing against the real DB)
bash ../infra/scripts/03_allow_dev_ip.sh

# Set environment variables
export DB_HOST=<rds-endpoint>
export DB_PASSWORD=<password>

# Run the test suite
uv run pytest

# With coverage
uv run pytest --cov=app --cov-report=term-missing
```

The test suite covers: credit risk engine (mocked SageMaker), market risk engine (synthetic price history), and stress test engine (deterministic shock calculations). The agent tests require a live Bedrock endpoint and are tagged to be skippable.

---

## Drawbacks and known limitations

These are honest constraints of the current implementation, not bugs.

**Single-model PD**
The credit risk engine uses one LightGBM model trained on the GMSC consumer-credit dataset. It was not retrained on borrower-specific data. PD values should be treated as illustrative, not production-grade. A real credit system would calibrate the model to its own historical default rates and apply regulatory capital add-ons.

**Fixed LGD and duration assumptions**
LGD is computed as `1 − recovery_rate` using a flat default of 0.60 for loans that don't specify their own rate. The stress test uses a fixed bond effective duration of 17 years for all bond holdings. Both are reasonable approximations for a demo but would require asset-specific parameterization in production.

**No async I/O**
The FastAPI app uses synchronous SQLAlchemy and synchronous boto3 calls. Both the DB and SageMaker/Bedrock calls block the Uvicorn worker thread. With 2 workers, this means a maximum of 2 concurrent requests that involve I/O. Under any real load this would saturate quickly. Migrating to `asyncpg` and `aioboto3` (or an async Bedrock SDK) would be the correct fix.

**Static portfolio holdings**
The market and stress engines use a current holdings snapshot. There is no time-series of portfolio composition changes, no P&L attribution, and no intraday price data. The value history chart on the market risk view shows what the current portfolio would have been worth in the past — it is not an actual NAV track record.

**Agent latency**
The AI analyst makes multiple sequential tool calls, each of which may involve a SageMaker invocation. A single question can take 30–90 seconds depending on the model's reasoning depth and the number of tools called. The frontend shows a loading indicator but there is no streaming — the full response is returned in one shot.

**No authentication or authorization**
The platform has no login, no user accounts, and no access control. Anyone with the URL can read all data and run all analyses. This is acceptable for a personal demo but rules out any multi-tenant or sensitive-data use case without a significant auth layer.

**Dashboard computes market risk on every load**
The dashboard endpoint calls `assess_portfolio()` for every portfolio to aggregate a total portfolio value and headline metrics. For the current single-portfolio demo this is fast, but this pattern would be expensive at any real portfolio count. The correct approach is to cache or pre-compute these metrics and serve them from the `risk_results` table.

**Mock fallback masks backend errors silently**
When the backend returns a 5xx error, the frontend falls back to hardcoded mock data and shows no error to the user. This was convenient for demos when the SageMaker endpoint was down, but it makes real failures invisible. The 404 case was already fixed (it now surfaces as an error), but 5xx errors still silently return mock data.

**No rate limiting or request validation beyond schema**
The API has no rate limiting, no request size limits beyond Pydantic's schema validation, and no authentication. Bedrock and SageMaker calls are billed per request, so a malicious or runaway caller could incur unbounded costs.

---

## Issues that could have arisen

These are real architectural risks — things that did not become problems in this project but easily could have with different choices or at larger scale.

**Case-sensitive IDs causing silent fallback to mock data**
This one actually did occur during development. The backend stores and queries borrower and portfolio IDs in uppercase (`B1001`, `P001`). The frontend was sending user-typed input directly without normalizing case. A user typing `p001` or `b1001` got a 404 from the backend, which the API client silently converted to mock data. The fix was to uppercase IDs in the API client before sending and to stop treating 404 as a fallback trigger. The lesson: when IDs are case-sensitive strings, normalize at the edge closest to the user, not deep in the backend.

**SQLAlchemy sessions shared across threads in the agent**
LangGraph's `ToolNode` can run tool calls concurrently in separate threads. SQLAlchemy `Session` objects are explicitly not thread-safe — sharing a single session across tool calls in a multi-threaded context would cause intermittent `DetachedInstanceError` or silent data corruption. The tools were written to open and close their own short-lived sessions per call, which avoids this entirely. Had the tools shared a single session injected at startup, this would have been a hard-to-reproduce race condition.

**SageMaker model artifact version mismatch**
The credit engine is tightly coupled to the exact feature schema (`to_pd_model_payload()`) that the deployed endpoint expects. If the model were retrained and redeployed with a different feature set or feature name casing without updating the application, every credit assessment would silently fail or return garbage scores. The mitigation used here is to return `model_version` in every response so the caller can detect a mismatch. A production system would validate the endpoint's expected input schema at startup.

**Bedrock model pulling chain-of-thought into the answer**
The Kimi K2 Thinking model returns its chain-of-thought reasoning as inline `<think>...</think>` XML blocks in the response text, rather than in a separate content field. If the `_extract_text` function in `graph.py` did not strip those blocks, the user would see hundreds of lines of internal reasoning before the actual answer. Different Bedrock models handle this differently (some use a dedicated `reasoningContent` block, others use inline text), so the extraction logic needs to handle both and be updated when the model changes.

**Database schema and ORM model drift**
Alembic generates migrations by diffing the SQLAlchemy model definitions against the current database schema. If a column is added or renamed directly in the database (e.g., via a hotfix SQL statement) without a corresponding migration, subsequent `alembic upgrade head` runs will not fix the drift, and the ORM will either fail with a column error or silently ignore the mismatch. The project avoids this by using Alembic exclusively for schema changes, but without CI enforcement there is nothing stopping a direct SQL change.

**Nginx stripping the /api prefix before FastAPI sees it**
The Nginx config uses `proxy_pass http://127.0.0.1:8000/;` (note the trailing slash), which causes Nginx to strip the `/api/` prefix before forwarding to FastAPI. FastAPI is configured with `root_path="/api"` to reconstruct the correct URL in OpenAPI docs and redirects. If the trailing slash were removed from the `proxy_pass` directive, FastAPI would receive requests with the `/api/` prefix still intact and all route matching would fail with 404s. This is a subtle Nginx configuration gotcha that is easy to accidentally change during an edit.

**RDS in a private subnet with no connection retry**
The SQLAlchemy engine is created with `pool_pre_ping=True`, which sends a lightweight `SELECT 1` before each connection to detect stale connections. However, there is no retry logic for the case where RDS is temporarily unavailable (e.g., during a Multi-AZ failover or a manual restart). A request arriving during a ~30-second RDS failover window would receive a 500 error. Adding a retry with exponential backoff at the connection level would make the application resilient to brief DB unavailability.

**EAD approximated as outstanding balance**
The exposure at default (EAD) is approximated as `loan.outstanding_balance`. For a revolving credit facility, the actual EAD at default would include undrawn commitments, which can be significantly larger than the current balance. This is documented as an MVP assumption in the code comments but could lead to materially understated expected-loss figures for credit card or revolver portfolios. For a mortgage-only book, the approximation is reasonable.
