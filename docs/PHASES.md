# Implementation Phases

Running checklist of what has been built and what remains.

---

## Phase 0 — IAM
- [x] Scoped `fra-platform-dev` IAM user + `FRAPlatformDevPolicy`, `fra-dev` CLI profile
- [x] `FRA-EC2Role` — least-privilege instance role (SageMaker invoke + Bedrock invoke only)

## Phase 1 — RDS PostgreSQL
- [x] Provisioned `fra-postgres-dev` (17.10, db.t4g.micro), 9-table schema migrated

## Phase 2 — Data ingestion
- [x] 30 GMSC-sampled borrowers/loans + demo portfolio P001 (~2yr synthetic price history)

## Phase 3 — Credit Risk Engine
- [x] `app/engines/credit_risk.py`: PD via `gmsc-pd-endpoint`, LGD/EAD/EL
- [x] `GET /credit/borrowers/{id}/assess`

## Phase 4 — Market Risk Engine
- [x] `app/engines/market_risk.py`: volatility, historical/parametric VaR, ES, max drawdown, HHI
- [x] `GET /market/portfolios/{id}/risk`
- [x] Unit tests (pure `compute_market_risk`, no DB)

## Phase 5 — Stress Testing Engine
- [x] `app/engines/stress.py`: equity/rate/default shocks → market loss + credit loss + combined
- [x] `POST /stress/portfolios/{id}/run`
- [x] Unit tests (5, pure shock functions)

## Phase 6 — LangGraph Agent + Bedrock
- [x] 5 tool wrappers (`app/agent/tools.py`): get_borrower, get_portfolio,
      assess_credit_risk, assess_market_risk, run_stress_scenario
- [x] LangGraph ReAct agent (`app/agent/graph.py`): tool selection → engine calls → Bedrock synthesis
- [x] System prompt forbids the model from computing PD/LGD/VaR/etc. itself
- [x] `POST /agent/ask` — verified live for single-tool and multi-tool questions
- [x] Model: `moonshot.kimi-k2-thinking` via Bedrock Converse API
- [x] `_extract_text()` handles Kimi's `<think>...</think>` reasoning-block leak

## Phase 7 — React Frontend
- [x] Vite + React + react-router-dom + axios
- [x] Dashboard, Credit Risk, Market Risk, Stress Testing, AI Analyst pages
- [x] Frontend uses relative `/api/` paths — works via Nginx (prod) and Vite proxy (dev)

## Phase 8 — EC2 Deployment
- [x] EC2 `fra-app-server` (t3.small, Amazon Linux 2023) with `FRA-EC2Role`
- [x] Nginx: serves React build at `/`, proxies `/api/` to FastAPI at `127.0.0.1:8000`
- [x] FastAPI via systemd (`financial-risk-api.service`, 2 Uvicorn workers)
- [x] Alembic migrations run on deploy; demo data seeded
- [x] Verified live: all endpoints working through Nginx

## Phase 9 — Architecture Simplification
- [x] Removed RAG pipeline: embeddings, vector retrieval, pgvector, Titan,
      `search_risk_methodology` tool, methodology docs, ingest script
- [x] Removed ECS/Fargate/ALB/ECR/CloudFront from AWS account and codebase
- [x] Updated IAM policy: removed ECS/ECR/ALB/Amplify/CloudFront permissions

## Remaining / known limitations
- [ ] HTTPS not configured — add ACM certificate + Nginx SSL or Certbot for production TLS
- [ ] SSH open to 0.0.0.0/0 — restrict to known IPs for production
- [ ] No CI/CD — redeploy is a manual `git pull + npm run build + systemctl restart`
