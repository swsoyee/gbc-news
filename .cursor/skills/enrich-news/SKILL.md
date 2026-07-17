---
name: enrich-news
description: 批量核对、汉化并补录 gbc-news 抓取资讯的活动日期，写入独立 enrichment 叠加层。用户要求人工增强、汉化、核对日程、订正或补录抓取资讯时使用。
---

# 资讯人工增强

仅使用当前 Cursor 会话内模型分析正文；禁止调用外部付费 AI API。

## 固定术语（必读）

汉化前先读取 [glossary.md](glossary.md)。

- `titleZh` / `summaryZh` **必须**使用词表中的固定译名（例如 `ガルクラ`→`GBC`，`トゲナシトゲアリ`→`无刺有刺`，`トゲトゲ`→`刺刺`，`ルパ`→`RUPA`）。
- 禁止临时发明近义词；词表没有的专名优先保留原文，需要新增时先更新 `glossary.md`。
- 角色名按方案 B：一律使用词表译名（如 `安和すばる`→`安和昴`），不得混用未收录写法。

## 批次流程

1. 获取待处理项：
   ```bash
   npm run enrich:list-pending -- --limit 10 --source gbc-news --json
   ```
   `--source` 可用 `gbc-news`、`gbc-firstriff`、`collabo-cafe`；需要跨源时省略。
2. 逐条核对输出中的 `title`、`bodyText`、`eventDates` 与 `url`：
   - 按 [glossary.md](glossary.md) 翻译简体中文 `titleZh`、`summaryZh`，忠于原文，不扩写未证实信息。
   - `summaryZh` 只写面向用户的事实摘要；**不要**写「无具体日不补录」等内部说明（那些放 `reviewNotes`）。
   - 有明确日期证据时订正或补录 `eventDates`；证据不足时不得猜测日期。
   - **跨日时长 > 24 小时**：只保留 `date` / `endDate`（及 `kind`），**去掉** `startTime` / `endTime`。例如先行抽选 `3/22 21:00–4/1 23:59` → `{ date: "2026-03-22", endDate: "2026-04-01", kind: "sale" }`。单日或跨日但总时长 ≤ 24 小时的仍可保留时刻。
   - **线上 talk / 配信「19时开始（20时结束预定）」**：合并为一条 `{ startTime: "19:00", endTime: "20:00" }`，禁止拆成 19:00 与 20:00 两条导致日历重复。
   - 明确无需发布增强的条目可标记 `skip`。
3. 编辑 `data/enrichments/<sourceId>.json` 的 `items[id]`：
   - `contentFingerprint` 必须原样使用 pending 输出值。
   - `reviewed` 必填 `reviewedAt`、`titleZh`、`summaryZh`。
   - `skip` 必填 `reviewedAt`。
   - `eventDates` 若存在则完整覆盖规则结果；空数组表示明确移除全部活动日期。
   - 可用 `reviewNotes` 简述日期订正证据。
4. 每批完成后验证：
   ```bash
   npm run enrich:validate
   npm run build:feeds
   npm test
   npm run build:web
   ```
5. 用 `npx serve public -l 3000` 预览日历，并抽查对应 RSS/iCal 的中文标题、描述和日期。

## 边界

- 不修改 `data/<sourceId>/latest.json` 中的日文原文；人工结果只写 enrichment。
- 不修改 GitHub Actions 定时或加入 AI API 调用。
- 原文发生变化、fingerprint 失效时，旧增强不得继续发布；重新核对后更新记录。
- 不手改 `public/data/news.json`、`public/feeds/` 或 `public/subscribe-core.js`，统一由构建生成。
