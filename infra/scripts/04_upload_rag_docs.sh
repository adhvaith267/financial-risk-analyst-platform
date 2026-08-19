#!/usr/bin/env bash
# Uploads the RAG source documents (docs/rag/*.md) to S3. Idempotent - just
# re-syncs. Run this before backend/scripts/ingest_rag_docs.py.
set -euo pipefail

PROFILE=fra-dev
REGION=ap-south-1
BUCKET=financial-risk-analyst-adhvaith-2026
PREFIX=rag-docs
LOCAL_DIR="$(dirname "$0")/../../docs/rag"

aws --profile "$PROFILE" --region "$REGION" s3 sync "$LOCAL_DIR" "s3://$BUCKET/$PREFIX/" --delete

echo "synced $LOCAL_DIR -> s3://$BUCKET/$PREFIX/"
