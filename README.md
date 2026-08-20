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

## AWS Services

| Service | Resource | Role |
|---|---|---|
| EC2 | `fra-app-server` (t3.small, AL2023) | Nginx + FastAPI + React build |
| RDS | `fra-postgres-dev` (db.t4g.micro, PG 17) | All application data |
| SageMaker | `gmsc-pd-endpoint` (ml.m5.xlarge) | LightGBM PD model — real-time inference |
| Bedrock | `moonshot.kimi-k2-thinking` | Agent LLM — final answer synthesis |
| S3 | `financial-risk-analyst-adhvaith-2026` | ML dataset + model artifacts only |

---

## Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── graph.py          LangGraph ReAct agent
│   │   │   └── tools.py          5 tools: get_borrower, get_portfolio,
│   │   │                           assess_credit_risk, assess_market_risk,
│   │   │                           run_stress_scenario
│   │   ├── api/routes/           FastAPI routers (credit, market, stress, agent, dashboard)
│   │   ├── core/                 Settings + DB engine/session
│   │   ├── engines/              Credit risk, market risk, stress engines
│   │   ├── models/               SQLAlchemy ORM models
│   │   ├── schemas/              Pydantic request/response schemas
│   │   ├── services/             SageMaker boto3 client
│   │   └── main.py
│   ├── alembic/                  DB migrations
│   ├── scripts/
│   │   └── seed_demo_data.py     Seeds 30 borrowers + portfolio P001
│   └── tests/                    pytest unit tests (no AWS/DB required)
│
├── frontend/
│   └── src/
│       ├── pages/                Dashboard, CreditRisk, MarketRisk, StressTesting, AIAnalyst
│       └── components/           Sidebar, charts, AgentTrace, EvidencePanel …
│
├── deployment/
│   ├── nginx/
│   │   └── financial-risk.conf   Nginx config (HTTPS + SPA + /api/ reverse proxy)
│   ├── systemd/
│   │   └── financial-risk-api.service
│   └── aws/
│       ├── ec2-iam.sh            Create FRA-EC2Role + instance profile
│       ├── ec2-provision.sh      Provision EC2 instance
│       └── ec2-setup.sh          Full deploy script (run on EC2)
│
└── infra/
    ├── fra-dev-iam-policy.json   IAM policy for the fra-dev user
    └── scripts/
        ├── 01_provision_rds.sh   Provision RDS + security groups
        ├── 02_write_env.sh       Write /etc/financial-risk-analyst/env on EC2
        └── 03_allow_dev_ip.sh    Whitelist dev IP for direct RDS access
```

---

## Local Development

```bash
# Backend
cd backend
uv sync
cp .env.example .env          # fill in DB_HOST, DB_PASSWORD
export AWS_PROFILE=fra-dev    # for SageMaker + Bedrock calls
bash ../infra/scripts/03_allow_dev_ip.sh   # open your IP to RDS
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# http://localhost:8000  |  Swagger: http://localhost:8000/docs

# Frontend
cd frontend
npm install
npm run dev
# http://localhost:5173  (/api/* proxied to :8000 via vite.config.js)
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `ap-south-1` | AWS region |
| `DB_HOST` | — | RDS endpoint |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `fra` | Database name |
| `DB_USER` | `fra_admin` | Database user |
| `DB_PASSWORD` | — | RDS master password |
| `SAGEMAKER_ENDPOINT_NAME` | `gmsc-pd-endpoint` | SageMaker endpoint |
| `BEDROCK_MODEL_ID` | `moonshot.kimi-k2-thinking` | Bedrock model ID |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS — empty string in production |

> On EC2 with `FRA-EC2Role` attached, **do not** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. boto3 uses the instance role automatically.

---

## Database

```bash
# Run migrations
cd backend && uv run alembic upgrade head

# Seed demo data (30 borrowers/loans + portfolio P001 with ~2yr price history)
uv run python scripts/seed_demo_data.py
```

| Table | Contents |
|---|---|
| `borrowers` | Credit profiles (GMSC feature set — exact SageMaker input shape) |
| `loans` | Active/closed loans |
| `payments` | Payment history |
| `portfolios` | Named portfolios |
| `portfolio_holdings` | Asset quantities per portfolio |
| `assets` | Asset metadata (equity / bond / cash) |
| `market_prices` | Daily close prices |
| `risk_results` | Persisted credit + market assessments |
| `stress_results` | Persisted stress-test results |

---

## EC2 Deployment

```bash
# 1. Create EC2 IAM role (one-time, needs admin credentials)
bash deployment/aws/ec2-iam.sh

# 2. Provision EC2 instance
bash deployment/aws/ec2-provision.sh

# 3. SSH in and run full setup
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@<PUBLIC_IP>
curl -fsSL https://raw.githubusercontent.com/adhvaith267/financial-risk-analyst-platform/main/deployment/aws/ec2-setup.sh | bash

# 4. Fill in secrets and restart
sudo nano /etc/financial-risk-analyst/env
sudo systemctl restart financial-risk-api
```

### Redeploy after code changes

```bash
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@15.206.37.142
cd /var/www/financial-risk-analyst
git pull origin main
cd frontend && npm ci && npm run build
sudo systemctl restart financial-risk-api
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/dashboard/summary` | Headline KPIs + recent analyses |
| `GET` | `/api/credit/borrowers` | List all borrowers |
| `GET` | `/api/credit/borrowers/{id}/assess` | PD / LGD / EAD / EL + SHAP drivers |
| `GET` | `/api/market/portfolios` | List portfolios |
| `GET` | `/api/market/portfolios/{id}/risk` | VaR / ES / volatility / drawdown |
| `POST` | `/api/stress/portfolios/{id}/run` | Run a shock scenario |
| `POST` | `/api/agent/ask` | Natural-language question → agent answer + trace |

---

## Agent Tools

| Tool | What it does |
|---|---|
| `get_borrower` | Fetches borrower + active loan from RDS |
| `get_portfolio` | Fetches portfolio holdings from RDS |
| `assess_credit_risk` | Calls SageMaker → PD, computes LGD / EAD / EL |
| `assess_market_risk` | Historical-simulation VaR / ES / volatility / drawdown |
| `run_stress_scenario` | Equity + rate + default shocks across portfolio + loan book |

Example — *"Assess borrower B1001 and show the recession impact on P001"*:
```
Agent → assess_credit_risk(B1001) → run_stress_scenario(P001) → Bedrock → answer
```

---

## Testing

```bash
cd backend

# Unit tests — no AWS or DB required (28 tests)
uv run pytest tests/ -v

# Import check
uv run python -c "from app.agent.graph import ask; print('OK')"

# Frontend build check
cd ../frontend && npm run build
```

---

## Security

- FastAPI bound to `127.0.0.1:8000` — not reachable from the internet directly
- RDS in private subnet — accessible only from `fra-app-sg`
- EC2 uses IAM instance role — no static AWS credentials anywhere
- `FRA-EC2Role` is least-privilege: `sagemaker:InvokeEndpoint` + `bedrock:InvokeModel` only
- HTTPS via Let's Encrypt (auto-renews every 90 days)
- `/etc/financial-risk-analyst/env` — owned `root:ec2-user`, mode `640`

---

## Related Repository

PD model training and deployment:
[`adhvaith267/credit-default-pd-model`](https://github.com/adhvaith267/credit-default-pd-model)

- LightGBM, Optuna-tuned, isotonic-calibrated
- Brier score: 0.1421 → 0.0487 after calibration
- SHAP global + local explanations
- Deployed to `gmsc-pd-endpoint` SageMaker real-time endpoint
