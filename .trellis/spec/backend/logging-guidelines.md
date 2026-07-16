# 日志约定

## 级别

| 级别 | 用途 |
|------|------|
| `error` | 导致任务失败或单源失败 |
| `warn` | 可降级继续，但需关注（如跳过脏条目） |
| `info` | 关键里程碑：开始/结束、条数、耗时 |
| `debug` | 本地排查用；CI 默认不刷屏 |

## 格式

- Actions 环境用单行可读文本即可：`[info] source=foo fetched=12 durationMs=840`
- 关键带 `sourceId`、条数、耗时；不要打印整页 HTML
- 禁止记录 Cookie、Token、Authorization 头

## 成功摘要

每次抓取结束应输出摘要，便于在 Actions 日志快速确认：

```text
[info] scrape done ok=3 failed=1 items=42
```

## 禁止

- `console.log` 打印完整响应体
- 用日志代替测试断言
