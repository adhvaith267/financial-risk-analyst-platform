# Operations Guide

Day-to-day commands for running, stopping, and maintaining the deployed
platform. All commands assume the `fra-dev` AWS CLI profile
(`--profile fra-dev`) and region `ap-south-1`; every resource name below is
literal (this project's actual resources), not a placeholder.

## Costs at a glance — what's actually billing right now

| Resource | Bills while... | Approx cost |
|---|---|---|
| RDS (`fra-postgres-dev`, `db.t4g.micro`) | Always (until stopped/deleted) | Free-tier eligible / low single-digit $/mo |
| ECS Fargate (1 task, 0.25 vCPU/0.5GB) | Always the service is running | A few $/mo |
| ALB | Always it exists | ~$16-20/mo fixed + traffic |
| CloudFront | Always it exists | Pennies at this traffic level |
| SageMaker endpoint (`ml.m5.xlarge`) | **Always it's InService** | **~$0.23/hr (~$5.50/day)** — the single biggest lever |
| Amplify Hosting | Build minutes + bandwidth only | Pennies at this traffic level |
| Bedrock / embeddings | Per-request only | Pennies per question asked |

**If you want to stop spending without deleting anything**, stop the
SageMaker endpoint and the ECS service (both below) — RDS, ALB, and
CloudFront are cheap enough to leave running, but can also be stopped/torn
down if you want zero cost.

## Starting and stopping the backend (ECS Fargate)

The backend is one ECS service running one task behind an ALB.

**Stop it** (scale to zero — keeps the service/task definition, no compute
billing while stopped):
```bash
aws ecs update-service --profile fra-dev --region ap-south-1 \
  --cluster fra-cluster --service fra-backend-svc --desired-count 0
```

**Start it again:**
```bash
aws ecs update-service --profile fra-dev --region ap-south-1 \
  --cluster fra-cluster --service fra-backend-svc --desired-count 1
aws ecs wait services-stable --profile fra-dev --region ap-south-1 \
  --cluster fra-cluster --services fra-backend-svc
```

**Redeploy after a code change** (rebuilds the image, pushes to ECR,
registers a new task revision, forces a rolling deploy):
```bash
infra/scripts/05_deploy_backend_ecs.sh
```

**Check status / recent logs:**
```bash
aws ecs describe-services --profile fra-dev --region ap-south-1 \
  --cluster fra-cluster --services fra-backend-svc \
  --query 'services[0].{Status:status,Desired:desiredCount,Running:runningCount}'

aws logs tail /ecs/fra-backend --profile fra-dev --region ap-south-1 --since 1h --follow
```

## Starting and stopping the frontend (Amplify)

Amplify Hosting is serverless static hosting — there's no "server" to
stop/start, and it costs nothing while idle (only build minutes + bandwidth).
To actually stop it from being reachable:

**Disable auto-deploy on push** (keeps the site up, stops new commits from
redeploying it):
```bash
aws amplify update-branch --profile fra-dev --region ap-south-1 \
  --app-id d97yoeq2bkvvs --branch-name master --no-enable-auto-build
```

**Take the site down entirely** (deletes the app — irreversible, only do
this deliberately):
```bash
aws amplify delete-app --profile fra-dev --region ap-south-1 --app-id d97yoeq2bkvvs
```

**Redeploy manually** (rebuild + republish the current `master` branch):
```bash
infra/scripts/07_deploy_frontend_amplify.sh
```

**Check the latest build:**
```bash
aws amplify list-jobs --profile fra-dev --region ap-south-1 \
  --app-id d97yoeq2bkvvs --branch-name master --max-results 1
```

## Starting and stopping the PD model (SageMaker)

This is the expensive one (~$0.23/hr) — stop it whenever you're not
actively using/demoing the platform, from either repo:

**Stop (delete the endpoint — the model and training jobs are untouched,
this only removes the always-on hosting):**
```bash
aws sagemaker delete-endpoint --profile fra-dev --region ap-south-1 \
  --endpoint-name gmsc-pd-endpoint
```

**Start again** (redeploys from the latest trained model artifact, from the
`financial-risk-analyst-ml` repo):
```bash
cd ../financial-risk-analyst-ml
AWS_PROFILE=fra-dev uv run python scripts/deploy_sagemaker.py
```
Takes 3-5 minutes to reach `InService`. While the endpoint is down, the
Credit Risk Engine and any agent question touching credit/stress will fail
cleanly with a `ValidationError: Endpoint ... not found` — the rest of the
platform (Market Risk, RAG methodology questions) keeps working.

## Ingesting / refreshing data in RDS

All scripts run from `backend/`, with `AWS_PROFILE=fra-dev` set. If RDS is
currently private (the normal state) and you're running from a laptop
rather than from inside the VPC, first:
```bash
../infra/scripts/03_allow_dev_ip.sh
aws rds modify-db-instance --profile fra-dev --db-instance-identifier fra-postgres-dev \
  --publicly-accessible --apply-immediately
# ... run the scripts below ...
aws rds modify-db-instance --profile fra-dev --db-instance-identifier fra-postgres-dev \
  --no-publicly-accessible --apply-immediately   # revert when done
```

**Apply schema changes** (after editing a SQLAlchemy model):
```bash
uv run alembic revision --autogenerate -m "describe the change"
uv run alembic upgrade head
```

**Re-seed demo borrowers/loans/portfolio** (idempotent — re-running refreshes
the data, doesn't duplicate it):
```bash
uv run python scripts/seed_demo_data.py
```

**Re-ingest RAG methodology docs** (after editing `docs/rag/*.md`):
```bash
../infra/scripts/04_upload_rag_docs.sh   # sync docs/rag/*.md to S3
uv run python scripts/ingest_rag_docs.py # re-chunk, re-embed, re-upsert
```

## Rotating the RDS password

```bash
NEW_PW=$(python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(32)))")
aws secretsmanager put-secret-value --profile fra-dev --region ap-south-1 \
  --secret-id fra/rds/master-password --secret-string "$NEW_PW"
aws rds modify-db-instance --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev --master-user-password "$NEW_PW" --apply-immediately
```
ECS reads the secret fresh on every task start (via the `secrets` block in
the task definition), so the next `05_deploy_backend_ecs.sh` picks it up
automatically — no code change needed.

## Swapping the agent's model

Blocked Claude models aside, changing which Bedrock model powers the agent
is a one-line change:
```bash
# edit infra/scripts/task-def.json: BEDROCK_MODEL_ID -> the new model id
infra/scripts/05_deploy_backend_ecs.sh
```

## Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| Frontend shows "Network Error" | Mixed content (frontend HTTPS calling an HTTP API), CORS, **or the ECS service silently still running an old task-definition revision** | Confirm `VITE_API_BASE_URL` points at the CloudFront domain, not the raw ALB; confirm the frontend's origin is in `ALLOWED_ORIGINS`; check the actual running revision with `aws ecs describe-tasks ... --query 'tasks[0].taskDefinitionArn'` against `aws ecs describe-task-definition --task-definition fra-backend --query taskDefinition.revision` - if they don't match, `update-service --force-new-deployment` alone does **not** pick up new revisions (it just restarts whatever revision the service is already pinned to); `05_deploy_backend_ecs.sh` now passes `--task-definition` explicitly every deploy to prevent this |
| `500` on `/credit/...` or `/agent/ask` | SageMaker endpoint not `InService` | `aws sagemaker describe-endpoint --endpoint-name gmsc-pd-endpoint` |
| Backend can't reach RDS | RDS is private and the caller isn't in `fra-app-sg` | ECS tasks are always in `fra-app-sg`, so this usually means local dev without `03_allow_dev_ip.sh` |
| ECS task stuck `PENDING`/failing to start | Check task stopped-reason | `aws ecs describe-tasks --cluster fra-cluster --tasks <task-id>` |
| Bedrock `AccessDeniedException` | Model not enabled for the account, or (for Marketplace-fulfilled models) a payment-instrument issue | See `docs/PHASES.md` Phase 6 |
