export interface SourceRunResult {
  sourceId: string
  ok: boolean
  error?: string
}

export interface OrchestrationSummary {
  ok: string[]
  failed: Array<{ sourceId: string; error: string }>
  /** 至少一个源成功时为 true；用于决定是否继续 build:feeds */
  canContinue: boolean
  /** 全部失败时为 true；编排入口应非零退出 */
  allFailed: boolean
  /** 有失败但仍有成功时为 true；可继续构建，最终仍应非零退出以提示 Actions */
  hasPartialFailure: boolean
}

export function summarizeSourceResults(results: SourceRunResult[]): OrchestrationSummary {
  const ok = results.filter((result) => result.ok).map((result) => result.sourceId)
  const failed = results
    .filter((result) => !result.ok)
    .map((result) => ({
      sourceId: result.sourceId,
      error: result.error ?? 'unknown error',
    }))

  return {
    ok,
    failed,
    canContinue: ok.length > 0,
    allFailed: ok.length === 0,
    hasPartialFailure: ok.length > 0 && failed.length > 0,
  }
}

/** 退出码：0 全成功；1 部分失败；2 全失败 */
export function exitCodeForSummary(summary: OrchestrationSummary): number {
  if (summary.allFailed) return 2
  if (summary.hasPartialFailure) return 1
  return 0
}
