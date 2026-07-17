import { decodeHtml, stripTags } from '../../utils/html.js'
import { parseIsoDate } from './urls.js'

export interface GamepediaArticleDetail {
  title: string
  publishedAt: string
  bodyText: string
  summary: string
  imageUrl?: string
}

/** 解析 キャラホビ 详情页。 */
export function parseNewsDetail(html: string): GamepediaArticleDetail {
  const title =
    extractJsonLdString(html, 'headline') || extractOgContent(html, 'og:title') || extractH1(html)
  const cleanedTitle = decodeHtml(stripTags(title))
    .replace(/\s*[–—-]\s*キャラホビ\s*$/u, '')
    .trim()
  if (!cleanedTitle) {
    throw new Error('Failed to parse gamepedia detail title')
  }

  const publishedAt = extractPublishedAt(html)
  const bodyHtml = extractEntryContent(html)
  const bodyText = decodeHtml(stripTags(bodyHtml.replace(/<br\s*\/?>/gi, '\n'))).trim()
  if (!bodyText) {
    throw new Error('Empty body in gamepedia news detail')
  }

  const summaryFromLd = extractJsonLdString(html, 'description')
  const summaryFromOg = extractOgContent(html, 'og:description')
  const summary = decodeHtml(summaryFromLd || summaryFromOg || bodyText).slice(0, 180)
  const imageUrl = extractImageUrl(html)

  return {
    title: cleanedTitle,
    publishedAt,
    bodyText,
    summary,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

function extractPublishedAt(html: string): string {
  const ld = extractJsonLdString(html, 'datePublished')
  if (ld) return parseIsoDate(ld)

  const metaMatch =
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i.exec(html) ??
    /<meta[^>]+content="([^"]+)"[^>]+property="article:published_time"/i.exec(html)
  if (metaMatch?.[1]) return parseIsoDate(metaMatch[1])

  throw new Error('Failed to parse gamepedia detail publishedAt')
}

function extractEntryContent(html: string): string {
  const sectionMatch =
    /<section[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/section>/i.exec(html)
  if (sectionMatch?.[1]) return sectionMatch[1]

  const divMatch = /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
  if (divMatch?.[1]) return divMatch[1]

  throw new Error('Failed to parse gamepedia entry-content')
}

function extractH1(html: string): string {
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  return match?.[1] ?? ''
}

function extractOgContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match =
    new RegExp(`<meta[^>]+property="${escaped}"[^>]+content="([^"]*)"`, 'i').exec(html) ??
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${escaped}"`, 'i').exec(html)
  return match?.[1]?.trim() ?? ''
}

function extractJsonLdString(html: string, key: string): string {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`).exec(html)
  if (!match?.[1]) return ''
  try {
    return JSON.parse(`"${match[1]}"`) as string
  } catch {
    return decodeHtml(match[1])
  }
}

function extractImageUrl(html: string): string | undefined {
  const og = extractOgContent(html, 'og:image')
  if (og) return og
  const ld = extractJsonLdString(html, 'image')
  return ld || undefined
}
