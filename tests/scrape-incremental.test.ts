import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scrapeGbcNews } from '../src/scrapers/gbc-news/index.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../src/scrapers/gbc-news/fixtures')

describe('scrapeGbcNews incremental', () => {
  it('已知 id 时只抓新条目并在边界停页', async () => {
    const page1 = readFileSync(join(fixtures, 'list-page-1.html'), 'utf8')
    const detail = readFileSync(join(fixtures, 'detail-post-487.html'), 'utf8')
    // list-page-1 第一条是 post-487；假装其余都已有
    const knownIds = new Set(
      [
        'post-486',
        'post-485',
        'post-483',
        'post-477',
        'post-482',
        'post-481',
        'post-480',
        'post-479',
        'post-478',
        'post-476',
        'post-475',
      ].filter(Boolean),
    )

    const urls: string[] = []
    const items = await scrapeGbcNews({
      delayMs: 0,
      maxPages: 3,
      knownIds,
      fetchHtml: async (url) => {
        urls.push(url)
        if (url.includes('/news/page/')) throw new Error('should not fetch page 2+')
        if (url.includes('/news/post-')) return detail
        return page1
      },
    })

    expect(items.map((item) => item.id)).toEqual(['post-487'])
    expect(urls.some((url) => url.includes('/page/2'))).toBe(false)
  })
})
