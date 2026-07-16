export function parseFirstriffDate(raw: string): string {
  const normalized = raw.trim().replace(/\./g, '-')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (!match) {
    throw new Error(`Unrecognized Firstriff date: ${raw}`)
  }
  const [, year, month, day] = match
  return `${year}-${month}-${day}T00:00:00.000Z`
}

export function absoluteUrl(href: string, base = 'https://gbc-firstriff.com'): string {
  return new URL(href, base).toString()
}

export function postIdFromUrl(url: string): string {
  const match = /post-(\d+)\.html(?:[?#].*)?$/.exec(url)
  if (!match) {
    throw new Error(`Cannot extract post id from url: ${url}`)
  }
  return `firstriff-post-${match[1]}`
}

export function listPageUrl(page: number): string {
  if (page <= 1) return 'https://gbc-firstriff.com/news/'
  return `https://gbc-firstriff.com/news/page/${page}/`
}
