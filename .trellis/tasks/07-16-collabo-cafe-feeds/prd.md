# PRD: 抓取 collabo-cafe GBC 协作资讯并生成 RSS/iCal

## Goal

从 [collabo-cafe.com](https://collabo-cafe.com/) 抓取「ガールズバンドクライ」相关协作资讯，生成**独立** RSS / iCal 订阅（与官网、First Riff 的 `all.*` 分开）。条目时间取活动举办/预约截止日。

## Background

- 现有源：`gbc-news`、`gbc-firstriff` → 合并进 `public/data/news.json` 与 `public/feeds/all.*`。
- 新源：`https://collabo-cafe.com/?s=ガールズバンドクライ`（约 52 篇，WordPress）。
- collabo-cafe 内容以**协作活动、周边贩售**为主（カフェ、ポップアップ、フェア、グッズ），与官网 Live/曲目 资讯重叠度低。
- 结构化 `table.cc-table` 的 `開催期間` 便于抽跨日期间。
- 调研：`research/collabo-cafe-site.md`。

## Requirements

1. **R1** 新增 `collabo-cafe` scraper → `data/collabo-cafe/latest.json`
2. **R2** `sourceId: 'collabo-cafe'`；`id` 前缀 `collabo-<slug>`
3. **R3** 搜索列表翻页；`SCRAPE_MODE=incremental|full`
4. **R4** 详情：标题、发布日、摘要、正文、主图、`cc-table` 键值
5. **R5** `eventDates`：优先 `開催期間`（多城市 → 多条 `hold` + `endDate`）；`～まで予約` → `sale`；无日期不进 feed
6. **R6** 分类以 **`event`（活动）与 `goods`（周边）** 为主：
   - `event-category-cafe` / `pop-up-store` / 标题含カフェ・フェア・ポップアップ → 含 `event`
   - `event-category-goods` / 予約受付・発売 → 含 `goods`
   - 可同时多标签；极少命中 live/music 等可保留但不作为订阅维度
7. **R7** `groups: ['togenashi']`（搜索词已限定 GBC）
8. **R8** **独立 feed 管线**：`public/feeds/collabo-cafe.xml` + `collabo-cafe.ics`；**不写入** `news.json` / `all.*`
9. **R9** 可选公开快照 `public/data/collabo-cafe.json`（供订阅页展示条数）
10. **R10** 订阅页增加 collabo-cafe 独立订阅入口（RSS + 日历链接卡片）
11. **R11** 夹具测试；`npm run ci` 通过
12. **R12** GitHub Actions 定时增量抓取

## Decisions

| ID | 结论 |
|----|------|
| D1 | **独立 feed**（`feeds/collabo-cafe.*`），不并入 `all.*` / `news.json` |
| D2 | 内容定位：**周边 + 活动**（event / goods） |
| D3 | MVP 不去重（与官网同活动可并存，来源不同） |
| D4 | 多城市 `開催期間` → 每条城市段独立 `eventDate`（含 `endDate`） |
| D5 | `/api/feed` 动态过滤**不**纳入 collabo-cafe（静态独立文件即可） |

## Acceptance Criteria

- [ ] AC1：`npm run ci` 通过
- [ ] AC2：全量抓取后 `data/collabo-cafe/latest.json` ≥40 条合法 `NewsItem`
- [ ] AC3：条目 `sourceId=collabo-cafe`；分类以 `event` / `goods` 为主
- [ ] AC4：期间活动在 iCal 为跨日事件（`endDate`）
- [ ] AC5：`public/feeds/collabo-cafe.xml` 与 `.ics` 存在且仅含 collabo-cafe 源
- [ ] AC6：`public/feeds/all.*` 与 `public/data/news.json` **不含** collabo-cafe 条目
- [ ] AC7：首页有 collabo-cafe 独立订阅入口
- [ ] AC8：列表/详情/日期抽取有夹具测试

## Out of Scope

- 并入官网 `all` 订阅池
- collabo-cafe 全站 / 其他 IP 关键词
- 与官网自动去重
- Function 内按来源动态合成 feed
