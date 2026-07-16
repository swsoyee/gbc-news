import { describe, expect, it } from 'vitest'
import { parseCategoryList } from '../src/models/categories.js'
import { parseGroupList } from '../src/models/groups.js'
import { assertNewsItem, filterItems, type NewsItem } from '../src/models/item.js'

const sample: NewsItem = {
  id: 'post-1',
  title: '示例 Live',
  url: 'https://example.com/news/post-1',
  publishedAt: '2026-07-16T00:00:00.000Z',
  sourceId: 'gbc-news',
  categories: ['live', 'event'],
  groups: ['togenashi'],
  summary: '摘要',
}

describe('NewsItem', () => {
  it('接受含 groups/categories 的合法条目', () => {
    expect(() => assertNewsItem(sample)).not.toThrow()
  })

  it('拒绝缺少 groups 的对象', () => {
    const { groups: _groups, ...rest } = sample
    expect(() => assertNewsItem(rest)).toThrow(/groups/)
  })

  it('拒绝缺少分类的对象', () => {
    const { categories: _categories, ...rest } = sample
    expect(() => assertNewsItem(rest)).toThrow(/categories/)
  })

  it('接受带 kind 的 eventDates', () => {
    expect(() =>
      assertNewsItem({
        ...sample,
        eventDates: [
          { date: '2026-08-14', kind: 'hold' },
          { date: '2026-06-26', kind: 'sale' },
        ],
      }),
    ).not.toThrow()
  })
})

describe('filterItems', () => {
  const items: NewsItem[] = [
    sample,
    {
      ...sample,
      id: 'firstriff-post-5',
      sourceId: 'gbc-firstriff',
      groups: ['canna-lily'],
      categories: ['live'],
    },
    {
      ...sample,
      id: 'firstriff-post-3',
      sourceId: 'gbc-firstriff',
      groups: ['f272'],
      categories: ['goods', 'live'],
    },
  ]

  it('null 表示该维不过滤', () => {
    expect(filterItems(items, {})).toEqual(items)
  })

  it('维内 OR：任一组合命中', () => {
    expect(filterItems(items, { groups: ['f272', 'canna-lily'] }).map((i) => i.id)).toEqual([
      'firstriff-post-5',
      'firstriff-post-3',
    ])
  })

  it('维间 AND：组合与分类同时满足', () => {
    expect(
      filterItems(items, { groups: ['f272', 'canna-lily'], categories: ['goods'] }).map(
        (i) => i.id,
      ),
    ).toEqual(['firstriff-post-3'])
  })

  it('空数组无匹配', () => {
    expect(filterItems(items, { groups: [] })).toEqual([])
    expect(filterItems(items, { categories: [] })).toEqual([])
  })
})

describe('parse lists', () => {
  it('解析逗号分隔分类与组合', () => {
    expect(parseCategoryList('live,goods')).toEqual(['live', 'goods'])
    expect(parseGroupList('togenashi,f272')).toEqual(['togenashi', 'f272'])
  })

  it('空字符串表示不过滤', () => {
    expect(parseCategoryList('')).toBeNull()
    expect(parseGroupList('')).toBeNull()
  })
})
