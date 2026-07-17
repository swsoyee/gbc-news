export const SOURCE_IDS = ['gbc-news', 'gbc-firstriff', 'collabo-cafe'] as const

export type SourceId = (typeof SOURCE_IDS)[number]

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value)
}
