#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$(cd "${SCRIPT_DIR}/.." && pwd)/bt-deploy.sh"

grep -q 'wait_http_ready()' "$SCRIPT_PATH"
grep -q 'check_auth_me_status()' "$SCRIPT_PATH"
grep -q 'wait_http_ready '\''http://127.0.0.1:4000/api/health'\''' "$SCRIPT_PATH"
grep -q 'wait_http_ready '\''http://127.0.0.1:4000/api/config'\''' "$SCRIPT_PATH"
