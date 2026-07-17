# Design — AI 增强叠加层

## Architecture

```text
                    GitHub Actions (不变)
                    scrape → data/<source>/latest.json
                             (+ bodyText 新字段)

Cursor 人工 (偶尔)
  enrich:list-pending
       ↓ 读 latest.json.bodyText + 现有 eventDates
  Cursor AI 分析 / 汉化 / 订正
       ↓
  data/enrichments/<sourceId>.json

build:feeds
  merge snapshots → applyEnrichments → expandEventDates → RSS/iCal/news.json
```

## Data Contracts

### NewsItem 扩展（抓取层）

```typescript
// src/models/item.ts — 新增可选字段
bodyText?: string  // 完整日文正文；assertNewsItem 校验非空字符串（若存在）
```

写入方：三源 scraper 在 push item 时附带 `bodyText: detail.bodyText`。

### EnrichmentRecord（叠加层）

存储路径：`data/enrichments/gbc-news.json` 等，结构：

```typescript
interface EnrichmentFile {
  sourceId: string
  updatedAt: string
  items: Record<string, EnrichmentRecord>  // key = item.id
}

interface EnrichmentRecord {
  id: string
  sourceId: string
  status: 'pending' | 'reviewed' | 'skip'
  contentFingerprint: string
  // reviewed / skip 时必填；pending 可省略
  reviewedAt?: string
  titleZh?: string // reviewed 时必填
  summaryZh?: string // reviewed 时必填
  eventDates?: EventDate[]
  reviewNotes?: string
}
```

校验：`assertEnrichmentRecord()` 独立于 `assertNewsItem`；`reviewed` 必须同时具有
`reviewedAt`、`titleZh`、`summaryZh`，`skip` 必须具有 `reviewedAt`。

### ResolvedItem（build 内部）

合并后的只读视图，供 expand / feed / news.json：

```typescript
interface ResolvedNewsItem extends NewsItem {
  /** 展示用 */
  displayTitle: string   // titleZh ?? title
  displaySummary: string // summaryZh ?? summary
  /** 展开用 */
  effectiveEventDates?: EventDate[]  // enrichment.eventDates ?? eventDates
}
```

## Merge Semantics

### scrape `mergeById`

- 行为不变：新抓取 item 替换同 id。
- `bodyText` 随抓取更新。
- **不**读取或写入 `data/enrichments/`。

### 历史正文 backfill

- 新增脚本读取三源 `latest.json`，按各源现有 parser 重抓详情，仅补写 `bodyText`。
- 支持 `--source`、断点式跳过已有 `bodyText`，以及显式 `--force` 重抓。
- 单条请求/解析失败仅告警并继续；每个源完成后按「临时文件 → 校验 → 原子替换」写盘，避免中断造成快照损坏。
- 复用现有 HTTP 工具、parser 和请求间隔，不引入新依赖。

### `applyEnrichments(items, enrichments)`

对每个 `NewsItem`：

1. 查 `enrichments.items[item.id]`。
2. 若无 record → `displayTitle = title`，`displaySummary = summary ?? ''`，`effectiveEventDates = eventDates`。
3. 若有 record 且 `status === 'reviewed'` 且 fingerprint 与当前正文一致：
   - `displayTitle = record.titleZh ?? title`
   - `displaySummary = record.summaryZh ?? summary ?? ''`
   - `effectiveEventDates = record.eventDates ?? eventDates`
4. 若 fingerprint 不一致 → 视为 stale，不应用增强并进入 P0。
5. 若有 record 且 `status === 'skip'` → 同无 record（不回退以外的特殊逻辑）。
6. `status === 'pending'` → 同无 record（尚未发布增强）。

Fingerprint 计算（写入 enrichment 时由脚本/Skill 约定）：

```typescript
sha256(normalize(title) + '\n' + normalize(bodyText))
```

`enrich:list-pending`：无 record，或 fingerprint 不匹配，或 `status === pending`。

### Pending 优先级（A — 含补录）

| 优先级 | 条件 | 人工动作 |
|--------|------|----------|
| P0 | 已 `reviewed` / `skip` 但 fingerprint 失效 | 重新核对 + 更新汉化/日程 |
| P1 | 有规则 `eventDates`，未 review | 订正 + 汉化 |
| P2 | 无 `eventDates`，疑似活动（`categories` 含 live/event，或 `EVENT_CUE` / collabo 线索） | **补录** `eventDates` + 汉化 |
| P3 | 其余无 enrichment | 汉化为主；无活动则 `status: skip` |

补录后的 `eventDates` 经 `applyEnrichments` → `expandEventDates` 进入 feed，与订正路径相同。

疑似活动启发式可复用 `src/categories/extract-event-dates.ts` 的 `EVENT_CUE` 或抽成共享 util，避免重复维护。

## Feed / UI 中文化

### 标题前缀

| kind | 现网 | 增强输出 |
|------|------|----------|
| hold | `[開催]` | `[举办]` |
| sale | `[発売]` | `[发售]` |

实现：`expandEventDates` 接受可选 `titlePrefix: Record<EventDateKind, string>`，build 传入中文版；或新增 `expandEventDatesLocalized(..., 'zh')`。

展开标题：`${prefix} ${displayTitle}`。

### RSS / iCal

- `buildRss` / `buildIcal` 使用 `FeedEntry.title` / `summary`（已由 expand 使用 display 字段）。
- 未增强条目仍为日文，订阅行为向后兼容。

## Scripts & npm

| 命令 | 用途 |
|------|------|
| `enrich:list-pending` | 打印/JSON 输出待处理列表 |
| `enrich:validate` | 校验 enrichments JSON |
| `backfill:body-text` | 一次性补齐历史正文，支持 source/force 参数 |
| （可选）`enrich:apply --id post-483` | 从 stdin/文件 merge 单条 |

package.json 注册上述 script。

## Cursor Skill（SOP 概要）

1. `npm run enrich:list-pending -- --limit 10 --source gbc-news`
2. 对每条：读 `bodyText`、`eventDates`、URL；AI 输出 JSON patch。
3. 更新 `data/enrichments/gbc-news.json`；`reviewedAt` + fingerprint。
4. `npm run enrich:validate && npm run build:feeds && npm test`
5. 本地 `npx serve public -l 3000` 目视日历与 feed。

## GA / Git Commit

- `scrape.yml` 无需修改：GA 的 `git add data public/data public/feeds` 已涵盖快照；enrichment 由 Cursor 工作流单独提交，GA 不写它。
- 首次 `bodyText` 落盘会导致单次大 diff；可接受。

## Risks

| 风险 | 缓解 |
|------|------|
| `latest.json` 体积增至数 MB | 监控；后续可拆 `data/*/bodies/` |
| 增强 eventDates 与规则冲突 | enrichment 显式覆盖；fingerprint 变更触发 re-review |
| 中文 feed 影响已有订阅者 | 策略 B 为产品决策；未增强条仍日文 |

## Compatibility

- `public/data/news.json` 保留原 `title`/`summary`，并在存在增强时附带 `titleZh`/`summaryZh`；前端使用 `titleZh ?? title`。这样保留原文兼容性，也避免复制 `displayTitle` 派生字段。
- `bodyText` 仅保留在 `data/*/latest.json`，不发布到 `public/data/news.json`，避免无必要扩大公开产物。
