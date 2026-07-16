import { buildIcal, buildRss } from '../../src/feeds/build.js'
import { parseCategoryList } from '../../src/models/categories.js'
import { assertNewsItem, filterItemsByCategories, type NewsItem } from '../../src/models/item.js'

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

    const filtered = filterItemsByCategories(snapshot.items, categories)
    const label = categories == null ? '全部' : categories.join(',')
    const query = new URLSearchParams()
    query.set('format', format === 'ics' ? 'ics' : 'rss')
    if (categories) query.set('categories', categories.join(','))

    const meta = {
      title: `gbc-news · ${label}`,
      homeUrl: `${origin}/`,
      feedUrl: `${origin}/api/feed?${query.toString()}`,
      description: `ガールズバンドクライ 公式ニュース（${label}）`,
    }

    if (format === 'ics' || format === 'ical') {
      return {
        statusCode: 200,
        headers: {
          'content-type': 'text/calendar; charset=utf-8',
          'content-disposition': 'inline; filename="gbc-news.ics"',
          'cache-control': 'public, max-age=300',
        },
        body: buildIcal(filtered, meta),
      }
    }

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
      body: buildRss(filtered, meta),
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
