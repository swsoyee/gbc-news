const SEARCH_QUERY = encodeURIComponent('ガールズバンドクライ')
const SITE_ORIGIN = 'https://collabo-cafe.com'

/** 列表发布日：`2026/07/07` → ISO。 */
export function parseListDate(raw: string): string {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(raw.trim())
  if (!match) {
    throw new Error(`Unrecognized collabo-cafe list date: ${raw}`)
  }
  const [, year, month, day] = match
  return `${year}-${month}-${day}T00:00:00.000Z`
}

/** JSON-LD / ISO8601 → 统一 UTC ISO。 */
export function parseIsoDate(raw: string): string {
  const ms = Date.parse(raw.trim())
  if (Number.isNaN(ms)) {
    throw new Error(`Unrecognized collabo-cafe ISO date: ${raw}`)
  }
  return new Date(ms).toISOString()
}

export function absoluteUrl(href: string, base = SITE_ORIGIN): string {
  return new URL(href, base).toString()
}

/** `.../events/collabo/<slug>/` → `collabo-<slug>` */
export function itemIdFromUrl(url: string): string {
  const match = /\/events\/collabo\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(url)
  if (!match?.[1]) {
    throw new Error(`Cannot extract collabo slug from url: ${url}`)
  }
  return `collabo-${match[1]}`
}

export function listPageUrl(page: number): string {
  if (page <= 1) return `${SITE_ORIGIN}/?s=${SEARCH_QUERY}`
  return `${SITE_ORIGIN}/page/${page}/?s=${SEARCH_QUERY}`
}

export { SITE_ORIGIN, SEARCH_QUERY }
