import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyText } from '../src/categories/classify.js'
import { parseNewsDetail } from '../src/scrapers/gbc-news/parse-detail.js'
import { parseNewsList } from '../src/scrapers/gbc-news/parse-list.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../src/scrapers/gbc-news/fixtures')

describe('parseNewsList', () => {
  it('解析第1页列表', () => {
    const html = readFileSync(join(fixtures, 'list-page-1.html'), 'utf8')
    const items = parseNewsList(html)
    expect(items.length).toBe(12)
    expect(items[0]).toMatchObject({
      id: 'post-487',
      url: 'https://girls-band-cry.com/news/post-487.html',
    })
    expect(items[0]?.publishedAt).toBe('2026-07-15T00:00:00.000Z')
  })

  it('解析第2/3页列表', () => {
    for (const page of [2, 3]) {
      const html = readFileSync(join(fixtures, `list-page-${page}.html`), 'utf8')
      expect(parseNewsList(html).length).toBeGreaterThan(0)
    }
  })
})

describe('parseNewsDetail', () => {
  it('解析文章正文', () => {
    const html = readFileSync(join(fixtures, 'detail-post-487.html'), 'utf8')
    const detail = parseNewsDetail(html)
    expect(detail.title).toContain('特典CD')
    expect(detail.publishedAt).toBe('2026-07-15T00:00:00.000Z')
    expect(detail.bodyText.length).toBeGreaterThan(20)
  })
})

describe('classifyText', () => {
  it('Live 文识别为 live', () => {
    expect(
      classifyText('トゲナシトゲアリ“凛音の理” SOUTHEAST ASIA TOUR 2026 チケット発売情報公開！'),
    ).toContain('live')
  })

  it('グッズ文识别为 goods', () => {
    expect(classifyText('夏らしい新グッズ「トゲナシトゲアリ 甚平」が二次元コスパより登場！')).toContain(
      'goods',
    )
  })

  it('无关键词时为 other', () => {
    expect(classifyText('お知らせ')).toEqual(['other'])
  })
})
