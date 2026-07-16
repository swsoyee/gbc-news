import { CATEGORY_IDS, isCategoryId, type CategoryId } from './categories.js'

export interface NewsItem {
  id: string
  title: string
  url: string
  publishedAt: string
  sourceId: string
  categories: CategoryId[]
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

export function listUsedCategories(items: NewsItem[]): CategoryId[] {
  const used = new Set<CategoryId>()
  for (const item of items) {
    for (const category of item.categories) used.add(category)
  }
  return CATEGORY_IDS.filter((id) => used.has(id))
}
