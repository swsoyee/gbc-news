import type { PublicNewsItem } from '../models/enrichment.js'

export interface ManualDrop {
  /** 被判定为重复、需从合并结果剔除的条目 id（低优先级源） */
  id: string
  /** 保留的高优先级条目 id（仅记录用途） */
  keptId?: string
  /** 人工判定说明 */
  reason?: string
}

export interface ManualDedupeFile {
  updatedAt: string
  drops: ManualDrop[]
}

export interface ManualDedupeResult<T> {
  items: T[]
  dropped: ManualDrop[]
  warnings: string[]
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
}

export function assertManualDedupeFile(value: unknown): asserts value is ManualDedupeFile {
  if (!value || typeof value !== 'object') {
    throw new Error('ManualDedupeFile must be an object')
  }
  const file = value as Record<string, unknown>
  if (
    typeof file.updatedAt !== 'string' ||
    file.updatedAt.length === 0 ||
    !isIsoTimestamp(file.updatedAt)
  ) {
    throw new Error('ManualDedupeFile.updatedAt must be an ISO timestamp')
  }
  if (!Array.isArray(file.drops)) {
    throw new Error('ManualDedupeFile.drops must be an array')
  }
  const seen = new Set<string>()
  for (const drop of file.drops) {
    if (!drop || typeof drop !== 'object') {
      throw new Error('ManualDrop must be an object')
    }
    const record = drop as Record<string, unknown>
    if (typeof record.id !== 'string' || record.id.length === 0) {
      throw new Error('ManualDrop.id must be a non-empty string')
    }
    if (seen.has(record.id)) {
      throw new Error(`Duplicate ManualDrop.id: ${record.id}`)
    }
    seen.add(record.id)
    for (const key of ['keptId', 'reason'] as const) {
      const optional = record[key]
      if (optional !== undefined && (typeof optional !== 'string' || optional.length === 0)) {
        throw new Error(`ManualDrop.${key} must be a non-empty string when set`)
      }
    }
  }
}

/**
 * 按人工去重名单剔除条目。
 * 名单中未命中任何条目的 id 记为警告（提示名单过期）。
 */
export function applyManualDrops<T extends Pick<PublicNewsItem, 'id'>>(
  items: T[],
  file: ManualDedupeFile,
): ManualDedupeResult<T> {
  const dropById = new Map(file.drops.map((drop) => [drop.id, drop]))
  const kept: T[] = []
  const dropped: ManualDrop[] = []

  for (const item of items) {
    const drop = dropById.get(item.id)
    if (drop) {
      dropped.push(drop)
      dropById.delete(item.id)
      continue
    }
    kept.push(item)
  }

  const warnings = [...dropById.keys()].map(
    (id) => `manual dedupe drop id 未命中任何条目（可能已过期）: ${id}`,
  )

  return { items: kept, dropped, warnings }
}
