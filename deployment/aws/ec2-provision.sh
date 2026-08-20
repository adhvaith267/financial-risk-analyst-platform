#!/usr/bin/env bash
# ec2-provision.sh — Provisions the EC2 instance for the Financial Risk
# Analyst platform. Idempotent: safe to re-run, skips resources that exist.
# Requires: aws CLI configured with the fra-dev profile.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
VPC_ID=vpc-0284304629b3039a9
SUBNET_ID=subnet-079b42f82932dd6dc    # public subnet in ap-south-1a
APP_SG_NAME=fra-app-sg

# Ubuntu 22.04 LTS (HVM, SSD) in ap-south-1 — update if a newer AMI is preferred
AMI_ID=ami-0f58b397bc5c1f2e8          # Amazon Linux 2023 ap-south-1
INSTANCE_TYPE=t3.small
KEY_NAME=fra-dev-key                   # must already exist in your account
IAM_INSTANCE_PROFILE=FRA-EC2Role      # the role created by ec2-iam.sh

aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "== Security group: $APP_SG_NAME =="
APP_SG_ID=$(aws_ ec2 describe-security-groups \
    --filters "Name=group-name,Values=$APP_SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' --output text)
if [ "$APP_SG_ID" = "None" ] || [ -z "$APP_SG_ID" ]; then
    APP_SG_ID=$(aws_ ec2 create-security-group \
        --group-name "$APP_SG_NAME" \
        --description "Financial Risk Analyst platform — EC2 app server" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' --output text)
    aws_ ec2 create-tags --resources "$APP_SG_ID" \
        --tags Key=Name,Value="$APP_SG_NAME" Key=project,Value=financial-risk-analyst

    # Allow inbound HTTP and HTTPS from anywhere
    aws_ ec2 authorize-security-group-ingress --group-id "$APP_SG_ID" \
        --protocol tcp --port 80   --cidr 0.0.0.0/0
    aws_ ec2 authorize-security-group-ingress --group-id "$APP_SG_ID" \
        --protocol tcp --port 443  --cidr 0.0.0.0/0
    # SSH — restrict this to your own IP in production
    aws_ ec2 authorize-security-group-ingress --group-id "$APP_SG_ID" \
        --protocol tcp --port 22   --cidr 0.0.0.0/0

    echo "Created security group: $APP_SG_ID"
else
    echo "Security group already exists: $APP_SG_ID"
fi

echo "== EC2 instance =="
INSTANCE_ID=$(aws_ ec2 describe-instances \
    --filters "Name=tag:Name,Values=fra-app-server" \
              "Name=instance-state-name,Values=running,stopped,pending" \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    INSTANCE_ID=$(aws_ ec2 run-instances \
        --image-id "$AMI_ID" \
        --instance-type "$INSTANCE_TYPE" \
        --key-name "$KEY_NAME" \
        --security-group-ids "$APP_SG_ID" \
        --subnet-id "$SUBNET_ID" \
        --associate-public-ip-address \
        --iam-instance-profile "Name=$IAM_INSTANCE_PROFILE" \
        --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
        --tag-specifications \
            "ResourceType=instance,Tags=[{Key=Name,Value=fra-app-server},{Key=project,Value=financial-risk-analyst}]" \
        --query 'Instances[0].InstanceId' --output text)
    echo "Launched instance: $INSTANCE_ID"
    echo "Waiting for instance to be running..."
    aws_ ec2 wait instance-running --instance-ids "$INSTANCE_ID"
else
    echo "Instance already exists: $INSTANCE_ID"
fi

PUBLIC_IP=$(aws_ ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Public IP: $PUBLIC_IP"
echo ""
echo "Next steps:"
echo "  ssh -i ~/.ssh/$KEY_NAME.pem ec2-user@$PUBLIC_IP"
echo "  curl https://raw.githubusercontent.com/adhvaith267/financial-risk-analyst-platform/main/deployment/aws/ec2-setup.sh | bash"
