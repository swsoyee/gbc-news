export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}`)
    this.name = 'HttpError'
  }
}

export interface FetchTextOptions {
  timeoutMs?: number
  userAgent?: string
  headers?: Record<string, string>
}

export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          options.userAgent ??
          'gbc-news/0.1 (+https://github.com/swsoyee/gbc-news; research crawler)',
        accept: 'text/html,application/xhtml+xml',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new HttpError(response.status, url)
    }

    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}
