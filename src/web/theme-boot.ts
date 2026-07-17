import { resolveTheme, THEME_STORAGE_KEY } from './subscribe-core.js'

function readStoredThemeValue(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function prefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

function themeColorFromCss(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim()
}

function applyBootTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!(meta instanceof HTMLMetaElement)) return
  meta.content = themeColorFromCss() || (theme === 'light' ? '#f8f6f2' : '#101418')
}

applyBootTheme(resolveTheme(readStoredThemeValue(), prefersLight()))
