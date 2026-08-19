#!/usr/bin/env bash
# Connects the frontend/ directory to Amplify Hosting via GitHub CI/CD.
# Requires `gh auth login` to have been run already (uses its token to
# authorize the Amplify GitHub App - the token itself is never stored by
# Amplify). Re-running triggers a fresh build of the current branch.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
APP_NAME=financial-risk-analyst-frontend
REPO_URL=https://github.com/adhvaith267/financial-risk-analyst-platform
BRANCH=master
ALB_NAME=fra-backend-alb

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

ALB_DNS=$(aws_ elbv2 describe-load-balancers --names "$ALB_NAME" --query 'LoadBalancers[0].DNSName' --output text)
echo "backend ALB: $ALB_DNS"

APP_ID=$(aws_ amplify list-apps --query "apps[?name=='$APP_NAME'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ] || [ -z "$APP_ID" ]; then
  APP_ID=$(aws_ amplify create-app \
    --name "$APP_NAME" \
    --repository "$REPO_URL" \
    --access-token "$(gh auth token)" \
    --platform WEB \
    --build-spec '{
      "version": 1,
      "applications": [
        {
          "appRoot": "frontend",
          "frontend": {
            "phases": {
              "preBuild": {"commands": ["npm install"]},
              "build": {"commands": ["npm run build"]}
            },
            "artifacts": {"baseDirectory": "dist", "files": ["**/*"]},
            "cache": {"paths": ["node_modules/**/*"]}
          }
        }
      ]
    }' \
    --tags project=financial-risk-analyst \
    --query 'app.appId' --output text)
  aws_ amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" \
    --environment-variables VITE_API_BASE_URL="http://$ALB_DNS" \
    --enable-auto-build
  echo "created Amplify app $APP_ID"
else
  aws_ amplify update-branch --app-id "$APP_ID" --branch-name "$BRANCH" \
    --environment-variables VITE_API_BASE_URL="http://$ALB_DNS" >/dev/null
  echo "using existing Amplify app $APP_ID"
fi

aws_ amplify start-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-type RELEASE >/dev/null
DOMAIN=$(aws_ amplify get-app --app-id "$APP_ID" --query 'app.defaultDomain' --output text)
echo "deploying... frontend will be live at: https://$BRANCH.$DOMAIN"
