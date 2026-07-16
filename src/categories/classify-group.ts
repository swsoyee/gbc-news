import type { GroupId } from '../models/groups.js'

interface GroupRule {
  id: Exclude<GroupId, 'other'>
  patterns: RegExp[]
}

const RULES: GroupRule[] = [
  {
    id: 'togenashi',
    patterns: [
      /トゲナシ/i,
      /トゲアリ/i,
      /とげなし/i,
      /とげあり/i,
      /togenashi/i,
      /togeari/i,
      /TOGETOGE/i,
    ],
  },
  {
    id: 'f272',
    patterns: [/\bF-?272\b/i, /エフ.?272/],
  },
  {
    id: 'canna-lily',
    patterns: [/canna\s*lily/i, /カンナ\s*リリー/, /カンナリリー/],
  },
]

/** 组合打标：命中谁打谁；未命中 → other（D2）。 */
export function classifyGroups(title: string, body = ''): GroupId[] {
  const text = `${title}\n${body}`
  const matched = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map(
    (rule) => rule.id,
  )
  return matched.length > 0 ? [...new Set(matched)] : ['other']
}

/**
 * gbc-news 官网默认归属トゲナシ：仅得 other 时改为 togenashi（D3）。
 * 其他源保持 D2 结果。
 */
export function classifyGroupsForSource(sourceId: string, title: string, body = ''): GroupId[] {
  const groups = classifyGroups(title, body)
  if (sourceId === 'gbc-news' && groups.length === 1 && groups[0] === 'other') {
    return ['togenashi']
  }
  return groups
}
