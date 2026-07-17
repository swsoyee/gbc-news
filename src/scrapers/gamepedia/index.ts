import { classifyText } from '../../categories/classify.js'
import type { CategoryId } from '../../models/categories.js'
import type { NewsItem } from '../../models/item.js'
import { fetchText } from '../../utils/http.js'
import { extractGamepediaEventDates } from './extract-dates.js'
import { parseNewsDetail } from './parse-detail.js'
import { isLastListPage, parseNewsList, type GamepediaListEntry } from './parse-list.js'
import { listPageUrl } from './urls.js'

export const GAMEPEDIA_SOURCE_ID = 'gamepedia'

export interface ScrapeGamepediaOptions {
  maxPages?: number
  delayMs?: number
  fetchHtml?: (url: string) => Promise<string>
  knownIds?: ReadonlySet<string>
}

export async function scrapeGamepedia(options: ScrapeGamepediaOptions = {}): Promise<NewsItem[]> {
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY
  const delayMs = options.delayMs ?? 400
  const fetchHtml = options.fetchHtml ?? ((url: string) => fetchText(url))
  const knownIds = options.knownIds
  const incremental = Boolean(knownIds && knownIds.size > 0)

  const listEntries: GamepediaListEntry[] = []
  for (let page = 1; page <= maxPages; page += 1) {
    const pageResult = await fetchListPage(page, fetchHtml)
    if (!pageResult) {
      if (page === 1) throw new Error('gamepedia 第 1 页无法解析，中止')
      console.log(`[info] gamepedia list pagination ended before page=${page}`)
      break
    }

    const { entries: pageEntries, html } = pageResult
    const fresh = incremental
      ? pageEntries.filter((entry) => !knownIds!.has(entry.id))
      : pageEntries
    console.log(
      `[info] gamepedia list page=${page} items=${pageEntries.length} fresh=${fresh.length}${incremental ? ' (incremental)' : ''}`,
    )
    listEntries.push(...fresh)

    if (incremental && fresh.length < pageEntries.length) {
      console.log(`[info] gamepedia incremental boundary at page=${page}`)
      break
    }
    if (isLastListPage(html, page, pageEntries.length)) {
      console.log(`[info] gamepedia last list page=${page}`)
      break
    }
    if (page < maxPages && delayMs > 0) await sleep(delayMs)
  }

  const unique = new Map(listEntries.map((entry) => [entry.id, entry]))
  console.log(`[info] gamepedia unique list entries=${unique.size}`)

  const items: NewsItem[] = []
  let skippedNoDates = 0
  let index = 0
  for (const entry of unique.values()) {
    index += 1
    try {
      const item = await hydrateEntry(entry, fetchHtml)
      if (!item) {
        skippedNoDates += 1
      } else {
        items.push(item)
      }
    } catch (error) {
      console.warn(
        `[warn] skip detail ${entry.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (index % 25 === 0 || index === unique.size) {
      console.log(`[info] gamepedia details ${index}/${unique.size}`)
    }
    if (delayMs > 0) await sleep(delayMs)
  }

  console.log(`[info] gamepedia skippedNoDates=${skippedNoDates}`)
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return items
}

/** 默认 goods；命中 event 关键词时可兼带 event。 */
export function classifyGamepedia(title: string, body = ''): CategoryId[] {
  const matched = new Set(classifyText(title, body))
  const categories = new Set<CategoryId>(['goods'])
  if (matched.has('event')) categories.add('event')
  return [...categories]
}

async function hydrateEntry(
  entry: GamepediaListEntry,
  fetchHtml: (url: string) => Promise<string>,
): Promise<NewsItem | null> {
  const detailHtml = await fetchHtml(entry.url)
  const detail = parseNewsDetail(detailHtml)
  const title = detail.title || entry.title
  const publishedAt = detail.publishedAt
  const eventDates = extractGamepediaEventDates({
    title,
    bodyText: detail.bodyText,
    publishedAt,
  })
  if (eventDates.length === 0) {
    console.warn(`[warn] skip no eventDates ${entry.id}`)
    return null
  }

  const categories = classifyGamepedia(title, detail.bodyText)
  const imageUrl = detail.imageUrl || entry.imageUrl

  return {
    id: entry.id,
    title,
    url: entry.url,
    publishedAt,
    sourceId: GAMEPEDIA_SOURCE_ID,
    categories,
    groups: ['togenashi'],
    eventDates,
    summary: detail.summary,
    bodyText: detail.bodyText,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

async function fetchListPage(
  page: number,
  fetchHtml: (url: string) => Promise<string>,
): Promise<{ entries: GamepediaListEntry[]; html: string } | null> {
  try {
    const html = await fetchHtml(listPageUrl(page))
    return { entries: parseNewsList(html), html }
  } catch (error) {
    if (page === 1) throw error
    console.warn(
      `[warn] stop at gamepedia list page=${page}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
