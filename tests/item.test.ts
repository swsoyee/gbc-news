import { describe, expect, it } from 'vitest'
import { parseCategoryList } from '../src/models/categories.js'
import { assertNewsItem, filterItemsByCategories, type NewsItem } from '../src/models/item.js'

const sample: NewsItem = {
  id: 'post-1',
  title: '示例 Live',
  url: 'https://example.com/news/post-1',
  publishedAt: '2026-07-16T00:00:00.000Z',
  sourceId: 'gbc-news',
  categories: ['live', 'event'],
  summary: '摘要',
}

describe('NewsItem', () => {
  it('接受含分类的合法条目', () => {
    expect(() => assertNewsItem(sample)).not.toThrow()
  })

  it('拒绝缺少分类的对象', () => {
    const { categories: _categories, ...rest } = sample
    expect(() => assertNewsItem(rest)).toThrow(/categories/)
  })
})

describe('filterItemsByCategories', () => {
  it('null 表示不过滤', () => {
    expect(filterItemsByCategories([sample], null)).toEqual([sample])
  })

  it('按任一分类命中过滤', () => {
    expect(filterItemsByCategories([sample], ['goods'])).toEqual([])
    expect(filterItemsByCategories([sample], ['live'])).toEqual([sample])
  })
})

describe('parseCategoryList', () => {
  it('解析逗号分隔分类', () => {
    expect(parseCategoryList('live,goods')).toEqual(['live', 'goods'])
  })

  it('空字符串表示全部分类', () => {
    expect(parseCategoryList('')).toBeNull()
  })
})
