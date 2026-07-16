import type { CategoryId } from '../models/categories.js'

const EVENT_CATEGORY_SIGNAL = new Set([
  'cafe',
  'pop-up-store',
  'popup-store',
  'event',
  'fair',
  'exhibition',
])

const GOODS_CATEGORY_SIGNAL = new Set(['goods', 'apparel', 'shop'])

/**
 * collabo-cafe 分类：优先 event / goods（WP event-category + 标题关键词），
 * 不继承官网通用分类，避免协作资讯混入 live/music 等订阅。
 */
export function classifyCollabo(
  title: string,
  body = '',
  eventCategories: readonly string[] = [],
): CategoryId[] {
  const matched = new Set<CategoryId>()

  for (const raw of eventCategories) {
    const slug = raw.toLowerCase()
    if (EVENT_CATEGORY_SIGNAL.has(slug) || slug.includes('cafe') || slug.includes('pop-up')) {
      matched.add('event')
    }
    if (GOODS_CATEGORY_SIGNAL.has(slug) || slug.includes('goods')) {
      matched.add('goods')
    }
  }

  // 标题信号（避免正文「コラボ/グッズ」把几乎所有稿打成双类）
  if (/カフェ|フェア|ポップアップ|開催/.test(title)) matched.add('event')
  if (/グッズ|予約受付|発売|アパレル/.test(title)) matched.add('goods')

  if (matched.size === 0) {
    if (/カフェ|フェア|ポップアップ|イベント|開催|コラボ/.test(body)) matched.add('event')
    if (/グッズ|予約受付|発売|アパレル|通販/.test(body)) matched.add('goods')
  }

  if (matched.size === 0) return ['other']
  return [...matched]
}
