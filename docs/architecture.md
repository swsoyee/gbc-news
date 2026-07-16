# 架构决策：低成本资讯订阅服务

## 背景

`gbc-news` 需要定时抓取官网信息，并向用户提供 RSS 与 iCal 订阅。约束：尽量低成本、托管在 GitHub、CI 用 GitHub Actions、部署到 Netlify。

## 决策

采用 **「Actions 抓取 → 静态产物 → Netlify 分发」** 架构。

```text
官网 HTML/API
    │
    ▼
GitHub Actions（定时 cron）
    │  抓取 + 解析 + 校验
    ▼
data/ 快照 + public/ 生成的 RSS / iCal
    │  commit 或 artifact → 部署
    ▼
Netlify（静态托管，公开订阅 URL）
```

## 为什么这样选

1. **无常驻服务器**：定时任务交给 Actions，空闲不花钱。
2. **无数据库**：资讯以 JSON 快照落盘；RSS/iCal 由快照生成。
3. **订阅协议天然静态**：RSS/iCal 是文件协议，CDN/静态站最合适。
4. **可审计**：抓取结果进 git 时，变更可回看、可回滚。
5. **可演进**：流量或动态需求上来后，再按需加 Netlify Functions，不推翻主路径。

## 非目标（当前不做）

- 用户账号 / 个性化推送
- 实时推送（WebSocket 等）
- 付费代理池、商业爬虫平台
- 重型前端应用（仅保留必要状态页或文档页）

## 目录规划（实现阶段）

```text
src/
  scrapers/     # 各官网抓取器
  feeds/        # RSS / iCal 生成
  models/       # 统一事件/资讯模型
  utils/
data/           # 抓取快照（生成物）
public/         # Netlify 对外静态文件（含 feeds）
scripts/        # 本地/CI 入口脚本
.github/workflows/
```

## 质量门槛

- TypeScript strict
- ESLint + Prettier
- 单元测试覆盖解析与 feed 生成
- CI 必须通过才能合并
- 抓取失败要可观测（Actions 日志 + 非零退出），不得静默写出空订阅

## 风险与缓解

| 风险                 | 缓解                                                 |
| -------------------- | ---------------------------------------------------- |
| 官网改版导致解析失败 | 每个源独立 scraper；失败隔离；测试夹具锁定关键 HTML  |
| Actions 配额         | 控制抓取频率；优先公共仓库；避免无意义重跑           |
| 大文件撑爆仓库       | 只保留必要窗口数据；定期裁剪；必要时改 artifact 部署 |
| 合规/robots          | 尊重 robots.txt 与合理频率；只抓公开页面             |
