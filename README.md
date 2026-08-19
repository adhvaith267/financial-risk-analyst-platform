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
  real-time endpoint (`gmsc-pd-endpoint`) is deployed via that repo's
  `scripts/deploy_sagemaker.py` and is **currently InService** (ml.m5.xlarge,
  bills ~$0.23/hr while up - intentionally left running). Tear down with
  `aws sagemaker delete-endpoint --endpoint-name gmsc-pd-endpoint --profile fra-dev`
  when no longer needed.
- Bedrock: agent uses `moonshot.kimi-k2-thinking` (see `bedrock_model_id` in
  `app/core/config.py`). **Claude Sonnet/Opus (4.6 and 5) are blocked
  account-wide** by an AWS Marketplace `INVALID_PAYMENT_INSTRUMENT` error -
  confirmed via both the Converse and InvokeModel APIs, with root and
  `fra-dev` credentials, and unaffected by accepting the model's agreement
  (`aws bedrock create-foundation-model-agreement`, already done for all 4).
  Fix is in AWS Console -> Billing and Cost Management -> Payment
  preferences -> add/fix a Marketplace payment method; once that's done,
  swap `bedrock_model_id` back to `global.anthropic.claude-opus-4-6-v1` (or
  whichever Claude model) and it should work immediately.

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

## Demo data

`backend/scripts/seed_demo_data.py` (idempotent, `AWS_PROFILE=fra-dev uv run
python scripts/seed_demo_data.py`):

- 30 borrowers/loans (`B1001`..`B1030`) sampled from the real GMSC training
  CSV in S3 (`s3://financial-risk-analyst-adhvaith-2026/datasets/gmsc/raw/cs-training.csv`,
  fixed `random_state=42`) - real credit-bureau attributes, not synthetic.
  Loan `outstanding_balance`/`recovery_rate` are a simple heuristic on top
  (mortgage vs. personal, income x debt ratio), clearly synthetic.
- Portfolio `P001` ("Demo Balanced Portfolio"): 5 assets (AAPL, MSFT, JPM,
  TLT, CASH) with ~2 years of **synthetic** daily price history (GBM, fixed
  seed) - a placeholder until the real-world data phase (FRED/market API).
- Plus the one hand-seeded `B102`/`L102` from the initial smoke test.

## RAG

Self-built on pgvector rather than managed Bedrock Knowledge Bases (see
`docs/PHASES.md` Phase 7 for the cost tradeoff). Setup:

```bash
../infra/scripts/04_upload_rag_docs.sh    # syncs docs/rag/*.md to S3
uv run python scripts/ingest_rag_docs.py  # chunks, embeds, upserts into methodology_chunks
```

Source docs live in `docs/rag/*.md`. Embeddings use
`amazon.titan-embed-text-v2:0` (1024-dim). Retrieval is cosine-distance
nearest-neighbor via pgvector's `<=>` operator (`app/engines/retrieval.py`),
exposed to the agent as the `search_risk_methodology` tool.

## Status

- [x] Phase 0 - IAM (scoped user/policy for this project)
- [x] Phase 1 - RDS PostgreSQL provisioned, migrated
- [x] Data ingestion - demo borrowers/loans (real GMSC sample) + demo
      portfolio/market prices (synthetic) seeded, see above
- [x] Credit Risk Engine - `app/engines/credit_risk.py`, verified live end
      to end against the deployed `gmsc-pd-endpoint`
      (`GET /credit/borrowers/{id}/assess` returns PD/LGD/EAD/EL/risk_drivers)
- [x] Market Risk Engine - `app/engines/market_risk.py`, verified live
      against P001 (`GET /market/portfolios/{id}/risk`)
- [x] Stress Testing Engine - `app/engines/stress.py`, verified live
      (`POST /stress/portfolios/{id}/run`, persists to `stress_results`)
- [x] LangGraph agent + Bedrock - `app/agent/`, verified live over HTTP
      (`POST /agent/ask`) for both single-tool and multi-tool questions;
      see the Bedrock note above re: Claude model access
- [x] RAG - self-built on pgvector (existing RDS) instead of managed
      Bedrock Knowledge Bases, see below
- [ ] React frontend
- [ ] AWS deployment (ECS/Fargate, Amplify)
