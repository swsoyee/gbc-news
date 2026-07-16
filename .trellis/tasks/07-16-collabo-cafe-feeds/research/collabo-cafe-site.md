# collabo-cafe.com 站点调研

## 平台

WordPress。图片 `/wp-content/uploads/`，JSON-LD `datePublished`/`dateModified`，详情 `/events/collabo/<slug>/`。

## 列表（搜索）

- 关键词：`ガールズバンドクライ`（URL 编码 `%E3%82%AC%E3%83%BC%E3%83%AB%E3%82%BA%E3%83%90%E3%83%B3%E3%83%89%E3%82%AF%E3%83%A9%E3%82%A4`）
- 分页：`/page/N/?s=<enc>`（第 1 页可省略 `/page/1/`）
- 规模（2026-07-16）：约 **4 页 / 52 篇**
- 末页：当页 `<article class="post-list">` 少于 16，或不再出现更大 `page/N` 链接

### 列表卡片结构

```html
<article class="post-list ... post-<ID> event-category-girls-band-cry event-category-cafe ...">
  <a href="https://collabo-cafe.com/events/collabo/<slug>/" rel="bookmark">
    <img data-src="...">  <!-- 懒加载，真 URL 在 data-src -->
    <h1 class="entry-title">...</h1>
    <span class="event-date">期間 : 2026年7月10日〜7月26日</span>
    <span class="date updated">2026/07/07</span>
    <div class="description"><p>摘要</p></div>
  </a>
</article>
```

`article` class 含 `event-category-cafe` / `pop-up-store` / `goods` 等，可作分类辅助。

## 详情页

示例：`https://collabo-cafe.com/events/collabo/girls-band-cry-scream-cafe-treevillage-2026/`

| 字段 | 来源 |
|------|------|
| 标题 | `h1.entry-title` |
| 发布日 | JSON-LD `datePublished`（ISO8601） |
| 正文 | `div.entry-content` |
| 主图 | JSON-LD / `og:image` |
| 结构化信息 | `table.cc-table` 的 `th`→`td` |

常见 `th`：`開催期間`、`開催場所`、`会場`、`公式サイト`、`価格`、`開催時間`。

`開催期間` 可多行、多城市：

```
【東京】2026年4月4日〜4月17日
【横浜】2026年4月24日〜5月15日
```

## 日期格式

- 列表会期：`期間 : 2026年7月10日〜7月26日`
- 预约截止：`～2026年7月18日まで予約受付` → `sale` 候选
- 详情期间：`YYYY年M月D日〜M月D日`（`〜`/`～`）
- 列表发布：`YYYY/MM/DD`

现有 `extract-event-dates.ts` 可复用大部分规则；需优先读 `table.cc-table` 的 `開催期間` 行。

## RSS 不可用

`/search/<term>/feed/rss2/` 返回空 body，必须 HTML 抓取。

## 与 gbc-news 重叠

同一协作活动（如 SCREAM CAFE）可能同时出现在官网与 collabo-cafe。MVP 不去重，靠 `sourceId` 区分。
