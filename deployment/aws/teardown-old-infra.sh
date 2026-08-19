#!/usr/bin/env bash
# teardown-old-infra.sh — Removes the ECS/Fargate/ALB/CloudFront/Amplify/ECR
# infrastructure that is no longer needed in the simplified EC2 architecture.
#
# DESTRUCTIVE — read through this script before running.
# RDS, SageMaker, S3, and VPC networking are NOT touched.
# Run with: bash teardown-old-infra.sh
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }
cfaws() { aws --profile "$PROFILE" --region us-east-1 "$@"; }  # CloudFront is global

echo "========================================================"
echo " Financial Risk Analyst — teardown old ECS/ALB/CF/Amplify infra"
echo "========================================================"

# ── 1. ECS service + cluster ──────────────────────────────────────────────────
echo "==> ECS service: fra-backend-svc"
if aws_ ecs describe-services --cluster fra-cluster --services fra-backend-svc \
        --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
    aws_ ecs update-service --cluster fra-cluster --service fra-backend-svc --desired-count 0 >/dev/null
    aws_ ecs delete-service --cluster fra-cluster --service fra-backend-svc --force >/dev/null
    echo "  Deleted fra-backend-svc"
else
    echo "  fra-backend-svc not found or already deleted"
fi

echo "==> ECS cluster: fra-cluster"
if aws_ ecs describe-clusters --clusters fra-cluster \
        --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
    aws_ ecs delete-cluster --cluster fra-cluster >/dev/null
    echo "  Deleted fra-cluster"
else
    echo "  fra-cluster not found or already deleted"
fi

# ── 2. ALB + target group + listener ─────────────────────────────────────────
echo "==> ALB: fra-backend-alb"
ALB_ARN=$(aws_ elbv2 describe-load-balancers --names fra-backend-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "")
if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
    # Delete listeners first
    LISTENER_ARNS=$(aws_ elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
        --query 'Listeners[*].ListenerArn' --output text)
    for arn in $LISTENER_ARNS; do
        aws_ elbv2 delete-listener --listener-arn "$arn" >/dev/null
    done
    aws_ elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN" >/dev/null
    echo "  Deleted ALB: $ALB_ARN"
else
    echo "  fra-backend-alb not found or already deleted"
fi

echo "==> Target group: fra-backend-tg"
TG_ARN=$(aws_ elbv2 describe-target-groups --names fra-backend-tg \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
    aws_ elbv2 delete-target-group --target-group-arn "$TG_ARN" >/dev/null
    echo "  Deleted target group: $TG_ARN"
else
    echo "  fra-backend-tg not found or already deleted"
fi

echo "==> Security group: fra-alb-sg"
ALB_SG_ID=$(aws_ ec2 describe-security-groups \
    --filters "Name=group-name,Values=fra-alb-sg" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")
if [ -n "$ALB_SG_ID" ] && [ "$ALB_SG_ID" != "None" ]; then
    aws_ ec2 delete-security-group --group-id "$ALB_SG_ID" >/dev/null && \
        echo "  Deleted fra-alb-sg ($ALB_SG_ID)" || \
        echo "  Could not delete fra-alb-sg — may still be referenced; remove manually"
else
    echo "  fra-alb-sg not found or already deleted"
fi

# ── 3. ECR repository ─────────────────────────────────────────────────────────
echo "==> ECR repository: fra-backend"
if aws_ ecr describe-repositories --repository-names fra-backend >/dev/null 2>&1; then
    aws_ ecr delete-repository --repository-name fra-backend --force >/dev/null
    echo "  Deleted ECR repo fra-backend (all images purged)"
else
    echo "  fra-backend ECR repo not found or already deleted"
fi

# ── 4. CloudFront distribution ────────────────────────────────────────────────
echo "==> CloudFront distributions..."
DIST_ID=$(cfaws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='fra-backend-cdn' || contains(Origins.Items[0].DomainName, 'fra-backend')].Id | [0]" \
    --output text 2>/dev/null || echo "")
if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
    # Get ETag required for disable+delete
    ETAG=$(cfaws cloudfront get-distribution-config --id "$DIST_ID" \
        --query 'ETag' --output text)
    CONFIG=$(cfaws cloudfront get-distribution-config --id "$DIST_ID" \
        --query 'DistributionConfig' --output json)
    DISABLED_CONFIG=$(echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); d['Enabled']=False; print(json.dumps(d))")
    NEW_ETAG=$(cfaws cloudfront update-distribution --id "$DIST_ID" \
        --distribution-config "$DISABLED_CONFIG" --if-match "$ETAG" \
        --query 'ETag' --output text)
    echo "  Distribution $DIST_ID disabled. Waiting for deployment (can take 5–10 min)..."
    cfaws cloudfront wait distribution-deployed --id "$DIST_ID"
    cfaws cloudfront delete-distribution --id "$DIST_ID" --if-match "$NEW_ETAG" >/dev/null
    echo "  Deleted CloudFront distribution $DIST_ID"
else
    echo "  No matching CloudFront distribution found"
fi

# ── 5. Amplify app ────────────────────────────────────────────────────────────
echo "==> Amplify app: financial-risk-analyst-frontend"
APP_ID=$(aws_ amplify list-apps \
    --query "apps[?name=='financial-risk-analyst-frontend'].appId | [0]" \
    --output text 2>/dev/null || echo "")
if [ -n "$APP_ID" ] && [ "$APP_ID" != "None" ]; then
    aws_ amplify delete-app --app-id "$APP_ID" >/dev/null
    echo "  Deleted Amplify app $APP_ID"
else
    echo "  No matching Amplify app found"
fi

# ── 6. ECS task definitions (deregister all revisions) ────────────────────────
echo "==> Deregistering ECS task definition revisions: fra-backend"
TASK_ARNS=$(aws_ ecs list-task-definitions --family-prefix fra-backend \
    --query 'taskDefinitionArns' --output text 2>/dev/null || echo "")
for arn in $TASK_ARNS; do
    aws_ ecs deregister-task-definition --task-definition "$arn" >/dev/null
done
[ -n "$TASK_ARNS" ] && echo "  Deregistered all fra-backend task definition revisions" \
                     || echo "  No fra-backend task definitions found"

echo ""
echo "========================================================"
echo " Teardown complete."
echo " RDS, SageMaker, S3, VPC, and security groups are untouched."
echo "========================================================"
