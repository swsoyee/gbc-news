import type { CategoryId } from '../models/categories.js'
import { classifyText } from './classify.js'

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
 * 再合并 classifyText 的非 event/goods 命中（live 等可保留）。
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

  for (const id of classifyText(title, body)) {
    if (id === 'other' || id === 'event' || id === 'goods') continue
    matched.add(id)
  }

  if (matched.size === 0) {
    // 无 WP/标题信号时，回退 classifyText 的 event/goods，再否则 other
    for (const id of classifyText(title, body)) {
      if (id === 'event' || id === 'goods') matched.add(id)
    }
  }

  if (matched.size === 0) return ['other']
  return [...matched]
}
