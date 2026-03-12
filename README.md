# AI 聚合问答项目（单文档接手手册）

本文件是项目唯一业务文档入口，面向“后续 AI/开发者”快速接手。  
目标：5 分钟看懂架构，15 分钟跑起来，30 分钟能改功能。

## 1. 项目一句话

这是一个三端项目：
- 用户前台（`frontend`）：多模型对话、图片生成、会员与 Token 消耗。
- 管理后台（`admin`）：用户/模型/订单/对话日志/系统配置/计费配置/分析看板。
- 后端 API（`backend`）：认证、聊天流式返回、支付、计费、限流、审计、媒体任务队列。

## 2. 目录结构（只看这些）

```txt
.
├── frontend/         # 用户前台 Vue3
├── admin/            # 管理后台 Vue3
├── backend/          # Express + Sequelize + MySQL + Redis
├── docker-compose.yml
└── .github/workflows/ci.yml
```

核心代码入口：
- 前台路由：`frontend/src/router/index.ts`
- 前台聊天主逻辑：`frontend/src/views/ChatView.vue`
- 后台路由：`admin/src/router/index.ts`
- 后端应用装配：`backend/src/app.ts`
- 后端主入口：`backend/src/index.ts`
- 后端管理路由：`backend/src/routes/admin.ts`

## 3. 技术栈

- 前台/后台：Vue 3 + TypeScript + Vite + Pinia + Tailwind
- 后端：Express + TypeScript + Sequelize
- 数据：MySQL 8 + Redis
- 部署：Docker Compose + Nginx（前后台容器）
- CI：GitHub Actions（typecheck/build/test 全量门禁）

## 4. 快速启动

### 4.1 一键 Docker（推荐）

```bash
docker compose up -d --build
```

访问：
- 前台：`http://localhost:3000`
- 后台：`http://localhost:3001`
- 后端：`http://localhost:4000`

### 4.1.1 配置搬家（本地 -> 服务器）

后台模型配置、系统设置、图片配置、计费配置都在 `system_configs` 表，不需要上线后重新一项项点。

导出本地配置：

```bash
docker compose exec backend npm run config:export -- --output /tmp/ai-app-config.json
docker cp ai_app_backend:/tmp/ai-app-config.json ./ai-app-config.json
```

服务器导入：

```bash
docker cp ./ai-app-config.json ai_app_backend:/tmp/ai-app-config.json
docker compose exec backend npm run config:import -- --input /tmp/ai-app-config.json
```

详细说明见：
- `docs/config-sync.md`

### 4.2 本地开发模式

先起基础设施：
```bash
docker compose up -d mysql redis
```

再分别启动三端：
```bash
cd backend && npm ci && npm run dev
cd frontend && npm ci && npm run dev
cd admin && npm ci && npm run dev
```

默认开发端口：
- 前台：`5173`
- 后台：`5174`
- 后端：`4000`

## 5. 环境变量（最小集）

根目录 `.env`（Docker Compose 使用）：
- `DB_USER` `DB_PASSWORD` `DB_NAME`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `DASHSCOPE_API_KEY` `DEEPSEEK_API_KEY` `ZHIPU_API_KEY` `MOONSHOT_API_KEY`

后端 `.env`（本地开发）：
- `PORT`
- `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME`
- `REDIS_URL`
- `JWT_SECRET`
- `WECHAT_APP_ID` `WECHAT_APP_SECRET`（可选）

可选管理员自动播种：
- `ENABLE_ADMIN_SEED=true`
- `ADMIN_EMAIL=...`
- `ADMIN_PASSWORD=...`（至少 12 位）

微信支付如果走后台配置，不需要再依赖环境变量。到后台 `系统设置 -> 微信支付` 填写：
- `WECHAT_PAY_ENABLED`
- `WECHAT_PAY_MOCK_MODE`
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_CERT_SERIAL_NO`
- `WECHAT_PAY_CERT_PEM`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_PAY_NOTIFY_URL`

## 6. 后端核心能力

API 挂载前缀（见 `backend/src/app.ts`）：
- `/api/auth` 登录注册、微信登录、用户信息、推荐码
- `/api/chat` 会话历史、消息、流式聊天
- `/api/media` 图片任务创建与轮询（异步任务）
- `/api/payment` 套餐、下单、回调、订单状态
- `/api/token` Token 统计/历史/趋势/导出
- `/api/admin` 后台管理全量接口（含 RBAC）
- `/api/config` 前台公开配置
- `/api/visit` 访客埋点
- `/api/wechat` JSSDK 签名

