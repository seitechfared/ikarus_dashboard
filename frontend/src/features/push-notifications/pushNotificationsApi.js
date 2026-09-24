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

const authenticatedMultipartFetch = (url, options = {}) => {
  const headers = appendAuthHeader({
    ...options.headers,
    skipContentType: true,
  })
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  })
}

const handleJsonResponse = async (response, fallbackMessage) => {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = data.detail || fallbackMessage
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return response.json()
}

const handleEmptyResponse = async (response, fallbackMessage) => {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const detail = data.detail || fallbackMessage
    const error = new Error(detail)
    error.status = response.status
    throw error
  }
  return true
}

const buildDistrictsQuery = (cityIds = []) => {
  const params = new URLSearchParams()
  cityIds
    .map((cityId) => String(cityId ?? '').trim())
    .filter(Boolean)
    .forEach((cityId) => {
      params.append('city_ids', cityId)
    })
  return params.toString()
}

const buildPushNotificationsListQuery = ({ page, pageSize, search, filters } = {}) => {
  const params = new URLSearchParams()

  if (Number.isFinite(Number(page)) && Number(page) > 0) {
    params.set('page', String(page))
  }
  if (Number.isFinite(Number(pageSize)) && Number(pageSize) > 0) {
    params.set('page_size', String(pageSize))
  }
  if (typeof search === 'string' && search.trim()) {
    params.set('search', search.trim())
  }
  if (filters && typeof filters === 'object') {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }
      if (Array.isArray(value)) {
        value
          .map((entry) => String(entry ?? '').trim())
          .filter(Boolean)
          .forEach((entry) => params.append(key, entry))
        return
      }
      params.set(key, String(value).trim())
    })
  }

  return params.toString()
}

export async function listPushNotificationCountries({ signal } = {}) {
  const response = await authenticatedFetch(`${API_BASE}/push-notifications/countries/`, {
    signal,
  })
  return handleJsonResponse(response, 'Failed to load countries.')
}

export async function listPushNotificationCities({ countryCode, signal } = {}) {
  const params = new URLSearchParams()
  if (countryCode) {
    params.set('country_code', countryCode)
  }
  const query = params.toString()
  const url = query
    ? `${API_BASE}/push-notifications/cities/?${query}`
    : `${API_BASE}/push-notifications/cities/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleJsonResponse(response, 'Failed to load cities.')
}

export async function listPushNotificationDistricts({ cityIds, signal } = {}) {
  const query = buildDistrictsQuery(cityIds)
  const url = query
    ? `${API_BASE}/push-notifications/districts/?${query}`
    : `${API_BASE}/push-notifications/districts/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleJsonResponse(response, 'Failed to load districts.')
}

export async function listPushNotifications({ page = 1, pageSize = 25, search = '', filters, signal } = {}) {
  const query = buildPushNotificationsListQuery({ page, pageSize, search, filters })
  const url = query
    ? `${API_BASE}/push-notifications/?${query}`
    : `${API_BASE}/push-notifications/`
  const response = await authenticatedFetch(url, {
    signal,
  })
  return handleJsonResponse(response, 'Failed to load push notifications.')
}

export async function getPushNotification(notificationId, { signal } = {}) {
  const response = await authenticatedFetch(
    `${API_BASE}/push-notifications/${notificationId}/`,
    {
      signal,
    }
  )
  return handleJsonResponse(response, 'Failed to load push notification.')
}

export async function getPushNotificationJobStatus(jobId, { signal } = {}) {
  const response = await authenticatedFetch(
    `${API_BASE}/push-notification-jobs/${jobId}/status/`,
    {
      signal,
    }
  )
  return handleJsonResponse(response, 'Failed to load push notification job status.')
}

export async function createPushNotification(formData, { signal } = {}) {
  const response = await authenticatedMultipartFetch(`${API_BASE}/push-notifications/`, {
    method: 'POST',
    body: formData,
    signal,
  })
  return handleJsonResponse(response, 'Failed to create push notification.')
}

export async function updatePushNotification(notificationId, formData, { signal } = {}) {
  const response = await authenticatedMultipartFetch(
    `${API_BASE}/push-notifications/${notificationId}/`,
    {
      method: 'PATCH',
      body: formData,
      signal,
    }
  )
  return handleJsonResponse(response, 'Failed to update push notification.')
}

export async function deletePushNotification(notificationId, { signal } = {}) {
  const response = await authenticatedFetch(
    `${API_BASE}/push-notifications/${notificationId}/`,
    {
      method: 'DELETE',
      signal,
    }
  )
  return handleEmptyResponse(response, 'Failed to delete push notification.')
}

export async function repushPushNotification(notificationId, { signal } = {}) {
  const response = await authenticatedJsonFetch(
    `${API_BASE}/push-notifications/${notificationId}/re-push/`,
    {
      method: 'POST',
      signal,
    }
  )
  return handleJsonResponse(response, 'Failed to re-push push notification.')
}
