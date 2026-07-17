import { describe, expect, it } from 'vitest'
import {
  applyEnrichments,
  assertEnrichmentFile,
  contentFingerprint,
  type EnrichmentFile,
} from '../src/models/enrichment.js'
import type { NewsItem } from '../src/models/item.js'

const item: NewsItem = {
  id: 'post-1',
  sourceId: 'gbc-news',
  title: 'ライブ開催',
  bodyText: '2026年9月6日に開催します。',
  summary: '日本語要約',
  url: 'https://example.com/post-1',
  publishedAt: '2026-07-01T00:00:00.000Z',
  categories: ['live'],
  groups: ['togenashi'],
  eventDates: [{ date: '2026-09-05', kind: 'hold' }],
}

function reviewedFile(overrides: Partial<EnrichmentFile['items'][string]> = {}): EnrichmentFile {
  return {
    sourceId: 'gbc-news',
    updatedAt: '2026-07-17T10:46:00.000Z',
    items: {
      'post-1': {
        id: 'post-1',
        sourceId: 'gbc-news',
        status: 'reviewed',
        contentFingerprint: contentFingerprint(item),
        reviewedAt: '2026-07-17T10:46:00.000Z',
        titleZh: '演出举办',
        summaryZh: '将于 2026 年 9 月 6 日举办。',
        eventDates: [{ date: '2026-09-06', kind: 'hold' }],
        ...overrides,
      },
    },
  }
}

describe('enrichment contract', () => {
  it('校验 reviewed/pending/skip 及条件必填字段', () => {
    expect(() => assertEnrichmentFile(reviewedFile())).not.toThrow()
    expect(() =>
      assertEnrichmentFile({
        ...reviewedFile(),
        items: {
          'post-1': {
            ...reviewedFile().items['post-1'],
            titleZh: undefined,
          },
        },
      }),
    ).toThrow(/titleZh/)
    expect(() =>
      assertEnrichmentFile({
        ...reviewedFile(),
        items: {
          'post-1': {
            id: 'post-1',
            sourceId: 'gbc-news',
            status: 'skip',
            contentFingerprint: contentFingerprint(item),
          },
        },
      }),
    ).toThrow(/reviewedAt/)
  })

  it('fingerprint 规范化空白且正文变化会失效', () => {
    expect(contentFingerprint(item)).toBe(
      contentFingerprint({ title: ' ライブ開催 ', bodyText: '2026年9月6日に開催します。\n' }),
    )
    expect(contentFingerprint({ ...item, bodyText: `${item.bodyText}更新` })).not.toBe(
      contentFingerprint(item),
    )
  })

  it('仅应用当前 reviewed，覆盖日期并排除 bodyText', () => {
    const result = applyEnrichments([item], new Map([['gbc-news', reviewedFile()]]))
    expect(result[0]).toMatchObject({
      title: 'ライブ開催',
      titleZh: '演出举办',
      summaryZh: '将于 2026 年 9 月 6 日举办。',
      eventDates: [{ date: '2026-09-06', kind: 'hold' }],
    })
    expect(result[0]).not.toHaveProperty('bodyText')

    const cleared = applyEnrichments(
      [item],
      new Map([['gbc-news', reviewedFile({ eventDates: [] })]]),
    )
    expect(cleared[0]?.eventDates).toEqual([])
  })

  it('stale enrichment 回退日文与规则日期', () => {
    const stale = reviewedFile({ contentFingerprint: '0'.repeat(64) })
    const result = applyEnrichments([item], new Map([['gbc-news', stale]]))
    expect(result[0]).not.toHaveProperty('titleZh')
    expect(result[0]?.eventDates).toEqual(item.eventDates)
  })
})
