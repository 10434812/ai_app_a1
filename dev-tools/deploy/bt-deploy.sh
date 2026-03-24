#!/usr/bin/env bash
set -Eeuo pipefail

HOST=""
PORT="22"
USER="root"
PASSWORD="${BT_SSH_PASSWORD:-}"
REMOTE_DIR="/home/www/docker/ai_app"
BRANCH="main"
PROJECT_NAME="ai_app"
WITH_BUILD="0"
DRY_RUN="0"
ALLOW_DIRTY="0"
SYNC_SCOPE="minimal"
FORCE_MODE="0"
SKIP_CONFIG_SYNC="0"

usage() {
  cat <<USAGE
用法:
  ./dev-tools/deploy/bt-deploy.sh --host <ip_or_domain> [options]

必填:
  --host <host>

可选:
  --port <port>                 default: 22
  --user <user>                 default: root
  --password <password>         default: env BT_SSH_PASSWORD; fallback prompt
  --remote-dir <dir>            default: /home/www/docker/ai_app
  --branch <name>               default: main
  --project <name>              default: ai_app
  --with-build                  run backend/frontend/admin build precheck
  --dry-run                     only precheck + rsync --dry-run
  --allow-dirty                 skip clean working tree check
  --force                       skip branch/dirty checks
  --sync-all                    同步整个仓库（默认仅最小文件集）
  --skip-config-sync            跳过本地配置导出/导入
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
    --force)
      FORCE_MODE="1"
      ALLOW_DIRTY="1"
      shift
      ;;
    --sync-all)
      SYNC_SCOPE="all"
      shift
      ;;
    --skip-config-sync)
      SKIP_CONFIG_SYNC="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "--host 是必填参数" >&2
  usage
  exit 2
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "缺少命令: $1" >&2; exit 3; }
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
    echo "本机不可用 docker compose" >&2
    exit 3
  fi
}

run_with_password() {
  local password="$1"
  shift
  local expect_script
  expect_script="$(mktemp -t ai-app-deploy.expect.XXXXXX)"
  cat >"$expect_script" <<'EOF'
#!/usr/bin/expect -f
set timeout -1
if {[llength $argv] < 2} {
  puts stderr "expect wrapper args invalid"
  exit 2
}
set password [lindex $argv 0]
set cmd [lrange $argv 1 end]
spawn -noecho {*}$cmd
expect {
  -re "(?i)yes/no" { send -- "yes\r"; exp_continue }
  -re "(?i)password:" { send -- "$password\r"; exp_continue }
  eof {
    catch wait result
    set code [lindex $result 3]
    if {$code eq ""} { set code 0 }
    exit $code
  }
}
EOF
  chmod +x "$expect_script"
  set +e
  expect "$expect_script" "$password" "$@"
  local code=$?
  set -e
  rm -f "$expect_script"
  return $code
}

if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "请输入 ${USER}@${HOST} 的 SSH 密码: " PASSWORD
  echo
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$FORCE_MODE" != "1" && "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "当前分支是 '$CURRENT_BRANCH'，期望 '$BRANCH'" >&2
  exit 4
fi

if [[ "$ALLOW_DIRTY" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "工作区不干净，请先 commit/stash，或加 --allow-dirty" >&2
    exit 4
  fi
fi

if [[ "$WITH_BUILD" == "1" ]]; then
  echo "[预检] 开始执行构建检查"
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

SYNC_SOURCES=()
if [[ "$SYNC_SCOPE" == "all" ]]; then
  SYNC_SOURCES=(./)
else
  SYNC_SOURCES=(
    ./backend
    ./frontend
    ./admin
    ./docker-compose.yml
  )
fi

echo "[发布] 开始同步（范围=${SYNC_SCOPE}）-> ${USER}@${HOST}:${REMOTE_DIR}"
run_with_password "$PASSWORD" rsync "${RSYNC_ARGS[@]}" -e "ssh -p ${PORT}" "${SYNC_SOURCES[@]}" "${USER}@${HOST}:${REMOTE_DIR}/"
echo "[发布] 同步完成"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[发布] dry-run 完成"
  exit 0
fi

if [[ "$SKIP_CONFIG_SYNC" == "1" ]]; then
  echo "[发布] 已跳过配置同步"
else
  echo "[发布] 导出本地系统配置"
  compose exec -T backend npm run config:export -- --output /tmp/ai-app-config.json
  compose cp backend:/tmp/ai-app-config.json "$LOCAL_CONFIG_FILE"

  echo "[发布] 上传配置文件"
  run_with_password "$PASSWORD" scp -P "$PORT" "$LOCAL_CONFIG_FILE" "${USER}@${HOST}:${REMOTE_TMP_CONFIG_FILE}"
  echo "[发布] 配置上传完成"
fi

echo "[发布] 开始远端部署"
REMOTE_CMD_BASE=$(cat <<EOF
set -Eeuo pipefail
echo "[远端] 进入目录 ${REMOTE_DIR}"
cd '${REMOTE_DIR}'
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  compose_cmd='docker compose'
elif command -v docker-compose >/dev/null 2>&1; then
  compose_cmd='docker-compose'
else
  echo '未找到 docker compose/docker-compose' >&2
  exit 3
fi
\$compose_cmd down || true
echo "[远端] compose down 完成"
\$compose_cmd up -d --build --remove-orphans
echo "[远端] compose up 完成"
if ! \$compose_cmd exec -T backend node dist/scripts/migrate.js; then
  \$compose_cmd exec -T backend npm run migrate
fi
echo "[远端] 数据迁移完成"
EOF
)

if [[ "$SKIP_CONFIG_SYNC" == "1" ]]; then
  REMOTE_CMD="${REMOTE_CMD_BASE}
curl -fsS 'http://127.0.0.1:4000/api/health' >/dev/null
curl -fsS 'http://127.0.0.1:4000/api/config' >/dev/null
status=\"\$(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:4000/api/auth/me')\"
if [[ \"\$status\" != '200' && \"\$status\" != '401' ]]; then
  echo \"/api/auth/me 状态异常: \$status\" >&2
  exit 1
fi
echo '[远端] 健康检查完成'"
else
  REMOTE_CMD="${REMOTE_CMD_BASE}
if [[ -f '${REMOTE_TMP_CONFIG_FILE}' ]]; then
  \$compose_cmd cp '${REMOTE_TMP_CONFIG_FILE}' backend:/tmp/ai-app-config.json
  \$compose_cmd exec -T backend npm run config:import -- --input /tmp/ai-app-config.json
fi
echo '[远端] 配置导入完成'
curl -fsS 'http://127.0.0.1:4000/api/health' >/dev/null
curl -fsS 'http://127.0.0.1:4000/api/config' >/dev/null
status=\"\$(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:4000/api/auth/me')\"
if [[ \"\$status\" != '200' && \"\$status\" != '401' ]]; then
  echo \"/api/auth/me 状态异常: \$status\" >&2
  exit 1
fi
echo '[远端] 健康检查完成'"
fi
REMOTE_CMD_QUOTED="$(printf '%q' "$REMOTE_CMD")"
run_with_password "$PASSWORD" ssh -p "$PORT" "${USER}@${HOST}" "bash -lc ${REMOTE_CMD_QUOTED}"

echo "[发布] 成功"
echo "[发布] 发布完成，脚本即将退出(0)"
