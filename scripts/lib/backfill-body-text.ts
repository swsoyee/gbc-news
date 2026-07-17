import { SOURCE_IDS, isSourceId, type SourceId } from '../../src/models/source.js'
import type { NewsItem } from '../../src/models/item.js'

export interface BackfillCliOptions {
  sources: SourceId[]
  force: boolean
  delayMs: number
}

export function parseBackfillArgs(args: string[]): BackfillCliOptions {
  let sources: SourceId[] = [...SOURCE_IDS]
  let force = false
  let delayMs = 400
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--force') {
      force = true
      continue
    }
    if (arg === '--source') {
      const value = args[++index]
      if (value === 'all') {
        sources = [...SOURCE_IDS]
      } else if (value && isSourceId(value)) {
        sources = [value]
      } else {
        throw new Error(`Invalid --source: ${String(value)}`)
      }
      continue
    }
    if (arg === '--delay-ms') {
      const value = Number(args[++index])
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--delay-ms must be a non-negative integer')
      }
      delayMs = value
      continue
    }
    throw new Error(`Unknown argument: ${String(arg)}`)
  }
  return { sources, force, delayMs }
}

export function withBackfilledBody(item: NewsItem, bodyText: string): NewsItem {
  const normalized = bodyText.trim()
  if (!normalized) throw new Error('Backfilled bodyText must be non-empty')
  return { ...item, bodyText: normalized }
}
