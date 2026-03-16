#!/usr/bin/env bash
set -Eeuo pipefail

HOST=""
PORT="22"
USER="root"
PASSWORD="${BT_SSH_PASSWORD:-}"
REMOTE_DIR="/home/www/docker"
BRANCH="main"
PROJECT_NAME="ai_app"
WITH_BUILD="0"
DRY_RUN="0"
ALLOW_DIRTY="0"

usage() {
  cat <<USAGE
Usage:
  ./dev-tools/deploy/bt-deploy.sh --host <ip_or_domain> [options]

Required:
  --host <host>

Options:
  --port <port>                 default: 22
  --user <user>                 default: root
  --password <password>         default: env BT_SSH_PASSWORD; fallback prompt
  --remote-dir <dir>            default: /home/www/docker
  --branch <name>               default: main
  --project <name>              default: ai_app
  --with-build                  run backend/frontend/admin build precheck
  --dry-run                     only precheck + rsync --dry-run
  --allow-dirty                 skip clean working tree check
  -h, --help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --user)
      USER="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --remote-dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --project)
      PROJECT_NAME="$2"
      shift 2
      ;;
    --with-build)
      WITH_BUILD="1"
      shift
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "--host is required" >&2
  usage
  exit 2
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 3; }
}

need_cmd git
need_cmd rsync
need_cmd expect
need_cmd ssh
need_cmd scp
need_cmd docker

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    echo "docker compose not available on local machine" >&2
    exit 3
  fi
}

run_with_password() {
  local password="$1"
  shift
  expect -c '
    set timeout -1
    set password [lindex $argv 0]
    set cmd [lrange $argv 1 end]
    spawn -noecho {*}$cmd
    expect {
      -re "(?i)yes/no" { send "yes\\r"; exp_continue }
      -re "(?i)password:" { send "$password\\r"; exp_continue }
      eof {
        catch wait result
        set code [lindex $result 3]
        if {$code eq ""} { set code 0 }
        exit $code
      }
    }
  ' "$password" "$@"
}

if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "SSH Password for ${USER}@${HOST}: " PASSWORD
  echo
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "Current branch is '$CURRENT_BRANCH', expected '$BRANCH'" >&2
  exit 4
fi

if [[ "$ALLOW_DIRTY" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean. Commit/stash first or use --allow-dirty" >&2
    exit 4
  fi
fi

if [[ "$WITH_BUILD" == "1" ]]; then
  echo "[precheck] running build checks"
  (cd backend && npm run build)
  (cd frontend && npm run build)
  (cd admin && npm run build)
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_TMP_DIR="$(mktemp -d -t ai-app-deploy.XXXXXX)"
LOCAL_CONFIG_FILE="$LOCAL_TMP_DIR/ai-app-config-$TIMESTAMP.json"
REMOTE_TMP_CONFIG_FILE="/tmp/ai-app-config-$TIMESTAMP.json"

cleanup() {
  rm -rf "$LOCAL_TMP_DIR"
}
trap cleanup EXIT

RSYNC_ARGS=(
  -az
  --delete
  --exclude=.git/
  --exclude=node_modules/
  --exclude=dist/
  --exclude=.DS_Store
  --exclude=.env
  --exclude=.env.*
  --exclude=.omc/
)

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

echo "[deploy] sync repo -> ${USER}@${HOST}:${REMOTE_DIR}"
run_with_password "$PASSWORD" rsync "${RSYNC_ARGS[@]}" -e "ssh -p ${PORT}" ./ "${USER}@${HOST}:${REMOTE_DIR}/"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[deploy] dry-run done"
  exit 0
fi

echo "[deploy] export local system configs"
compose exec -T backend npm run config:export -- --output /tmp/ai-app-config.json
compose cp backend:/tmp/ai-app-config.json "$LOCAL_CONFIG_FILE"

echo "[deploy] upload config package"
run_with_password "$PASSWORD" scp -P "$PORT" "$LOCAL_CONFIG_FILE" "${USER}@${HOST}:${REMOTE_TMP_CONFIG_FILE}"

echo "[deploy] execute remote deploy"
run_with_password "$PASSWORD" ssh -p "$PORT" "${USER}@${HOST}" \
  "bash '${REMOTE_DIR}/dev-tools/deploy/remote-deploy.sh' --remote-dir '${REMOTE_DIR}' --project '${PROJECT_NAME}' --config-import-file '${REMOTE_TMP_CONFIG_FILE}'"

echo "[deploy] success"
