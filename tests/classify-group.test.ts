import { describe, expect, it } from 'vitest'
import { classifyGroups, classifyGroupsForSource } from '../src/categories/classify-group.js'

describe('classifyGroups', () => {
  it('命中谁打谁', () => {
    expect(classifyGroups('トゲナシトゲアリ LIVE')).toEqual(['togenashi'])
    expect(classifyGroups('F-272 1st ONE-MAN LIVE')).toEqual(['f272'])
    expect(classifyGroups('Canna Lily 2nd LIVE')).toEqual(['canna-lily'])
  })

  it('可一文多组合', () => {
    expect(classifyGroups('トゲナシトゲアリとCanna Lilyが出展')).toEqual([
      'togenashi',
      'canna-lily',
    ])
  })

  it('未命中 → other', () => {
    expect(classifyGroups('お知らせ')).toEqual(['other'])
  })
})

describe('classifyGroupsForSource', () => {
  it('gbc-news 仅 other 时改为 togenashi（D3）', () => {
    expect(classifyGroupsForSource('gbc-news', 'お知らせ')).toEqual(['togenashi'])
  })

  it('gbc-news 已有队名时不覆盖', () => {
    expect(classifyGroupsForSource('gbc-news', 'トゲナシトゲアリ 甚平')).toEqual(['togenashi'])
  })

  it('firstriff 保持 other', () => {
    expect(classifyGroupsForSource('gbc-firstriff', 'AnimeJapan 出展')).toEqual(['other'])
  })
})
