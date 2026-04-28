# Realtime Market Answer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realtime-answer routing system for stock, fund, gold, oil, forex, and crypto questions so the app can answer time-sensitive finance queries without relying on stale model memory.

**Architecture:** Add a backend realtime intent detector, a quote-fetch aggregation service, and a formatter that generates system-owned answers. The chat route short-circuits into this pipeline for matched finance queries, while unmatched queries continue through the existing multi-model flow.

**Tech Stack:** Node.js, Express, TypeScript, existing chat router, existing realtime context service, Vue frontend.

---

### Task 1: 提炼实时问答判定与目标解析

**Files:**
- Create: `backend/src/services/realtimeIntentService.ts`
- Test: `backend/src/tests/realtimeIntentService.test.ts`

- [ ] **Step 1: Write the failing test**
Create tests for:
- gold query: `今日金价`
- oil query: `今日油价`
- stock query: `腾讯股价`
- fund query: `天弘沪深300基金净值`
- forex query: `美元兑人民币`
- crypto query: `比特币现在多少钱`
- non-realtime query: `帮我写一封邮件`

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test -- realtimeIntentService`
Expected: FAIL because service does not exist yet.

- [ ] **Step 3: Write minimal implementation**
Implement a detector that returns:
- `matched`
- `kind`
- `target`
- `displayName`
- `confidence`

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test -- realtimeIntentService`
Expected: PASS

### Task 2: 抽统一行情数据结构

**Files:**
- Create: `backend/src/services/realtimeQuoteService.ts`
- Test: `backend/src/tests/realtimeQuoteService.test.ts`

- [ ] **Step 1: Write the failing test**
Cover normalized output shape for all 6 kinds:
- `kind`
- `target`
- `value`
- `currency`
- `source`
- `timestamp`
- `extra`

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test -- realtimeQuoteService`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
Move/bridge existing realtime fetch logic from `realtimeContextService.ts`, then add:
- oil fetch path
- fund fetch path
- timeout + cache + normalization

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test -- realtimeQuoteService`
Expected: PASS

### Task 3: 生成系统自有答案模板

**Files:**
- Create: `backend/src/services/realtimeAnswerFormatter.ts`
- Test: `backend/src/tests/realtimeAnswerFormatter.test.ts`

- [ ] **Step 1: Write the failing test**
Verify formatter output includes:
- title/target
- current value
- source
- timestamp
- disclaimer

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test -- realtimeAnswerFormatter`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
Implement per-kind formatter templates:
- stock
- fund
- gold
- oil
- forex
- crypto

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test -- realtimeAnswerFormatter`
Expected: PASS

### Task 4: 在聊天路由前置实时分流

**Files:**
- Modify: `backend/src/routes/chat.ts`
- Test: `backend/src/tests/e2e/realtime-chat-routing.e2e.test.ts`

- [ ] **Step 1: Write the failing test**
Add E2E cases:
- realtime query returns `mode: realtime_quote`
- non-realtime query still enters normal route
- realtime fetch failure triggers fallback mode

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test -- realtime-chat-routing`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
In `/api/chat`:
- detect realtime intent
- fetch quote
- format answer
- short-circuit response for matched queries
- on failure, inject fallback warning and continue to LLM flow

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test -- realtime-chat-routing`
Expected: PASS

### Task 5: 前端接入统一实时结果卡

**Files:**
- Modify: `frontend/src/views/ChatView.vue`
- Test: `frontend/src/utils/__tests__/realtimeResultMode.spec.ts`

- [ ] **Step 1: Write the failing test**
Verify that `mode: realtime_quote` maps to single-card rendering data and does not duplicate across selected models.

- [ ] **Step 2: Run test to verify it fails**
Run: `cd frontend && npm test -- src/utils/__tests__/realtimeResultMode.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
Add realtime result branch:
- show one card
- show source and timestamp
- preserve existing UI for normal chat mode

- [ ] **Step 4: Run test to verify it passes**
Run: `cd frontend && npm test -- src/utils/__tests__/realtimeResultMode.spec.ts`
Expected: PASS

### Task 6: 降级与观测补齐

**Files:**
- Modify: `backend/src/routes/chat.ts`
- Modify: `backend/src/services/observabilityService.ts` (if needed)
- Test: `backend/src/tests/e2e/realtime-chat-routing.e2e.test.ts`

- [ ] **Step 1: Write the failing test**
Cover fallback path:
- response includes warning about non-realtime fallback
- observability records realtime fetch failure

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test -- realtime-chat-routing`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
Add:
- safe fallback warning injection
- metrics/log tags by kind and source
- standardized error handling

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test -- realtime-chat-routing`
Expected: PASS

### Task 7: 全链路验证

**Files:**
- Modify: `backend/src/services/realtimeContextService.ts` (trim obsolete responsibilities if needed)
- Verify: existing frontend/backend build and key tests

- [ ] **Step 1: Run backend targeted tests**
Run: `cd backend && npm test -- realtimeIntentService realtimeQuoteService realtimeAnswerFormatter realtime-chat-routing`
Expected: PASS

- [ ] **Step 2: Run frontend targeted tests**
Run: `cd frontend && npm test -- src/utils/__tests__/realtimeResultMode.spec.ts`
Expected: PASS

- [ ] **Step 3: Run builds**
Run:
- `cd backend && npm run build`
- `cd frontend && npm run build`
Expected: both PASS

- [ ] **Step 4: Manual verification cases**
Verify these prompts:
- `今日金价`
- `今日油价`
- `腾讯股价`
- `美元兑人民币`
- `比特币现在多少钱`
- `天弘沪深300基金净值`

Expected:
- realtime mode for finance queries
- source + timestamp visible
- fallback warning visible if fetch fails
