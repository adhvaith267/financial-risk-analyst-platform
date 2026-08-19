#!/usr/bin/env bash
# Puts a CloudFront distribution in front of the backend ALB. The ALB is
# HTTP-only (no custom domain / ACM cert); the Amplify frontend is HTTPS by
# default, so a browser blocks calls to the plain-HTTP ALB as mixed content.
# CloudFront gives free automatic HTTPS on its own *.cloudfront.net domain
# without needing to own a domain. Idempotent-ish: prints the existing
# distribution's domain if one already targets this ALB.
set -euo pipefail

PROFILE=fra-dev
ALB_NAME=fra-backend-alb
SCRIPT_DIR="$(dirname "$0")"

aws_() { aws --profile "$PROFILE" "$@"; }

EXISTING=$(aws_ cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='$(aws_ elbv2 describe-load-balancers --region ap-south-1 --names $ALB_NAME --query 'LoadBalancers[0].DNSName' --output text)'].DomainName | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$EXISTING" != "None" ] && [ -n "$EXISTING" ]; then
  echo "CloudFront already in front of $ALB_NAME: https://$EXISTING"
  exit 0
fi

RESULT=$(aws_ cloudfront create-distribution --distribution-config file://"$SCRIPT_DIR/cf-dist-config.json" \
  --query '{Id:Distribution.Id,Domain:Distribution.DomainName}' --output json)
echo "$RESULT"
echo "Deploying (5-15 min). Once Status=Deployed, update Amplify's VITE_API_BASE_URL to https://<Domain>"
echo "and update backend/app/main.py CORS allow_origins to include the Amplify frontend's origin."
