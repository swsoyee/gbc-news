import { classifyText } from '../../categories/classify.js'
import type { NewsItem } from '../../models/item.js'
import { fetchText } from '../../utils/http.js'
import { parseNewsDetail } from './parse-detail.js'
import { parseNewsList } from './parse-list.js'
import { listPageUrl } from './urls.js'

export const GBC_SOURCE_ID = 'gbc-news'

export interface ScrapeGbcOptions {
  maxPages?: number
  delayMs?: number
  fetchHtml?: (url: string) => Promise<string>
}

export async function scrapeGbcNews(options: ScrapeGbcOptions = {}): Promise<NewsItem[]> {
  const maxPages = options.maxPages ?? 3
  const delayMs = options.delayMs ?? 400
  const fetchHtml = options.fetchHtml ?? ((url: string) => fetchText(url))

  const listEntries = []
  for (let page = 1; page <= maxPages; page += 1) {
    const html = await fetchHtml(listPageUrl(page))
    listEntries.push(...parseNewsList(html))
    if (page < maxPages && delayMs > 0) await sleep(delayMs)
  }

  const unique = new Map(listEntries.map((entry) => [entry.id, entry]))
  const items: NewsItem[] = []

  for (const entry of unique.values()) {
    const detailHtml = await fetchHtml(entry.url)
    const detail = parseNewsDetail(detailHtml)
    const categories = classifyText(detail.title, detail.bodyText)

    items.push({
      id: entry.id,
      title: detail.title || entry.title,
      url: entry.url,
      publishedAt: detail.publishedAt || entry.publishedAt,
      sourceId: GBC_SOURCE_ID,
      categories,
      summary: detail.summary,
      ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
    })

    if (delayMs > 0) await sleep(delayMs)
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return items
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
