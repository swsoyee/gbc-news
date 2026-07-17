# 后端开发规范

> gbc-news 的「后端」指：抓取器、数据模型、RSS/iCal 生成，以及在 GitHub Actions 中运行的批处理逻辑。不是传统常驻 API 服务。

## Overview

本目录描述抓取与订阅生成相关约定。所有文档使用**简体中文**。

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | 模块与目录组织 | Done |
| [Database Guidelines](./database-guidelines.md) | 静态快照存储约定（无传统 DB） | Done |
| [Error Handling](./error-handling.md) | 错误处理与失败策略 | Done |
| [Quality Guidelines](./quality-guidelines.md) | 质量门槛与禁止模式 | Done |
| [Logging Guidelines](./logging-guidelines.md) | 日志与可观测性 | Done |
| [Enrichment Guidelines](./enrichment-guidelines.md) | 人工 AI 增强、正文回填与发布叠加契约 | Done |

## Pre-Development Checklist

- [ ] 确认该改动属于 scraper / model / feed / script 哪一层
- [ ] 新增官网源时，使用独立 scraper，不与其他源耦合
- [ ] 输出必须能映射到统一资讯模型，再生成 RSS/iCal
- [ ] 失败路径明确：退出码、日志、不写入空订阅
- [ ] 人工增强写入独立 enrichment；不得与可重抓快照混写

## Quality Check

- [ ] TypeScript 严格类型通过
- [ ] 解析逻辑有固定 HTML/JSON 夹具测试
- [ ] 不引入常驻服务器或付费基础设施（除非任务明确批准）
- [ ] 公开 `news.json` 不包含抓取正文 `bodyText`
