const THEME_STORAGE_PREFIX = 'ikarus-theme'

const DEFAULT_THEME = {
  primary: '#74A42D',
  secondary: '#124D5E',
  logo: null,
}

const hasWindow = () => typeof window !== 'undefined' && typeof document !== 'undefined'

const normalizeColor = (value, fallback) => {
  if (!value) return fallback
  const text = String(value).trim()
  if (!text) return fallback
  const hex = text.startsWith('#') ? text : `#${text}`
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
    return hex
  }
  return fallback
}

const hexToRgb = (hexValue) => {
  const normalized = normalizeColor(hexValue, '')
  if (!normalized) return null
  const hex = normalized.replace('#', '')
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return `${r}, ${g}, ${b}`
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `${r}, ${g}, ${b}`
  }
  return null
}

export const normalizeTheme = (theme, fallback = DEFAULT_THEME) => ({
  primary: normalizeColor(theme?.primary, fallback.primary),
  secondary: normalizeColor(theme?.secondary, fallback.secondary),
  logo: theme?.logo || null,
})

export const getThemeStorageKey = (user) => {
  const id = user?.id || user?.email || 'anonymous'
  return `${THEME_STORAGE_PREFIX}:${id}`
}

export const readStoredTheme = (user) => {
  if (!hasWindow()) return { ...DEFAULT_THEME }
  const key = getThemeStorageKey(user)
  const raw = window.localStorage.getItem(key)
  if (!raw) return { ...DEFAULT_THEME }
  try {
    const parsed = JSON.parse(raw)
    return {
      primary: normalizeColor(parsed?.primary, DEFAULT_THEME.primary),
      secondary: normalizeColor(parsed?.secondary, DEFAULT_THEME.secondary),
      logo: parsed?.logo || null,
    }
  } catch (error) {
    console.warn('Unable to read theme settings', error)
    return { ...DEFAULT_THEME }
  }
}

export const storeTheme = (user, theme) => {
  if (!hasWindow()) return
  const key = getThemeStorageKey(user)
  const payload = {
    primary: normalizeColor(theme?.primary, DEFAULT_THEME.primary),
    secondary: normalizeColor(theme?.secondary, DEFAULT_THEME.secondary),
    logo: theme?.logo || null,
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch (error) {
    console.warn('Unable to store theme settings', error)
  }
}

export const applyTheme = (theme) => {
  if (!hasWindow()) return
  const normalized = normalizeTheme(theme)
  const primary = normalized.primary
  const secondary = normalized.secondary
  const primaryRgb = hexToRgb(primary)
  const secondaryRgb = hexToRgb(secondary)
  const root = document.documentElement
  root.style.setProperty('--theme-primary', primary)
  root.style.setProperty('--theme-secondary', secondary)
  if (primaryRgb) {
    root.style.setProperty('--theme-primary-rgb', primaryRgb)
  }
  if (secondaryRgb) {
    root.style.setProperty('--theme-secondary-rgb', secondaryRgb)
  }
  root.style.setProperty('--color-primary-500', primary)
  root.style.setProperty('--color-primary-700', secondary)
  root.style.setProperty('--color-focus', secondary)
}

export const getThemeColors = () => {
  if (!hasWindow()) return { ...DEFAULT_THEME }
  const styles = getComputedStyle(document.documentElement)
  const primary = styles.getPropertyValue('--theme-primary').trim() || DEFAULT_THEME.primary
  const secondary = styles.getPropertyValue('--theme-secondary').trim() || DEFAULT_THEME.secondary
  return {
    primary: normalizeColor(primary, DEFAULT_THEME.primary),
    secondary: normalizeColor(secondary, DEFAULT_THEME.secondary),
  }
}

export const defaultTheme = { ...DEFAULT_THEME }
