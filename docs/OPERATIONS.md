# Operations Guide

Day-to-day commands for running and maintaining the platform.
All AWS CLI commands use `--profile fra-dev --region ap-south-1`.

---

## Current infrastructure at a glance

| Resource | Type | Status |
|---|---|---|
| `fra-app-server` | EC2 t3.small (AL2023) | Running — hosts Nginx + FastAPI + React |
| `fra-postgres-dev` | RDS PostgreSQL 17, db.t4g.micro | Always-on |
| `gmsc-pd-endpoint` | SageMaker real-time endpoint | InService — biggest cost lever |
| Bedrock `moonshot.kimi-k2-thinking` | Per-request | No standing cost |

## Cost levers

| Resource | Approx cost | Stop to save |
|---|---|---|
| EC2 t3.small | ~$15/mo | `aws ec2 stop-instances` |
| RDS db.t4g.micro | Free-tier / low single-digit $/mo | `aws rds stop-db-instance` |
| SageMaker `ml.m5.xlarge` endpoint | **~$0.23/hr (~$5.50/day)** | Delete endpoint (see below) |
| Bedrock | Per request — pennies | N/A |

**Cheapest "pause" state:** delete the SageMaker endpoint + stop EC2.
RDS can stay running (free-tier eligible). Bring it back with the SageMaker
deploy script from the ML repo + `aws ec2 start-instances`.

---

## EC2 — start / stop / redeploy

```bash
INSTANCE_ID=$(aws ec2 describe-instances --profile fra-dev --region ap-south-1 \
  --filters "Name=tag:Name,Values=fra-app-server" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

# Stop (no billing for compute while stopped, EBS still billed)
aws ec2 stop-instances  --profile fra-dev --region ap-south-1 --instance-ids $INSTANCE_ID

# Start
aws ec2 start-instances --profile fra-dev --region ap-south-1 --instance-ids $INSTANCE_ID
aws ec2 wait instance-running --profile fra-dev --region ap-south-1 --instance-ids $INSTANCE_ID

# SSH in
PUBLIC_IP=$(aws ec2 describe-instances --profile fra-dev --region ap-south-1 \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@$PUBLIC_IP
```

### Redeploy after a code change

```bash
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@$PUBLIC_IP
cd /var/www/financial-risk-analyst
git pull origin simplify-aws-architecture
cd frontend && npm ci && npm run build
sudo systemctl restart financial-risk-api
```

### Service management on EC2

```bash
# FastAPI
sudo systemctl status  financial-risk-api
sudo systemctl restart financial-risk-api
sudo journalctl -u     financial-risk-api -f     # live logs

# Nginx
sudo systemctl status  nginx
sudo systemctl restart nginx
sudo journalctl -u     nginx -f

# Secrets / env
sudo nano /etc/financial-risk-analyst/env        # edit env vars
sudo systemctl restart financial-risk-api        # apply changes
```

---

## SageMaker PD endpoint — start / stop

**Stop** (deletes the endpoint — model and config untouched, saves ~$0.23/hr):
```bash
aws sagemaker delete-endpoint --profile fra-dev --region ap-south-1 \
  --endpoint-name gmsc-pd-endpoint
```

**Start** (redeploy from the ML repo):
```bash
cd ../credit-default-pd-model
AWS_PROFILE=fra-dev uv run python scripts/deploy_sagemaker.py
# Takes 3–5 minutes to reach InService
```

**Check status:**
```bash
aws sagemaker describe-endpoint --profile fra-dev --region ap-south-1 \
  --endpoint-name gmsc-pd-endpoint \
  --query '{Status:EndpointStatus,Updated:LastModifiedTime}'
```

> While the endpoint is down, any credit-risk or stress-test call will
> return a clear error. Market risk and the dashboard still work.

---

## RDS — stop / start

```bash
# Stop (saves compute cost; storage still billed; auto-starts after 7 days)
aws rds stop-db-instance --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev

# Start
aws rds start-db-instance --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev
aws rds wait db-instance-available --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev
```

---

## Database — migrations and seeding

Run from your laptop (allow your IP first via `infra/scripts/03_allow_dev_ip.sh`
and set `DB_HOST`/`DB_PASSWORD` in `backend/.env`), or SSH into EC2 and run there.

```bash
cd backend

# Apply schema changes
uv run alembic upgrade head

# Re-seed demo data (idempotent)
uv run python scripts/seed_demo_data.py
```

---

## Rotating the RDS password

```bash
NEW_PW=$(python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(32)))")
aws secretsmanager put-secret-value --profile fra-dev --region ap-south-1 \
  --secret-id fra/rds/master-password --secret-string "$NEW_PW"
aws rds modify-db-instance --profile fra-dev --region ap-south-1 \
  --db-instance-identifier fra-postgres-dev \
  --master-user-password "$NEW_PW" --apply-immediately

# Update the env file on EC2
ssh -i ~/.ssh/fra-dev-key.pem ec2-user@$PUBLIC_IP \
  "sudo sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=$NEW_PW/' /etc/financial-risk-analyst/env && \
   sudo systemctl restart financial-risk-api"
```

---

## Swapping the Bedrock model

```bash
# On EC2:
sudo sed -i 's/^BEDROCK_MODEL_ID=.*/BEDROCK_MODEL_ID=<new-model-id>/' \
  /etc/financial-risk-analyst/env
sudo systemctl restart financial-risk-api
```

---

## Troubleshooting

| Symptom | Check |
|---|---|
| FastAPI won't start | `journalctl -u financial-risk-api -n 50` |
| Nginx 502 | `systemctl status financial-risk-api` — is it running on port 8000? |
| DB connection refused | RDS SG allows 5432 from `fra-app-sg`? `DB_HOST` correct in `/etc/financial-risk-analyst/env`? |
| SageMaker `AccessDenied` | EC2 has `FRA-EC2Role` attached? Role has `sagemaker:InvokeEndpoint`? |
| Bedrock `AccessDenied` | Role has `bedrock:InvokeModel`? Model ID correct? Model enabled in Bedrock console? |
| Agent returns no answer | `journalctl -u financial-risk-api -n 100` — look for tool errors |
| Credit/stress 500 after restart | SageMaker endpoint `InService`? `aws sagemaker describe-endpoint --endpoint-name gmsc-pd-endpoint` |
