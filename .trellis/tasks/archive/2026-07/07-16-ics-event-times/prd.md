# PRD：日历事件支持具体起止时刻

关联 Issue：https://github.com/swsoyee/gbc-news/issues/20

## 背景

当前 iCal 一律全天（`VALUE=DATE`）。gbc-news / gbc-firstriff 正文常有 `OPEN/START`、`開場/開演`、`18:00〜` 等时刻，用户希望有起止时间时写入日历。

## 需求

1. `EventDate` 支持可选 `startTime` / `endTime`（Asia/Tokyo 墙钟 `HH:mm`）
2. 从标题/正文抽取常见时刻（開場・開演、OPEN/START、`HH:mm～HH:mm`、`HH:mm〜`、`N時`）
3. 同一日多部（一部/二部）→ 多条带时刻的日历事件
4. 有 `startTime` 时 iCal 使用 UTC `DATE-TIME`；仅有开始则 hold 默认 +2h、sale 默认 +1h 作为结束
5. 无时刻时行为不变（全天 `VALUE=DATE`）
6. 两源 scrape 后重建 feeds 并部署

## 非目标

- 精确演出时长（无结束时刻时用默认时长）
- 跨日销售区间合并为单条跨越事件（可后续做）

## 验收

- [x] 典型 Live（開場/開演）生成带时刻的 DTSTART/DTEND
- [x] 无时刻条目仍为全天
- [x] firstriff / gbc-news 均覆盖
- [x] 单测 + `npm run ci` + 部署
