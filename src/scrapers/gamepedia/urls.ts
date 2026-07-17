const SEARCH_QUERY = encodeURIComponent('ガールズバンドクライ')
const SITE_ORIGIN = 'https://premium.gamepedia.jp'
const HOBBY_BASE = `${SITE_ORIGIN}/hobby`

/** JSON-LD / ISO8601 → 统一 UTC ISO。 */
export function parseIsoDate(raw: string): string {
  const ms = Date.parse(raw.trim())
  if (Number.isNaN(ms)) {
    throw new Error(`Unrecognized gamepedia ISO date: ${raw}`)
  }
  return new Date(ms).toISOString()
}

export function absoluteUrl(href: string, base = SITE_ORIGIN): string {
  return new URL(href, base).toString()
}

/** `.../hobby/archives/205942` → `gamepedia-205942` */
export function itemIdFromUrl(url: string): string {
  const match = /\/hobby\/archives\/(\d+)\/?(?:[?#].*)?$/i.exec(url)
  if (!match?.[1]) {
    throw new Error(`Cannot extract gamepedia archives id from url: ${url}`)
  }
  return `gamepedia-${match[1]}`
}

export function listPageUrl(page: number): string {
  if (page <= 1) return `${HOBBY_BASE}/?s=${SEARCH_QUERY}`
  return `${HOBBY_BASE}/page/${page}?s=${SEARCH_QUERY}`
}

export { SITE_ORIGIN, SEARCH_QUERY, HOBBY_BASE }
