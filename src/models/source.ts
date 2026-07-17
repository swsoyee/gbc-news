export const SOURCE_IDS = ['gbc-news', 'gbc-firstriff', 'collabo-cafe', 'gamepedia'] as const

export type SourceId = (typeof SOURCE_IDS)[number]

/** 跨源去重保留优先级：数值越小越高。 */
export const SOURCE_PRIORITY: Record<SourceId, number> = {
  'gbc-news': 0,
  'gbc-firstriff': 1,
  'collabo-cafe': 2,
  gamepedia: 3,
}

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value)
}

export function sourcePriority(sourceId: string): number {
  if (isSourceId(sourceId)) return SOURCE_PRIORITY[sourceId]
  return Number.MAX_SAFE_INTEGER
}
