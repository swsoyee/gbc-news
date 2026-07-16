# 错误处理

## 原则

1. **失败要响亮**：抓取或生成失败必须非零退出，让 Actions 标红。
2. **单源隔离**：一个官网失败不应拖垮其他源（编排层聚合结果，失败源单独报告）。
3. **禁止静默空订阅**：不得在失败时写出空的 RSS/iCal 覆盖上次成功产物（除非任务明确要求「失败则清空」）。

## 推荐模式

```ts
// 示意：单源失败抛出带 sourceId 的错误，由编排层捕获汇总
export class ScrapeError extends Error {
  constructor(
    readonly sourceId: string,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`[${sourceId}] ${message}`)
    this.name = 'ScrapeError'
  }
}
```

## HTTP

- 必须设置超时
- 4xx/5xx 视为失败（除非该源文档约定某些状态可忽略）
- 重试仅用于瞬时错误（429/5xx），并带上限与退避

## Feed 生成

- 输入校验失败 → 中止生成该 feed
- 部分条目非法 → 记录告警并跳过非法条目；若合法条目为 0 且上次有数据，视为失败

## 禁止

- `catch (e) {}` 空吞异常
- 用默认空数组掩盖解析失败
- 在生产路径使用 `any` 抹平错误类型
