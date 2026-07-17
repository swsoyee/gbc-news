import { decodeHtml, stripTags } from '../../utils/html.js'
import { absoluteUrl, itemIdFromUrl } from './urls.js'

export interface GamepediaListEntry {
  id: string
  title: string
  url: string
  imageUrl?: string
}

/**
 * 解析 キャラホビ 搜索列表页：仅取「サイト内の検索結果」中的 `/hobby/archives/<id>` 文章，
 * 忽略商品/奖品侧栏。
 */
export function parseNewsList(html: string): GamepediaListEntry[] {
  const block = extractSiteSearchBlock(html)
  const items: GamepediaListEntry[] = []
  const seen = new Set<string>()

  const itemRegex =
    /<li>\s*<a\s+href="(https?:\/\/premium\.gamepedia\.jp\/hobby\/archives\/\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi

  for (const match of block.matchAll(itemRegex)) {
    const href = match[1]?.trim()
    const body = match[2] ?? ''
    if (!href) continue

    const titleMatch = /class="media-heading"[^>]*>([\s\S]*?)(?:<img|<\/div>)/i.exec(body)
    const title = decodeHtml(stripTags(titleMatch?.[1] ?? '')).trim()
    if (!title) continue

    const url = absoluteUrl(href)
    const id = itemIdFromUrl(url)
    if (seen.has(id)) continue
    seen.add(id)

    const imageMatch = /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(body)
    const imageUrl = imageMatch?.[1]?.trim()

    items.push({
      id,
      title,
      url,
      ...(imageUrl ? { imageUrl } : {}),
    })
  }

  if (items.length === 0) {
    throw new Error('No news items parsed from gamepedia list page')
  }

  return items
}

/** 末页：无更大 page/N，或当页不足一页容量（搜索列表约 10 条）。 */
export function isLastListPage(html: string, page: number, itemCount: number): boolean {
  if (itemCount < 10) return true
  const pageNums = [...html.matchAll(/\/hobby\/page\/(\d+)/g)].map((m) => Number(m[1]))
  if (pageNums.length === 0) return page <= 1
  return Math.max(...pageNums) <= page
}

function extractSiteSearchBlock(html: string): string {
  const start =
    html.search(/「キャラホビ」サイト内の検索結果/) >= 0
      ? html.search(/「キャラホビ」サイト内の検索結果/)
      : html.search(/サイト内の検索結果/)
  if (start < 0) {
    // 夹具可能已裁成仅搜索块
    return html
  }
  const from = html.slice(start)
  const end = from.search(/<ul class="gg-pagination"/i)
  return end >= 0 ? from.slice(0, end) : from.slice(0, 50_000)
}
