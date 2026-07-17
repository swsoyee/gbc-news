import { describe, expect, it } from 'vitest'
import {
  dayGap,
  eventDatesOverlap,
  findDuplicateCandidates,
  titlesSimilar,
} from '../src/feeds/dedupe-candidates.js'
import { applyManualDrops, assertManualDedupeFile } from '../src/feeds/manual-dedupe.js'
import type { NewsItem } from '../src/models/item.js'

function item(
  partial: Pick<NewsItem, 'id' | 'title' | 'publishedAt' | 'sourceId'> &
    Partial<Pick<NewsItem, 'eventDates' | 'categories' | 'groups' | 'url'>>,
): NewsItem {
  return {
    categories: ['goods'],
    groups: ['togenashi'],
    url: `https://example.com/${partial.id}`,
    ...partial,
  }
}

describe('dedupe candidate helpers', () => {
  it('eventDates 区间重叠', () => {
    expect(
      eventDatesOverlap(
        [{ date: '2026-08-07', endDate: '2026-08-16', kind: 'hold' }],
        [{ date: '2026-08-10', kind: 'hold' }],
      ),
    ).toBe(true)
    expect(
      eventDatesOverlap(
        [{ date: '2026-08-07', endDate: '2026-08-16', kind: 'hold' }],
        [{ date: '2026-09-01', kind: 'hold' }],
      ),
    ).toBe(false)
    expect(eventDatesOverlap([{ date: '2026-08-07', kind: 'hold' }], undefined)).toBe(false)
  })

  it('dayGap 计算发布日差', () => {
    expect(dayGap('2026-07-15T00:00:00.000Z', '2026-07-16T12:00:00.000Z')).toBe(1.5)
  })

  it('titlesSimilar 去括号与作品名后包含', () => {
    expect(
      titlesSimilar(
        '【ガールズバンドクライ】タワレコ限定！浴衣グッズ販売まとめ',
        'ガルクラ タワレコ限定！浴衣グッズ販売',
      ),
    ).toBe(true)
  })
})

describe('findDuplicateCandidates', () => {
  it('跨源且日期重叠 → 产出候选，KEEP 为高优先级（不依赖标题/发布时间）', () => {
    const gbc = item({
      id: 'post-1',
      sourceId: 'gbc-news',
      title: 'アニメイトフェア開催決定',
      publishedAt: '2026-03-20T00:00:00.000Z',
      eventDates: [{ date: '2026-07-10', endDate: '2026-07-26', kind: 'hold' }],
    })
    const gp = item({
      id: 'gamepedia-1',
      sourceId: 'gamepedia',
      title: 'Stride! ver. フェア in アニメイト',
      publishedAt: '2026-07-07T00:00:00.000Z',
      eventDates: [{ date: '2026-07-10', endDate: '2026-07-26', kind: 'hold' }],
    })
    const candidates = findDuplicateCandidates([gp, gbc])
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      keepId: 'post-1',
      keepSourceId: 'gbc-news',
      dropId: 'gamepedia-1',
      dropSourceId: 'gamepedia',
    })
    expect(candidates[0]?.overlapDates).toEqual(['2026-07-10..2026-07-26'])
  })

  it('同源不产出候选；日期无重叠不产出', () => {
    const a = item({
      id: 'post-1',
      sourceId: 'gbc-news',
      title: 'A',
      publishedAt: '2026-07-01T00:00:00.000Z',
      eventDates: [{ date: '2026-08-01', kind: 'hold' }],
    })
    const b = item({
      id: 'post-2',
      sourceId: 'gbc-news',
      title: 'B',
      publishedAt: '2026-07-02T00:00:00.000Z',
      eventDates: [{ date: '2026-08-01', kind: 'hold' }],
    })
    const c = item({
      id: 'gamepedia-1',
      sourceId: 'gamepedia',
      title: 'C',
      publishedAt: '2026-07-02T00:00:00.000Z',
      eventDates: [{ date: '2026-09-01', kind: 'hold' }],
    })
    expect(findDuplicateCandidates([a, b, c])).toHaveLength(0)
  })

  it('标题相近的候选排在前', () => {
    const near1 = item({
      id: 'post-1',
      sourceId: 'gbc-news',
      title: 'タワレコ限定！浴衣グッズ販売',
      publishedAt: '2026-07-15T00:00:00.000Z',
      eventDates: [{ date: '2026-08-07', endDate: '2026-08-16', kind: 'hold' }],
    })
    const near2 = item({
      id: 'gamepedia-1',
      sourceId: 'gamepedia',
      title: '【ガールズバンドクライ】タワレコ限定！浴衣グッズ販売まとめ',
      publishedAt: '2026-07-16T00:00:00.000Z',
      eventDates: [{ date: '2026-08-07', endDate: '2026-08-16', kind: 'hold' }],
    })
    const far = item({
      id: 'collabo-1',
      sourceId: 'collabo-cafe',
      title: '全然違う商品の話',
      publishedAt: '2026-07-16T00:00:00.000Z',
      eventDates: [{ date: '2026-08-10', kind: 'hold' }],
    })
    const candidates = findDuplicateCandidates([near1, near2, far])
    expect(candidates[0]?.titleSimilar).toBe(true)
  })
})

describe('applyManualDrops', () => {
  it('按名单剔除条目', () => {
    const items = [
      item({
        id: 'post-1',
        sourceId: 'gbc-news',
        title: 'A',
        publishedAt: '2026-07-01T00:00:00.000Z',
      }),
      item({
        id: 'gamepedia-1',
        sourceId: 'gamepedia',
        title: 'B',
        publishedAt: '2026-07-02T00:00:00.000Z',
      }),
    ].map(({ bodyText: _b, ...rest }) => rest)
    const {
      items: kept,
      dropped,
      warnings,
    } = applyManualDrops(items, {
      updatedAt: '2026-07-17T00:00:00.000Z',
      drops: [{ id: 'gamepedia-1', keptId: 'post-1', reason: '同一活动' }],
    })
    expect(kept.map((i) => i.id)).toEqual(['post-1'])
    expect(dropped).toHaveLength(1)
    expect(warnings).toHaveLength(0)
  })

  it('名单 id 未命中 → 警告', () => {
    const items = [
      item({
        id: 'post-1',
        sourceId: 'gbc-news',
        title: 'A',
        publishedAt: '2026-07-01T00:00:00.000Z',
      }),
    ].map(({ bodyText: _b, ...rest }) => rest)
    const { warnings } = applyManualDrops(items, {
      updatedAt: '2026-07-17T00:00:00.000Z',
      drops: [{ id: 'missing-1' }],
    })
    expect(warnings).toHaveLength(1)
  })
})

describe('assertManualDedupeFile', () => {
  it('接受合法文件', () => {
    expect(() =>
      assertManualDedupeFile({
        updatedAt: '2026-07-17T00:00:00.000Z',
        drops: [{ id: 'x', keptId: 'y', reason: 'z' }],
      }),
    ).not.toThrow()
  })

  it('拒绝重复 id 与非法时间', () => {
    expect(() =>
      assertManualDedupeFile({
        updatedAt: '2026-07-17T00:00:00.000Z',
        drops: [{ id: 'x' }, { id: 'x' }],
      }),
    ).toThrow(/Duplicate/)
    expect(() => assertManualDedupeFile({ updatedAt: 'nope', drops: [] })).toThrow(/ISO/)
  })
})
