export const EVENT_DATE_KINDS = ['hold', 'sale'] as const

export type EventDateKind = (typeof EVENT_DATE_KINDS)[number]

export interface EventDate {
  /** YYYY-MM-DD（UTC 日历日） */
  date: string
  kind: EventDateKind
}

export function isEventDateKind(value: string): value is EventDateKind {
  return (EVENT_DATE_KINDS as readonly string[]).includes(value)
}

export function assertEventDate(value: unknown): asserts value is EventDate {
  if (!value || typeof value !== 'object') {
    throw new Error('EventDate must be an object')
  }
  const entry = value as Record<string, unknown>
  if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    throw new Error(`EventDate.date must be YYYY-MM-DD, got: ${String(entry.date)}`)
  }
  if (typeof entry.kind !== 'string' || !isEventDateKind(entry.kind)) {
    throw new Error(`EventDate.kind must be hold|sale, got: ${String(entry.kind)}`)
  }
}

export const EVENT_DATE_TITLE_PREFIX: Record<EventDateKind, string> = {
  hold: '[開催]',
  sale: '[発売]',
}
