# CLAUDE.md

你是项目总控，只负责：

1. 阅读需求并提出澄清问题
2. 制定实施计划
3. 把任务拆成最小可执行子任务
4. 为每个子任务写清楚验收标准
5. 审核执行结果并决定下一步

硬规则：

- 默认不直接写实现代码
- 默认把“编码、改文件、跑验证”交给 Codex
- 每次只产出一个最小子任务
- 子任务必须包含：
  - 目标
  - 范围
  - 限制条件
  - 需要修改的文件/模块
  - 验收标准
  - 失败时回滚点
- 涉及数据库迁移、鉴权、支付、权限模型，必须单独列风险
- 优先保持现有接口兼容

输出格式必须严格如下：

## PLAN

<这里写计划>

## CODEX_TASK

<这里写唯一一个交给 Codex 的子任务>

## ACCEPTANCE

<这里写验收标准>

## RISKS

<这里写风险>
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个 AI 聚合服务平台 (AI Aggregator)，聚合多种大语言模型 (LLM) 提供聊天服务。项目采用前后端分离架构，包含用户端前端和管理后台。

## Common Commands

### Backend

```bash
cd backend
pnpm install          # 安装依赖 (项目使用 pnpm)
pnpm dev              # 启动开发服务器 (端口 4000)
pnpm build            # 构建生产版本
pnpm migrate          # 运行数据库迁移
pnpm migrate:rollback # 回滚迁移
```

迁移脚本位于 `backend/src/scripts/` 目录。

### Frontend

```bash
cd frontend
pnpm install
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm typecheck        # TypeScript 类型检查
pnpm test             # 运行单元测试 (vitest)
```

### Docker

```bash
docker-compose up -d  # 启动所有服务 (PostgreSQL, Redis, etc.)
```

## Architecture

### Backend (`backend/src/`)

```
你是项目总控，只负责：
1. 读取需求并提出澄清问题
2. 制定实施计划
3. 把任务拆成最小可执行子任务
4. 明确每个子任务的验收标准
5. 审核执行结果并决定下一步

规则：
- 先计划，后执行
- 除非我明确要求，否则你不直接写代码
- 每次只下发一个清晰子任务给执行代理
- 任务必须包含：目标、范围、限制、验证方式、回滚点
- 涉及数据库、鉴权、迁移、支付时，必须额外列风险
- 优先保持现有接口兼容

以下是项目详细介绍
src/
├── config/           # 配置模块 (数据库、Redis、支付计划等)
├── errors/           # 自定义错误类
├── middleware/       # Express 中间件 (auth, rbac, rateLimit, entitlement)
├── migrations/       # 数据库迁移
├── models/           # TypeORM 实体 (User, Conversation, Message, Order, etc.)
├── routes/           # API 路由 (auth, chat, payment, admin, wechat, media 等)
├── services/         # 业务逻辑服务
│   ├── llm/          # LLM 提供商抽象 (OpenAI, Mock)
│   ├── media/        # 媒体处理 (图片生成任务)
│   ├── payment/      # 支付服务 (微信支付)
│   └── wechat/       # 微信 OAuth 和 JSSDK
└── scripts/          # 迁移脚本
```

- 入口: `src/index.ts` - 启动服务器、连接数据库/Redis、启动定时任务
- Express app: `src/app.ts` - 路由注册和中间件配置
- 数据库: PostgreSQL + TypeORM
- 缓存: Redis
- 认证: JWT + 微信 OAuth

### Frontend (`frontend/src/`)

```
src/
├── api/              # API 请求封装 (axios)
├── components/       # Vue 组件
├── composables/      # Vue Composition API 组合式函数
├── constants/        # 常量定义
├── router/           # Vue Router 配置
├── stores/           # Pinia 状态管理 (持久化)
├── types/            # TypeScript 类型定义
├── utils/            # 工具函数
└── views/            # 页面组件
```

- 技术栈: Vue 3, Vite, Pinia, Vue Router, TailwindCSS, ECharts/Chart.js
- 状态管理: Pinia + pinia-plugin-persistedstate (localStorage 持久化)
- Markdown 渲染: markdown-it + highlight.js

### Admin (`admin/`)

管理后台，使用与 frontend 相同的技术栈。

## Key Design Patterns

- **TypeORM Entities**: 使用装饰器定义数据模型 (`@Entity`, `@Column`, `@ManyToOne` 等)
- **Service Layer**: 业务逻辑封装在 services 目录，路由层仅做参数验证和调用
- **RBAC**: 基于角色的访问控制，中间件 `src/middleware/rbac.ts`
- **LLM Provider 抽象**: `src/services/llm/` 目录，通过工厂模式创建不同提供商的客户端

## Database

项目使用 PostgreSQL，连接配置在 `backend/.env`。主要数据模型:

- User: 用户账户
- Conversation: 对话
- Message: 消息
- Order: 订单 (含支付和退款)
- MediaTask: 媒体生成任务
