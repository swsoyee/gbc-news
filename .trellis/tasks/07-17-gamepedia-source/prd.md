# PRD: 增加 gamepedia（キャラホビ）周边消息源与跨源去重

## Goal

从 [キャラホビ / premium.gamepedia.jp hobby 搜索「ガールズバンドクライ」](https://premium.gamepedia.jp/hobby/?s=%E3%82%AC%E3%83%BC%E3%83%AB%E3%82%BA%E3%83%90%E3%83%B3%E3%83%89%E3%82%AF%E3%83%A9%E3%82%A4) 抓取周边相关资讯，并入现有订阅；跨源重复时按优先级只保留一条。

## Background

- 现有源：`gbc-news`、`gbc-firstriff`、`collabo-cafe`；`mergeNewsSnapshots` 目前无跨源去重。
- 新源约 5 页 / WP 搜索约 49 篇；URL 形如 `/hobby/archives/<id>`；以新商品、POP UP、协作贩售为主。
- 历史：collabo-cafe MVP 曾明确不去重；本任务正式引入跨源去重。

## Requirements

1. **R1** 新增 `gamepedia` scraper → `data/gamepedia/latest.json`；`sourceId: 'gamepedia'`；`id` 前缀如 `gamepedia-<archivesId>`
2. **R2** 搜索列表翻页；与现有源一致支持 `SCRAPE_MODE=full|incremental`（首次全量约 5 页，之后增量）
3. **R3** 详情解析标题、发布日、摘要、正文、主图；从正文抽 `eventDates`（含 **販売期間** / 開催期間 等）
4. **R4** **抽不到日期则丢弃该条**，不进快照/feed
5. **R5** 分类：默认含 `goods`；标题/正文命中 `classifyText` 的 `event` 关键词时可兼带 `event`；`groups: ['togenashi']`（搜索词已限定 GBC）
6. **R6** 并入 `public/data/news.json` 与现有分类 feeds；不生成独立 `gamepedia.*` feed / 订阅 section
7. **R7** 跨源去重**人工化**：`build-feeds` 按 `data/dedupe/manual.json` 剔除条目，保留优先级 `gbc-news` > `gbc-firstriff` > `collabo-cafe` > `gamepedia`
8. **R8** 提供 `dedupe-news` skill + `dedupe:candidates` 脚本：脚本按 `eventDates` 重叠列候选，人工确认后写名单
9. **R9** 流水线不再自动去重（避免误杀同档期不同商品）
10. **R10** 夹具测试 + `npm run ci`；接入 `scrape-all` / 定时增量抓取

## Decisions

| ID | 结论 |
|----|------|
| D1 | 优先级：`gbc-news` > `gbc-firstriff` > `collabo-cafe` > `gamepedia` |
| D2 | **流水线不自动去重**。自动规则（publishedAt≤3天 ∧ eventDates重叠）会误杀同档期不同商品（如 F-272 演唱会被无关周边压掉），故取消。 |
| D2a | 去重改为**人工**：Cursor 用 `dedupe-news` skill 判定，确认项写入 `data/dedupe/manual.json`；`build-feeds` 只按名单剔除低优先级条目。 |
| D2b | `scripts/dedupe-candidates.ts` 仅按 `eventDates` 重叠给出候选建议（不硬过滤发布时间），供人工参考。 |
| D3 | 无日期 → 丢弃 gamepedia 条目 |
| D5 | 默认 goods，可兼 event |
| D6 | `sourceId: 'gamepedia'` |
| D7 | 首次 full 全量搜索结果，之后 incremental |
| D8 | 并入现有订阅池，无独立 section / feed |
| D9 | `groups: ['togenashi']` |

## Acceptance Criteria

- [ ] AC1：`npm run ci` 通过
- [ ] AC2：全量抓取后 `data/gamepedia/latest.json` 条目均有非空 `eventDates`，`sourceId=gamepedia`
- [ ] AC3：无日期正文不出现在快照中
- [ ] AC4：`public/feeds/goods.*`（及命中时 `event.*`）含 gamepedia 条目
- [ ] AC5：不生成 `public/feeds/gamepedia.*`
- [ ] AC6：`build-feeds` 只按 `data/dedupe/manual.json` 剔除（空名单 → 不删）；`applyManualDrops` / 候选 finder 有单测
- [ ] AC7：列表/详情/日期抽取有夹具测试
- [ ] AC8：`SCRAPE_MODE=incremental` 可只补新文

## Out of Scope

- 独立 gamepedia 订阅 UI / 独立 feed
- 非 GBC 关键词全站抓取
- Jaccard 等相似度阈值调参
- 本任务内批量人工 enrichment（可后续）
- 引入 DB 做跨历史去重
