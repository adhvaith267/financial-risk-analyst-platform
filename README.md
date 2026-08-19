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
  security group `fra-rds-sg` (inbound 5432 restricted to the app SG
  `fra-app-sg` plus, temporarily, one dev IP - see below). Provisioned via
  `infra/scripts/01_provision_rds.sh`. Master password lives in Secrets
  Manager at `fra/rds/master-password`, never in this repo.
  **Temporarily set `--publicly-accessible`** so local dev machines can
  reach it directly (the security group still only allows the one IP that
  ran `infra/scripts/03_allow_dev_ip.sh` - see that script's tag
  `purpose=local-dev-access` on the SG rule). Revert with
  `aws rds modify-db-instance --db-instance-identifier fra-postgres-dev --no-publicly-accessible`
  once the backend runs inside the VPC (ECS) and no longer needs laptop access.
- SageMaker: existing `FinancialRiskSageMakerExecutionRole` and trained
  GMSC PD models from the ML repo - reused, not recreated here. The
  real-time endpoint (`gmsc-pd-endpoint`) is deployed on demand via that
  repo's `scripts/deploy_sagemaker.py` and is not left running by default
  (ml.m5.xlarge bills hourly while up).

## Local dev setup

```bash
cd backend
uv sync
../infra/scripts/02_write_env.sh   # after RDS status = available
export AWS_PROFILE=fra-dev         # boto3 needs this explicitly; the SDK's
                                    # default profile is root
uv run alembic upgrade head        # first time: alembic revision --autogenerate -m "..."
uv run uvicorn app.main:app --reload
```

## Status

- [x] Phase 0 - IAM (scoped user/policy for this project)
- [x] Phase 1 - RDS PostgreSQL provisioned, migrated, seeded with a demo
      borrower/loan (B102/L102); FastAPI verified end-to-end against RDS
- [ ] Data ingestion (beyond the one demo borrower)
- [~] Credit Risk Engine - implemented in `app/engines/credit_risk.py`,
      calls the `gmsc-pd-endpoint` contract exactly (verified against the
      ML repo's `inference.py`); blocked on that endpoint actually being
      deployed to test live (currently no SageMaker endpoint is running)
- [ ] Market Risk Engine
- [ ] Stress Testing Engine
- [ ] LangGraph agent + Bedrock
- [ ] RAG (S3 + Bedrock Knowledge Bases)
- [ ] React frontend
- [ ] AWS deployment (ECS/Fargate, Amplify)
