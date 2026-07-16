# PRD：回溯抓取 girls-band-cry.com/news 全部分页

关联 Issue：https://github.com/swsoyee/gbc-news/issues/21

## 背景

此前仅抓取前 3 页做验证。用户要求回溯拉取官网新闻**全部**数据。

探测结果：列表约 **41** 页（末页条目更少；再往后返回 403），合计约 480+ 条。

## 需求

1. `scrapeGbcNews` 支持自动翻页至无更多条目（或 HTTP 失败），不再默认停在 3 页
2. `GBC_MAX_PAGES` 仍可限制页数（测试用）；`0` / 未设 / `all` = 全量
3. 全量抓取后写出 `data/gbc-news/latest.json`，重建 feeds 并部署
4. 保持礼貌延迟，避免压垮官网

## 非目标

- firstriff 全量（本次仅 gbc-news 官网）
- 增量/断点续传（失败则保留旧快照，成功后整份替换）

## 验收

- [x] 本地/CI 可用有限页数跑通
- [x] 全量 scrape 条目数显著大于 36（约数百）
- [x] feeds 重建；`npm run ci`；部署
