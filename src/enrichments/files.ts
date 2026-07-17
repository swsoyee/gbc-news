import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertEnrichmentFile, type EnrichmentFile } from '../models/enrichment.js'
import { SOURCE_IDS, type SourceId } from '../models/source.js'

export async function loadEnrichmentFiles(
  root: string,
  sourceIds: readonly SourceId[] = SOURCE_IDS,
): Promise<Map<string, EnrichmentFile>> {
  const files = new Map<string, EnrichmentFile>()
  for (const sourceId of sourceIds) {
    const path = join(root, 'data/enrichments', `${sourceId}.json`)
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    assertEnrichmentFile(parsed)
    if (parsed.sourceId !== sourceId) {
      throw new Error(`Enrichment file source mismatch: ${path}`)
    }
    files.set(sourceId, parsed)
  }
  return files
}
