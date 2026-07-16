import { absoluteUrl, parseFirstriffDate, postIdFromUrl } from './urls.js'

export interface FirstriffListEntry {
  id: string
  title: string
  url: string
  publishedAt: string
}

/** 解析 First Riff 新闻列表页（ul.p-news-articles__list）。 */
export function parseNewsList(html: string): FirstriffListEntry[] {
  const listMatch = /<ul class="p-news-articles__list">([\s\S]*?)<\/ul>/i.exec(html)
  const listHtml = listMatch?.[1]
  if (!listHtml) {
    throw new Error('p-news-articles__list not found')
  }

  const items: FirstriffListEntry[] = []
  const itemRegex =
    /<li class="c-news-item">\s*<a[^>]+href="([^"]+)"[^>]*>\s*<span class="c-news-item__date">([^<]+)<\/span>\s*<span class="c-news-item__title">([\s\S]*?)<\/span>\s*<\/a>\s*<\/li>/gi

  for (const match of listHtml.matchAll(itemRegex)) {
    const href = match[1]?.trim()
    const dateRaw = match[2]?.trim()
    const title = decodeHtml(stripTags(match[3] ?? '')).trim()
    if (!href || !dateRaw || !title) continue

    const url = absoluteUrl(href)
    items.push({
      id: postIdFromUrl(url),
      title,
      url,
      publishedAt: parseFirstriffDate(dateRaw),
    })
  }

  if (items.length === 0) {
    throw new Error('No news items parsed from firstriff list page')
  }

  return items
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
}
