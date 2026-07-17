import { createDynamicFeed, jsonError } from '../../src/feeds/dynamic-feed.js'
import type { ExpandableNewsItem } from '../../src/feeds/expand.js'

interface Snapshot {
  items: ExpandableNewsItem[]
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
    const host = event.headers?.host ?? 'localhost'
    const proto = event.headers?.['x-forwarded-proto'] ?? 'https'
    const origin = `${proto}://${host}`

    const response = await fetch(`${origin}/data/news.json`)
    if (!response.ok) {
      return jsonError(502, `Failed to load news.json: HTTP ${response.status}`)
    }

    const snapshot = (await response.json()) as Snapshot
    if (!Array.isArray(snapshot.items)) {
      return jsonError(503, 'news dataset is empty')
    }

    return createDynamicFeed({
      origin,
      format: params.format,
      categories: params.categories,
      groups: params.groups,
      items: snapshot.items,
    })
  } catch (error) {
    return jsonError(500, error instanceof Error ? error.message : 'unknown error')
  }
}
