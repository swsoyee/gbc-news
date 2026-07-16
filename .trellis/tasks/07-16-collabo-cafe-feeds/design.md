# Design: collabo-cafe 独立数据源与 feed

## 架构

```
collabo-cafe HTML
  → src/scrapers/collabo-cafe/
  → data/collabo-cafe/latest.json
  → scripts/build-collabo-feeds.ts   ← 独立，不走 build-feeds 合并
  → public/feeds/collabo-cafe.xml
  → public/feeds/collabo-cafe.ics
  → public/data/collabo-cafe.json    （可选，订阅页统计）
```

与 `gbc-news` / `gbc-firstriff` **并行**，不进入 `public/data/news.json`。

## 模块

| 文件 | 职责 |
|------|------|
| `src/scrapers/collabo-cafe/*` | 同前：urls, parse-list, parse-detail, index |
| `scripts/scrape-collabo-cafe.ts` | CLI 抓取 |
| `scripts/build-collabo-feeds.ts` | 读 `data/collabo-cafe/latest.json` → 写出独立 RSS/iCal |
| `src/categories/classify-collabo.ts`（可选） | 基于 `event-category-*` + 关键词，收敛到 event/goods |

## 分类策略（event + goods）

| 信号 | 分类 |
|------|------|
| `event-category-cafe`, `pop-up-store`, カフェ, フェア, ポップアップ, 開催 | `event` |
| `event-category-goods`, グッズ, 予約受付, 発売, アパレル | `goods` |
| 两者兼有（如カフェ限定グッズ） | `['event', 'goods']` |
| 仅 `classifyText` 命中 live 等 | 保留但 MVP 不单独出 live feed |

feed 本身为**全量 collabo 条目**（已限定 GBC 搜索）；不在此 feed 内再拆 event/goods 子 feed（除非后续要加）。

## eventDates

1. `ccTable['開催期間']` 按 `<br>` 拆段 → `extractEventDates`
2. 列表 `span.event-date` fallback
3. `～まで予約受付` → `sale`
4. 复用 `endDate` 跨日逻辑

## Feed 元数据

```ts
{
  title: 'gbc-news · 协作资讯（collabo-cafe）',
  description: 'ガールズバンドクライ 协作カフェ・ポップアップ・グッズ（collabo-cafe.com）',
  feedUrl: `${SITE_URL}/feeds/collabo-cafe.xml`,
}
```

iCal 同理，`PRODID` / `UID` 后缀仍可用 `@gbc-news`，`entryId` 含 `collabo-` 前缀便于区分。

## 订阅页

在 `public/index.html` 增加独立 section（或卡片）：

- 说明：协作活动与周边，来源 collabo-cafe.com
- 固定链接：`/feeds/collabo-cafe.xml`、`/feeds/collabo-cafe.ics`（带 `?v=` rev）
- **不**接入组合/分类多选（避免与官网订阅混淆）

## 定时任务

`.github/workflows/scrape.yml`：

```bash
npm run scrape:collabo-cafe
npm run build:collabo-feeds
```

与 `scrape:gbc` / `build:feeds` 并列，互不依赖顺序。

## 风险

| 风险 | 缓解 |
|------|------|
| 用户误以为已并入 all | 订阅页文案写清「独立订阅」 |
| 与官网重复事件 | `sourceId` + 原文 URL 区分 |
| `cc-table` 字段变异 | th 别名表 |
