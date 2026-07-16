# PRD：修复 ICS 折行切断链接

关联：用户反馈 https://gbc-news.netlify.app/feeds/all.ics 结果仍错误。

## 背景

RFC5545 要求每行 ≤75 octets。当前 `foldIcs` 按字节硬切，会把 `DESCRIPTION` 里的 `https://...`（含摘要中的外链与文末文章链接）从中间切断。部分日历客户端不会先 unfold 再识别链接，从而点到错误 URL（如 `.../post` 或 `...klook20260210.`）。

## 需求

1. ICS 折行不得从 `http(s)://` URL 中间切断（URL 过长无法整段放入一行时除外）
2. `DESCRIPTION` 摘要去掉正文中的外链，只保留本站条目的完整原始跳转链接
3. `URL;VALUE=URI` 仍为完整原文链接
4. 重建并部署 `all.ics`

## 验收

- [x] 生成的 ICS 物理行中不出现 `news/post` + 续行 `-123.html` 这类断链
- [x] DESCRIPTION 含完整文章 URL；摘要中的第三方 URL 不再出现（或不会被折断）
- [x] 单测覆盖；`npm run ci`；部署后线上验证
