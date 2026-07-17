import { buildIcal, buildRss } from './build.js'
import { expandEventDates } from './expand.js'
import { parseCategoryList } from '../models/categories.js'
import { parseGroupList } from '../models/groups.js'
import { assertNewsItem, filterItems, type NewsItem } from '../models/item.js'

export interface FeedHttpResult {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export interface CreateDynamicFeedInput {
  origin: string
  format?: string | undefined
  categories?: string | undefined
  groups?: string | undefined
  items: NewsItem[]
}

export function jsonError(statusCode: number, message: string): FeedHttpResult {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: message }),
  }
}

/** 已加载的 news 快照 → RSS/iCal HTTP 响应（不含网络 IO）。 */
export function createDynamicFeed(input: CreateDynamicFeedInput): FeedHttpResult {
  const format = (input.format ?? 'rss').toLowerCase()
  const categories = parseCategoryList(input.categories)
  const groups = parseGroupList(input.groups)

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return jsonError(503, 'news dataset is empty')
  }
  for (const item of input.items) assertNewsItem(item)

  const filtered = filterItems(input.items, { groups, categories })
  const entries = expandEventDates(filtered)
  const isIcs = format === 'ics' || format === 'ical'

  const groupLabel = groups == null ? '全部组合' : groups.join(',')
  const categoryLabel = categories == null ? '全部分类' : categories.join(',')
  const label = `${groupLabel} · ${categoryLabel}`
  const query = new URLSearchParams()
  query.set('format', isIcs ? 'ics' : 'rss')
  if (groups) query.set('groups', groups.join(','))
  if (categories) query.set('categories', categories.join(','))

  const meta = {
    title: `gbc-news · ${label}`,
    homeUrl: `${input.origin}/`,
    feedUrl: `${input.origin}/api/feed?${query.toString()}`,
    description: isIcs
      ? `ガールズバンドクライ イベント（${label}）`
      : `ガールズバンドクライ 公式ニュース（${label}）`,
  }

  if (isIcs) {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'inline; filename="gbc-news.ics"',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
      body: buildIcal(entries, meta),
    }
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
    body: buildRss(entries, meta),
  }
}
