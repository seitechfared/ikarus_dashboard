import { useEffect, useRef } from 'react'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { useToast } from '@/components/common/ToastProvider'

const ALERT_POLL_INTERVAL_MS = 15000
const SEVERITY_VARIANTS = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
}

const humanizeAlertType = (value) => {
  if (!value) {
    return 'Alert'
  }
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const buildAlertMessage = (alert = {}) => {
  if (alert.message) {
    return alert.message
  }
  const typeLabel = humanizeAlertType(alert.type)
  const locationBits = []
  if (alert.charger_name) {
    locationBits.push(alert.charger_name)
  } else if (alert.station_name) {
    locationBits.push(alert.station_name)
  }
  if (alert.connector_number != null) {
    locationBits.push(`Connector ${alert.connector_number}`)
  }
  if (locationBits.length) {
    return `${typeLabel} - ${locationBits.join(' • ')}`
  }
  return typeLabel
}

const resolveVariant = (severity) => SEVERITY_VARIANTS[severity] || 'info'
const ALERT_POLL_LIMIT = 50

export default function useAlertToasts({
  enabled = true,
  pollInterval = ALERT_POLL_INTERVAL_MS,
} = {}) {
  const { showToast } = useToast()
  const seenRef = useRef(new Set())
  const initialRef = useRef(true)
  const inFlightRef = useRef(false)
  const latestOccurredAtRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    let timerId
    let isActive = true

    const fetchAlerts = async () => {
      if (inFlightRef.current || !isActive) {
        return
      }
      inFlightRef.current = true
      try {
        const params = new URLSearchParams()
        params.set('limit', String(ALERT_POLL_LIMIT))
        if (latestOccurredAtRef.current) {
          const latestTs = Date.parse(latestOccurredAtRef.current)
          if (!Number.isNaN(latestTs)) {
            // Pull a 1-second overlap to avoid missing alerts with identical timestamps.
            params.set('since', new Date(latestTs - 1000).toISOString())
          }
        }
        const response = await fetch(`${API_BASE}/alerts/?${params.toString()}`, {
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          return
        }
        const payload = await response.json().catch(() => null)
        if (!Array.isArray(payload)) {
          return
        }
        payload.forEach((alert) => {
          const occurredAt = alert?.occurred_at ? Date.parse(alert.occurred_at) : Number.NaN
          if (Number.isNaN(occurredAt)) {
            return
          }
          if (!latestOccurredAtRef.current || occurredAt > Date.parse(latestOccurredAtRef.current)) {
            latestOccurredAtRef.current = new Date(occurredAt).toISOString()
          }
        })
        if (initialRef.current) {
          payload.forEach((alert) => {
            if (alert?.id) {
              seenRef.current.add(alert.id)
            }
          })
          initialRef.current = false
          return
        }
        payload.forEach((alert) => {
          if (!alert?.id || seenRef.current.has(alert.id)) {
            return
          }
          seenRef.current.add(alert.id)
          showToast({
            message: buildAlertMessage(alert),
            variant: resolveVariant(alert.severity),
            duration: 10000,
          })
        })
      } catch (error) {
        console.warn('Unable to fetch alerts', error)
      } finally {
        inFlightRef.current = false
      }
    }

    fetchAlerts()
    timerId = setInterval(fetchAlerts, pollInterval)

    return () => {
      isActive = false
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [enabled, pollInterval, showToast])
}
