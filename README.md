<div align="center">

# Financial Risk Analyst Platform

AI-powered financial risk analyst — an agentic platform that combines
deterministic quantitative finance, a trained credit risk model, and a
LangGraph ReAct agent on Amazon Bedrock to answer questions like
*"Assess borrower B1001"* or *"What happens to P001 in a recession?"*
with a single, explained, numbers-first answer.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-ReAct%20agent-1C3C3C)](https://www.langchain.com/langgraph)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-Kimi%20K2-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon SageMaker](https://img.shields.io/badge/SageMaker-LightGBM%20PD-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/sagemaker/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![EC2](https://img.shields.io/badge/AWS-EC2-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/ec2/)

</div>

---

## Architecture

```
                              ┌─────────────────────────────────────────────────────┐
                              │                    AWS EC2  (t3.small)               │
                              │                                                       │
   ┌──────────┐   HTTP :80    │  ┌─────────────────────────────────────────────────┐ │
   │          │ ────────────► │  │                    Nginx                         │ │
   │  Analyst │               │  │  /          → React SPA  (dist/index.html)       │ │
   │ (Browser)│ ◄──────────── │  │  /api/*     → FastAPI  (strips /api prefix)      │ │
   └──────────┘               │  └────────────────────┬────────────────────────────┘ │
                              │                        │  127.0.0.1:8000             │
                              │            ┌───────────▼───────────────┐             │
                              │            │         FastAPI            │             │
                              │            │    /credit  /market        │             │
                              │            │    /stress  /agent         │             │
                              │            └───────────┬───────────────┘             │
                              │                        │                             │
                              │            ┌───────────▼───────────────┐             │
                              │            │   LangGraph ReAct Agent    │             │
                              │            │                            │             │
                              │            │  thinks → picks tool(s)   │             │
                              │            │  calls → observes result  │             │
                              │            │  repeats until done       │             │
                              │            └──────┬──────────┬─────────┘             │
                              │                   │          │         │             │
                              └───────────────────┼──────────┼─────────┼─────────────┘
                                                  │          │         │
               ┌──────────────────────────────────┘          │         └──────────────────────────────┐
               │                                             │                                        │
   ┌───────────▼─────────────────┐            ┌─────────────▼──────────────┐          ┌──────────────▼────────────────┐
   │     Credit Risk Tool        │            │    Market Risk Tool         │          │    Stress Testing Tool        │
   │                             │            │                             │          │                               │
   │  1. fetch borrower + loan   │            │  1. fetch portfolio         │          │  1. fetch portfolio + loans   │
   │  2. build SageMaker payload │            │     holdings + prices       │          │  2. apply equity shock        │
   │  3. call SageMaker endpoint │            │  2. compute returns         │          │  3. apply rate shock          │
   │  4. PD  ──────────────────► │            │  3. VaR / ES / vol          │          │  4. apply default shock       │
   │  5. LGD = 1 − recovery_rate │            │  4. drawdown / HHI          │          │  5. market loss +             │
   │  6. EAD = balance           │            │                             │          │     credit loss →             │
   │  7. EL  = PD × LGD × EAD   │            │                             │          │     combined loss             │
   └──────────┬──────────────────┘            └──────────────┬─────────────┘          └────────────────┬──────────────┘
              │                                              │                                          │
              │          ┌───────────────────────────────────┘                                          │
              │          │                                        ┌─────────────────────────────────────┘
              │          │                                        │
   ┌──────────▼──────────▼────────────────────────────────────────▼──────────────┐
   │                           RDS PostgreSQL  (fra-postgres-dev)                  │
   │                                                                               │
   │   borrowers · loans · portfolios · portfolio_holdings · assets                │
   │   market_prices · payments · risk_results · stress_results                   │
   └───────────────────────────────────────────────────────────────────────────────┘

              │          │                                        │
              └──────────┴────────────┬───────────────────────────┘
                                      │  structured tool results
                          ┌───────────▼───────────────┐
                          │                            │
                          │   Amazon Bedrock LLM       │
                          │   Kimi K2 Thinking         │
                          │   (Converse API)           │
                          │                            │
                          │  • reads tool outputs      │
                          │  • never invents numbers   │
                          │  • explains in plain       │
                          │    language for analysts   │
                          └───────────┬───────────────┘
                                      │  natural-language answer
                                      ▼
                              FastAPI → Nginx → Browser

   ┌──────────────────────────────────────────────────┐
   │              AWS SageMaker                        │
   │         gmsc-pd-endpoint  (ml.m5.xlarge)          │
   │                                                   │
   │   LightGBM PD model  (isotonic-calibrated)        │
   │   Input : 10 GMSC credit features                 │
   │   Output: { pd, status, risk_drivers (SHAP) }     │
   └──────────────────────────────────────────────────┘
         ▲  called only by Credit Risk Tool

   ┌──────────────────────────────────────────────────┐
   │              AWS S3  (ML lifecycle only)          │
   │  raw/         GMSC raw dataset                    │
   │  processed/   feature-engineered training data    │
   │  artifacts/   model.tar.gz  (SageMaker reads)     │
   └──────────────────────────────────────────────────┘
```

> **Key principle:** the LLM never computes a risk number. Every PD, LGD, EAD,
> Expected Loss, VaR, Expected Shortfall, or stress-test loss comes from a
> deterministic engine or the SageMaker model. The agent selects tools and
> synthesises results — it does not invent figures.

---

## AWS Services

| Service | Resource | Purpose |
|---------|----------|---------|
| **EC2** | `fra-app-server` (t3.small, Amazon Linux 2023) | Runs Nginx + FastAPI + React build |
| **RDS PostgreSQL** | `fra-postgres-dev` (db.t4g.micro, PG 17) | All structured application data |
| **SageMaker** | `gmsc-pd-endpoint` (ml.m5.xlarge) | LightGBM PD model — real-time inference |
| **Bedrock** | `moonshot.kimi-k2-thinking` | Agent LLM — final synthesis of tool results |
| **S3** | `financial-risk-analyst-adhvaith-2026` | ML dataset + SageMaker model artifacts only |
| **Secrets Manager** | `fra/rds/master-password` | RDS master password |

---

## Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── graph.py        LangGraph ReAct agent + trace helpers
│   │   │   └── tools.py        5 tools: get_borrower, get_portfolio,
│   │   │                         assess_credit_risk, assess_market_risk,
│   │   │                         run_stress_scenario
│   │   ├── api/routes/         FastAPI routers (credit, market, stress, agent, dashboard)
│   │   ├── core/               Settings (pydantic-settings) + DB engine/session
│   │   ├── engines/            Deterministic engines: credit_risk, market_risk, stress
│   │   ├── models/             SQLAlchemy ORM models
│   │   ├── schemas/            Pydantic request/response schemas
│   │   ├── services/           SageMaker boto3 client
│   │   └── main.py
│   ├── alembic/                DB migrations
│   ├── scripts/
│   │   └── seed_demo_data.py   Seeds 30 borrowers + portfolio P001
│   └── tests/                  pytest — pure-function unit tests (no AWS/DB required)
│
├── frontend/
│   └── src/
│       ├── pages/              Dashboard, CreditRisk, MarketRisk, StressTesting, AIAnalyst
│       └── components/         Sidebar, charts, AgentTrace, EvidencePanel, ...
│
├── deployment/
│   ├── nginx/
│   │   └── financial-risk.conf       Nginx config — SPA + /api/ reverse proxy
│   ├── systemd/
│   │   └── financial-risk-api.service  Uvicorn systemd unit
│   └── aws/
│       ├── ec2-iam.sh            Create FRA-EC2Role + instance profile
│       ├── ec2-provision.sh      Launch EC2 instance
│       ├── ec2-setup.sh          Full deploy script (run on EC2)
│       └── teardown-old-infra.sh Remove ECS/ALB/ECR/CloudFront if migrating
│
├── infra/
│   ├── scripts/
│   │   ├── 01_provision_rds.sh
│   │   ├── 02_write_env.sh
│   │   └── 03_allow_dev_ip.sh
│   └── fra-dev-iam-policy.json
│
└── docs/
    ├── OPERATIONS.md
    └── PHASES.md
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the blanks.

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `ap-south-1` | AWS region |
| `DB_HOST` | — | RDS endpoint hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `fra` | Database name |
| `DB_USER` | `fra_admin` | Database user |
| `DB_PASSWORD` | — | RDS password (fetch from Secrets Manager) |
| `SAGEMAKER_ENDPOINT_NAME` | `gmsc-pd-endpoint` | SageMaker PD endpoint name |
| `BEDROCK_MODEL_ID` | `moonshot.kimi-k2-thinking` | Bedrock model ID |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS origins — empty string in production |

> On EC2 with `FRA-EC2Role` attached, **do not** set `AWS_ACCESS_KEY_ID` /
> `AWS_SECRET_ACCESS_KEY`. boto3 picks up the instance role automatically.

---

## Local Development

```bash
# ── Backend ────────────────────────────────────────────────────────────────────
cd backend
uv sync                          # installs all deps into .venv
export AWS_PROFILE=fra-dev       # boto3 uses this for SageMaker + Bedrock
cp .env.example .env             # fill in DB_HOST and DB_PASSWORD
# Allow your IP to reach RDS (closes automatically — see infra/scripts/03_allow_dev_ip.sh)
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# FastAPI: http://localhost:8000
# Swagger: http://localhost:8000/docs

# ── Frontend ───────────────────────────────────────────────────────────────────
cd frontend
npm install
npm run dev
# React dev server: http://localhost:5173
# /api/* is proxied to http://localhost:8000 via vite.config.js
```

---

## Database Setup

```bash
# Run migrations (creates all tables)
cd backend && uv run alembic upgrade head

# Seed demo data — 30 borrowers/loans + portfolio P001 (~2yr price history)
uv run python scripts/seed_demo_data.py
```

### RDS Tables

| Table | Contents |
|-------|---------|
| `borrowers` | Credit profiles (GMSC feature set — exact SageMaker input shape) |
| `loans` | Active/closed loans (EAD = outstanding_balance, LGD = 1 − recovery_rate) |
| `payments` | Payment history |
| `portfolios` | Named portfolios |
| `portfolio_holdings` | Asset quantities per portfolio |
| `assets` | Asset metadata (class: equity / bond / cash) |
| `market_prices` | Daily close prices |
| `risk_results` | Persisted credit + market risk assessments |
| `stress_results` | Persisted stress-test results |

---

## EC2 Deployment

### One-time setup

```bash
# 1. Create EC2 IAM role (needs admin credentials once)
bash deployment/aws/ec2-iam.sh

# 2. Provision the EC2 instance
bash deployment/aws/ec2-provision.sh

# 3. SSH in and run the full setup script
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@<PUBLIC_IP>
curl -fsSL https://raw.githubusercontent.com/adhvaith267/financial-risk-analyst-platform/simplify-aws-architecture/deployment/aws/ec2-setup.sh | bash

# 4. Fill in secrets and restart
sudo nano /etc/financial-risk-analyst/env
sudo systemctl restart financial-risk-api
```

### Redeploy after code changes

```bash
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@<PUBLIC_IP>
cd /var/www/financial-risk-analyst
git pull origin simplify-aws-architecture
cd frontend && npm ci && npm run build
sudo systemctl restart financial-risk-api
```

---

## Nginx Configuration

File: `deployment/nginx/financial-risk.conf`

| Path | Routed to |
|------|-----------|
| `/` | React SPA (`frontend/dist/index.html`) — SPA fallback enabled |
| `/api/*` | `http://127.0.0.1:8000/*` — FastAPI, `/api` prefix stripped |

FastAPI binds to `127.0.0.1:8000` and is **not** reachable from the internet directly.

---

## systemd Service

File: `deployment/systemd/financial-risk-api.service`

```bash
sudo systemctl status  financial-risk-api
sudo systemctl restart financial-risk-api
sudo journalctl -u     financial-risk-api -f    # live logs
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/dashboard/summary` | Headline KPIs, recent analyses |
| `GET` | `/api/credit/borrowers` | List all borrowers |
| `GET` | `/api/credit/borrowers/{id}/assess` | PD / LGD / EAD / EL + SHAP drivers |
| `GET` | `/api/market/portfolios` | List portfolios |
| `GET` | `/api/market/portfolios/{id}/risk` | VaR / ES / volatility / drawdown |
| `POST` | `/api/stress/portfolios/{id}/run` | Run a shock scenario |
| `POST` | `/api/agent/ask` | Natural-language question → agent answer + trace |

---

## Agent Tools

The LangGraph ReAct agent selects from these five tools per request:

| Tool | What it does |
|------|-------------|
| `get_borrower` | Fetches borrower credit profile + active loan from RDS |
| `get_portfolio` | Fetches portfolio holdings from RDS |
| `assess_credit_risk` | Calls SageMaker → PD, then computes LGD / EAD / EL |
| `assess_market_risk` | Historical-simulation VaR / ES / volatility / drawdown |
| `run_stress_scenario` | Equity + rate + default shocks across portfolio + loan book |

Multi-tool example — *"Assess borrower B1001 and show the recession impact on P001"*:

```
Agent → assess_credit_risk(B1001) → run_stress_scenario(P001) → Bedrock → answer
```

---

## Testing

```bash
cd backend

# Unit tests — no AWS or DB required (28 tests)
uv run pytest tests/test_agent.py tests/test_credit_risk.py \
    tests/test_market_risk.py tests/test_stress.py -v

# Import check
uv run python -c "from app.agent.graph import ask; from app.agent.tools import build_tools; print('OK')"

# Frontend build
cd ../frontend && npm run build
```

---

## S3 — ML Lifecycle Only

S3 is used exclusively for the SageMaker ML pipeline:

```
s3://financial-risk-analyst-adhvaith-2026/
    raw/          GMSC raw dataset
    processed/    Feature-engineered training data
    artifacts/    SageMaker model artifacts (model.tar.gz)
```

S3 is **not** used for application storage, reports, or document retrieval.

---

## IAM

EC2 instance role `FRA-EC2Role` grants only:

- `sagemaker:InvokeEndpoint` on `gmsc-pd-endpoint`
- `bedrock:InvokeModel` + `bedrock:InvokeModelWithResponseStream`

No static credentials are stored anywhere in the application.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| FastAPI won't start | `journalctl -u financial-risk-api -n 50` |
| Nginx 502 bad gateway | `systemctl status financial-risk-api` — is it running on port 8000? |
| DB connection refused | RDS SG allows 5432 from `fra-app-sg`? `DB_HOST` correct in `/etc/financial-risk-analyst/env`? |
| SageMaker `AccessDenied` | EC2 has `FRA-EC2Role` attached? Role has `sagemaker:InvokeEndpoint`? |
| Bedrock `AccessDenied` | Role has `bedrock:InvokeModel`? `BEDROCK_MODEL_ID` correct? Model enabled in Bedrock console? |
| Agent returns no answer | `journalctl -u financial-risk-api -n 100` — look for tool call errors |
| Credit / stress 500 | SageMaker endpoint `InService`? `aws sagemaker describe-endpoint --endpoint-name gmsc-pd-endpoint` |

---

## Security

- FastAPI bound to `127.0.0.1:8000` — not reachable from the internet
- RDS in private subnet — accessible only from `fra-app-sg`
- EC2 uses IAM instance role — no static AWS credentials anywhere
- `FRA-EC2Role` is least-privilege: SageMaker invoke + Bedrock invoke only
- DB password in Secrets Manager (`fra/rds/master-password`), not in code
- `/etc/financial-risk-analyst/env` — owned `root:ec2-user`, mode `640`
- **HTTPS not configured** — add ACM + ALB or Nginx + Certbot before production use

---

## Related Repository

The PD model is trained and deployed from a sibling repo:
[`adhvaith267/credit-default-pd-model`](https://github.com/adhvaith267/credit-default-pd-model)

- LightGBM, Optuna-tuned, isotonic-calibrated (Brier score 0.1421 → 0.0487)
- SHAP global + local explanations
- Deployed to `gmsc-pd-endpoint` SageMaker real-time endpoint
