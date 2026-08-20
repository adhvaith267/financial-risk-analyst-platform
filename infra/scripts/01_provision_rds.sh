#!/usr/bin/env bash
# Provisions the RDS PostgreSQL instance for the Financial Risk Analyst platform.
# Idempotent: safe to re-run, skips resources that already exist.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
VPC_ID=vpc-0284304629b3039a9
SUBNET_IDS="subnet-079b42f82932dd6dc subnet-0e84cafc158b26de0 subnet-075b2a0c3208dca17"

APP_SG_NAME=fra-app-sg
RDS_SG_NAME=fra-rds-sg
DB_SUBNET_GROUP=fra-db-subnet-group
DB_INSTANCE_ID=fra-postgres-dev
DB_NAME=fra
DB_MASTER_USER=fra_admin
DB_INSTANCE_CLASS=db.t4g.micro
DB_ENGINE_VERSION=17.10
DB_STORAGE_GB=20

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "== Security group: $APP_SG_NAME =="
APP_SG_ID=$(aws_ ec2 describe-security-groups --filters Name=group-name,Values=$APP_SG_NAME Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text)
if [ "$APP_SG_ID" = "None" ] || [ -z "$APP_SG_ID" ]; then
  APP_SG_ID=$(aws_ ec2 create-security-group --group-name $APP_SG_NAME --description "FRA platform app server" --vpc-id $VPC_ID --query 'GroupId' --output text)
  aws_ ec2 create-tags --resources "$APP_SG_ID" --tags Key=Name,Value=$APP_SG_NAME Key=project,Value=financial-risk-analyst
fi
echo "app SG: $APP_SG_ID"

echo "== Security group: $RDS_SG_NAME =="
RDS_SG_ID=$(aws_ ec2 describe-security-groups --filters Name=group-name,Values=$RDS_SG_NAME Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text)
if [ "$RDS_SG_ID" = "None" ] || [ -z "$RDS_SG_ID" ]; then
  RDS_SG_ID=$(aws_ ec2 create-security-group --group-name $RDS_SG_NAME --description "FRA platform RDS PostgreSQL" --vpc-id $VPC_ID --query 'GroupId' --output text)
  aws_ ec2 create-tags --resources "$RDS_SG_ID" --tags Key=Name,Value=$RDS_SG_NAME Key=project,Value=financial-risk-analyst
  aws_ ec2 authorize-security-group-ingress --group-id "$RDS_SG_ID" --protocol tcp --port 5432 --source-group "$APP_SG_ID" >/dev/null
fi
echo "rds SG: $RDS_SG_ID (inbound 5432 from $APP_SG_ID only)"

echo "== DB subnet group: $DB_SUBNET_GROUP =="
if ! aws_ rds describe-db-subnet-groups --db-subnet-group-name $DB_SUBNET_GROUP >/dev/null 2>&1; then
  aws_ rds create-db-subnet-group \
    --db-subnet-group-name $DB_SUBNET_GROUP \
    --db-subnet-group-description "FRA platform RDS subnets (default VPC, 3 AZs)" \
    --subnet-ids $SUBNET_IDS \
    --tags Key=project,Value=financial-risk-analyst >/dev/null
fi
echo "subnet group ready"

MASTER_PW=$(python3 -c "import secrets,string; alphabet=string.ascii_letters+string.digits; print(''.join(secrets.choice(alphabet) for _ in range(32)))")

echo "== RDS instance: $DB_INSTANCE_ID =="
if aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID >/dev/null 2>&1; then
  echo "instance already exists, skipping create"
else
  aws_ rds create-db-instance \
    --db-instance-identifier $DB_INSTANCE_ID \
    --db-name $DB_NAME \
    --engine postgres \
    --engine-version $DB_ENGINE_VERSION \
    --db-instance-class $DB_INSTANCE_CLASS \
    --allocated-storage $DB_STORAGE_GB \
    --storage-type gp3 \
    --master-username $DB_MASTER_USER \
    --master-user-password "$MASTER_PW" \
    --vpc-security-group-ids "$RDS_SG_ID" \
    --db-subnet-group-name $DB_SUBNET_GROUP \
    --no-publicly-accessible \
    --no-multi-az \
    --backup-retention-period 1 \
    --storage-encrypted \
    --tags Key=project,Value=financial-risk-analyst Key=env,Value=dev \
    --output json > /dev/null
  echo "create-db-instance submitted, provisioning takes ~5-10 minutes"
fi

echo "== Waiting summary =="
aws_ rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}' --output json

echo ""
echo "================================================================"
echo "DB master password (save this — it is not stored anywhere else):"
echo "$MASTER_PW"
echo "================================================================"
