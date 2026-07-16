# PRD：GBC 官网新闻抓取与分类订阅（前3页）

## 背景

从 https://girls-band-cry.com/news/ 抓取新闻文章。官网列表/详情页**不暴露** WordPress 分类，因此使用标题与正文关键词做规则分类。用户在本站网页点选分类后，可订阅对应 RSS 或 iCal。

关联 GitHub：#8（父）、#9–#13（子）

## 范围（本阶段）

- 仅抓取新闻列表第 1–3 页及对应文章详情
- 规则分类（可多标签）：`live` / `event` / `goods` / `music` / `cinema` / `media` / `other`
- 生成可过滤的 RSS / iCal
- 提供分类点选订阅页

## 非范围

- 全站历史全量抓取
- 用户账号体系
- 付费代理 / 绕过反爬

## 验收标准

1. `npm run scrape:gbc` 能抓取前 3 页并写出 `data/gbc-news/latest.json`
2. 每条资讯含 `categories: string[]`，无匹配时为 `["other"]`
3. 解析与分类有夹具/单测
4. 订阅页可多选分类，生成 RSS 与日历订阅链接
5. Netlify Function 支持 `format=rss|ics` + `categories=` 过滤
6. 小步提交；Issue 状态同步更新

## 技术要点

- 列表：`ul.news-List li.item a` → href / title / time
- 详情：`h1.ttl` + `time` + `.sw-Txtarea` 文本
- 分页：`/news/`、`/news/page/2/`、`/news/page/3/`
- 低成本：静态 JSON + Function 动态过滤
