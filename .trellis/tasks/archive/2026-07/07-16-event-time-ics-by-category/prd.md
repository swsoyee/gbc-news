# PRD：日历使用事件发生时间，各分类均提供 ICS

关联 Issue: https://github.com/swsoyee/gbc-news/issues/17

## 背景

用户订阅日历时期望看到的是 **Live / 活动等「发生日」**，而不是新闻发稿日。  
另外各内容分类都应有独立可订阅的 ICS，不能只有「全部」。

## 需求

1. 从标题/正文解析事件发生日（可含区间），写入条目的 `eventAt` / `eventEndAt`
2. **iCal 只使用 `eventAt`**；无法解析发生日的条目不进入任何 ICS（仍可出现在 RSS）
3. 每个有日历事件的分类生成 `/feeds/<category>.ics`；`/feeds/all.ics` 为全部有发生日的条目
4. 订阅页：每个分类都展示明确的 ICS（及 RSS）链接；多选分类也可得到 ICS

## 非目标

- 精确到时刻的排程（无时刻则全天）
- 完整行程爬取第三方售票站

## 验收

- [x] 解析器覆盖常见日文日期写法，有单测
- [x] 现有快照可 enrich 出若干 `eventAt`（如 9/5、9/12、11/3、7/3 等）
- [x] 分类 ICS 文件存在且仅含带 `eventAt` 的条目
- [x] 订阅页可见各分类 ICS 链接
- [x] `npm run ci` 通过后 push
