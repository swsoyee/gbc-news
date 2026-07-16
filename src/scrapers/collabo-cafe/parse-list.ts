import { absoluteUrl, itemIdFromUrl, parseListDate } from './urls.js'

export interface CollaboListEntry {
  id: string
  title: string
  url: string
  publishedAt: string
  /** `span.event-date` 原文，如 `期間 : …` / `～…まで予約受付` */
  eventDateText?: string
  imageUrl?: string
  /** article class 上的 `event-category-*`（不含前缀） */
  eventCategories: string[]
}

/** 解析 collabo-cafe 搜索列表页（article.post-list）。 */
export function parseNewsList(html: string): CollaboListEntry[] {
  const items: CollaboListEntry[] = []
  const articleRegex = /<article\s+class="([^"]*post-list[^"]*)"[^>]*>([\s\S]*?)<\/article>/gi

  for (const match of html.matchAll(articleRegex)) {
    const classAttr = match[1] ?? ''
    const body = match[2] ?? ''
    const hrefMatch =
      /<a\s+[^>]*href="(https?:\/\/collabo-cafe\.com\/events\/collabo\/[^"]+)"/i.exec(body)
    const href = hrefMatch?.[1]?.trim()
    if (!href) continue

    const titleMatch =
      /<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(body) ??
      /title="([^"]+)"/i.exec(body)
    const title = decodeHtml(stripTags(titleMatch?.[1] ?? '')).trim()
    if (!title) continue
    const eventCategories = extractEventCategories(classAttr)
    if (!isGirlsBandCryArticle(title, href, eventCategories)) continue

    const dateMatch = /<span[^>]*class="[^"]*\bupdated\b[^"]*"[^>]*>([^<]+)<\/span>/i.exec(body)
    const dateRaw = dateMatch?.[1]?.trim()
    if (!dateRaw) continue

    const eventDateMatch = /<span[^>]*class="[^"]*event-date[^"]*"[^>]*>([^<]+)<\/span>/i.exec(body)
    const eventDateText = eventDateMatch?.[1]?.trim()

    const imageMatch =
      /<img[^>]+data-src="([^"]+)"/i.exec(body) ?? /<img[^>]+src="(https?:\/\/[^"]+)"/i.exec(body)
    const imageRaw = imageMatch?.[1]?.trim()
    const imageUrl = imageRaw && !imageRaw.includes('dummy.png') ? absoluteUrl(imageRaw) : undefined

    const url = absoluteUrl(href)
    items.push({
      id: itemIdFromUrl(url),
      title,
      url,
      publishedAt: parseListDate(dateRaw),
      ...(eventDateText ? { eventDateText } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      eventCategories,
    })
  }

  if (items.length === 0) {
    throw new Error('No news items parsed from collabo-cafe list page')
  }

  return items
}

/** 末页判定：当页不足一页容量，或 HTML 中无更大 page/N 链接。 */
export function isLastListPage(html: string, page: number, itemCount: number): boolean {
  if (itemCount < 16) return true
  const pageNums = [...html.matchAll(/\/page\/(\d+)\//g)].map((m) => Number(m[1]))
  if (pageNums.length === 0) return page <= 1
  return Math.max(...pageNums) <= page
}

function extractEventCategories(classAttr: string): string[] {
  const cats: string[] = []
  for (const match of classAttr.matchAll(/event-category-([a-z0-9-]+)/gi)) {
    const slug = match[1]?.toLowerCase()
    if (slug) cats.push(slug)
  }
  return [...new Set(cats)]
}

function isGirlsBandCryArticle(
  title: string,
  url: string,
  eventCategories: readonly string[],
): boolean {
  if (eventCategories.includes('girls-band-cry')) return true
  return /girls-band-cry|ガールズバンドクライ|ガルクラ|トゲナシ|トゲトゲ|ダイヤモンドダスト/i.test(
    `${title}\n${url}`,
  )
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
    .replace(/&#8211;/g, '–')
    .replace(/\s+/g, ' ')
}
