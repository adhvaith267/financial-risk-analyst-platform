#!/usr/bin/env bash
# Whitelists the caller's current public IP for direct RDS access (dev only).
# Safe to re-run when your IP changes - removes any prior local-dev-access
# rule on the RDS security group before adding the current one.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
RDS_SG_ID=sg-0921291e9f6767fd0

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

MY_IP=$(curl -s https://checkip.amazonaws.com)
echo "Current public IP: $MY_IP"

OLD_RULE_IDS=$(aws_ ec2 describe-security-group-rules \
  --filters Name=group-id,Values=$RDS_SG_ID \
  --query "SecurityGroupRules[?Tags[?Key=='purpose' && Value=='local-dev-access']].SecurityGroupRuleId" \
  --output text)
if [ -n "$OLD_RULE_IDS" ]; then
  aws_ ec2 revoke-security-group-ingress --group-id "$RDS_SG_ID" --security-group-rule-ids $OLD_RULE_IDS
  echo "revoked stale local-dev-access rule(s): $OLD_RULE_IDS"
fi

aws_ ec2 authorize-security-group-ingress \
  --group-id "$RDS_SG_ID" \
  --protocol tcp --port 5432 \
  --cidr "${MY_IP}/32" \
  --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=purpose,Value=local-dev-access},{Key=project,Value=financial-risk-analyst}]"

echo "allowed $MY_IP/32 -> :5432 on $RDS_SG_ID"
