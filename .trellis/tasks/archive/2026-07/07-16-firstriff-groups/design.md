# Design: firstriff + 组合 + 活动日期

## Data flow

```text
官网 HTML
  → scrape（解析正文、classify 分类/组合、extractEventDates）
  → data/<source>/latest.json   // NewsItem + groups + eventDates + publishedAt
  → build-feeds /api/feed
       ├─ filter by groups ∧ categories
       └─ expandEventDates → FeedEntry[]（无 eventDates 则跳过）
            → RSS pubDate / iCal DTSTART = entry.occurredOn
            → title = `[開催|発売] ` + originalTitle
```

## Contracts

### GroupId

`togenashi` | `f272` | `canna-lily` | `other`

### EventDate

```ts
type EventDateKind = 'hold' | 'sale'
interface EventDate {
  date: string // YYYY-MM-DD（UTC 日历日约定，与现有 publishedAt 日期部分一致）
  kind: EventDateKind
}
```

### NewsItem（增量）

- `groups: GroupId[]`（非空）
- `eventDates?: EventDate[]`（可空/缺省 = 无活动日 → 不进 feeds）
- `publishedAt`：新闻发布日，仅元数据与省略年推定基准

### Feed 展开

- 输入：过滤后的 `NewsItem[]`
- 输出：每个 `(item, eventDate)` 一条
- RSS `guid` / iCal `UID`：`${item.id}-${eventDate.date}-${eventDate.kind}@gbc-news`（避免多日冲突）
- 标题前缀：`hold` → `[開催]`，`sale` → `[発売]`

### API

`/api/feed?format=&groups=&categories=` — 语义同 D1；展开在过滤之后。

### 源 id

| sourceId | 条目 id |
|----------|---------|
| `gbc-news` | `post-{n}` |
| `gbc-firstriff` | `firstriff-post-{n}` |

## Event date extraction（MVP）

**收录（D8）**

- hold：`日程` / `開催日` / `開催日時` / `出演日` 及邻近日期
- sale：`チケット発売日` / `発売日` / `通販`+开始类 / `受注`+开始类（规则表可测）

**排除**：`営業日`、纯相对措辞等

**格式**：`YYYY年M月D日`、`M月D日`（D9 补年）、同标签多日（`5日/6日`）尽量拆开

**失败**：抽不出 → `eventDates` 空 → 该稿不出现在 RSS/iCal（仍可留在 `news.json`）

## Layers

| 模块 | 职责 |
|------|------|
| `models/groups.ts` | GroupId |
| `categories/classify-group.ts` | 组合打标 |
| `categories/extract-event-dates.ts`（新） | 纯函数抽取 |
| `feeds/expand.ts`（新）或 `feeds/build.ts` | 按日展开 + 前缀 |
| `scrapers/gbc-firstriff/` | 新源 |
| `scrapers/gbc-news/` | 接 groups + eventDates |
| `subscribe.js` / `index.html` | 组合 UI |
| `feed-entry.ts` | groups 参数 + expand |

## Compatibility

1. 同 PR 内一次性补齐 `groups`（修复 main 债务），避免半引用。
2. 旧快照无 `eventDates`/`groups`：重跑 scrape；build 对缺 `groups` 断言失败胜于静默。
3. 回滚：还原模型与 scraper，删 firstriff 数据，重建 feeds。

## Trade-offs

- 快照不按日拆条（D7）：更新去重简单；feed 层负责展开。
- kind 进标题但不进独立筛选：满足可读性，控制 MVP 范围。
