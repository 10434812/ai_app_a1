# 一键发布到宝塔（本地触发）

## 前置条件
- 本地（Mac）：`git`、`rsync`、`expect`、`ssh`、`scp`
- 如果不加 `--skip-config-sync`：本地还需要 `docker`、`docker compose`
- 服务器：已安装 `docker compose`（或 `docker-compose`）
- 项目目录：`/www/www/docker/home/ai_app`

## 命令
```bash
./dev-tools/deploy/bt-deploy.sh --host 81.70.240.92 --user root --port 22 --branch main --remote-dir /www/www/docker/home/ai_app
```

## 常用参数
- `--password`：直接传 SSH 密码（不推荐）
- 环境变量 `BT_SSH_PASSWORD`：推荐
- `--with-build`：发布前先跑三端 build
- `--dry-run`：只做预检和 `rsync --dry-run`
- `--allow-dirty`：跳过工作区干净检查
- `--skip-config-sync`：跳过本地配置导出/导入，此时本地不需要 Docker
- `--node-base-image`：远端构建时覆盖 Node 基础镜像
- `--nginx-base-image`：远端构建时覆盖 Nginx 基础镜像

## 基础镜像覆盖
默认仍使用：
- `node:20-alpine`
- `nginx:stable-alpine`

如果服务器 Docker Hub 连通性不稳定，可以在发布时显式覆盖：

```bash
./dev-tools/deploy/bt-deploy.sh \
  --host <服务器IP或域名> \
  --user root \
  --remote-dir /www/www/docker/home/ai_app \
  --skip-config-sync \
  --node-base-image <你的Node基础镜像> \
  --nginx-base-image <你的Nginx基础镜像>
```

## 流程
1. 预检（分支/工作区/可选构建）
2. 导出本地 `system_configs`
3. `rsync` 到服务器（默认最小同步：`backend/frontend/admin + docker-compose.yml`，且不覆盖服务器 `.env`）
4. 上传配置包
5. 远程执行部署：`compose down/up --build + migrate + config:import + 带重试的健康检查`

## 同步范围
- 默认：最小同步（推荐）
- 全量：加 `--sync-all`
