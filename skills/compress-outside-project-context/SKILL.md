---
name: compress-outside-project-context
description: 极限压缩上下文并严格隔离项目边界。用于用户要求“压缩上下文”“只看当前项目”“忽略外部信息”“减少 token 占用”时。执行时仅保留当前项目目录内的目标、约束、关键文件与最小证据；项目外信息统一折叠为单行占位，不展开细节。
---

# Compress Outside Project Context

## Goal

仅保留当前项目上下文，项目外上下文一律折叠，做到可执行前提下的最小 token。

## Hard Rules

1. 锚定项目根目录为 `pwd`（或用户指定目录）。
2. 仅采集项目内信息：需求、约束、相关文件、必要命令结果。
3. 项目外信息禁止展开；统一写为 `EXTERNAL_CONTEXT: ELIDED`。
4. 不复述历史长对话；只保留当前任务直接相关结论。
5. 引用文件时仅列必要路径，不贴大段内容。

## Compression Format

输出固定为 5 段，且每段尽量 1-3 行：

1. `TASK`: 当前要做什么（1 行）。
2. `SCOPE`: 仅当前项目根路径（1 行）。
3. `CONSTRAINTS`: 最多 5 条硬约束。
4. `KEY_FILES`: 最多 20 个路径，每行“路径 + 作用短语”。
5. `ELIDED`: 固定 `EXTERNAL_CONTEXT: ELIDED`。

## Procedure

1. 用 `pwd` 和项目内目录结构确认边界。
2. 从用户最新请求提取单行任务目标。
3. 仅扫描项目内必要文件（优先 `rg` 精确检索）。
4. 生成 5 段压缩上下文。
5. 开始执行任务时，只基于压缩结果与项目内证据。

## Anti-Patterns

1. 粘贴长日志、长代码、长对话。
2. 引入项目外教程、新闻、无关背景。
3. 为“完整性”保留不影响执行的信息。

## Minimal Template

```text
TASK: <one-line objective>
SCOPE: <absolute project path only>
CONSTRAINTS:
- <c1>
- <c2>
KEY_FILES:
- <abs_path>: <why needed>
ELIDED: EXTERNAL_CONTEXT: ELIDED
```
