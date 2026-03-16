# 一键发布到宝塔（本地触发）

## 前置条件
- 本地（Mac）：`docker`、`docker compose`、`rsync`、`expect`、`ssh`、`scp`
- 服务器：已安装 `docker compose`（或 `docker-compose`）
- 项目目录：`/home/www/docker`

## 命令
```bash
./dev-tools/deploy/bt-deploy.sh --host <服务器IP或域名> --user root --port 22 --branch main --remote-dir /home/www/docker
```

## 常用参数
- `--password`：直接传 SSH 密码（不推荐）
- 环境变量 `BT_SSH_PASSWORD`：推荐
- `--with-build`：发布前先跑三端 build
- `--dry-run`：只做预检和 `rsync --dry-run`
- `--allow-dirty`：跳过工作区干净检查

## 流程
1. 预检（分支/工作区/可选构建）
2. 导出本地 `system_configs`
3. `rsync` 到服务器（默认最小同步：`backend/frontend/admin + docker-compose.yml + remote-deploy.sh`，且不覆盖服务器 `.env`）
4. 上传配置包
5. 远程执行部署：`compose build/up + migrate + config:import + 健康检查`

## 远程日志
- 路径：`/home/www/docker/.deploy/deploy-YYYYmmdd-HHMMSS.log`

## 同步范围
- 默认：最小同步（推荐）
- 全量：加 `--sync-all`
