---
name: dedupe-news
description: 人工判定 gbc-news 跨源重复资讯，把确认的重复写入 data/dedupe/manual.json，供 build-feeds 剔除。用户要求跨源去重、合并重复、清理重复活动/周边资讯时使用。
---

# 跨源资讯人工去重

抓取流水线**不做**自动跨源去重（自动规则会误杀「同档期不同商品」）。
去重改为人工在本会话内判定，并写入独立叠加层 `data/dedupe/manual.json`。

## 背景

- 四源优先级（高 → 低）：`gbc-news` > `gbc-firstriff` > `collabo-cafe` > `gamepedia`。
- 判定为重复时，**保留高优先级**那条，把低优先级条目写入去重名单剔除。
- 只有「同一件事」才算重复；同档期的不同商品 / 不同活动**不要**去重。

## 批次流程

1. 拉取候选（脚本仅按 `eventDates` 重叠给出建议，不代表一定重复）：
   ```bash
   npm run dedupe:candidates              # 全部候选（★ = 标题相近）
   npm run dedupe:candidates -- --title-similar   # 只看标题也相近的高置信候选
   npm run dedupe:candidates -- --json --limit 50
   ```
   输出中 `KEEP` 为高优先级建议保留项，`DROP` 为低优先级建议剔除项；
   `gap` 为两者发布日差，`overlap` 为重叠的活动日区间。

2. 逐条**人工确认**是不是同一件事（看标题、日期、正文/URL）：
   - 是同一活动/同一商品 → 采纳，记下要剔除的 `DROP` id 与保留的 `KEEP` id。
   - 只是同档期的不同商品 / 不同场次 / 不同 IP → **跳过**，不写入名单。

3. 编辑 `data/dedupe/manual.json` 的 `drops` 数组，追加确认项：
   ```json
   {
     "updatedAt": "<当前 ISO 时间>",
     "drops": [
       { "id": "<被剔除条目 id>", "keptId": "<保留条目 id>", "reason": "<判定依据>" }
     ]
   }
   ```
   - `id`：被剔除条目 id（低优先级源，如 `gamepedia-205942`）。
   - `keptId`：保留条目 id（仅记录用途）。
   - `reason`：一句话说明为何判为重复。
   - 同一 `id` 不得重复出现。

4. 构建并验证：
   ```bash
   npm run build:feeds     # 日志出现 manualDrops=<n> 与逐条 drop
   npm test
   npm run build:web
   ```
   `build-feeds` 会按 `drops` 剔除条目；若某 `id` 未命中任何条目会打印
   `manual dedupe drop id 未命中任何条目（可能已过期）` 警告，需核对后清理。
   `keptId` 写了但快照中找不到时，`enrich:validate` 会报错退出。
   同一活动若 collabo 有多条近似 slug，需**分别**写入 drops。

## 边界

- 不修改 `data/<sourceId>/latest.json` 日文原文，也不改 enrichment 文件。
- 不在流水线里加回自动去重；只有 `data/dedupe/manual.json` 里的条目会被剔除。
- 不手改 `public/data/news.json`、`public/feeds/`，统一由 `build:feeds` 生成。
- 拿不准是否同一件事时**宁可不剔除**（漏去重优于误删有效资讯）。
- 已 drop 的条目不会再出现在 `enrich:list-pending`；无需为其继续汉化。
