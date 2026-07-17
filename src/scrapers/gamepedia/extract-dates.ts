import { extractEventDates } from '../../categories/extract-event-dates.js'
import type { EventDate } from '../../models/event-date.js'

/**
 * gamepedia 活动日：正文标签归一化后走通用抽取。
 * 販売期間 / 予約受付* → sale；開催期間等保持 hold。
 */
export function extractGamepediaEventDates(options: {
  title: string
  bodyText: string
  publishedAt: string
}): EventDate[] {
  const normalizedBody = normalizeDateLabels(options.bodyText)
  return extractEventDates(options.title, normalizedBody, options.publishedAt)
}

function normalizeDateLabels(body: string): string {
  return body
    .replace(/販売期間/g, '発売日')
    .replace(/予約受付期間/g, '発売日')
    .replace(/予約受付開始/g, '発売日')
    .replace(/(?:^|\n)\s*受付開始\s*[:：]?/gm, '\n発売日 ')
}
