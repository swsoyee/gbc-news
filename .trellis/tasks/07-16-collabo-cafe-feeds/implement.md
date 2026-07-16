# Implement: collabo-cafe 并入活动/周边 feed

## Checklist

### 1. Scraper

- [ ] `src/scrapers/collabo-cafe/`（urls, parse-list, parse-detail, index）
- [ ] fixtures + `tests/collabo-cafe-parser.test.ts`

### 2. 分类（event / goods）

- [ ] 列表 `event-category-*` 映射 + `classifyText` 合并
- [ ] 测试：cafe 文 → 含 `event`；goods 文 → 含 `goods`

### 3. 日期

- [ ] `cc-table` 開催期間 多段 + `endDate`
- [ ] 预约截止 → `sale`

### 4. CLI

- [ ] `scripts/scrape-collabo-cafe.ts`
- [ ] `package.json`: `scrape:collabo-cafe`, `build:collabo-feeds`
- [ ] 全量 scrape

### 5. 合并进现有 feeds

- [ ] `scripts/build-feeds.ts` 追加 `data/collabo-cafe/latest.json`
- [ ] 不生成 `public/feeds/collabo-cafe.xml|ics`
- [ ] 不生成 `public/data/collabo-cafe.json`
- [ ] 验证 `event.*` / `goods.*` 含 collabo-cafe 条目

### 6. 订阅页

- [ ] 不增加 collabo-cafe 独立订阅卡片/区块
- [ ] `subscribe.js` 使用合并后的 `news.json` 统计

### 7. CI / Actions

- [ ] workflow 增加 scrape，构建仍用 `build:feeds`
- [ ] `npm run ci`

## 验证

```bash
npm run ci
npm run scrape:collabo-cafe
npm run build:feeds
# event.ics / goods.ics 有 collabo-cafe 条目和跨日期间
```

## 回滚

从 `build-feeds.ts` 移除 collabo 源，删除 scraper 与 `data/collabo-cafe/`，重建 feeds。
