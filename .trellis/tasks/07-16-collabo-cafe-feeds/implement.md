# Implement: collabo-cafe 独立 feed

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

### 5. 独立 feeds（不合并 all）

- [ ] `scripts/build-collabo-feeds.ts` → `public/feeds/collabo-cafe.xml|ics`
- [ ] `public/data/collabo-cafe.json`（可选）
- [ ] 确认 `build-feeds.ts` **未**加入 collabo 源
- [ ] AC6 验证：`all.*` 条目数不因 collabo 增加

### 6. 订阅页

- [ ] `index.html` collabo-cafe 独立订阅卡片/区块
- [ ] `subscribe.js` 加载 `collabo-cafe.json` 显示条数（可选）

### 7. CI / Actions

- [ ] workflow 增加 scrape + build-collabo-feeds
- [ ] `npm run ci`

## 验证

```bash
npm run ci
npm run scrape:collabo-cafe
npm run build:collabo-feeds
# collabo-cafe.ics 有跨日期间；all.ics 条目数不变
```

## 回滚

删除 scraper、`data/collabo-cafe/`、`public/feeds/collabo-cafe.*`、订阅页区块。
