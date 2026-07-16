import { CATEGORY_IDS, isCategoryId, type CategoryId } from './categories.js'
import { assertEventDate, type EventDate } from './event-date.js'
import { GROUP_IDS, isGroupId, type GroupId } from './groups.js'

export interface NewsItem {
  id: string
  title: string
  url: string
  /** 新闻发布日（元数据；省略年推定基准） */
  publishedAt: string
  sourceId: string
  categories: CategoryId[]
  /** 组合标签（非空） */
  groups: GroupId[]
  /** 活动相关日；缺省/空 = 不进入 RSS/iCal */
  eventDates?: EventDate[]
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

  if (!Array.isArray(item.groups) || item.groups.length === 0) {
    throw new Error('NewsItem.groups must be a non-empty array')
  }

  for (const group of item.groups) {
    if (typeof group !== 'string' || !isGroupId(group)) {
      throw new Error(`NewsItem.groups contains invalid id: ${String(group)}`)
    }
  }

  if (item.eventDates !== undefined) {
    if (!Array.isArray(item.eventDates)) {
      throw new Error('NewsItem.eventDates must be an array when set')
    }
    for (const entry of item.eventDates) assertEventDate(entry)
  }
}

export interface FilterItemsOptions {
  groups?: GroupId[] | null
  categories?: CategoryId[] | null
}

/**
 * 维间 AND、维内 OR。
 * null/undefined = 该维不过滤；空数组 = 无匹配。
 */
export function filterItems(items: NewsItem[], options: FilterItemsOptions = {}): NewsItem[] {
  const { groups = null, categories = null } = options
  let result = items

  if (groups != null) {
    if (groups.length === 0) return []
    const selected = new Set(groups)
    result = result.filter((item) => item.groups.some((group) => selected.has(group)))
  }

  if (categories != null) {
    if (categories.length === 0) return []
    const selected = new Set(categories)
    result = result.filter((item) => item.categories.some((category) => selected.has(category)))
  }

  return result
}

/** @deprecated 使用 filterItems({ categories }) */
export function filterItemsByCategories(
  items: NewsItem[],
  categories: CategoryId[] | null,
): NewsItem[] {
  return filterItems(items, { categories })
}

export function listUsedCategories(items: NewsItem[]): CategoryId[] {
  const used = new Set<CategoryId>()
  for (const item of items) {
    for (const category of item.categories) used.add(category)
  }
  return CATEGORY_IDS.filter((id) => used.has(id))
}

export function listUsedGroups(items: NewsItem[]): GroupId[] {
  const used = new Set<GroupId>()
  for (const item of items) {
    for (const group of item.groups) used.add(group)
  }
  return GROUP_IDS.filter((id) => used.has(id))
}
