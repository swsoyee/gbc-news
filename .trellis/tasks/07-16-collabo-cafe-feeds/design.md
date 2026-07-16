# Design: collabo-cafe 数据源并入活动/周边 feed

## 架构

```
collabo-cafe HTML
  → src/scrapers/collabo-cafe/
  → data/collabo-cafe/latest.json
  → scripts/build-feeds.ts
  → public/data/news.json
  → public/feeds/event.xml|ics / goods.xml|ics / all.*
```

与 `gbc-news` / `gbc-firstriff` 同池合并，但分类只贡献活动/周边。

## 模块

| 文件 | 职责 |
|------|------|
| `src/scrapers/collabo-cafe/*` | 同前：urls, parse-list, parse-detail, index |
| `scripts/scrape-collabo-cafe.ts` | CLI 抓取 |
| `src/categories/classify-collabo.ts`（可选） | 基于 `event-category-*` + 关键词，收敛到 event/goods |

## 分类策略（event + goods）

| 信号 | 分类 |
|------|------|
| `event-category-cafe`, `pop-up-store`, カフェ, フェア, ポップアップ, 開催 | `event` |
| `event-category-goods`, グッズ, 予約受付, 発売, アパレル | `goods` |
| 两者兼有（如カフェ限定グッズ） | `['event', 'goods']` |
| 其他 | `other` |

collabo-cafe 不继承官网通用分类，避免协作资讯混入 live/music 等订阅。

## eventDates

1. `ccTable['開催期間']` 按 `<br>` 拆段 → `extractEventDates`
2. 列表 `span.event-date` fallback
3. `～まで予約受付` → `sale`
4. 复用 `endDate` 跨日逻辑

## 订阅页

不增加独立 section；用户通过现有「活动」「周边」分类订阅获取 collabo-cafe 条目。

## 定时任务

`.github/workflows/scrape.yml`：

```bash
npm run scrape:collabo-cafe
npm run build:feeds
```

与 `scrape:gbc` / `build:feeds` 并列，互不依赖顺序。

## 风险

| 风险 | 缓解 |
|------|------|
| 用户误以为有独立 collabo 入口 | 不渲染独立 section |
| 与官网重复事件 | `sourceId` + 原文 URL 区分 |
| `cc-table` 字段变异 | th 别名表 |
