import { describe, expect, it } from 'vitest'
import { assertNewsItem, type NewsItem } from '../src/models/item.js'

describe('NewsItem', () => {
  it('接受合法条目', () => {
    const item: NewsItem = {
      id: 'demo-1',
      title: '示例资讯',
      url: 'https://example.com/news/1',
      publishedAt: '2026-07-16T00:00:00Z',
      sourceId: 'demo',
    }

    expect(() => assertNewsItem(item)).not.toThrow()
  })

  it('拒绝缺少必填字段的对象', () => {
    expect(() => assertNewsItem({ title: '缺字段' })).toThrow(/NewsItem/)
  })
})
