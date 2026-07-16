import { buildIcal, buildRss } from '../../src/feeds/build.js'
import { expandEventDates } from '../../src/feeds/expand.js'
import { parseCategoryList } from '../../src/models/categories.js'
import { parseGroupList } from '../../src/models/groups.js'
import { assertNewsItem, filterItems, type NewsItem } from '../../src/models/item.js'

interface Snapshot {
  items: NewsItem[]
}

export async function handler(event: {
  rawQuery?: string
  queryStringParameters?: Record<string, string | undefined> | null
  headers?: Record<string, string | undefined>
}): Promise<{
  statusCode: number
  headers: Record<string, string>
  body: string
}> {
  try {
    const params = event.queryStringParameters ?? {}
    const format = (params.format ?? 'rss').toLowerCase()
    const categories = parseCategoryList(params.categories)
    const groups = parseGroupList(params.groups)

    const host = event.headers?.host ?? 'localhost'
    const proto = event.headers?.['x-forwarded-proto'] ?? 'https'
    const origin = `${proto}://${host}`
    const response = await fetch(`${origin}/data/news.json`)
    if (!response.ok) {
      return jsonError(502, `Failed to load news.json: HTTP ${response.status}`)
    }

    const snapshot = (await response.json()) as Snapshot
    if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
      return jsonError(503, 'news dataset is empty')
    }
    for (const item of snapshot.items) assertNewsItem(item)

    const filtered = filterItems(snapshot.items, { groups, categories })
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
      homeUrl: `${origin}/`,
      feedUrl: `${origin}/api/feed?${query.toString()}`,
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
          'cache-control': 'public, max-age=300',
        },
        body: buildIcal(entries, meta),
      }
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
      body: buildRss(entries, meta),
    }
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'unknown error')
  }
}

function jsonError(statusCode: number, message: string) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: message }),
  }
}
