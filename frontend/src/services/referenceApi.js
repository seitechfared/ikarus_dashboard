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

export const fetchCompanyTypes = async ({ signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/reference/company-types/`, {
    signal,
  })
  return handleResponse(response, 'Failed to load company types.')
}

export const fetchCountries = async ({ signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/reference/countries/`, {
    signal,
  })
  return handleResponse(response, 'Failed to load countries.')
}

export const fetchCities = async ({ countryCode, search, includeInactive = false, signal } = {}) => {
  const params = new URLSearchParams()
  if (countryCode) {
    params.set('country', countryCode)
  }
  if (search) {
    params.set('search', search)
  }
  if (includeInactive) {
    params.set('include_inactive', 'true')
  }
  const query = params.toString()
  const url = query ? `${API_BASE}/reference/cities/?${query}` : `${API_BASE}/reference/cities/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleResponse(response, 'Failed to load cities.')
}

export const fetchDistricts = async ({ cityId, search, includeInactive = false, signal } = {}) => {
  const params = new URLSearchParams()
  if (cityId) {
    params.set('city_id', cityId)
  }
  if (search) {
    params.set('search', search)
  }
  if (includeInactive) {
    params.set('include_inactive', 'true')
  }
  const query = params.toString()
  const url = query ? `${API_BASE}/reference/districts/?${query}` : `${API_BASE}/reference/districts/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleResponse(response, 'Failed to load districts.')
}

export const fetchPackages = async ({ search, includeInactive = true, countryCode, signal } = {}) => {
  const params = new URLSearchParams()
  if (search) {
    params.set('search', search)
  }
  if (countryCode) {
    params.set('country', countryCode)
  }
  if (includeInactive) {
    params.set('include_inactive', 'true')
  }
  const query = params.toString()
  const url = query ? `${API_BASE}/packages/?${query}` : `${API_BASE}/packages/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleResponse(response, 'Failed to load packages.')
}

export const fetchPackage = async (packageId, { signal } = {}) => {
  const response = await authenticatedFetch(`${API_BASE}/packages/${packageId}/`, {
    signal,
  })
  return handleResponse(response, 'Failed to load package.')
}

export const createPackage = async (payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/packages/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to create package.')
}

export const updatePackage = async (packageId, payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/packages/${packageId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update package.')
}

export const updateAllPackageFees = async (payload = {}) => {
  const params = new URLSearchParams()
  if (payload?.country_code) {
    params.set('country', payload.country_code)
  }
  const url = params.toString() ? `${API_BASE}/packages/?${params.toString()}` : `${API_BASE}/packages/`
  const response = await authenticatedJsonFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update package fees.')
}

export const deletePackage = async (packageId) => {
  const response = await authenticatedFetch(`${API_BASE}/packages/${packageId}/`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = data.detail || 'Failed to delete package.'
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return true
}
