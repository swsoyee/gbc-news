export const SOURCE_IDS = ['gbc-news', 'gbc-firstriff', 'collabo-cafe', 'gamepedia'] as const

export type SourceId = (typeof SOURCE_IDS)[number]

/** 跨源去重保留优先级：数值越小越高。 */
export const SOURCE_PRIORITY: Record<SourceId, number> = {
  'gbc-news': 0,
  'gbc-firstriff': 1,
  'collabo-cafe': 2,
  gamepedia: 3,
}

/** 各源抓取入口脚本（相对仓库根）；`scrape-all` 必须由此派生，禁止另维护列表。 */
export const SOURCE_SCRAPE_SCRIPTS: Record<SourceId, string> = {
  'gbc-news': 'scripts/scrape-gbc.ts',
  'gbc-firstriff': 'scripts/scrape-firstriff.ts',
  'collabo-cafe': 'scripts/scrape-collabo-cafe.ts',
  gamepedia: 'scripts/scrape-gamepedia.ts',
}

/** 抓取快照相对仓库根路径。 */
export function sourceLatestRelPath(sourceId: SourceId): string {
  return `data/${sourceId}/latest.json`
}

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value)
}

export function sourcePriority(sourceId: string): number {
  if (isSourceId(sourceId)) return SOURCE_PRIORITY[sourceId]
  return Number.MAX_SAFE_INTEGER
}
