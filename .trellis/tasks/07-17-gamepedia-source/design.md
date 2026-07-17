# Design: gamepedia 源 + 跨源去重

## Architecture

```text
scrape-gamepedia → data/gamepedia/latest.json
                         ↓
scrape-all / build-feeds
  mergeNewsSnapshots(四源)
  → applyEnrichments
  → applyManualDrops(data/dedupe/manual.json)   // 人工名单，不自动去重
  → expandEventDates → public/feeds/*
```

- Scraper 独立目录：`src/scrapers/gamepedia/`（不与其它源耦合）。
- **推荐顺序**：`merge` → `applyEnrichments` → `applyManualDrops` → expand/write。
  enrichment 后再剔除，使人工日程已叠加到条目上（候选脚本同样先 enrich 再建议）。

## Scraper

| 文件 | 职责 |
|------|------|
| `urls.ts` | 搜索列表 URL、`archives/<id>` → `gamepedia-<id>` |
| `parse-list.ts` | 列表条目（id/title/url）+ 末页判定 |
| `parse-detail.ts` | 标题、publishedAt、summary、bodyText、imageUrl |
| `extract-dates.ts` | 販売期間 / 開催期間 / 常见日文日期区间；复用或包装 `extractEventDates` / collabo 经验 |
| `index.ts` | 翻页、增量 `knownIds`、详情 hydrate；**无 eventDates → skip** |
| `fixtures/` | 列表页 + 详情页 HTML |

分类：`classifyText(title, body)` 结果中保留 `goods`/`event`（若无 goods 则补上 `goods`）；不强制 live/music。  
`groups: ['togenashi']`。

## Cross-source dedupe（人工）

流水线**不自动去重**。曾试过 `publishedAt≤3天 ∧ eventDates重叠` 的自动规则，
会误杀同档期不同商品（F-272 演唱会票务 sale 与无关周边预约截止同日 → 演唱会稿被压掉），故取消。

改为人工判定：

1. `src/feeds/dedupe-candidates.ts`：`findDuplicateCandidates(items)` 按 `eventDates`
   重叠列出跨源候选对（KEEP=高优先级，DROP=低优先级），附 `publishedDayGap` 与
   `titleSimilar` 提示，**不硬过滤发布时间**，仅供人工参考。
2. `src/feeds/manual-dedupe.ts`：`data/dedupe/manual.json` 的加载/校验与 `applyManualDrops`。
3. `scripts/dedupe-candidates.ts` + `dedupe-news` skill：人工看候选 → 确认 → 写名单。
4. `build-feeds`：merge → enrichment → `applyManualDrops` → expand/write；名单外条目全保留。

`eventDates` 重叠：日期区间 `[date, endDate??date]` 有交集。名单 id 未命中任何条目 → 警告（提示过期）。

## Registration touchpoints

- `src/models/source.ts`：`SOURCE_IDS` + `SOURCE_SCRAPE_SCRIPTS`（`scrape-all` / `build-feeds` 由此派生）
- `scripts/scrape-gamepedia.ts`、`package.json`
- README / architecture 简述（若现有文档列源则更新）

## Trade-offs

| 选择 | 取舍 |
|------|------|
| enrichment 后再人工剔除 | 人工日程已叠加；候选与构建路径一致 |
| 丢弃无日期 gamepedia | 订阅更干净；漏掉纯介绍文 |
| 不自动按日期去重 | 避免同档期不同商品误杀；需人工维护名单 |
