# 后端目录结构

## 目标布局

```text
src/
  scrapers/          # 每个官网一个模块
    <source-id>/
      index.ts       # 导出 scrape()
      parse*.ts      # 纯解析（便于单测）
      fixtures/      # HTML/JSON 夹具
  models/
    item.ts          # 统一资讯模型（含 groups / eventDates）
    groups.ts        # GroupId
    event-date.ts    # EventDate / kind / 标题前缀
    categories.ts    # CategoryId
  categories/
    classify.ts           # 内容分类
    classify-group.ts     # 组合打标（D2/D3）
    extract-event-dates.ts # 活动日抽取（D8/D9/D10）
  feeds/
    expand.ts        # eventDates → FeedEntry（无日期跳过）
    build.ts         # RSS / iCal 字符串生成（只吃 FeedEntry）
  utils/
    http.ts          # 带超时与 User-Agent 的请求
scripts/
  scrape-<source>.ts # Actions / 本地入口：抓取并写 data/
  build-feeds.ts     # 多源合并 → public/data/news.json + feeds
  bundle-function.mjs
data/
  <source-id>/       # 抓取快照（生成物）
public/
  feeds/             # 对外订阅文件（按活动日展开）
  data/news.json     # 合并快照（含无活动日条目）
netlify/functions/
  feed-entry.ts      # /api/feed：groups∧categories 过滤后再 expand
```

## 约定

1. **一个源一个目录**：`src/scrapers/<source-id>/`，禁止把多个官网的选择器堆在同一文件。
2. **解析与 IO 分离**：`parse*.ts` 只吃字符串/DOM，不发网络请求；网络在 `scrape()` 或 `utils/http.ts`。
3. **统一模型出站**：scraper 产出 `NewsItem[]`（含 `groups`、可选 `eventDates`），feed 层只依赖模型与 `expandEventDates`，不在 scraper 里拼 RSS/iCal。
4. **条目时间**：RSS `pubDate` / iCal `DTSTART` 使用展开后的活动日（`occurredOn`），不用 `publishedAt`；无 `eventDates` 的稿不进 feeds，可留在 `news.json`。
5. **生成物不手改**：`data/`、`public/feeds/`、`public/data/news.json` 由脚本写出；手工编辑视为错误。
6. **空订阅防护**：全量展开结果为 0 时 `build-feeds` 必须失败退出，禁止覆盖上次成功的 `all` 订阅。

## 禁止

- 在 Netlify Functions 里做重型全量抓取（定时抓取应在 Actions）
- 把密钥硬编码进仓库
- 为「以后可能用到」提前引入 ORM / Redis / 消息队列
