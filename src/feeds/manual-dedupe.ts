import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
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

export interface ManualDedupeRefCheck {
  errors: string[]
  warnings: string[]
}

export const MANUAL_DEDUPE_REL_PATH = 'data/dedupe/manual.json'

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

export function emptyManualDedupeFile(updatedAt = new Date().toISOString()): ManualDedupeFile {
  return { updatedAt, drops: [] }
}

/** 读取人工去重名单；文件不存在时返回空名单。 */
export async function loadManualDedupeFile(root: string): Promise<ManualDedupeFile> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, MANUAL_DEDUPE_REL_PATH), 'utf8'))
    assertManualDedupeFile(parsed)
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyManualDedupeFile()
    }
    throw error
  }
}

/**
 * 校验名单引用：drop id 未命中 → warning；keptId 已写但未命中 → error。
 */
export function validateManualDedupeReferences(
  file: ManualDedupeFile,
  items: readonly Pick<PublicNewsItem, 'id'>[],
): ManualDedupeRefCheck {
  const ids = new Set(items.map((item) => item.id))
  const errors: string[] = []
  const warnings: string[] = []
  for (const drop of file.drops) {
    if (!ids.has(drop.id)) {
      warnings.push(`manual dedupe drop id 未命中任何条目（可能已过期）: ${drop.id}`)
    }
    if (drop.keptId && !ids.has(drop.keptId)) {
      errors.push(`manual dedupe keptId 未命中任何条目: ${drop.keptId} (drop=${drop.id})`)
    }
  }
  return { errors, warnings }
}

/**
 * 按人工去重名单剔除条目。
 * 名单中未命中任何条目的 id、以及 keptId 未命中，记为警告（提示名单过期/写错）。
 */
export function applyManualDrops<T extends Pick<PublicNewsItem, 'id'>>(
  items: T[],
  file: ManualDedupeFile,
): ManualDedupeResult<T> {
  const itemIds = new Set(items.map((item) => item.id))
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
  for (const drop of dropped) {
    if (drop.keptId && !itemIds.has(drop.keptId)) {
      warnings.push(`manual dedupe keptId 未命中任何条目: ${drop.keptId} (drop=${drop.id})`)
    }
  }

  return { items: kept, dropped, warnings }
}
