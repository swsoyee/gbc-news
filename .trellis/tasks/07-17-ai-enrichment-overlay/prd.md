# AI 增强叠加层：正文落盘 + 中文 RSS/iCal

## Goal

在**不引入付费 AI API、不改变 GitHub Actions 自动抓取节奏**的前提下，支持偶尔在 Cursor 中人工触发 AI 增强：核对/订正活动日程，并输出中文标题与描述；增强结果写入独立叠加层，`build:feeds` 合并后 **RSS / iCal / 网站日历均优先展示中文**（未增强条目回退日文原文）。

## Background（已确认事实）

- 当前架构：`Actions scrape → data/*/latest.json → build:feeds → public/`（见 `docs/architecture.md`）。
- 抓取器已解析 `bodyText`，但写入 `NewsItem` 时仅保留约 180 字 `summary`（如 `src/scrapers/gbc-news/parse-detail.ts`）。
- 日程由规则引擎 `extractEventDates()` 生成；约 534 条资讯中约 100 条带 `eventDates`。
- 增量抓取用 `mergeById` 整项覆盖同 `id`，人工字段若写入 `latest.json` 会被 GA 冲掉。
- 已有 `scripts/reenrich-event-dates.ts` 证明「快照二次加工」模式可行，但是规则重跑而非 AI/人工叠加。

## Requirements

### R1 — 抓取层：正文落盘（GA 路径）

- `NewsItem` 增加可选字段 `bodyText`（完整日文纯文本，与解析器输出一致）。
- 三源抓取器（`gbc-news`、`gbc-firstriff`、`collabo-cafe`）写入 `bodyText`。
- 提供一次性 backfill 脚本：根据现有快照 URL 重抓详情并为历史条目补齐 `bodyText`；单条失败记录警告并继续，写回时必须使用临时文件、校验和原子替换。
- GitHub Actions `Scrape` workflow **行为不变**（仍跑 `npm run scrape` + `build:feeds` + commit）；仅因模型扩展导致快照体积增大。
- 增量合并时：新抓取覆盖同 `id` 的 `bodyText`；**不得**覆盖 enrichment 叠加层。

### R2 — 增强叠加层（Cursor 人工路径）

- 新增独立存储 `data/enrichments/<sourceId>.json`（或等价结构），与 `data/<source>/latest.json` 分离。
- 每条 enrichment 至少包含：
  - `id`、`sourceId`
  - `status`：`pending` | `reviewed` | `skip`
  - `contentFingerprint`：基于原文关键字段（如 `title` + `bodyText` 或 hash）检测 GA 更新后是否需重新审核
  - `reviewedAt`（`reviewed` / `skip` 时必填的 ISO 时间；`pending` 可省略）
  - `titleZh`、`summaryZh`（`reviewed` 时必填的中文标题与描述，供 feed/UI 使用）
  - 可选 `eventDates`：人工订正后的日程（覆盖规则解析结果）
  - 可选 `reviewNotes`：订正说明
- **不在 CI/GA 中调用外部 AI API**；增强由用户在 Cursor 中 occasional 触发，利用 Cursor 订阅内模型完成。

### R3 — 合并与输出（build 路径）

- `build:feeds`（及 `public/data/news.json` 生成）在合并三源快照后 **apply enrichments overlay**：
  - 展示/feed 用字段：`titleZh ?? title`，`summaryZh ?? summary`
  - 日程：`enrichment.eventDates ?? item.eventDates`
- RSS / iCal 标题前缀（原 `[開催]`/`[発売]`）在输出层改为中文等价（如 `[举办]`/`[发售]`），与策略 B 一致。
- 未增强条目：**回退**现有日文 `title` / `summary`，行为与现网兼容。
- `assertNewsItem` 增加可选 `bodyText` 校验；enrichment 字段使用独立模型，不得污染原始 `NewsItem` 契约。

### R4 — 待处理队列与 Cursor 工作流

- 提供 CLI：`npm run enrich:list-pending`（或等价脚本），列出待人工增强条目，支持 `--limit`、`--source`。
- 「待处理」判定（默认）：
  - 无对应 enrichment 记录；或
  - `contentFingerprint` 与当前快照不一致（原文被 GA 更新）；或
  - `status === pending`
- **增强范围（已确认：A — 含补录）**：
  - **订正**：核对/修正规则已抽出的 `eventDates`；
  - **补录**：正文明显含活动/发售信息但规则未抽出 `eventDates` 的条目，人工增强后可**新增** `eventDates`，使其进入 RSS/iCal 与日历；
  - **汉化**：输出 `titleZh` / `summaryZh` 供 feed/UI 使用。
- pending 列表排序建议：① fingerprint 失效的已 review 条 → ② 有 `eventDates` 未 review → ③ 疑似活动但无 `eventDates`（启发式：`categories` 含 live/event 或正文/event cue 命中）→ ④ 其余未 review。
- 提供 Cursor Skill / 文档化 SOP：读取 pending 列表 → 参照 `bodyText` 与现有 `eventDates` → 写入 enrichment → 跑 `build:feeds` → 本地预览 → commit。
- 可选辅助脚本：`enrich-apply` 校验 schema 后 merge 单条（防手写 JSON 错误）。

### R5 — 前端

- 网站日历（`public/subscribe.js` / `news.json`）优先显示中文标题；未增强回退日文。

## Acceptance Criteria

- [ ] 三源抓取后 `latest.json` 条目含 `bodyText`；现有测试与 CI 通过。
- [ ] backfill 脚本可为三源现有历史条目补齐 `bodyText`，单条失败不阻断其余条目，并提供进度/汇总日志。
- [ ] GA `Scrape` workflow 无需改 cron/步骤逻辑即可跑通（快照变大可接受）。
- [ ] `data/enrichments/` 存在独立 schema 与校验；GA 增量抓取**不会**删除或覆盖 enrichment 文件。
- [ ] 写入 `reviewed` enrichment 后，`build:feeds` 产出的 RSS/iCal/`news.json` 对应该条使用中文 title/description。
- [ ] enrichment 中 `eventDates` 覆盖后，日历与 feed 展开结果反映订正值。
- [ ] 原文 `title`/`bodyText` 被 GA 更新后，该条重新出现在 `enrich:list-pending`（fingerprint 失效）。
- [ ] 无 enrichment 的条目 feed/UI 仍用日文，与现网行为一致。
- [ ] Cursor SOP（Skill 或 task 内文档）可让非作者按步骤完成一批增强。
- [ ] 对「无规则 `eventDates` 但正文为活动」的条目，写入 enrichment 的 `eventDates` 后，该条出现在 RSS/iCal 与日历中。

## Out of Scope（MVP）

- GitHub Actions 内自动调用 OpenAI/Gemini 等付费 API。
- 用户账号、审核工作流 UI、多人协作锁。
- categories/groups 的人工覆盖（除非后续 PRD 扩展）。
- `bodyText` 拆到独立文件目录（首期直接进 `latest.json`；体积过大时再 refactor）。

## Decisions

| 决策 | 结论 |
|------|------|
| Feed/UI 语言 | **B** — RSS/iCal/日历均优先中文，未增强回退日文 |
| 原文存储 | 抓取时 `bodyText` 落盘至 `latest.json` |
| 历史正文 | **A** — 提供一次性 backfill 脚本，立即补齐现有约 534 条 |
| 增强范围 | **A** — 订正 + 补录（规则漏抽也可人工新增 `eventDates`）+ 汉化 |
| 增强存储 | 独立 `data/enrichments/`，与 GA 抓取分离 |
