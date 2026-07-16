import {
  EVENT_DATE_TITLE_PREFIX,
  allDayExclusiveEndDate,
  eventDateToUtcRange,
  type EventDateKind,
} from '../models/event-date.js'
import type { CategoryId } from '../models/categories.js'
import type { GroupId } from '../models/groups.js'
import type { NewsItem } from '../models/item.js'

/** Feed 展开后的单日/期间条目（RSS/iCal 共用） */
export interface FeedEntry {
  /** `${item.id}-${date}[_endDate]-${kind}[-HHmm]`，用于 UID/guid */
  entryId: string
  title: string
  url: string
  /**
   * 排序/展示基准 ISO：
   * - 有时刻：开始时刻（UTC）
   * - 无时刻：当天 UTC 午夜
   */
  occurredOn: string
  /** 有时刻时的结束 UTC；缺省 = 全天事件 */
  endAt?: string
  /** 全天跨日：排他结束日 YYYY-MM-DD（iCal DTEND;VALUE=DATE） */
  allDayEndOn?: string
  kind: EventDateKind
  categories: CategoryId[]
  groups: GroupId[]
  sourceId: string
  summary?: string
}

/**
 * 按 eventDates 展开；无日期的条目跳过（D6）。
 * 标题加 `[開催]` / `[発売]` 前缀（D10）。
 * 带 endDate 的期间保持为一条（不按日拆开）。
 */
export function expandEventDates(items: NewsItem[]): FeedEntry[] {
  const entries: FeedEntry[] = []

  for (const item of items) {
    const dates = item.eventDates
    if (!dates || dates.length === 0) continue

    for (const eventDate of dates) {
      const prefix = EVENT_DATE_TITLE_PREFIX[eventDate.kind]
      const range = eventDateToUtcRange(eventDate)
      const exclusiveEnd = allDayExclusiveEndDate(eventDate)
      const timeSuffix = eventDate.startTime ? `-${eventDate.startTime.replace(':', '')}` : ''
      const endSuffix =
        eventDate.endDate && eventDate.endDate > eventDate.date ? `_${eventDate.endDate}` : ''
      entries.push({
        entryId: `${item.id}-${eventDate.date}${endSuffix}-${eventDate.kind}${timeSuffix}`,
        title: `${prefix} ${item.title}`,
        url: item.url,
        occurredOn: range?.startAt ?? `${eventDate.date}T00:00:00.000Z`,
        ...(range ? { endAt: range.endAt } : {}),
        ...(exclusiveEnd ? { allDayEndOn: exclusiveEnd } : {}),
        kind: eventDate.kind,
        categories: item.categories,
        groups: item.groups,
        sourceId: item.sourceId,
        ...(item.summary !== undefined ? { summary: item.summary } : {}),
      })
    }
  }

  return entries.sort(
    (a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.entryId.localeCompare(b.entryId),
  )
}
