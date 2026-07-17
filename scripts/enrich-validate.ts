import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnrichmentFiles } from '../src/enrichments/files.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

loadEnrichmentFiles(root)
  .then((files) => {
    const records = [...files.values()].reduce(
      (sum, file) => sum + Object.keys(file.items).length,
      0,
    )
    console.log(`[info] enrichments valid files=${files.size} records=${records}`)
  })
  .catch((error: unknown) => {
    console.error('[error]', error)
    process.exitCode = 1
  })
