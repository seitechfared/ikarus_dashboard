import { canonicalizeAdminRole } from '@/utils/adminRoles'

const hasWindow = () => typeof window !== 'undefined'

export const SESSION_STORAGE_KEY = 'ikarus-current-session'
const SESSION_EXPIRED_KEY = 'ikarus-session-expired'
export const SESSION_EXPIRED_EVENT = 'ikarus:session-expired'

let fetchInterceptorInstalled = false
let originalFetch = null

const safeParse = (value) => {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Unable to parse stored session payload', error)
    return null
  }
}

export const normalizeUser = (payload, fallback = {}) => {
  const source = payload ?? {}
  const fallbackEmail =
    typeof fallback === 'string' ? fallback : fallback?.email ?? ''
  const fallbackRole =
    typeof fallback === 'string' ? undefined : fallback?.role ?? undefined

  const email = source.email ?? fallbackEmail
  if (!email) {
    return null
  }

  const resolvedRole =
    source.role ??
    (source.is_super_admin ? 'super_admin' : null) ??
    source.permission ??
    fallbackRole ??
    'guest'
  const canonicalRole = canonicalizeAdminRole(resolvedRole) || 'guest'
  const profileImage =
    source.profile_image ??
    source.profileImage ??
    (typeof fallback === 'object' ? fallback.profile_image ?? fallback.profileImage : null) ??
    null

  return {
    id: source.id ?? null,
    email,
    role: canonicalRole,
    firstName: source.first_name ?? source.firstName ?? '',
    lastName: source.last_name ?? source.lastName ?? '',
    profile_image: profileImage,
  }
}

export const getStoredSession = () => {
  if (!hasWindow()) {
    return null
  }
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
  const parsed = safeParse(raw)
  if (!parsed || typeof parsed !== 'object') {
    return null
  }
  return parsed
}

export const storeSession = (session) => {
  if (!hasWindow()) {
    return
  }
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch (error) {
    console.warn('Unable to write session payload', error)
  }
}

export const clearStoredSession = () => {
  if (!hasWindow()) {
    return
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export const getSessionToken = () => {
  const session = getStoredSession()
  return session?.token ?? null
}

export const markSessionExpired = () => {
  if (!hasWindow()) {
    return
  }
  window.sessionStorage.setItem(SESSION_EXPIRED_KEY, '1')
}

export const consumeSessionExpired = () => {
  if (!hasWindow()) {
    return false
  }
  const flagged = window.sessionStorage.getItem(SESSION_EXPIRED_KEY)
  if (!flagged) {
    return false
  }
  window.sessionStorage.removeItem(SESSION_EXPIRED_KEY)
  return true
}

export const notifySessionExpired = () => {
  markSessionExpired()
  if (!hasWindow()) {
    return
  }
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

export const installSessionExpiryInterceptor = (apiBase) => {
  if (!hasWindow() || fetchInterceptorInstalled || typeof window.fetch !== 'function') {
    return () => {}
  }
  originalFetch = window.fetch.bind(window)
  fetchInterceptorInstalled = true

  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    try {
      const token = getSessionToken()
      if (token) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
        if (url && apiBase && url.startsWith(apiBase) && response?.status === 401) {
          notifySessionExpired()
        }
      }
    } catch (error) {
      console.warn('Unable to inspect auth response', error)
    }
    return response
  }

  return () => {
    if (fetchInterceptorInstalled && originalFetch) {
      window.fetch = originalFetch
      fetchInterceptorInstalled = false
      originalFetch = null
    }
  }
}

export const appendAuthHeader = (headers = {}) => {
  const { skipContentType, ...rest } = headers
  if (skipContentType && Object.prototype.hasOwnProperty.call(rest, 'Content-Type')) {
    delete rest['Content-Type']
  }
  const token = getSessionToken()
  if (!token) {
    return { ...rest }
  }
  return {
    ...rest,
    Authorization: `Bearer ${token}`,
  }
}
