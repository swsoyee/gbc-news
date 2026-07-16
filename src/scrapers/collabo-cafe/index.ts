import { classifyCollabo } from '../../categories/classify-collabo.js'
import type { NewsItem } from '../../models/item.js'
import { fetchText } from '../../utils/http.js'
import { extractCollaboEventDates } from './extract-dates.js'
import { parseNewsDetail } from './parse-detail.js'
import { isLastListPage, parseNewsList, type CollaboListEntry } from './parse-list.js'
import { listPageUrl } from './urls.js'

export const COLLABO_SOURCE_ID = 'collabo-cafe'

export interface ScrapeCollaboOptions {
  maxPages?: number
  delayMs?: number
  fetchHtml?: (url: string) => Promise<string>
  knownIds?: ReadonlySet<string>
}

export async function scrapeCollaboCafe(options: ScrapeCollaboOptions = {}): Promise<NewsItem[]> {
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY
  const delayMs = options.delayMs ?? 400
  const fetchHtml = options.fetchHtml ?? ((url: string) => fetchText(url))
  const knownIds = options.knownIds
  const incremental = Boolean(knownIds && knownIds.size > 0)

  const listEntries: CollaboListEntry[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const pageResult = await fetchListPage(page, fetchHtml)
    if (!pageResult) {
      if (page === 1) throw new Error('collabo-cafe 第 1 页无法解析，中止')
      console.log(`[info] collabo-cafe list pagination ended before page=${page}`)
      break
    }

    const { entries: pageEntries, html } = pageResult
    const fresh = incremental
      ? pageEntries.filter((entry) => !knownIds!.has(entry.id))
      : pageEntries
    console.log(
      `[info] collabo-cafe list page=${page} items=${pageEntries.length} fresh=${fresh.length}${incremental ? ' (incremental)' : ''}`,
    )
    listEntries.push(...fresh)

    if (incremental && fresh.length < pageEntries.length) {
      console.log(`[info] collabo-cafe incremental boundary at page=${page}`)
      break
    }
    if (isLastListPage(html, page, pageEntries.length)) {
      console.log(`[info] collabo-cafe last list page=${page}`)
      break
    }
    if (page < maxPages && delayMs > 0) await sleep(delayMs)
  }

  const unique = new Map(listEntries.map((entry) => [entry.id, entry]))
  console.log(`[info] collabo-cafe unique list entries=${unique.size}`)

  const items: NewsItem[] = []
  let index = 0
  for (const entry of unique.values()) {
    index += 1
    try {
      items.push(await hydrateEntry(entry, fetchHtml))
    } catch (error) {
      console.warn(
        `[warn] skip detail ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (index % 25 === 0 || index === unique.size) {
      console.log(`[info] collabo-cafe details ${index}/${unique.size}`)
    }
    if (delayMs > 0) await sleep(delayMs)
  }

  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return items
}

async function hydrateEntry(
  entry: CollaboListEntry,
  fetchHtml: (url: string) => Promise<string>,
): Promise<NewsItem> {
  const detailHtml = await fetchHtml(entry.url)
  const detail = parseNewsDetail(detailHtml)
  const title = detail.title || entry.title
  const publishedAt = detail.publishedAt || entry.publishedAt
  const categories = classifyCollabo(title, detail.bodyText, entry.eventCategories)
  const eventDates = extractCollaboEventDates({
    title,
    bodyText: detail.bodyText,
    publishedAt,
    ccTable: detail.ccTable,
    ...(entry.eventDateText ? { listEventDateText: entry.eventDateText } : {}),
  })
  const imageUrl = detail.imageUrl || entry.imageUrl

  return {
    id: entry.id,
    title,
    url: entry.url,
    publishedAt,
    sourceId: COLLABO_SOURCE_ID,
    categories,
    groups: ['togenashi'],
    ...(eventDates.length > 0 ? { eventDates } : {}),
    summary: detail.summary,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

async function fetchListPage(
  page: number,
  fetchHtml: (url: string) => Promise<string>,
): Promise<{ entries: CollaboListEntry[]; html: string } | null> {
  try {
    const html = await fetchHtml(listPageUrl(page))
    return { entries: parseNewsList(html), html }
  } catch (error) {
    if (page === 1) throw error
    console.warn(
      `[warn] stop at collabo-cafe list page=${page}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
