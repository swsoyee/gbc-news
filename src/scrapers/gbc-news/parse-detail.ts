import { decodeHtml, stripTags } from '../../utils/html.js'
import { parseGbcDate } from './urls.js'

export interface GbcArticleDetail {
  title: string
  publishedAt: string
  bodyText: string
  summary: string
}

/** 解析新闻详情页正文与标题。 */
export function parseNewsDetail(html: string): GbcArticleDetail {
  const titleMatch = /<h1 class="ttl">([\s\S]*?)<\/h1>/i.exec(html)
  const timeMatch =
    /<time class="time[^"]*">\s*<span class="year">(\d{4})\.<\/span>\s*<span class="md">(\d{2})\.(\d{2})<\/span>\s*<\/time>/i.exec(
      html,
    )
  const bodyMatch = /<div class="sw-Txtarea">([\s\S]*?)<\/div>/i.exec(html)

  const titleHtml = titleMatch?.[1]
  const year = timeMatch?.[1]
  const month = timeMatch?.[2]
  const day = timeMatch?.[3]
  const bodyHtml = bodyMatch?.[1]
  if (!titleHtml || !year || !month || !day || !bodyHtml) {
    throw new Error('Failed to parse news detail fields')
  }

  const title = decodeHtml(stripTags(titleHtml)).trim()
  const publishedAt = parseGbcDate(`${year}.${month}.${day}`)
  const bodyText = decodeHtml(stripTags(bodyHtml)).trim()
  const summary = bodyText.slice(0, 180)

  if (!title || !bodyText) {
    throw new Error('Empty title or body in news detail')
  }

  return { title, publishedAt, bodyText, summary }
}
