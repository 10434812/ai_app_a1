#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_DIR="/home/www/docker"
PROJECT_NAME="ai_app"
CONFIG_IMPORT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --project)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --config-import-file)
      CONFIG_IMPORT_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$CONFIG_IMPORT_FILE" ]]; then
  echo "Missing required arg: --config-import-file" >&2
  exit 2
fi

if [[ ! -d "$REMOTE_DIR" ]]; then
  echo "Remote dir not found: $REMOTE_DIR" >&2
  exit 2
fi

DEPLOY_LOG_DIR="$REMOTE_DIR/.deploy"
mkdir -p "$DEPLOY_LOG_DIR"
LOG_FILE="$DEPLOY_LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[deploy] started at $(date '+%F %T')"
echo "[deploy] remote_dir=$REMOTE_DIR"
echo "[deploy] project=$PROJECT_NAME"
echo "[deploy] config_import_file=$CONFIG_IMPORT_FILE"

compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "docker compose/docker-compose not found" >&2
    exit 3
  fi
}

wait_backend_ready() {
  local retries=40
  local delay=3
  local i
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "http://127.0.0.1:4000/api/health" >/dev/null 2>&1; then
      echo "[deploy] backend health ok"
      return 0
    fi
    sleep "$delay"
  done
  echo "[deploy] backend health check timeout" >&2
  return 1
}

wait_mysql_ready() {
  local retries=40
  local delay=3
  local i
  for ((i=1; i<=retries; i++)); do
    if compose exec -T mysql sh -lc 'MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysqladmin ping -uroot --silent' >/dev/null 2>&1; then
      echo "[deploy] mysql ready"
      return 0
    fi
    sleep "$delay"
  done
  echo "[deploy] mysql readiness timeout" >&2
  return 1
}

check_auth_me_status() {
  local status
  status="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:4000/api/auth/me")"
  if [[ "$status" != "200" && "$status" != "401" ]]; then
    echo "[deploy] /api/auth/me unexpected status: $status" >&2
    return 1
  fi
  echo "[deploy] /api/auth/me status=$status"
}

cd "$REMOTE_DIR"

compose pull || true
compose build
compose up -d --remove-orphans
wait_mysql_ready
if ! compose exec -T backend node dist/scripts/migrate.js; then
  compose exec -T backend npm run migrate
fi

if [[ -f "$CONFIG_IMPORT_FILE" ]]; then
  compose cp "$CONFIG_IMPORT_FILE" backend:/tmp/ai-app-config.json
  compose exec -T backend node dist/scripts/import-config.js --input /tmp/ai-app-config.json
else
  echo "[deploy] config file not found, skip import: $CONFIG_IMPORT_FILE" >&2
fi

wait_backend_ready
curl -fsS "http://127.0.0.1:4000/api/config" >/dev/null
check_auth_me_status

echo "[deploy] finished at $(date '+%F %T')"
echo "[deploy] log_file=$LOG_FILE"
