import { describe, expect, it } from 'vitest'
import {
  mergeNewsSnapshots,
  requireExpandableEntries,
  requireNonEmptyMergedItems,
} from '../src/feeds/merge-snapshots.js'
import type { NewsItem } from '../src/models/item.js'

const baseItem: NewsItem = {
  id: 'post-1',
  title: 'Live',
  url: 'https://example.com/1',
  publishedAt: '2026-07-01T00:00:00.000Z',
  sourceId: 'gbc-news',
  categories: ['live'],
  groups: ['togenashi'],
  eventDates: [{ date: '2026-09-06', kind: 'hold' }],
}

describe('mergeNewsSnapshots', () => {
  it('跳过缺失源与空 items，合并有效源', () => {
    const result = mergeNewsSnapshots([
      { label: 'missing.json', snapshot: null },
      { label: 'empty.json', snapshot: { items: [], sourceId: 'empty' } },
      {
        label: 'ok.json',
        snapshot: {
          sourceId: 'gbc-news',
          items: [baseItem, { ...baseItem, id: 'post-2', publishedAt: '2026-07-02T00:00:00.000Z' }],
        },
      },
    ])

    expect(result.warnings).toEqual([
      'missing.json 不存在，跳过该源',
      'empty.json 无有效 items，跳过',
    ])
    expect(result.sources).toEqual(['gbc-news'])
    expect(result.merged.map((item) => item.id)).toEqual(['post-2', 'post-1'])
  })

  it('部分源有效时仍可合并，不全失败', () => {
    const result = mergeNewsSnapshots([
      { label: 'a.json', snapshot: null },
      {
        label: 'b.json',
        snapshot: { sourceId: 'collabo-cafe', items: [baseItem] },
      },
    ])
    expect(result.merged).toHaveLength(1)
    expect(result.sources).toEqual(['collabo-cafe'])
  })
})

describe('empty feed guards', () => {
  it('无合并条目时拒绝构建', () => {
    expect(() => requireNonEmptyMergedItems([])).toThrow(/无可用资讯快照/)
  })

  it('展开后无活动日时拒绝写出空订阅', () => {
    const { eventDates: _omit, ...noDates } = baseItem
    expect(() => requireExpandableEntries([noDates])).toThrow(/展开后无活动日期条目/)
  })

  it('有活动日时返回展开条目', () => {
    const entries = requireExpandableEntries([baseItem])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.occurredOn).toBe('2026-09-06T00:00:00.000Z')
  })
})
