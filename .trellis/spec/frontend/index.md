# 前端开发规范

> gbc-news 前端以**轻量静态页**为主（说明、订阅链接、健康状态），不是复杂 SPA。

## Overview

若暂无 UI，也可只提供 `public/feeds/` 文件。需要页面时再按本目录约定扩展。文档使用**简体中文**。

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 静态资源与页面组织 | Done |
| [Component Guidelines](./component-guidelines.md) | 组件约定（若引入 UI 框架） | Done |
| [Hook Guidelines](./hook-guidelines.md) | Hooks 使用边界 | Done |
| [State Management](./state-management.md) | 状态策略 | Done |
| [Quality Guidelines](./quality-guidelines.md) | 质量与无障碍 | Done |
| [Type Safety](./type-safety.md) | 类型约定 | Done |

## Pre-Development Checklist

- [ ] 该改动是否真的需要 UI？能用 README/静态说明解决则不做页面
- [ ] 订阅 URL 是否稳定、可复制
- [ ] 不引入重型设计系统或仪表盘式布局

## Quality Check

- [ ] 移动端可读
- [ ] 无障碍基本可用（语义化标题、链接可聚焦）
- [ ] 不阻塞 feed 文件的正确部署
