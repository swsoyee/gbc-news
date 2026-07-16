# Implement: firstriff + 组合 + 活动日期

## Ordered checklist

1. **模型**
   - `groups.ts`、`NewsItem.groups` / `eventDates`、断言与 `filterItems`
   - 修正 `feeds/build.ts`、相关测试中的 groups 债务

2. **组合打标**
   - `classify-group.ts` + 单测
   - gbc-news 接 D3

3. **活动日期**
   - `extract-event-dates.ts`（D8/D9/D10）+ 夹具单测（含 post-480 多日程/售票）
   - feed 展开（前缀、UID、无日期跳过）；更新 `feeds.test.ts`

4. **firstriff scraper**
   - parse/urls/index + fixtures + `scrape-firstriff.ts` + npm scripts
   - scrape 时写入 groups + eventDates

5. **合并与 API/UI**
   - `build-feeds` 多源合并 + expand
   - `feed-entry.ts`：`groups` + expand
   - 订阅页组合区块

6. **验证产物**
   - scrape → build-feeds → build-function
   - lint / typecheck / test

## Validation

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"  # 如需要
npm run lint && npm run typecheck && npm test
npm run scrape:firstriff
npm run scrape:gbc   # 写入 groups + eventDates
npm run build:feeds && npm run build:function
```

抽查：任选含 `■日程` 的条目，RSS/iCal 日期 ≠ 发布日；售票日标题带 `[発売]`。

## Risky points

| 点 | 风险 | 缓解 |
|----|------|------|
| 日期正则误伤 | 「5営業日」等 | 显式排除规则 + 夹具 |
| 省略年跨年 | 误 +1 年 | D9 + 单测边界 |
| 无日期稿消失于 feeds | 用户以为丢稿 | UI note 说明；`news.json` 仍保留 |
| 空 feeds | 全失败抽取 | 禁止静默覆盖（error-handling） |

## Ready-for-start

- [x] prd / design / implement 已含活动日期决策
- [x] jsonl 已有真实 spec（若增 extract 相关，可再补 guides）
- [ ] 用户 review 通过后 `task.py start`
