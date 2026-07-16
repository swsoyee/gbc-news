/** 资讯分类（官网无原生分类时由规则推断，一文可多类） */
export const CATEGORY_IDS = ['live', 'event', 'goods', 'music', 'cinema', 'media', 'other'] as const

export type CategoryId = (typeof CATEGORY_IDS)[number]

export const CATEGORY_LABELS: Record<CategoryId, { zh: string; ja: string }> = {
  live: { zh: 'Live', ja: 'ライブ' },
  event: { zh: '活动', ja: 'イベント' },
  goods: { zh: '周边', ja: 'グッズ' },
  music: { zh: '曲目', ja: '楽曲' },
  cinema: { zh: '剧场/映像', ja: '劇場/映像' },
  media: { zh: '媒体', ja: 'メディア' },
  other: { zh: '其他', ja: 'その他' },
}

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value)
}

export function parseCategoryList(raw: string | null | undefined): CategoryId[] | null {
  if (raw == null || raw.trim() === '') return null
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const categories = parts.filter(isCategoryId)
  return categories.length > 0 ? [...new Set(categories)] : []
}
