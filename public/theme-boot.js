'use strict'
;(() => {
  // src/web/subscribe-core.ts
  var THEME_STORAGE_KEY = 'gbc-news-theme'
  function isThemeName(value) {
    return value === 'dark' || value === 'light'
  }
  function resolveTheme(stored, prefersLight2) {
    if (isThemeName(stored)) return stored
    return prefersLight2 ? 'light' : 'dark'
  }

  // src/web/theme-boot.ts
  function readStoredThemeValue() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      return null
    }
  }
  function prefersLight() {
    return window.matchMedia('(prefers-color-scheme: light)').matches
  }
  function themeColorFromCss() {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim()
  }
  function applyBootTheme(theme) {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!(meta instanceof HTMLMetaElement)) return
    meta.content = themeColorFromCss() || (theme === 'light' ? '#f8f6f2' : '#101418')
  }
  applyBootTheme(resolveTheme(readStoredThemeValue(), prefersLight()))
})()
