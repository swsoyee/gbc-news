// 骨架阶段：占位模块，保证 typecheck/test 可通过。业务实现另开任务。

export interface NewsItem {
  id: string
  title: string
  url: string
  publishedAt: string
  sourceId: string
  summary?: string
}

export function assertNewsItem(value: unknown): asserts value is NewsItem {
  if (!value || typeof value !== 'object') {
    throw new Error('NewsItem must be an object')
  }

  const item = value as Record<string, unknown>
  for (const key of ['id', 'title', 'url', 'publishedAt', 'sourceId'] as const) {
    if (typeof item[key] !== 'string' || item[key].length === 0) {
      throw new Error(`NewsItem.${key} must be a non-empty string`)
    }
  }
}
