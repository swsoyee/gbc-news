import { CATEGORY_IDS, isCategoryId, type CategoryId } from './categories.js'

export interface NewsItem {
  id: string
  title: string
  url: string
  publishedAt: string
  sourceId: string
  categories: CategoryId[]
  /** 事件发生开始日（日历用）；缺失则不进入 ICS */
  eventAt?: string
  /** 事件发生结束日（多日活动） */
  eventEndAt?: string
  summary?: string
  imageUrl?: string
}

export function assertNewsItem(value: unknown): asserts value is NewsItem {
  if (!value || typeof value !== 'object') {
    throw new Error('NewsItem must be an object')
  }

  const item = value as Record<string, unknown>
  for (const key of ['id', 'title', 'url', 'publishedAt', 'sourceId'] as const) {
    if (typeof item[key] !== 'string' || item[key].length === 0) {
      throw new Error(`NewsItem.${key} must be a non-empty string`)
    }
  }

  if (!Array.isArray(item.categories) || item.categories.length === 0) {
    throw new Error('NewsItem.categories must be a non-empty array')
  }

  for (const category of item.categories) {
    if (typeof category !== 'string' || !isCategoryId(category)) {
      throw new Error(`NewsItem.categories contains invalid id: ${String(category)}`)
    }
  }

  if (item.eventAt !== undefined) {
    if (typeof item.eventAt !== 'string' || item.eventAt.length === 0) {
      throw new Error('NewsItem.eventAt must be a non-empty string when set')
    }
  }
  if (item.eventEndAt !== undefined) {
    if (typeof item.eventEndAt !== 'string' || item.eventEndAt.length === 0) {
      throw new Error('NewsItem.eventEndAt must be a non-empty string when set')
    }
  }
}

export function filterItemsByCategories(
  items: NewsItem[],
  categories: CategoryId[] | null,
): NewsItem[] {
  if (categories == null) return items
  if (categories.length === 0) return []
  const selected = new Set(categories)
  return items.filter((item) => item.categories.some((category) => selected.has(category)))
}

/** 仅保留可放入日历的条目（必须有事件发生日） */
export function filterItemsForCalendar(items: NewsItem[]): NewsItem[] {
  return items.filter((item) => typeof item.eventAt === 'string' && item.eventAt.length > 0)
}

export function listUsedCategories(items: NewsItem[]): CategoryId[] {
  const used = new Set<CategoryId>()
  for (const item of items) {
    for (const category of item.categories) used.add(category)
  }
  return CATEGORY_IDS.filter((id) => used.has(id))
}
