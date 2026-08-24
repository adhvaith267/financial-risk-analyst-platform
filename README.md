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

---

## Overview

Riskora is a full-stack financial risk platform built as a personal project to demonstrate the integration of classical quantitative risk methods with modern ML inference and LLM-based reasoning.

| Area | What is implemented |
| --- | --- |
| Credit Risk | Configured SageMaker LightGBM model for probability of default (PD), with deterministic LGD, EAD, and expected-loss calculation layered on top |
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
│   ├── tests/                  # pytest test suite
│   ├── pyproject.toml          # Python dependencies (managed with uv)
│   └── .env.example            # Template for required environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── platform/       # The five platform views and shared UI primitives
│   │   │   │   ├── ui.tsx          # Shared UI primitives and charts
│   │   │   │   ├── presentation.ts # Shared formatting and control classes
│   │   │   │   ├── dashboard-view.tsx
│   │   │   │   ├── credit-view.tsx
│   │   │   │   ├── market-view.tsx
│   │   │   │   ├── stress-view.tsx
│   │   │   │   └── ai-view.tsx
│   │   │   └── riskora/        # Landing page components (logo, header, footer…)
│   │   ├── lib/
│   │   │   ├── riskora-api.ts  # Axios-free API client + response shaping
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
│   │   ├── ec2-provision.sh    # EC2/network provisioning script
│   │   └── ec2-deploy.sh       # Repeatable application deployment script
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
        │     ├── Credit Risk engine  → SageMaker gmsc-pd-endpoint
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
              Deployed LightGBM PD model — gmsc-xgb-v1
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

When provisioned separately, the configured SageMaker endpoint hosts a LightGBM model trained on the Give Me Some Credit (GMSC) dataset. The model takes 10 borrower features and returns:

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
| SageMaker (ml.m5.xlarge) | Hosts the deployed LightGBM PD model (`gmsc-pd-endpoint`) |
| Amazon Bedrock | Hosts the LLM (`moonshot.kimi-k2-thinking`) per-request |
| S3 | Stores ML model artifacts and approved ingestion inputs |
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

The Vite dev server is configured to proxy all `/api/*` requests to `http://localhost:8000` (see `vite.config.ts`). You do not need Nginx locally. The repository does not generate synthetic production records; load approved borrower, loan, portfolio, and market data through the system's data-ingestion process.

### Without a running backend

The frontend does not fabricate fallback data. Network failures, invalid responses,
and backend errors are shown directly in the relevant view so unavailable
dependencies are visible to the analyst.

---

## Deployment (EC2)

Full setup instructions are in `deployment/aws/ec2-setup.sh` (run once on a fresh instance), `deployment/aws/ec2-provision.sh` (network/instance provisioning), and `deployment/aws/ec2-deploy.sh` (repeatable application deployment). The provisioning script requires `SSH_CIDR` so port 22 is restricted to an administrator network.

### Automated GitHub deployment

`.github/workflows/cd.yml` deploys to EC2 only after the `CI` workflow succeeds on `main`. Configure these secrets in the GitHub `production` environment:

- `EC2_HOST` — EC2 public hostname or Elastic IP
- `EC2_USER` — normally `ec2-user`
- `EC2_SSH_PRIVATE_KEY` — private key matching the EC2 key pair
- `EC2_KNOWN_HOSTS` — pinned output from `ssh-keyscan` for the host

The workflow uses a serialized production deployment, refuses a dirty EC2 checkout, applies migrations before restarting the API, and verifies both `/health` and `/ready`. Configure required reviewers on the `production` environment if live deployment approval is required.

The CD workflow deploys the application commit that passed CI to the EC2
instance. SageMaker model releases are managed separately from application
releases.

### Quick re-deploy after a code change

```bash
# SSH into the instance
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@15.206.37.142

cd /var/www/financial-risk-analyst

# Pull latest code (the setup script refuses to deploy over local changes)
git pull --ff-only origin main

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
| `DB_SSL_MODE` | No | `prefer` | PostgreSQL TLS mode; use `require` when RDS enforces encryption |
| `AWS_REGION` | No | `ap-south-1` | AWS region for SageMaker and Bedrock |
| `SAGEMAKER_ENDPOINT_NAME` | No | `gmsc-pd-endpoint` | SageMaker endpoint hosting the deployed GMSC PD model |
| `BEDROCK_MODEL_ID` | No | `moonshot.kimi-k2-thinking` | Bedrock model ID for the AI analyst |
| `DEFAULT_RECOVERY_RATE` | No | `0.60` | Recovery rate assumption when a loan has no specific value |
| `CREDIT_DECLINE_THRESHOLD` | No | `0.10` | PD above which a borrower is DECLINED |
| `ALLOWED_ORIGINS` | No | empty | Comma-separated CORS origins (set explicitly for cross-origin development) |

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

The test suite covers: credit risk engine (isolated SageMaker contract), market risk engine (deterministic fixtures), stress test engine (deterministic shock calculations), and invalid dependency-response handling. External AWS calls are isolated in unit tests and are not used as production fallbacks.

Every push and pull request runs the same backend Ruff/pytest gates and frontend TypeScript/ESLint/Prettier/Vite gates in GitHub Actions (`.github/workflows/ci.yml`).

On pushes to `main`, the CD workflow (`.github/workflows/cd.yml`) runs only
after CI succeeds, checks out the tested commit on EC2, builds the frontend,
applies migrations, restarts `financial-risk-api`, and verifies health and
readiness.

---
