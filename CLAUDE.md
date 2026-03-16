# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 聚合问答平台（ai-app），三端架构：
- `frontend/` — 用户前台（Vue 3 + TypeScript + Vite + Pinia + Tailwind）
- `admin/` — 管理后台（Vue 3 + TypeScript + Vite + Pinia + Tailwind）
- `backend/` — 后端 API（Express + TypeScript + Sequelize + MySQL 8 + Redis）

## Quick Start

```bash
# Docker 一键启动（推荐）
docker compose up -d --build

# 本地开发（先起基础设施，再起各服务）
docker compose up -d mysql redis
cd backend && npm ci && npm run dev    # :4000
cd frontend && npm ci && npm run dev   # :5173
cd admin && npm ci && npm run dev      # :5174
```

## Common Commands

所有子项目都有相同的脚本约定：

```bash
cd backend|frontend|admin
npm run typecheck   # TypeScript 类型检查
npm run build       # 构建
npm test            # 运行测试
```

后端特有命令：
```bash
cd backend
npm run dev              # 热重载开发
npm run migrate          # 执行迁移
npm run migrate:rollback # 回滚迁移
npm run config:export    # 导出 system_configs 配置
npm run config:import    # 导入 system_configs 配置
npm run test:e2e         # E2E 测试
```

## Architecture Notes

### Backend (`backend/src/`)
- `app.ts` — Express 路由挂载，API 前缀：`/api/auth`, `/api/chat`, `/api/media`, `/api/payment`, `/api/token`, `/api/admin`, `/api/config`, `/api/visit`, `/api/wechat`
- `index.ts` — 应用入口，启动时自动建库、sync、执行迁移
- `routes/` — 路由定义
- `services/` — 业务逻辑层
- `models/` — Sequelize 模型
- `middleware/` — JWT 鉴权、RBAC 权限（`rbac.ts`）、限流
- `migrations/` — 数据库迁移，注册表在 `registry.ts`
- `config/` — 数据库/Redis 连接配置
- `errors/` — 统一错误格式（code/message/retryable/requestId）

### Frontend (`frontend/src/`)
- `router/index.ts` — 前台路由
- `views/ChatView.vue` — 聊天主页面（多模型并发、图片生成、骨架态）
- `views/MembershipView.vue` — 会员与充值
- `views/TokenUsageView.vue` — Token 账单
- `stores/` — Pinia 状态管理
- `components/` — 可复用组件

### Admin (`admin/src/`)
- `router/index.ts` — 后台路由
- `views/` — 仪表盘、用户管理、模型管理、订单管理、对话日志、系统设置、计费配置、数据分析

### Database
核心表：`users`, `conversations`, `messages`, `orders`, `order_audit_logs`, `token_usage_records`, `system_configs`, `visit_logs`, `media_tasks`

### RBAC Roles
`super_admin` > `admin` > `ops` / `finance` / `support` > `user`

权限点定义在 `backend/src/middleware/rbac.ts`。

### CI
GitHub Actions (`.github/workflows/ci.yml`) 在 PR/主分支执行 typecheck + build + test 全量门禁。

## Development Conventions

- 新增接口必须遵循统一错误结构（包含可读 `message`）
- 后台危险操作需要"二次确认 + 审计记录"
- 提交前至少跑对应子项目的 `typecheck + build`
