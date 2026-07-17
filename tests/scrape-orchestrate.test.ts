import { describe, expect, it } from 'vitest'
import { exitCodeForSummary, summarizeSourceResults } from '../scripts/lib/scrape-orchestrate.js'

describe('scrape orchestration', () => {
  it('marks full success when all sources ok', () => {
    const summary = summarizeSourceResults([
      { sourceId: 'a', ok: true },
      { sourceId: 'b', ok: true },
    ])
    expect(summary.canContinue).toBe(true)
    expect(summary.allFailed).toBe(false)
    expect(summary.hasPartialFailure).toBe(false)
    expect(exitCodeForSummary(summary)).toBe(0)
  })

  it('keeps successful sources when one fails', () => {
    const summary = summarizeSourceResults([
      { sourceId: 'a', ok: true },
      { sourceId: 'b', ok: false, error: 'boom' },
      { sourceId: 'c', ok: true },
    ])
    expect(summary.ok).toEqual(['a', 'c'])
    expect(summary.failed).toEqual([{ sourceId: 'b', error: 'boom' }])
    expect(summary.canContinue).toBe(true)
    expect(summary.hasPartialFailure).toBe(true)
    expect(exitCodeForSummary(summary)).toBe(1)
  })

  it('fails hard when every source fails', () => {
    const summary = summarizeSourceResults([
      { sourceId: 'a', ok: false, error: 'x' },
      { sourceId: 'b', ok: false, error: 'y' },
    ])
    expect(summary.canContinue).toBe(false)
    expect(summary.allFailed).toBe(true)
    expect(exitCodeForSummary(summary)).toBe(2)
  })
})
