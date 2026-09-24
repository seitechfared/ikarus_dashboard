import { API_BASE } from '@/constants'

const API_MEDIA_BASE = (() => {
  const candidate = API_BASE.replace(/\/api\/?$/, '/')
  return candidate.endsWith('/') ? candidate : `${candidate}/`
})()

export const buildMediaUrl = (value) => {
  if (!value) return ''

  if (/^(?:https?:|blob:|data:)/i.test(value)) {
    return value
  }

  if (value.startsWith('/')) {
    return `${API_MEDIA_BASE}${value.replace(/^\//, '')}`
  }

  return `${API_MEDIA_BASE}${value}`
}
