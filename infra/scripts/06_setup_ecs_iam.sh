#!/usr/bin/env bash
# One-time IAM setup for the ECS deployment: task execution role (pulls the
# image, writes logs, reads the DB password secret) and task role (what the
# running app itself is allowed to call - SageMaker, Bedrock). Idempotent.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
SCRIPT_DIR="$(dirname "$0")"

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

role_exists() { aws_ iam get-role --role-name "$1" >/dev/null 2>&1; }

echo "== execution role =="
if ! role_exists FRA-EcsTaskExecutionRole; then
  aws_ iam create-role --role-name FRA-EcsTaskExecutionRole \
    --assume-role-policy-document file://"$SCRIPT_DIR/ecs-trust-policy.json" \
    --tags Key=project,Value=financial-risk-analyst
  aws_ iam attach-role-policy --role-name FRA-EcsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
fi
aws_ iam put-role-policy --role-name FRA-EcsTaskExecutionRole \
  --policy-name read-db-secret \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"arn:aws:secretsmanager:ap-south-1:575264900919:secret:fra/rds/master-password-*"}]}'
aws_ iam put-role-policy --role-name FRA-EcsTaskExecutionRole \
  --policy-name create-log-group \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["logs:CreateLogGroup","logs:PutRetentionPolicy"],"Resource":"arn:aws:logs:ap-south-1:575264900919:log-group:/ecs/fra-backend*"}]}'

echo "== task role =="
if ! role_exists FRA-BackendTaskRole; then
  aws_ iam create-role --role-name FRA-BackendTaskRole \
    --assume-role-policy-document file://"$SCRIPT_DIR/ecs-trust-policy.json" \
    --tags Key=project,Value=financial-risk-analyst
fi
aws_ iam put-role-policy --role-name FRA-BackendTaskRole \
  --policy-name app-permissions \
  --policy-document file://"$SCRIPT_DIR/ecs-task-role-policy.json"

echo "IAM roles ready: FRA-EcsTaskExecutionRole, FRA-BackendTaskRole"
