#!/usr/bin/env bash
# Writes backend/.env from the provisioned RDS instance + Secrets Manager password.
# Run after 01_provision_rds.sh has finished (instance status = available).
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
DB_INSTANCE_ID=fra-postgres-dev
SECRET_NAME=fra/rds/master-password
ENV_FILE="$(dirname "$0")/../../backend/.env"

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

STATUS=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].DBInstanceStatus' --output text)
if [ "$STATUS" != "available" ]; then
  echo "RDS instance status is '$STATUS', not 'available' yet. Try again in a few minutes." >&2
  exit 1
fi

ENDPOINT=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].Endpoint.Address' --output text)
PORT=$(aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].Endpoint.Port' --output text)
PASSWORD=$(aws_ secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)

cat > "$ENV_FILE" <<EOF
AWS_REGION=$REGION

DB_HOST=$ENDPOINT
DB_PORT=$PORT
DB_NAME=fra
DB_USER=fra_admin
DB_PASSWORD=$PASSWORD

SAGEMAKER_ENDPOINT_NAME=gmsc-pd-endpoint
DEFAULT_RECOVERY_RATE=0.60
EOF

echo "Wrote $ENV_FILE (endpoint: $ENDPOINT:$PORT)"
