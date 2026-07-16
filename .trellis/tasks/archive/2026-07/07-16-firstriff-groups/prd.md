# PRD: firstriff 信息源、组合分类与活动日期

## Goal

同时覆盖 First Riff 官网新闻；以「组合」为最大级别筛选并叠加内容分类；**RSS/iCal 条目时间取正文活动相关日（举办/售票等），不用新闻发布日。**

## Background

- 现有源：`girls-band-cry.com`（仅内容分类）。
- 新源：`gbc-firstriff.com/news/`（F-272、Canna Lily 等）。
- 现状：RSS `pubDate` / iCal `DTSTART` 均用 `publishedAt`；正文 `■日程`、`■チケット発売日`、省略年份日期尚未抽取。
- 架构：独立 scraper → `data/` 快照 → `build-feeds` → Netlify（`docs/architecture.md`）。
- 债务：`main` 上 `feeds/build.ts` 等已引用不存在的 `item.groups`，typecheck 失败。

## Requirements

1. **R1** 新增 `gbc-firstriff` scraper → `data/gbc-firstriff/latest.json`
2. **R2** `NewsItem.groups`；UI 组合区块在信息分类之前（含其他/共通）
3. **R3** 组合打标：关键词命中谁打谁；未命中 → `other`
4. **R4** gbc-news：仅得 `other` 时改 `togenashi`
5. **R5** `/api/feed`：`groups` + `categories`，维间 AND、维内 OR
6. **R6** `build-feeds` 多源合并
7. **R7** `eventDates[{ date, kind }]`；feed 按日展开；无日期不进 feeds；省略年按 D9
8. **R8** 夹具测试；清理 groups 残留

## Decisions

| ID | 结论 |
|----|------|
| D1 | 过滤：维间 AND、维内 OR |
| D2 | 组合：命中谁打谁；未命中 → `other` |
| D3 | gbc-news 仅 `other` → `togenashi` |
| D4 | 单任务 |
| D5 | 条目时间 = 活动相关日（RSS+iCal） |
| D6 | 每日一条；无日期不进 feeds |
| D7 | 快照保留全文 + `eventDates[]`；feed 展开；`publishedAt` 元数据 |
| D8 | 收录举办/出演 + 售票/通贩开始；排除「最大N営業日」等 |
| D9 | 省略年：发布年基准，倒退超阈值则 +1 年；显式年优先 |
| D10 | `kind: hold \| sale`；展开标题前缀 `[開催]` / `[発売]` |

## Acceptance criteria

- [ ] AC1：typecheck / lint / test 通过（含清理残留）
- [ ] AC2：firstriff 快照非空合法
- [ ] AC3：`news.json` 含 `groups`；可抽取时含带 kind 的 `eventDates`
- [ ] AC4：gbc-news 无队名 → `togenashi`
- [ ] AC5：订阅页组合在分类前
- [ ] AC6：API 过滤符合 D1
- [ ] AC7：解析 / 组合 / 日期抽取有夹具测试
- [ ] AC8：RSS/iCal 时间来自展开后的活动日；标题含 kind 前缀；无日期不进 feeds

## Out of scope

- 账号、Function 内抓取、角色筛选
- 开演时刻（MVP 全天事件）
- 按 `kind` 单独订阅维度（仅标题区分）
