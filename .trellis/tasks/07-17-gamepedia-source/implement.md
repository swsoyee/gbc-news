# Implement: gamepedia 源 + 跨源去重

## Checklist

1. [x] 扩展 `SOURCE_IDS`；文档列源处同步
2. [x] 实现 `src/scrapers/gamepedia/`（urls / parse-list / parse-detail / extract-dates / index + fixtures）
3. [x] `scripts/scrape-gamepedia.ts` + 接入 `scrape-all` / `package.json`
4. [x] `build-feeds`：读 `data/gamepedia/latest.json`；enrichment 后按人工名单剔除
5. [x] 人工去重：`manual-dedupe` 叠加层 + `dedupe-candidates` finder + skill/脚本 + 单测
6. [x] 列表/详情/抽日期夹具测试；无日期丢弃测试
7. [x] 本地 `SCRAPE_MODE=full` 跑一轮，确认快照与 feeds；`npm run ci`
8. [x] 更新 README / architecture 源列表（若适用）

## Validation

```bash
npm run scrape:gamepedia   # 或 SCRAPE_MODE=full
npm run build:feeds
npm run ci
```

## Results (2026-07-17)

- 全量：列表 49 → 入库 45（无日期丢弃 4）
- `build-feeds`：`sources` 含 gamepedia；`manualDrops=0`（人工名单为空）
- 跨源去重改为**人工**：`dedupe-news` skill + `dedupe:candidates` + `data/dedupe/manual.json`；流水线不再自动去重（曾误杀 F-272 演唱会稿）
- `npm run ci` 通过

## Risky points

- 日期抽取漏/误 → 直接丢条或误重叠去重；夹具覆盖販売期間
- 去重误杀不同商品同档期 → 标题辅证 + 单测固定案例
- WP/HTML 结构变化 → 夹具锁定选择器
