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

const handleResponse = async (response, fallbackMessage) => {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = data.detail || fallbackMessage
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return response.json()
}

export const fetchThemeSettings = async ({ signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/settings/`, { signal })
  return handleResponse(response, 'Failed to load settings.')
}

export const updateThemeSettings = async (formData) => {
  const response = await authenticatedFetch(`${API_BASE}/settings/`, {
    method: 'PATCH',
    body: formData,
  })
  return handleResponse(response, 'Failed to update settings.')
}
