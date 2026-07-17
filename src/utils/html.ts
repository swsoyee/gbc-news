export function stripTags(value: string, options: { removeScripts?: boolean } = {}): string {
  let next = value
  if (options.removeScripts !== false) {
    next = next
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  }
  return next.replace(/<[^>]+>/g, ' ')
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#038;/g, '&')
}

export function decodeHtml(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ')
}

export function decodeHtmlKeepNewlines(value: string): string {
  return decodeEntities(value)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n+/g, '\n')
}
