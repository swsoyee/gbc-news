import { spawn } from 'node:child_process'
import { SOURCE_IDS, SOURCE_SCRAPE_SCRIPTS } from '../src/models/source.js'
import {
  exitCodeForSummary,
  summarizeSourceResults,
  type SourceRunResult,
} from './lib/scrape-orchestrate.js'

function runSource(sourceId: string, script: string): Promise<SourceRunResult> {
  return new Promise((resolve) => {
    console.log(`[info] orchestration start source=${sourceId}`)
    const child = spawn(process.execPath, ['--import', 'tsx', script], {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', (error) => {
      resolve({
        sourceId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    child.on('close', (code, signal) => {
      if (code === 0) {
        console.log(`[info] orchestration ok source=${sourceId}`)
        resolve({ sourceId, ok: true })
        return
      }
      const error = signal ? `killed by ${signal}` : `exit ${code ?? 'unknown'}`
      console.error(`[error] orchestration failed source=${sourceId}: ${error}`)
      resolve({ sourceId, ok: false, error })
    })
  })
}

async function main(): Promise<void> {
  const results: SourceRunResult[] = []
  for (const sourceId of SOURCE_IDS) {
    results.push(await runSource(sourceId, SOURCE_SCRAPE_SCRIPTS[sourceId]))
  }

  const summary = summarizeSourceResults(results)
  console.log(
    `[info] orchestration summary ok=${summary.ok.join(',') || '-'} failed=${
      summary.failed.map((entry) => entry.sourceId).join(',') || '-'
    }`,
  )

  for (const failure of summary.failed) {
    console.error(`[error] source=${failure.sourceId} ${failure.error}`)
  }

  if (summary.allFailed) {
    console.error('[error] all scrape sources failed')
  } else if (summary.hasPartialFailure) {
    console.error('[error] scrape completed with partial failures; successful sources were kept')
  }

  process.exitCode = exitCodeForSummary(summary)
}

main().catch((error: unknown) => {
  console.error('[error]', error)
  process.exitCode = 2
})
