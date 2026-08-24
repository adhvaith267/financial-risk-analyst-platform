#!/usr/bin/env bash
# Fast, repeatable application deployment for an already-provisioned EC2 host.
set -euo pipefail

APP_DIR="/var/www/financial-risk-analyst"
DEPLOY_BRANCH="main"
DEPLOY_REF="${DEPLOY_REF:-origin/$DEPLOY_BRANCH}"
ENV_FILE="/etc/financial-risk-analyst/env"
NGINX_CONF="/etc/nginx/conf.d/financial-risk.conf"
SYSTEMD_UNIT="/etc/systemd/system/financial-risk-api.service"

if [ ! -d "$APP_DIR/.git" ]; then
    echo "Application checkout is missing: $APP_DIR" >&2
    exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
    echo "Runtime environment is missing: $ENV_FILE" >&2
    exit 1
fi
if [ -n "$(git -C "$APP_DIR" status --porcelain)" ]; then
    echo "Refusing to deploy over a dirty working tree: $APP_DIR" >&2
    exit 1
fi

echo "==> Updating application checkout"
git -C "$APP_DIR" fetch origin "$DEPLOY_BRANCH"
git -C "$APP_DIR" checkout --quiet "$DEPLOY_BRANCH"
if [ "$DEPLOY_REF" = "origin/$DEPLOY_BRANCH" ]; then
    git -C "$APP_DIR" pull --ff-only origin "$DEPLOY_BRANCH"
else
    git -C "$APP_DIR" cat-file -e "$DEPLOY_REF^{commit}"
    git -C "$APP_DIR" checkout --detach --quiet "$DEPLOY_REF"
fi

echo "==> Installing locked backend dependencies"
cd "$APP_DIR/backend"
uv sync --locked --no-dev

echo "==> Applying database migrations before restart"
set -a
source "$ENV_FILE"
set +a
: "${DB_HOST:?Set DB_HOST in $ENV_FILE}"
: "${DB_PASSWORD:?Set DB_PASSWORD in $ENV_FILE}"
if [ "${APP_ENV:-development}" = "production" ]; then
    : "${AUTH_SECRET_KEY:?Set AUTH_SECRET_KEY in $ENV_FILE}"
    if [ "${GOOGLE_AUTH_ENABLED:-false}" != "true" ]; then
        : "${AUTH_USERNAME:?Set AUTH_USERNAME in $ENV_FILE}"
        : "${AUTH_PASSWORD_HASH:?Set AUTH_PASSWORD_HASH in $ENV_FILE}"
    fi
fi
uv run alembic upgrade head

echo "==> Building frontend"
cd "$APP_DIR/frontend"
npm ci --silent
npm run build

echo "==> Reloading Nginx configuration"
sudo sed "s|/var/www/financial-risk-analyst/frontend|$APP_DIR/frontend/dist|g" \
    "$APP_DIR/deployment/nginx/financial-risk.conf" | sudo tee "$NGINX_CONF" > /dev/null
sudo nginx -t
sudo systemctl reload nginx

echo "==> Restarting API"
sudo cp "$APP_DIR/deployment/systemd/financial-risk-api.service" "$SYSTEMD_UNIT"
sudo systemctl daemon-reload
sudo systemctl restart financial-risk-api

echo "==> Verifying deployment"
for attempt in 1 2 3 4 5; do
    if curl --fail --silent http://127.0.0.1:8000/health > /dev/null \
        && curl --fail --silent http://127.0.0.1:8000/ready > /dev/null; then
        echo "Deployment verified."
        exit 0
    fi
    sleep 3
done

echo "Deployment verification failed; inspect: journalctl -u financial-risk-api -n 100" >&2
exit 1
