import { describe, expect, it } from 'vitest'
import { decodeHtml, decodeHtmlKeepNewlines, stripTags } from '../src/utils/html.js'

describe('html utils', () => {
  it('stripTags removes tags and script/style blocks', () => {
    expect(stripTags('<p>a<script>x</script>b</p>').replace(/\s+/g, ' ').trim()).toBe('a b')
  })

  it('decodeHtml expands entities and collapses whitespace', () => {
    expect(decodeHtml('A&nbsp;&amp;&#8211; B').trim()).toBe('A &– B')
  })

  it('decodeHtmlKeepNewlines preserves newlines', () => {
    expect(decodeHtmlKeepNewlines('A\n\n  B  \n').trim()).toBe('A\nB')
  })
})
