# 架构决策：低成本资讯订阅服务

## 背景

`gbc-news` 需要定时抓取官网信息，并向用户提供 RSS 与 iCal 订阅。约束：尽量低成本、托管在 GitHub、CI 用 GitHub Actions、部署到 Netlify。

## 决策

采用 **「Actions 抓取 → 静态产物 → Netlify 分发」** 架构。

```text
多官网 HTML
    │
    ▼
GitHub Actions（定时 cron）
    │  scrape-all：三源独立执行，失败隔离
    │  解析 + 校验 + 快照合并
    ▼
data/<source>/latest.json
    │
    ▼
build-feeds → public/data/news.json + public/feeds/*
    │  commit → 触发 Netlify 部署
    ▼
Netlify
  · 静态：首页日历 / 订阅页、feeds、news.json
  · Function：/api/feed（groups ∧ categories 过滤）
```

## 当前能力边界

- **三源**：`gbc-news`、`gbc-firstriff`、`collabo-cafe`；单源失败不阻断其他源写入。
- **订阅**：静态 `/feeds/*` + 动态 `/api/feed`；公开 URL 保持稳定。
- **前端**：`public/index.html` + `subscribe.js`；日历与筛选为客户端交互，但**零框架**。可测纯函数在 `src/web/subscribe-core.ts`，经 `build:web` 输出到 `public/subscribe-core.js`。
- **空订阅防护**：`build-feeds` 在无可用快照或展开后无活动日时失败退出，禁止覆盖有效 `all` 订阅。

## 为什么这样选

1. **无常驻服务器**：定时任务交给 Actions，空闲不花钱。
2. **无数据库**：资讯以 JSON 快照落盘；RSS/iCal 由快照生成。
3. **订阅协议天然静态**：RSS/iCal 是文件协议，CDN/静态站最合适。
4. **可审计**：抓取结果进 git 时，变更可回看、可回滚。
5. **可演进**：动态筛选已用轻量 Netlify Function；前端仍保持静态优先，不推翻主路径。

## 非目标（当前不做）

- 用户账号 / 个性化推送
- 实时推送（WebSocket 等）
- 付费代理池、商业爬虫平台
- React / Vue / Vite 等重型前端应用（日历 UI 已存在，但仍是静态页）

## 目录规划

```text
src/
  scrapers/     # 各官网抓取器
  feeds/        # RSS / iCal 生成、合并防护、动态订阅响应
  models/       # 统一资讯模型（groups / eventDates / categories）
  web/          # 前端可测纯函数（打包进 public/）
  utils/
data/           # 抓取快照（生成物）
public/         # Netlify 对外静态文件（首页、feeds、news.json）
scripts/        # scrape-* / scrape-all / build-feeds / bundle-*
netlify/functions/
  feed-entry.ts # /api/feed
.github/workflows/
```

## 质量门槛

- TypeScript strict
- ESLint + Prettier
- 单元测试覆盖解析、feed 生成、编排汇总、前端纯函数
- CI 必须通过才能合并
- 抓取失败要可观测（Actions 日志 + 非零退出），不得静默写出空订阅

## 风险与缓解

| 风险                 | 缓解                                                 |
| -------------------- | ---------------------------------------------------- |
| 官网改版导致解析失败 | 每个源独立 scraper；失败隔离；测试夹具锁定关键 HTML  |
| Actions 配额         | 控制抓取频率；优先公共仓库；避免无意义重跑           |
| 大文件撑爆仓库       | 只保留必要窗口数据；定期裁剪；必要时改 artifact 部署 |
| 合规/robots          | 尊重 robots.txt 与合理频率；只抓公开页面             |
| 前端单体膨胀         | 纯函数抽到 `src/web/` 并单测；禁止引入大型 UI 框架   |
