import { decodeHtml, stripTags } from '../../utils/html.js'
import { absoluteUrl, parseGbcDate, postIdFromUrl } from './urls.js'

export interface GbcListEntry {
  id: string
  title: string
  url: string
  publishedAt: string
  imageUrl?: string
}

/** 解析新闻列表页，提取 ul.news-List 中的条目。 */
export function parseNewsList(html: string): GbcListEntry[] {
  const listMatch = /<ul class="news-List">([\s\S]*?)<\/ul>/i.exec(html)
  const listHtml = listMatch?.[1]
  if (!listHtml) {
    throw new Error('news-List not found')
  }

  const items: GbcListEntry[] = []
  const itemRegex =
    /<li class="item">\s*<a href="([^"]+)"[^>]*>[\s\S]*?<div class="ttl">([\s\S]*?)<\/div>\s*<time class="time[^"]*">([\s\S]*?)<\/time>/gi

  for (const match of listHtml.matchAll(itemRegex)) {
    const href = match[1]?.trim()
    const title = decodeHtml(stripTags(match[2] ?? '')).trim()
    const dateRaw = decodeHtml(stripTags(match[3] ?? '')).trim()
    if (!href || !title || !dateRaw) continue

    try {
      const url = absoluteUrl(href)
      const imageMatch = /<img[^>]+src="([^"]+)"/i.exec(match[0])
      const imageUrl = imageMatch?.[1] ? absoluteUrl(imageMatch[1]) : undefined

      items.push({
        id: postIdFromUrl(url),
        title,
        url,
        publishedAt: parseGbcDate(dateRaw),
        ...(imageUrl ? { imageUrl } : {}),
      })
    } catch (error) {
      console.warn(
        `[warn] skip list item href=${href}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (items.length === 0) {
    throw new Error('No news items parsed from list page')
  }

  return items
}
