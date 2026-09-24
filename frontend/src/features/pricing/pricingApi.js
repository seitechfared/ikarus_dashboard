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
    const detail = data.detail || fallbackMessage
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return response.json()
}

export const fetchChargersPage = async ({ page = 1, pageSize = 100, countryCode, signal } = {}) => {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (countryCode) {
    params.set('country', countryCode)
  }
  const response = await authenticatedFetch(`${API_BASE}/chargers/?${params.toString()}`, { signal })
  const data = await handleResponse(response, 'Failed to load chargers.')
  const results = Array.isArray(data) ? data : data.results ?? []
  return {
    results,
    pagination: data?.pagination ?? null,
  }
}

export const fetchAllChargers = async ({ countryCode, signal } = {}) => {
  const chargers = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    // eslint-disable-next-line no-await-in-loop
    const { results, pagination } = await fetchChargersPage({ page, pageSize: 100, countryCode, signal })
    chargers.push(...results)
    if (pagination?.total_pages) {
      totalPages = pagination.total_pages
    } else if (results.length === 0 || results.length < 100) {
      break
    } else {
      totalPages = page + 1
    }
    page += 1
  }
  return chargers
}

export const fetchPricingSummary = async ({ countryCode, signal } = {}) => {
  const params = new URLSearchParams()
  if (countryCode) {
    params.set('country', countryCode)
  }
  const url = params.toString() ? `${API_BASE}/chargers/pricing-summary/?${params.toString()}` : `${API_BASE}/chargers/pricing-summary/`
  const response = await authenticatedFetch(url, { signal })
  return handleResponse(response, 'Failed to load pricing summary.')
}

export const fetchGeneralPricing = async ({ countryCode, signal } = {}) => {
  const params = new URLSearchParams()
  if (countryCode) {
    params.set('country', countryCode)
  }
  const url = params.toString() ? `${API_BASE}/pricing/general/?${params.toString()}` : `${API_BASE}/pricing/general/`
  const response = await authenticatedFetch(url, { signal })
  return handleResponse(response, 'Failed to load general pricing.')
}

export const updateGeneralPricing = async (payload = {}, { countryCode } = {}) => {
  const params = new URLSearchParams()
  if (countryCode || payload?.country_code) {
    params.set('country', countryCode || payload.country_code)
  }
  const url = params.toString() ? `${API_BASE}/pricing/general/?${params.toString()}` : `${API_BASE}/pricing/general/`
  const response = await authenticatedJsonFetch(url, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update general pricing.')
}

export const fetchChargerPricing = async (chargerId, { signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/chargers/${chargerId}/pricing/`, { signal })
  return handleResponse(response, 'Failed to load charger pricing.')
}

export const deleteChargerPricing = async (chargerId) => {
  const response = await authenticatedFetch(`${API_BASE}/chargers/${chargerId}/pricing/`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to delete custom pricing.')
  }
}

export const updateChargerPricing = async (chargerId, payload = {}, { countryCode } = {}) => {
  const params = new URLSearchParams()
  if (countryCode) {
    params.set('country', countryCode)
  }
  const url = params.toString()
    ? `${API_BASE}/chargers/${chargerId}/pricing/?${params.toString()}`
    : `${API_BASE}/chargers/${chargerId}/pricing/`
  const response = await authenticatedJsonFetch(url, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update charger pricing.')
}
