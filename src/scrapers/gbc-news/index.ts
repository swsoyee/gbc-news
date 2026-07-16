import { classifyText } from '../../categories/classify.js'
import { classifyGroupsForSource } from '../../categories/classify-group.js'
import { extractEventDates } from '../../categories/extract-event-dates.js'
import type { NewsItem } from '../../models/item.js'
import { fetchText } from '../../utils/http.js'
import { parseNewsDetail } from './parse-detail.js'
import { parseNewsList, type GbcListEntry } from './parse-list.js'
import { listPageUrl } from './urls.js'

export const GBC_SOURCE_ID = 'gbc-news'

export interface ScrapeGbcOptions {
  /**
   * 最多抓取列表页数。
   * - 未设 / `Infinity`：自动翻到无更多条目
   * - 正整数：上限（测试 / 增量保护）
   */
  maxPages?: number
  delayMs?: number
  fetchHtml?: (url: string) => Promise<string>
  /**
   * 增量：已有条目 id。列表按新→旧；本页出现已知稿后停止，且只抓未知条目详情。
   */
  knownIds?: ReadonlySet<string>
}

export async function scrapeGbcNews(options: ScrapeGbcOptions = {}): Promise<NewsItem[]> {
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY
  const delayMs = options.delayMs ?? 400
  const fetchHtml = options.fetchHtml ?? ((url: string) => fetchText(url))
  const knownIds = options.knownIds
  const incremental = Boolean(knownIds && knownIds.size > 0)

  const listEntries: GbcListEntry[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const pageEntries = await fetchListPage(page, fetchHtml)
    if (!pageEntries) {
      if (page === 1) throw new Error('gbc-news 第 1 页无法解析，中止')
      console.log(`[info] list pagination ended before page=${page}`)
      break
    }

    const fresh = incremental
      ? pageEntries.filter((entry) => !knownIds!.has(entry.id))
      : pageEntries
    console.log(
      `[info] list page=${page} items=${pageEntries.length} fresh=${fresh.length}${incremental ? ' (incremental)' : ''}`,
    )
    listEntries.push(...fresh)

    if (incremental && fresh.length < pageEntries.length) {
      console.log(`[info] incremental boundary at page=${page}`)
      break
    }
    if (page < maxPages && delayMs > 0) await sleep(delayMs)
  }

  const unique = new Map(listEntries.map((entry) => [entry.id, entry]))
  console.log(`[info] unique list entries=${unique.size}`)
  return hydrateEntries([...unique.values()], {
    sourceId: GBC_SOURCE_ID,
    delayMs,
    fetchHtml,
  })
}

export async function hydrateEntries(
  entries: GbcListEntry[],
  options: {
    sourceId: string
    delayMs: number
    fetchHtml: (url: string) => Promise<string>
  },
): Promise<NewsItem[]> {
  const items: NewsItem[] = []
  let index = 0

  for (const entry of entries) {
    index += 1
    try {
      const detailHtml = await options.fetchHtml(entry.url)
      const detail = parseNewsDetail(detailHtml)
      const title = detail.title || entry.title
      const categories = classifyText(title, detail.bodyText)
      const groups = classifyGroupsForSource(options.sourceId, title, detail.bodyText)
      const publishedAt = detail.publishedAt || entry.publishedAt
      const eventDates = extractEventDates(title, detail.bodyText, publishedAt)

      items.push({
        id: entry.id,
        title,
        url: entry.url,
        publishedAt,
        sourceId: options.sourceId,
        categories,
        groups,
        ...(eventDates.length > 0 ? { eventDates } : {}),
        summary: detail.summary,
        ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
      })
    } catch (error) {
      console.warn(
        `[warn] skip detail ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (index % 25 === 0 || index === entries.length) {
      console.log(`[info] details ${index}/${entries.length}`)
    }
    if (options.delayMs > 0) await sleep(options.delayMs)
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return items
}

async function fetchListPage(
  page: number,
  fetchHtml: (url: string) => Promise<string>,
): Promise<GbcListEntry[] | null> {
  try {
    const html = await fetchHtml(listPageUrl(page))
    return parseNewsList(html)
  } catch (error) {
    if (page === 1) throw error
    console.warn(
      `[warn] stop at list page=${page}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
