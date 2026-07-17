import { spawn } from 'node:child_process'
import {
  exitCodeForSummary,
  summarizeSourceResults,
  type SourceRunResult,
} from './lib/scrape-orchestrate.js'

const SOURCES = [
  { sourceId: 'gbc-news', script: 'scripts/scrape-gbc.ts' },
  { sourceId: 'gbc-firstriff', script: 'scripts/scrape-firstriff.ts' },
  { sourceId: 'collabo-cafe', script: 'scripts/scrape-collabo-cafe.ts' },
  { sourceId: 'gamepedia', script: 'scripts/scrape-gamepedia.ts' },
] as const

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
  for (const source of SOURCES) {
    results.push(await runSource(source.sourceId, source.script))
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
