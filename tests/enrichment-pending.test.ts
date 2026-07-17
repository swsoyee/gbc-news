import { describe, expect, it } from 'vitest'
import { listPendingItems, parsePendingCliArgs } from '../src/enrichments/pending.js'
import { contentFingerprint, type EnrichmentFile } from '../src/models/enrichment.js'
import type { NewsItem } from '../src/models/item.js'

function item(id: string, overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id,
    sourceId: 'gbc-news',
    title: id,
    bodyText: '通常のお知らせ',
    url: `https://example.com/${id}`,
    publishedAt: '2026-07-01T00:00:00.000Z',
    categories: ['other'],
    groups: ['togenashi'],
    ...overrides,
  }
}

describe('pending enrichment queue', () => {
  it('按 stale、有日期、疑似活动、其余排序，并排除有效 reviewed/skip', () => {
    const stale = item('stale')
    const dated = item('dated', { eventDates: [{ date: '2026-09-01', kind: 'hold' }] })
    const likely = item('likely', { title: 'ライブ開催決定' })
    const normal = item('normal')
    const reviewed = item('reviewed')
    const skipped = item('skipped')
    const drafting = item('drafting', { eventDates: [{ date: '2026-10-01', kind: 'sale' }] })
    const { bodyText: _omitBody, ...noBodyBase } = item('nobody', { categories: ['media'] })
    const noBody: NewsItem = noBodyBase
    const file: EnrichmentFile = {
      sourceId: 'gbc-news',
      updatedAt: '2026-07-17T10:46:00.000Z',
      items: {
        stale: {
          id: 'stale',
          sourceId: 'gbc-news',
          status: 'reviewed',
          contentFingerprint: '0'.repeat(64),
          reviewedAt: '2026-07-17T10:46:00.000Z',
          titleZh: '旧标题',
          summaryZh: '旧摘要',
        },
        reviewed: {
          id: 'reviewed',
          sourceId: 'gbc-news',
          status: 'reviewed',
          contentFingerprint: contentFingerprint(reviewed),
          reviewedAt: '2026-07-17T10:46:00.000Z',
          titleZh: '标题',
          summaryZh: '摘要',
        },
        skipped: {
          id: 'skipped',
          sourceId: 'gbc-news',
          status: 'skip',
          contentFingerprint: contentFingerprint(skipped),
          reviewedAt: '2026-07-17T10:46:00.000Z',
        },
        drafting: {
          id: 'drafting',
          sourceId: 'gbc-news',
          status: 'pending',
          contentFingerprint: contentFingerprint(drafting),
        },
      },
    }
    const pending = listPendingItems(
      [normal, likely, reviewed, dated, stale, skipped, drafting, noBody],
      new Map([['gbc-news', file]]),
    )
    expect(pending.map((entry) => [entry.item.id, entry.priority, entry.reason])).toEqual([
      ['stale', 0, 'stale'],
      ['dated', 1, 'has-event-dates'],
      ['drafting', 1, 'has-event-dates'],
      ['likely', 2, 'likely-event'],
      ['nobody', 3, 'unreviewed'],
      ['normal', 3, 'unreviewed'],
    ])
    expect(pending.find((entry) => entry.item.id === 'nobody')?.contentFingerprint).toBe(
      contentFingerprint(noBody),
    )
  })

  it('解析 source/limit/json 参数并拒绝非法值', () => {
    expect(parsePendingCliArgs(['--source', 'collabo-cafe', '--limit', '5', '--json'])).toEqual({
      source: 'collabo-cafe',
      limit: 5,
      json: true,
    })
    expect(() => parsePendingCliArgs(['--limit', '0'])).toThrow(/limit/)
  })
})
