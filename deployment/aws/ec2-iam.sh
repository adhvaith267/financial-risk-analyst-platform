#!/usr/bin/env bash
# ec2-iam.sh — Creates the IAM role for the EC2 instance with least-privilege
# permissions: SageMaker endpoint invocation + Bedrock model invocation only.
# Idempotent — safe to re-run.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
ACCOUNT_ID=575264900919
ROLE_NAME=FRA-EC2Role
PROFILE_NAME=FRA-EC2Role

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

PERMISSIONS_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SageMakerInvokeEndpoint",
      "Effect": "Allow",
      "Action": "sagemaker:InvokeEndpoint",
      "Resource": "arn:aws:sagemaker:ap-south-1:'"$ACCOUNT_ID"':endpoint/gmsc-pd-endpoint"
    },
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}'

echo "== IAM role: $ROLE_NAME =="
if aws_ iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "Role already exists, updating inline policy..."
else
    aws_ iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document "$TRUST_POLICY" \
        --description "EC2 role for Financial Risk Analyst — SageMaker + Bedrock only" \
        --tags Key=project,Value=financial-risk-analyst >/dev/null
    echo "Role created: $ROLE_NAME"
fi

aws_ iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name FRA-EC2Permissions \
    --policy-document "$PERMISSIONS_POLICY"
echo "Inline policy applied."

echo "== Instance profile: $PROFILE_NAME =="
if aws_ iam get-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null 2>&1; then
    echo "Instance profile already exists."
else
    aws_ iam create-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null
    aws_ iam add-role-to-instance-profile \
        --instance-profile-name "$PROFILE_NAME" \
        --role-name "$ROLE_NAME"
    echo "Instance profile created and role attached."
fi

echo "Done. Attach '$PROFILE_NAME' to your EC2 instance."
