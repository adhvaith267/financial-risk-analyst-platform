#!/usr/bin/env bash
# Writes /etc/financial-risk-analyst/env on EC2 from the provisioned RDS instance.
# Run after 01_provision_rds.sh has finished (instance status = available).
#
# Usage:
#   bash 02_write_env.sh <db-password>
#   DB_PASSWORD=<password> bash 02_write_env.sh
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
DB_INSTANCE_ID=fra-postgres-dev
ENV_FILE="/etc/financial-risk-analyst/env"

# Accept password as first argument or from environment
PASSWORD="${1:-${DB_PASSWORD:-}}"
if [ -z "$PASSWORD" ]; then
  echo "Error: DB password required. Pass as first argument or set DB_PASSWORD env var." >&2
  echo "  bash 02_write_env.sh <password>" >&2
  exit 1
fi

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

STATUS=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].DBInstanceStatus' --output text)
if [ "$STATUS" != "available" ]; then
  echo "RDS instance status is '$STATUS', not 'available' yet. Try again in a few minutes." >&2
  exit 1
fi

ENDPOINT=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].Endpoint.Address' --output text)
PORT=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].Endpoint.Port' --output text)

sudo mkdir -p /etc/financial-risk-analyst
sudo tee "$ENV_FILE" > /dev/null <<EOF
APP_ENV=production
AWS_REGION=$REGION

DB_HOST=$ENDPOINT
DB_PORT=$PORT
DB_NAME=fra
DB_USER=fra_admin
DB_PASSWORD=$PASSWORD

SAGEMAKER_ENDPOINT_NAME=gmsc-pd-endpoint
BEDROCK_MODEL_ID=moonshot.kimi-k2-thinking
DEFAULT_RECOVERY_RATE=0.60
CREDIT_DECLINE_THRESHOLD=0.10
ALLOWED_ORIGINS=
EOF

sudo chmod 640 "$ENV_FILE"
sudo chown root:ec2-user "$ENV_FILE"
echo "Wrote $ENV_FILE (endpoint: $ENDPOINT:$PORT)"
