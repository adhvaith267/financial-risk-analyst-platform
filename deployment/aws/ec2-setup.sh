#!/usr/bin/env bash
# ec2-setup.sh — Installs all dependencies and deploys the Financial Risk
# Analyst platform on a fresh Amazon Linux 2023 EC2 instance.
# Run as ec2-user (not root). Re-running is safe (idempotent).
set -euo pipefail

REPO_URL="https://github.com/adhvaith267/financial-risk-analyst-platform.git"
APP_DIR="/var/www/financial-risk-analyst"
DEPLOY_BRANCH="main"
ENV_FILE="/etc/financial-risk-analyst/env"
NGINX_CONF="/etc/nginx/conf.d/financial-risk.conf"
SYSTEMD_UNIT="/etc/systemd/system/financial-risk-api.service"

echo "========================================================"
echo " Financial Risk Analyst — EC2 setup"
echo "========================================================"

# ── 1. System packages ─────────────────────────────────────────────────────────
echo "==> Installing system packages..."
sudo dnf update -y
sudo dnf install -y git nginx python3.11 python3.11-pip nodejs npm

# Install uv (fast Python package manager used by this project)
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# ── 2. Clone / update repository ──────────────────────────────────────────────
echo "==> Cloning / updating repository..."
sudo mkdir -p "$APP_DIR"
sudo chown ec2-user:ec2-user "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
    if [ -n "$(git -C "$APP_DIR" status --porcelain)" ]; then
        echo "Refusing to deploy over a dirty working tree: $APP_DIR" >&2
        exit 1
    fi
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout --quiet "$DEPLOY_BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$DEPLOY_BRANCH"
else
    git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ── 3. Backend Python environment ─────────────────────────────────────────────
echo "==> Setting up Python backend..."
cd "$APP_DIR/backend"
uv sync --locked --no-dev

# ── 4. Environment variables ───────────────────────────────────────────────────
echo "==> Configuring environment..."
sudo mkdir -p /etc/financial-risk-analyst
if [ ! -f "$ENV_FILE" ]; then
    sudo cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
    sudo chmod 600 "$ENV_FILE"
    echo "IMPORTANT: Edit $ENV_FILE and fill in DB_HOST, DB_PASSWORD, etc."
fi

# ── 5. React frontend build ────────────────────────────────────────────────────
echo "==> Building React frontend..."
cd "$APP_DIR/frontend"
npm ci --silent
npm run build

# Copy the production build where Nginx expects it
sudo mkdir -p "$APP_DIR/frontend"
# The build output lands in frontend/dist — Nginx serves from there directly
# (we symlink so re-deploys just rebuild in place).
sudo ln -sfn "$APP_DIR/frontend/dist" "$APP_DIR/frontend_dist"

# ── 6. Nginx ───────────────────────────────────────────────────────────────────
echo "==> Configuring Nginx..."
# Update the Nginx config root to point at the actual dist path
sudo sed "s|/var/www/financial-risk-analyst/frontend|$APP_DIR/frontend/dist|g" \
    "$APP_DIR/deployment/nginx/financial-risk.conf" | sudo tee "$NGINX_CONF" > /dev/null
# Remove the default Nginx welcome page
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ── 7. systemd service ────────────────────────────────────────────────────────
echo "==> Installing systemd service..."
sudo cp "$APP_DIR/deployment/systemd/financial-risk-api.service" "$SYSTEMD_UNIT"
sudo systemctl daemon-reload
sudo systemctl enable financial-risk-api

# ── 8. Database migrations ────────────────────────────────────────────────────
echo "==> Running Alembic migrations..."
cd "$APP_DIR/backend"
# Source the env file so alembic can reach the DB
set -a && source "$ENV_FILE" && set +a
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
sudo systemctl restart financial-risk-api

# ── 9. Smoke test ─────────────────────────────────────────────────────────────
echo "==> Smoke test..."
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "FastAPI health check: OK (HTTP $HTTP_STATUS)"
else
    echo "WARNING: FastAPI returned HTTP $HTTP_STATUS — check 'journalctl -u financial-risk-api -n 50'"
fi

NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/)
if [ "$NGINX_STATUS" = "200" ]; then
    echo "Nginx frontend: OK (HTTP $NGINX_STATUS)"
else
    echo "WARNING: Nginx returned HTTP $NGINX_STATUS — check 'journalctl -u nginx -n 50'"
fi

echo ""
echo "========================================================"
echo " Deployment complete."
echo " Fill in secrets: sudo nano $ENV_FILE"
echo " Then restart:    sudo systemctl restart financial-risk-api"
echo "========================================================"
