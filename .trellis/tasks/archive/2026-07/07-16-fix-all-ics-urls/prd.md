# PRD：修复 all 活动覆盖与日历链接截断

关联 Issue: https://github.com/swsoyee/gbc-news/issues/18

## 背景

1. `/feeds/all.ics` 名义上是「全部活动」，但大量真实活动稿（标题含 `7/3`、正文 `開催期間` / `販売開始日時`、emoji 日期等）抽不出 `eventDates`，因此不进任何 ICS，用户感觉 all 不全。
2. iCal `DESCRIPTION` 用 `truncateIcs(..., 200)` 把摘要与 URL 一并截断，日历里跳转链接被砍断。

## 需求

1. **加强活动日抽取**：覆盖标题斜杠日期（`M/D`）、`開催期間` / `販売開始日時` / 标题内活动线索等常见写法；抽得出的活动应进入对应分类 ICS，并计入 `all.ics`。
2. **`all.ics` = 全部有活动日的展开条目**（与各分类/组合 feed 的并集一致）；无法解析日期的稿仍可不进日历（留在 `news.json`）。
3. **日历事件保留完整原始跳转链接**：`URL` 属性与 `DESCRIPTION` 中的链接均不得截断。

## 非目标

- 把无任何可解析日期的资讯硬塞进日历（用发稿日冒充活动日）
- 改动订阅页筛选逻辑

## 验收

- [x] 原先漏抽的典型稿（如 `7/3` 咖啡、`開催期間` カフェ、`販売開始日時`、CON-CON 日期）能抽出 `eventDates`
- [x] 重建后 `all.ics` 的 VEVENT 数 = 各分类 ICS UID 并集；且明显高于修复前（32 → 59）
- [x] 生成的 ICS 中 `URL;VALUE=URI:` 与 DESCRIPTION 内 URL 均为完整原文链接
- [x] 相关单测覆盖；`npm run ci` 通过后 push / 部署
