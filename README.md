# Financial Risk Analyst Platform

AI-powered financial risk analyst for financial organizations. Combines a
deterministic Credit Risk Engine (PD via SageMaker + LGD/EAD/EL logic), a
Market Risk Engine, a Stress Testing Engine, a LangGraph agent on Amazon
Bedrock, and a React analyst UI.

The PD (Probability of Default) model itself lives in a separate sibling
repo, [`financial-risk-analyst-ml`](../financial-risk-analyst-ml), and is
served from a SageMaker real-time endpoint (`gmsc-pd-endpoint`). This repo
consumes that endpoint; it never re-implements or approximates PD.

## Layout

```
backend/    FastAPI app: core config/db, SQLAlchemy models, Alembic
            migrations, credit/market/stress engines, LangGraph agent,
            SageMaker + external-data service clients.
frontend/   React analyst UI (dashboard, credit/market/stress views,
            AI Analyst chat).
infra/      AWS CLI provisioning scripts (no Terraform/CDK - plain,
            idempotent bash + aws cli), run manually per phase.
docs/       Architecture notes, RAG source documents.
```

## AWS account state (ap-south-1, account 575264900919)

- IAM: `fra-platform-dev` user + `FRAPlatformDevPolicy`, scoped to this
  project's services (S3 `financial-risk-analyst-*`, RDS, SageMaker,
  Bedrock, ECS/ECR, EC2 networking, Secrets Manager `fra/*`, CloudWatch,
  Amplify). No IAM user/policy management, Organizations, or billing access.
  CLI profile: `fra-dev`.
- RDS: `fra-postgres-dev`, PostgreSQL 17.10, `db.t4g.micro`, 20GB gp3,
  not publicly accessible, security group `fra-rds-sg` (inbound 5432 only
  from `fra-app-sg`). Provisioned via `infra/scripts/01_provision_rds.sh`.
- SageMaker: existing `FinancialRiskSageMakerExecutionRole` and trained
  GMSC PD models/endpoint from the ML repo - reused, not recreated here.

## Local dev setup

```bash
cd backend
uv sync
../infra/scripts/02_write_env.sh   # after RDS status = available
uv run alembic revision --autogenerate -m "initial schema"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

## Status

- [x] Phase 0 - IAM (scoped user/policy for this project)
- [x] Phase 1 - RDS PostgreSQL provisioned
- [ ] Data ingestion
- [ ] Credit Risk Engine (skeleton in `app/engines/credit_risk.py`, calls
      the existing `gmsc-pd-endpoint`)
- [ ] Market Risk Engine
- [ ] Stress Testing Engine
- [ ] LangGraph agent + Bedrock
- [ ] RAG (S3 + Bedrock Knowledge Bases)
- [ ] React frontend
- [ ] AWS deployment (ECS/Fargate, Amplify)