关键业务特性：
- 统一错误格式（包含 `code/message/retryable/requestId`）
- JWT 鉴权 + 角色权限 + 细粒度 RBAC
- 动态限流（用户/IP/会员等级/时段）
- 支付与订单幂等处理（防重复处理）
- Token 计费中心（模型/图片费率后台可配）
- 图片生成为异步任务队列（重试、状态轮询）
- 可观测性汇总接口（支付成功率、扣费失败率等）

## 7. 数据模型（最关键 9 张表）

- `users` 用户与角色、会员、余额
- `conversations` 会话
- `messages` 消息
- `orders` 订单
- `order_audit_logs` 订单审计
- `token_usage_records` Token 消耗与流水
- `system_configs` 动态系统配置
- `visit_logs` 访客日志（含游客）
- `media_tasks` 图片/视频任务

说明：
- 后端启动会自动建库、`sequelize.sync()`、执行迁移。
- 迁移注册表：`backend/src/migrations/registry.ts`

## 8. 管理后台功能面

主要页面（`admin/src/views`）：
- 仪表盘、用户管理、模型管理、订单管理、对话日志
- 系统设置、图片生成配置、Token 计费中心
- 数据分析、用户画像

最近已补充：
- 用户管理支持“禁用/启用/删除”（删除有安全保护）
- 对话日志支持“单条删除 + 批量删除”

## 9. 前台能力

主要页面（`frontend/src/views`）：
- `ChatView.vue`：多模型对话 + 图片模型并发生成 + 骨架态
- `MembershipView.vue`：会员与充值
- `TokenUsageView.vue`：Token 账单与趋势
- 登录/注册（含错误文案规范化）

聊天侧关键点：
- 支持游客模式与登录模式
- 选择多个模型并发返回
- 对话模型与绘图模型可混选
- 针对时效问题（股票/汇率/加密/新闻/金价）走实时上下文注入

## 10. 权限与角色（RBAC）

角色：
- `super_admin` `admin` `ops` `finance` `support` `user`

后台权限在 `backend/src/middleware/rbac.ts`，按权限点控制：
- `users:read/users:manage`
- `orders:read/orders:operate`
- `models:read/models:manage`
- `billing:read/billing:manage`
- `settings:read/settings:manage`
- `analysis:read` `audit:read`
- `export:read` `archive:execute`

## 11. 开发与质量门禁

本地常用命令：

```bash
# backend
cd backend
npm run typecheck
npm run build
npm test

# frontend
cd frontend
npm run typecheck
npm run build
npm test

# admin
cd admin
npm run typecheck
npm run build
npm test
```

CI（`.github/workflows/ci.yml`）会在 PR/主分支执行：
- backend/frontend/admin 的 typecheck + build + test
- backend E2E（含支付与计费关键链路）

## 12. 后续 AI 改造入口（按需求直达）

- 改聊天行为：`backend/src/routes/chat.ts` + `frontend/src/views/ChatView.vue`
- 改图片任务：`backend/src/routes/media.ts` + `backend/src/services/media/*`
- 改计费规则：`backend/src/services/billingConfigService.ts` + `admin/src/views/BillingSettingsView.vue`
- 改支付流程：`backend/src/routes/payment.ts` + `backend/src/services/idempotencyService.ts`
- 改后台权限：`backend/src/middleware/rbac.ts`
- 改系统配置项：`backend/src/routes/admin.ts`（`/config/general`）+ `admin/src/views/SystemSettingsView.vue`

## 13. 协作约定（简版）

- 所有新增接口遵循统一错误结构，必须返回可读 `message`。
- 任何后台危险操作必须保留“二次确认 + 审计记录”。
- 计费与统计优先使用真实 usage/流水记录，避免前端估算口径漂移。
- 提交前至少跑：对应子项目 `typecheck + build`。

---

如果要继续扩展，本项目当前最优先方向：
1. RBAC 再细化（菜单级 + 字段级）
2. 运营看板一屏化（收入/成本/毛利/退款率/ARPPU）
3. 全链路 E2E 扩充（下单→回调→到账→退款→审计）
