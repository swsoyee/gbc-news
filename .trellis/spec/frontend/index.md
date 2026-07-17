# 前端开发规范

> gbc-news 前端是 **轻量静态订阅页**：组合/分类筛选、订阅链接、活动日历（月/周/日）。不是复杂 SPA，也不引入 React/Vue。

## Overview

静态资源位于 `public/`。可测业务逻辑放在 `src/web/`，经 `npm run build:web` 打包到 `public/`。文档使用**简体中文**。

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 静态资源与页面组织 | Done |
| [Component Guidelines](./component-guidelines.md) | 组件约定（默认无框架） | Done |
| [Hook Guidelines](./hook-guidelines.md) | Hooks 使用边界 | Done |
| [State Management](./state-management.md) | 状态策略 | Done |
| [Quality Guidelines](./quality-guidelines.md) | 质量与无障碍 | Done |
| [Type Safety](./type-safety.md) | 类型约定 | Done |

## Pre-Development Checklist

- [ ] 该改动是否真的需要 UI？能用 README/静态说明解决则不做页面
- [ ] 订阅 URL 是否稳定、可复制；公开 feed 路径是否保持兼容
- [ ] 日历/筛选逻辑是否可抽成纯函数并加测试
- [ ] 不引入重型设计系统、前端框架或仪表盘式布局

## Quality Check

- [ ] 移动端可读
- [ ] 无障碍基本可用（语义化标题、链接可聚焦）
- [ ] 不阻塞 feed 文件的正确部署
- [ ] `npm run build:web` 后本地 `npx serve public` 可预览
