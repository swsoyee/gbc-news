# 后端目录结构

## 目标布局

```text
src/
  scrapers/          # 每个官网一个模块
    <source-id>/
      index.ts       # 导出 scrape()
      parse.ts       # 纯解析（便于单测）
      fixtures/      # HTML/JSON 夹具
  models/
    item.ts          # 统一资讯/事件模型
  feeds/
    rss.ts           # RSS 生成
    ical.ts          # iCal 生成
  utils/
    http.ts          # 带超时与 User-Agent 的请求
    time.ts          # 时区/日期规范化
scripts/
  scrape.ts          # Actions / 本地入口：抓取并写 data/
  build-feeds.ts     # 从 data/ 生成 public/feeds/
data/
  <source-id>/       # 抓取快照（生成物）
public/
  feeds/             # 对外订阅文件
```

## 约定

1. **一个源一个目录**：`src/scrapers/<source-id>/`，禁止把多个官网的选择器堆在同一文件。
2. **解析与 IO 分离**：`parse.ts` 只吃字符串/DOM，不发网络请求；网络在 `scrape()` 或 `utils/http.ts`。
3. **统一模型出站**：scraper 产出 `Item[]`，feed 层只依赖模型，不依赖具体官网结构。
4. **生成物不手改**：`data/`、`public/feeds/` 由脚本写出；手工编辑视为错误。

## 禁止

- 在 Netlify Functions 里做重型全量抓取（定时抓取应在 Actions）
- 把密钥硬编码进仓库
- 为「以后可能用到」提前引入 ORM / Redis / 消息队列
