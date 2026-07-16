import type { CategoryId } from '../models/categories.js'

interface CategoryRule {
  id: Exclude<CategoryId, 'other'>
  patterns: RegExp[]
}

/** 基于标题/正文的关键词规则；可一文多类。 */
const RULES: CategoryRule[] = [
  {
    id: 'live',
    patterns: [
      /ライブ/i,
      /\blive\b/i,
      /tour/i,
      /ツアー/i,
      /フェス/i,
      /festival/i,
      /出演/i,
      /チケット/i,
      /会場/i,
    ],
  },
  {
    id: 'music',
    patterns: [
      /楽曲/i,
      /試聴/i,
      /\bmv\b/i,
      /ミュージックビデオ/i,
      /配信開始/i,
      /\bcd\b/i,
      /シングル/i,
      /アルバム/i,
      /作詞/i,
      /作曲/i,
      /新曲/i,
    ],
  },
  {
    id: 'goods',
    patterns: [
      /グッズ/i,
      /アパレル/i,
      /ストア特典/i,
      /限定セット/i,
      /甚平/i,
      /コラボ商品/i,
      /二次元コスパ/i,
      /supergroupies/i,
      /誕生日グッズ/i,
    ],
  },
  {
    id: 'event',
    patterns: [
      /イベント/i,
      /カフェ/i,
      /開催/i,
      /コラボ/i,
      /フェア/i,
      /ポップアップ/i,
      /展覧/i,
      /キャンペーン/i,
    ],
  },
  {
    id: 'cinema',
    patterns: [
      /劇場版/i,
      /総集編/i,
      /映画/i,
      /blu-?ray/i,
      /bluray/i,
      /\bdvd\b/i,
      /上映/i,
      /劇場公開/i,
    ],
  },
  {
    id: 'media',
    patterns: [/ラジオ/i, /インタビュー/i, /放送/i, /番組/i, /雑誌/i, /掲載/i],
  },
]

export function classifyText(title: string, body = ''): CategoryId[] {
  const text = `${title}\n${body}`
  const matched = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map(
    (rule) => rule.id,
  )
  return matched.length > 0 ? [...new Set(matched)] : ['other']
}
