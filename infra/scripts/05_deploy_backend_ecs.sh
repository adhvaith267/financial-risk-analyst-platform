#!/usr/bin/env bash
# Builds the backend image, pushes to ECR, and deploys/updates it on ECS
# Fargate behind an ALB. Networking/IAM (ALB, target group, security
# groups, task roles, cluster) are created once by this script if missing;
# re-running just builds+pushes+redeploys the image.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
ACCOUNT_ID=575264900919
VPC_ID=vpc-0284304629b3039a9
SUBNET_IDS="subnet-079b42f82932dd6dc subnet-0e84cafc158b26de0 subnet-075b2a0c3208dca17"
APP_SG_ID=sg-029ae9f086add3b8c
ECR_REPO=fra-backend
CLUSTER=fra-cluster
SERVICE=fra-backend-svc
BACKEND_DIR="$(dirname "$0")/../../backend"

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "== ECR: build + push =="
aws_ ecr describe-repositories --repository-names $ECR_REPO >/dev/null 2>&1 || \
  aws_ ecr create-repository --repository-name $ECR_REPO --image-scanning-configuration scanOnPush=true
aws_ ecr get-login-password | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
docker build -t $ECR_REPO:latest "$BACKEND_DIR"
docker tag $ECR_REPO:latest "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest"
docker push "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:latest"

echo "== ALB security group =="
ALB_SG_ID=$(aws_ ec2 describe-security-groups --filters Name=group-name,Values=fra-alb-sg Name=vpc-id,Values=$VPC_ID --query 'SecurityGroups[0].GroupId' --output text)
if [ "$ALB_SG_ID" = "None" ] || [ -z "$ALB_SG_ID" ]; then
  ALB_SG_ID=$(aws_ ec2 create-security-group --group-name fra-alb-sg --description "FRA platform ALB - public HTTP" --vpc-id $VPC_ID --query GroupId --output text)
  aws_ ec2 create-tags --resources "$ALB_SG_ID" --tags Key=Name,Value=fra-alb-sg Key=project,Value=financial-risk-analyst
  aws_ ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null
  aws_ ec2 authorize-security-group-ingress --group-id "$APP_SG_ID" --protocol tcp --port 8000 --source-group "$ALB_SG_ID" >/dev/null
fi
echo "alb SG: $ALB_SG_ID"

echo "== ALB / target group / listener =="
ALB_ARN=$(aws_ elbv2 describe-load-balancers --names fra-backend-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "")
if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
  ALB_ARN=$(aws_ elbv2 create-load-balancer --name fra-backend-alb --subnets $SUBNET_IDS --security-groups "$ALB_SG_ID" \
    --scheme internet-facing --type application --tags Key=project,Value=financial-risk-analyst \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)
  TG_ARN=$(aws_ elbv2 create-target-group --name fra-backend-tg --protocol HTTP --port 8000 --vpc-id $VPC_ID --target-type ip \
    --health-check-path /health --health-check-interval-seconds 15 --healthy-threshold-count 2 --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' --output text)
  aws_ elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TG_ARN >/dev/null
else
  TG_ARN=$(aws_ elbv2 describe-target-groups --names fra-backend-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
fi
ALB_DNS=$(aws_ elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB: $ALB_DNS"

echo "== ECS cluster =="
aws_ ecs describe-clusters --clusters $CLUSTER --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE || \
  aws_ ecs create-cluster --cluster-name $CLUSTER --tags key=project,value=financial-risk-analyst >/dev/null

echo "== register task definition =="
aws_ ecs register-task-definition --cli-input-json file://"$(dirname "$0")/task-def.json" --query 'taskDefinition.revision' --output text

echo "== service =="
if aws_ ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  aws_ ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment >/dev/null
  echo "service updated, forcing redeploy"
else
  SUBNETS_CSV=$(echo "$SUBNET_IDS" | tr ' ' ',')
  aws_ ecs create-service --cluster $CLUSTER --service-name $SERVICE --task-definition fra-backend \
    --desired-count 1 --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS_CSV],securityGroups=[$APP_SG_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$TG_ARN,containerName=fra-backend,containerPort=8000" \
    --tags key=project,value=financial-risk-analyst >/dev/null
  echo "service created"
fi

aws_ ecs wait services-stable --cluster $CLUSTER --services $SERVICE
echo "deployed. backend live at: http://$ALB_DNS"
