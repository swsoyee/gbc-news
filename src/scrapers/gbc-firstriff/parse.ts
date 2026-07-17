import { decodeHtml, stripTags } from '../../utils/html.js'
import { parseFirstriffDate } from './urls.js'

export interface FirstriffArticleDetail {
  title: string
  publishedAt: string
  bodyText: string
  summary: string
}

/** 解析 First Riff 新闻详情页。 */
export function parseNewsDetail(html: string): FirstriffArticleDetail {
  const titleMatch = /<h1 class="c-single-head__title">([\s\S]*?)<\/h1>/i.exec(html)
  const dateMatch = /<p class="c-single-head__date">([^<]+)<\/p>/i.exec(html)
  const bodyMatch =
    /<div class="p-news-single__body c-single-body">([\s\S]*?)<\/div>\s*<div class="p-news-single__share"/i.exec(
      html,
    )

  const titleHtml = titleMatch?.[1]
  const dateRaw = dateMatch?.[1]?.trim()
  const bodyHtml = bodyMatch?.[1]
  if (!titleHtml || !dateRaw || !bodyHtml) {
    throw new Error('Failed to parse firstriff news detail fields')
  }

  const title = decodeHtml(stripTags(titleHtml)).trim()
  const publishedAt = parseFirstriffDate(dateRaw)
  const bodyText = decodeHtml(stripTags(bodyHtml)).trim()
  const summary = bodyText.slice(0, 180)

  if (!title || !bodyText) {
    throw new Error('Empty title or body in firstriff news detail')
  }

  return { title, publishedAt, bodyText, summary }
}
