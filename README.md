<div align="center">

# Financial Risk Analyst Platform

AI-powered financial risk analyst — an agentic platform that combines
deterministic quantitative finance, a trained credit risk model, and a
LangGraph agent on Amazon Bedrock to answer questions like *"Assess borrower
B1001"* or *"What happens to P001 in a recession?"* with a single, explained,
numbers-first answer.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-agent-1C3C3C)](https://www.langchain.com/langgraph)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon%20Bedrock-LLM-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![Amazon SageMaker](https://img.shields.io/badge/SageMaker-PD%20model-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/sagemaker/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![EC2](https://img.shields.io/badge/AWS-EC2-232F3E?logo=amazonaws&logoColor=white)](https://aws.amazon.com/ec2/)

</div>

---

## Architecture

```
User
 │
 ▼
React SPA  (Nginx serves static build, same EC2 instance)
 │
 ▼  /api/* (Nginx reverse-proxies, strips /api prefix)
Nginx
 │
 ▼  127.0.0.1:8000
FastAPI
 │
 ▼
LangGraph ReAct Agent  (decides which tools to call, in what order)
 ├──► Credit Risk Tool
 │       ├── RDS PostgreSQL  (borrower/loan data)
 │       └── SageMaker Endpoint  (LightGBM PD model)
 │               └── PD prediction → LGD/EAD/EL calculation
 ├──► Market Risk Tool
 │       └── RDS PostgreSQL  (portfolio, holdings, price history)
 │               └── historical VaR / ES / volatility / drawdown
 └──► Stress Testing Tool
         └── RDS PostgreSQL  (portfolio + active loans)
                 └── equity/rate/default shock calculations
 │
 ▼  collected tool results
Amazon Bedrock LLM  (Kimi K2 Thinking via Converse API)
 │
 ▼  natural-language risk analysis
FastAPI → Nginx → React → Analyst
```

**Key principle:** the LLM never computes a risk number. Every PD, LGD, EAD,
Expected Loss, VaR, Expected Shortfall, or stress-test loss comes from a
deterministic engine or the SageMaker model. The agent's only job is to select
the right tools and synthesize the results in plain language.

## AWS Services

| Service | Resource | Purpose |
|---------|----------|---------|
| **EC2** | `fra-app-server` (t3.small, Amazon Linux 2023) | Runs Nginx + FastAPI + React build |
| **RDS PostgreSQL** | `fra-postgres-dev` | Borrowers, loans, portfolios, holdings, prices, risk results |
| **SageMaker** | `gmsc-pd-endpoint` | Calibrated LightGBM PD model (served from [sibling ML repo](https://github.com/adhvaith267/credit-default-pd-model)) |
| **Bedrock** | Kimi K2 Thinking | Agent LLM — final synthesis of tool results |
| **S3** | `financial-risk-analyst-adhvaith-2026` | GMSC dataset + SageMaker model artifacts (ML lifecycle only) |
| **Secrets Manager** | `fra/rds/master-password` | RDS master password |

## Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   │   ├── graph.py       LangGraph ReAct agent + trace helpers
│   │   │   └── tools.py       5 tools: get_borrower, get_portfolio,
│   │   │                        assess_credit_risk, assess_market_risk,
│   │   │                        run_stress_scenario
│   │   ├── api/routes/        FastAPI routers (credit, market, stress, agent, dashboard)
│   │   ├── core/              Settings (pydantic-settings) + DB engine/session
│   │   ├── engines/           Pure calculation engines (credit_risk, market_risk, stress)
│   │   ├── models/            SQLAlchemy ORM models
│   │   ├── schemas/           Pydantic request/response schemas
│   │   ├── services/          SageMaker boto3 client
│   │   └── main.py
│   ├── alembic/               DB migrations
│   ├── scripts/
│   │   └── seed_demo_data.py  Seeds 30 borrowers + portfolio P001
│   └── tests/                 pytest — pure-function unit tests
│
├── frontend/
│   └── src/
│       ├── pages/             Dashboard, CreditRisk, MarketRisk, StressTesting, AIAnalyst
│       └── components/        Sidebar, charts, AgentTrace, EvidencePanel, ...
│
├── deployment/
│   ├── nginx/
│   │   └── financial-risk.conf     Nginx config (SPA + /api/ proxy)
│   ├── systemd/
│   │   └── financial-risk-api.service  Uvicorn systemd unit
│   └── aws/
│       ├── ec2-iam.sh          Create EC2 IAM role + instance profile
│       ├── ec2-provision.sh    Launch EC2 instance
│       ├── ec2-setup.sh        Full deploy script (run on EC2)
│       └── teardown-old-infra.sh  Remove ECS/ALB/ECR/CloudFront if migrating
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

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the blanks.

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `ap-south-1` | AWS region |
| `DB_HOST` | — | RDS endpoint hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `fra` | Database name |
| `DB_USER` | `fra_admin` | Database user |
| `DB_PASSWORD` | — | Database password (from Secrets Manager) |
| `SAGEMAKER_ENDPOINT_NAME` | `gmsc-pd-endpoint` | SageMaker PD endpoint |
| `BEDROCK_MODEL_ID` | `moonshot.kimi-k2-thinking` | Bedrock model ID |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins (empty in production behind Nginx) |

> On EC2 with the `FRA-EC2Role` IAM role attached, **do not** set
> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. boto3 uses the instance
> role automatically.

## Local Development

```bash
# Backend
cd backend
uv sync
export AWS_PROFILE=fra-dev   # boto3 profile for local dev
# Temporarily allow your IP to reach RDS (see infra/scripts/03_allow_dev_ip.sh)
cp .env.example .env          # fill in DB_HOST, DB_PASSWORD
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# FastAPI at http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# React dev server at http://localhost:5173 (proxies /api/ to :8000 via vite.config.js)
```

## Database Setup

```bash
# Run migrations (creates all tables)
cd backend && uv run alembic upgrade head

# Seed demo data (30 borrowers/loans + portfolio P001 with ~2yr price history)
uv run python scripts/seed_demo_data.py
```

RDS tables:

| Table | Purpose |
|-------|---------|
| `borrowers` | Credit profiles (GMSC feature set) |
| `loans` | Active/closed loans |
| `payments` | Payment history |
| `portfolios` | Named portfolios |
| `portfolio_holdings` | Asset quantities per portfolio |
| `assets` | Asset metadata (class: equity/bond/cash) |
| `market_prices` | Daily close prices |
| `risk_results` | Persisted credit/market risk assessments |
| `stress_results` | Persisted stress-test results |

## EC2 Deployment

### One-time setup

```bash
# 1. Create EC2 IAM role (needs admin/root credentials once)
bash deployment/aws/ec2-iam.sh

# 2. Provision EC2 instance
bash deployment/aws/ec2-provision.sh

# 3. SSH in and run the setup script
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@<PUBLIC_IP>
curl -fsSL https://raw.githubusercontent.com/adhvaith267/financial-risk-analyst-platform/simplify-aws-architecture/deployment/aws/ec2-setup.sh | bash

# 4. Fill in secrets
sudo nano /etc/financial-risk-analyst/env
sudo systemctl restart financial-risk-api
```

### Re-deploy after code changes

```bash
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@<PUBLIC_IP>
cd /var/www/financial-risk-analyst
git pull origin simplify-aws-architecture
cd frontend && npm ci && npm run build
sudo systemctl restart financial-risk-api
```

## Nginx Configuration

File: `deployment/nginx/financial-risk.conf`

```
/          → React SPA (dist/index.html, SPA fallback)
/api/*     → http://127.0.0.1:8000/*  (FastAPI, /api prefix stripped)
```

FastAPI runs on `127.0.0.1:8000` and is **not** exposed to the public internet
directly. Only Nginx (port 80) is public-facing.

## systemd Service

File: `deployment/systemd/financial-risk-api.service`

```bash
sudo systemctl status  financial-risk-api
sudo systemctl restart financial-risk-api
sudo journalctl -u     financial-risk-api -f   # live logs
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/dashboard/summary` | Headline KPIs, recent analyses |
| `GET` | `/api/credit/borrowers` | List borrowers |
| `GET` | `/api/credit/borrowers/{id}/assess` | PD/LGD/EAD/EL + SHAP drivers |
| `GET` | `/api/market/portfolios` | List portfolios |
| `GET` | `/api/market/portfolios/{id}/risk` | VaR/ES/volatility/drawdown |
| `POST` | `/api/stress/portfolios/{id}/run` | Run a shock scenario |
| `POST` | `/api/agent/ask` | Natural-language question → agent answer + trace |

## Testing

```bash
cd backend

# Unit tests (no AWS/DB required)
uv run pytest tests/test_agent.py tests/test_credit_risk.py \
    tests/test_market_risk.py tests/test_stress.py -v

# Import check
uv run python -c "from app.agent.graph import ask; from app.agent.tools import build_tools; print('OK')"

# Frontend build
cd ../frontend && npm run build
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| FastAPI won't start | `journalctl -u financial-risk-api -n 50` |
| Nginx 502 bad gateway | FastAPI running? `systemctl status financial-risk-api` |
| DB connection refused | RDS SG allows port 5432 from `fra-app-sg`? `DB_HOST` correct in `/etc/financial-risk-analyst/env`? |
| SageMaker `AccessDenied` | EC2 instance has `FRA-EC2Role` attached? Role has `sagemaker:InvokeEndpoint`? |
| Bedrock `AccessDenied` | Role has `bedrock:InvokeModel`? Model ID correct? Model access enabled in Bedrock console? |
| Agent returns no answer | Check logs: `journalctl -u financial-risk-api -n 100` — look for tool call errors |

## Security

- FastAPI bound to `127.0.0.1:8000` — not publicly reachable
- RDS accessible only from `fra-app-sg` (EC2 security group)
- EC2 uses IAM instance role (`FRA-EC2Role`) for AWS API calls — no static credentials
- `FRA-EC2Role` grants only `sagemaker:InvokeEndpoint` + `bedrock:InvokeModel`
- DB password stored in Secrets Manager (`fra/rds/master-password`), never in code
- `/etc/financial-risk-analyst/env` owned `root:ec2-user`, mode `640`
- HTTPS not configured — add an ACM certificate + ALB (or Nginx + Certbot) for production TLS

## Related Repository

The PD model is trained and deployed from a separate repo:
[`adhvaith267/credit-default-pd-model`](https://github.com/adhvaith267/credit-default-pd-model).

- LightGBM, Optuna-tuned, isotonic-calibrated (Brier 0.1421 → 0.0487)
- SHAP global + local explanations
- Deployed to `gmsc-pd-endpoint` SageMaker real-time endpoint
