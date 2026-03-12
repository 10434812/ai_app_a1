# 配置迁移

后台的模型配置、系统设置、图片配置、计费配置、模型启停状态都保存在 `system_configs` 表。

这意味着部署到服务器时，不需要再去后台一项项重新填写，可以直接导出本地配置后导入服务器。

## 导出本地配置

推荐在本地项目根目录执行：

```bash
docker compose exec backend npm run config:export -- --output /tmp/ai-app-config.json
docker cp ai_app_backend:/tmp/ai-app-config.json ./ai-app-config.json
```

默认导出范围是 `deployment`，会自动排除运行态键，例如会员月配额周期标记。

如果你确实要导出 `system_configs` 里的所有键：

```bash
docker compose exec backend npm run config:export -- --scope all --output /tmp/ai-app-config.json
docker cp ai_app_backend:/tmp/ai-app-config.json ./ai-app-config.json
```

## 导入到服务器

先把导出的文件上传到服务器，例如上传到项目根目录：

```bash
scp ./ai-app-config.json root@your-server:/root/ai_app/ai-app-config.json
```

然后在服务器项目目录执行：

```bash
docker cp ./ai-app-config.json ai_app_backend:/tmp/ai-app-config.json
docker compose exec backend npm run config:import -- --input /tmp/ai-app-config.json
```

## 本地到服务器完整部署顺序

下面这套顺序适合你现在这种 Docker Compose 部署。

### 1. 本地导出配置

```bash
cd /Users/hh/Desktop/ai_app_a1
docker compose exec backend npm run config:export -- --output /tmp/ai-app-config.json
docker cp ai_app_backend:/tmp/ai-app-config.json ./ai-app-config.json
```

### 2. 打包项目

建议直接打包整个项目目录，不带本地 `node_modules`：

```bash
cd /Users/hh/Desktop
tar --exclude='ai_app_a1/frontend/node_modules' \
    --exclude='ai_app_a1/admin/node_modules' \
    --exclude='ai_app_a1/backend/node_modules' \
    --exclude='ai_app_a1/frontend/dist' \
    --exclude='ai_app_a1/admin/dist' \
    -czf ai_app_a1.tar.gz ai_app_a1
```

### 3. 上传到服务器

```bash
scp /Users/hh/Desktop/ai_app_a1.tar.gz root@你的服务器IP:/root/
scp /Users/hh/Desktop/ai_app_a1/ai-app-config.json root@你的服务器IP:/root/
```

### 4. 服务器解压

```bash
ssh root@你的服务器IP
cd /root
rm -rf ai_app_a1
tar -xzf ai_app_a1.tar.gz
cd /root/ai_app_a1
```

### 5. 启动容器

```bash
docker compose up -d --build
```

### 6. 导入配置

```bash
docker cp /root/ai-app-config.json ai_app_backend:/tmp/ai-app-config.json
docker compose exec backend npm run config:import -- --input /tmp/ai-app-config.json
```

### 7. 验证

```bash
curl http://127.0.0.1:4000/api/health
docker compose logs --tail=100 backend
```

如果你用宝塔反代：

- 前台反代到 `3000`
- 后台反代到 `3001`
- API 反代到 `4000`

## 导入前检查

如果你只想先校验文件结构，不落库：

```bash
docker compose exec backend npm run config:import -- --input /tmp/ai-app-config.json --dry-run
```

## 会一起迁移的内容

- `model_config:*`：模型接口配置
- `model_status:*`：模型启用/禁用状态
- 系统设置
- 图片生成配置
- 微信分享/JSSDK 配置
- 限流配置
- 计费配置

## 不会迁移的内容

- 用户数据
- 订单数据
- 对话记录
- Token 流水
- 运行态键，例如 `membership_monthly_quota_last_cycle`

## 注意

导出文件里会包含真实 API Key。导出后请按密钥文件处理，不要提交到仓库。
