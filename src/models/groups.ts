/** 组合（最大级别筛选维度；一文可多组合） */
export const GROUP_IDS = ['togenashi', 'f272', 'canna-lily', 'other'] as const

export type GroupId = (typeof GROUP_IDS)[number]

export const GROUP_LABELS: Record<GroupId, { zh: string; ja: string }> = {
  togenashi: { zh: 'トゲナシトゲアリ', ja: 'トゲナシトゲアリ' },
  f272: { zh: 'F-272', ja: 'F-272' },
  'canna-lily': { zh: 'Canna Lily', ja: 'Canna Lily' },
  other: { zh: '其他/共通', ja: 'その他/共通' },
}

export function isGroupId(value: string): value is GroupId {
  return (GROUP_IDS as readonly string[]).includes(value)
}

export function parseGroupList(raw: string | null | undefined): GroupId[] | null {
  if (raw == null || raw.trim() === '') return null
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const groups = parts.filter(isGroupId)
  return groups.length > 0 ? [...new Set(groups)] : []
}
