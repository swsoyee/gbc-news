import { classifyText } from '../../categories/classify.js'
import { classifyGroupsForSource } from '../../categories/classify-group.js'
import { extractEventDates } from '../../categories/extract-event-dates.js'
import type { NewsItem } from '../../models/item.js'
import { fetchText } from '../../utils/http.js'
import { parseNewsDetail } from './parse.js'
import { parseNewsList, type FirstriffListEntry } from './parse-list.js'
import { listPageUrl } from './urls.js'

export const FIRSTRIFF_SOURCE_ID = 'gbc-firstriff'

export interface ScrapeFirstriffOptions {
  maxPages?: number
  delayMs?: number
  fetchHtml?: (url: string) => Promise<string>
  /** 增量：已有条目 id */
  knownIds?: ReadonlySet<string>
}

export async function scrapeFirstriff(options: ScrapeFirstriffOptions = {}): Promise<NewsItem[]> {
  const maxPages = options.maxPages ?? 1
  const delayMs = options.delayMs ?? 400
  const fetchHtml = options.fetchHtml ?? ((url: string) => fetchText(url))
  const knownIds = options.knownIds
  const incremental = Boolean(knownIds && knownIds.size > 0)

  const listEntries: FirstriffListEntry[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const html = await fetchHtml(listPageUrl(page))
    const pageEntries = parseNewsList(html)
    const fresh = incremental
      ? pageEntries.filter((entry) => !knownIds!.has(entry.id))
      : pageEntries
    console.log(
      `[info] firstriff list page=${page} items=${pageEntries.length} fresh=${fresh.length}${incremental ? ' (incremental)' : ''}`,
    )
    listEntries.push(...fresh)
    if (incremental && fresh.length < pageEntries.length) {
      console.log(`[info] firstriff incremental boundary at page=${page}`)
      break
    }
    if (page < maxPages && delayMs > 0) await sleep(delayMs)
  }

  const unique = new Map(listEntries.map((entry) => [entry.id, entry]))
  const items: NewsItem[] = []

  for (const entry of unique.values()) {
    try {
      const detailHtml = await fetchHtml(entry.url)
      const detail = parseNewsDetail(detailHtml)
      const title = detail.title || entry.title
      const categories = classifyText(title, detail.bodyText)
      const groups = classifyGroupsForSource(FIRSTRIFF_SOURCE_ID, title, detail.bodyText)
      const publishedAt = detail.publishedAt || entry.publishedAt
      const eventDates = extractEventDates(title, detail.bodyText, publishedAt)

      items.push({
        id: entry.id,
        title,
        url: entry.url,
        publishedAt,
        sourceId: FIRSTRIFF_SOURCE_ID,
        categories,
        groups,
        ...(eventDates.length > 0 ? { eventDates } : {}),
        summary: detail.summary,
        bodyText: detail.bodyText,
      })
    } catch (error) {
      console.warn(
        `[warn] skip detail ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (delayMs > 0) await sleep(delayMs)
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return items
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
