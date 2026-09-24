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

export const updateCountry = async (countryCode, payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/countries/${countryCode}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update country.')
}

export const createCountry = async (payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/countries/create/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to create country.')
}

export const updateCity = async (cityId, payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/cities/${cityId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update governorate.')
}

export const createCity = async (payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/cities/create/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to create governorate.')
}

export const updateDistrict = async (districtId, payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/districts/${districtId}/`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to update district.')
}

export const createDistrict = async (payload = {}) => {
  const response = await authenticatedJsonFetch(`${API_BASE}/reference/districts/create/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse(response, 'Failed to create district.')
}
