# 人工 AI 增强叠加层契约

## 1. Scope / Trigger

当抓取快照需要由 Cursor 人工核对日程、补录漏抽日期或翻译中文时，使用独立
enrichment 叠加层。GitHub Actions 只抓取与构建，禁止在 CI 中调用付费 AI API。

## 2. Signatures

```bash
npm run backfill:body-text -- [--source <gbc-news|gbc-firstriff|collabo-cafe|all>] [--force] [--delay-ms <n>]
npm run enrich:list-pending -- [--source <source-id>] [--limit <positive-int>] [--json]
npm run enrich:validate
```

```ts
contentFingerprint(item: Pick<NewsItem, 'title' | 'bodyText'>): string
applyEnrichments(
  items: NewsItem[],
  files: ReadonlyMap<string, EnrichmentFile>,
): PublicNewsItem[]
```

## 3. Contracts

- 原始正文保存在 `data/<sourceId>/latest.json` 的可选 `bodyText`，不得发布到
  `public/data/news.json`。
- 人工结果只写 `data/enrichments/<sourceId>.json`，不得改写原始日文内容。
- `EnrichmentFile` 必含 `sourceId`、ISO `updatedAt` 与按资讯 ID 索引的 `items`。
- 每条记录必含匹配 key 的 `id`、匹配文件的 `sourceId`、`status` 和 64 位 SHA-256
  `contentFingerprint`。
- `reviewed` 必含 ISO `reviewedAt`、非空 `titleZh`、非空 `summaryZh`；`skip` 必含
  `reviewedAt`。
- `eventDates` 存在时完整覆盖规则结果；空数组表示人工确认移除全部日期。
- fingerprint 为规范化后的 `title + "\n" + bodyText`；正文变化后旧增强必须失效。

## 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| enrichment 文件缺失、JSON 无效或 source 不匹配 | validate/build 非零退出 |
| record key、`id` 或 `sourceId` 不匹配 | 校验失败 |
| reviewed 缺中文字段或时间 | 校验失败 |
| fingerprint 与当前快照不一致 | 不应用旧增强，pending 列为 P0 |
| `status=pending` | 不发布增强，仍进入 pending |
| backfill 单条请求/解析失败 | 告警并继续，其余成功项可写回 |
| backfill 写回 | 临时文件 → 解析及模型校验 → 原子替换 |

## 5. Good / Base / Bad Cases

- Good：`reviewed` 且 fingerprint 当前有效，中文字段和人工日期进入
  `news.json`、RSS、iCal 与日历。
- Base：无 enrichment 或 `pending`，继续使用日文与规则日期。
- Bad：将 `titleZh` 直接写进 `latest.json`；下次增量抓取会整项覆盖并丢失人工结果。
- Bad：把 `bodyText` 展开进公开 `news.json`，造成无必要的体积与内容暴露。

## 6. Tests Required

- 模型：status 条件字段、ISO、SHA-256、source/key 一致性、`eventDates: []`。
- 叠加：有效 reviewed 生效；stale/pending/skip 回退；正文不进入公开类型。
- pending：P0 stale → P1 已有日期 → P2 疑似活动 → P3 其余，并验证稳定排序。
- feed：静态与动态 RSS/iCal 都使用中文前缀和增强字段。
- backfill：参数校验、跳过已有正文、空正文拒绝、单条失败隔离、原子写入路径。

## 7. Wrong vs Correct

### Wrong

```ts
// 人工字段与抓取数据混写，下次 scrape 会覆盖
item.title = titleZh
item.eventDates = reviewedDates
```

### Correct

```ts
// 原始快照保持可重抓；人工结果按 sourceId + id 独立叠加
const record = enrichmentFiles.get(item.sourceId)?.items[item.id]
const publish = record?.status === 'reviewed'
  && record.contentFingerprint === contentFingerprint(item)
```
