import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'

const authenticatedFetch = (url, options = {}) => {
  const headers = appendAuthHeader(options.headers)
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  })
}

const authenticatedJsonFetch = (url, options = {}) => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  return authenticatedFetch(url, { ...options, headers: baseHeaders })
}

const handleResponse = async (response, fallbackMessage) => {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail =
      data.detail ||
      Object.values(data).flat().find((value) => typeof value === 'string') ||
      fallbackMessage
    const error = new Error(detail)
    error.status = response.status
    error.data = data
    throw error
  }
  return response.json()
}

export const fetchAppVersions = async ({ signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/mobile-app-versions/`, {
    signal,
  })
  return handleResponse(response, 'Failed to load app versions.')
}

export const updateAppVersion = async (platform, payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/mobile-app-versions/${platform}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update app version.')
}