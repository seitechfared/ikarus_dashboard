import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import ChargerActionMenu from '@/components/ui/organisms/ChargerActionMenu'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { fetchCountries } from '@/services/referenceApi'
import { API_BASE, GOOGLE_MAPS_API_KEY } from '@/constants'
import { createMapPinIcon, MAP_PIN_SIZE } from '@/utils/mapPinIcon'
import { hexToRgba } from '@/utils/color'
import { getThemeColors } from '@/utils/theme'
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_OPTIONS,
  MAP_CONTAINER_STYLE,
  useGoogleMapsLoader,
} from '@/utils/mapConfig'
import { buildMediaUrl } from '@/utils/media'
import {
  CHARGER_STATUS_COLORS,
  CHARGER_STATUS_LABELS,
  CONNECTOR_STATUS_BACKGROUNDS,
  CONNECTOR_STATUS_COLORS,
  CONNECTOR_STATUS_LABELS,
  CONNECTOR_STATUS_ORDER,
  normalizeChargerStatus,
  normalizeConnectorStatus,
} from '@/utils/status'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import useDashboardLiveUpdates from '@/hooks/useDashboardLiveUpdates'
import '@/styles/dashboard.css'

const VIEW_MODES = {
  LIST: 'list',
  MAP: 'map',
}

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]

const MAP_PAGE_SIZE = 200
const MAX_MAP_PAGES = 5
const STATION_PAGE_SIZE = 200
const MAX_STATION_PAGES = 10

const MAP_OPTIONS = DEFAULT_MAP_OPTIONS

const CONNECTOR_FILTERS_BASE = CONNECTOR_STATUS_ORDER.map((status) => ({
  value: status,
  label: CONNECTOR_STATUS_LABELS[status] || status,
  color: CONNECTOR_STATUS_COLORS[status],
}))

const createEmptyFilters = () => ({
  governorates: [],
  visibilities: [],
  statuses: [],
  connectorStatuses: [],
})

const getChargerGovernorate = (charger) =>
  (charger.governorate || charger.station?.governorate || '').trim()

const getChargerVisibility = (charger) => {
  const visibility = charger.visibility
  if (!visibility) {
    return ''
  }
  if (typeof visibility === 'string') {
    return visibility
  }
  return visibility.value || ''
}

const getChargerStatus = (charger) => {
  const status = charger.status
  if (!status) {
    return 'planned'
  }
  const statusValue = typeof status === 'string' ? status : status.value || ''
  return normalizeChargerStatus(statusValue)
}

const chargerMatchesFilters = (charger, appliedFilters) => {
  const governorateKey = getChargerGovernorate(charger)
  if (appliedFilters.governorates?.length && !appliedFilters.governorates.includes(governorateKey)) {
    return false
  }
  const visibilityKey = getChargerVisibility(charger)
  if (appliedFilters.visibilities?.length && !appliedFilters.visibilities.includes(visibilityKey)) {
    return false
  }
  const statusKey = getChargerStatus(charger)
  if (appliedFilters.statuses?.length && !appliedFilters.statuses.includes(statusKey)) {
    return false
  }
  if (appliedFilters.connectorStatuses?.length) {
    const summary = charger.connectorStatus?.summary || {}
    const hasMatch = appliedFilters.connectorStatuses.some(
      (status) => (summary[status] ?? 0) > 0
    )
    if (!hasMatch) {
      return false
    }
  }
  return true
}

const appendFilterParams = (params, key, values) => {
  if (!Array.isArray(values)) {
    return
  }
  values.forEach((value) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.append(key, String(value))
    }
  })
}

const applyChargerFiltersToParams = (params, appliedFilters, countries = null) => {
  appendFilterParams(params, 'governorate', appliedFilters.governorates)
  appendFilterParams(params, 'visibility', appliedFilters.visibilities)
  appendFilterParams(params, 'status', appliedFilters.statuses)
  if (countries) {
    const list = countries instanceof Set ? Array.from(countries) : Array.isArray(countries) ? countries : [countries]
    list.forEach((code) => {
      if (code) {
        params.append('country', code)
      }
    })
  }
}

const DownloadIcon = () => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20.3447 14.1624C20.171 14.1624 20.0043 14.2314 19.8814 14.3543C19.7585 14.4772 19.6895 14.6438 19.6895 14.8176V17.0553C19.6895 17.5828 19.48 18.0886 19.107 18.4616C18.734 18.8345 18.2282 19.044 17.7008 19.044H6.29924C5.7718 19.044 5.26596 18.8345 4.893 18.4616C4.52005 18.0886 4.31052 17.5828 4.31052 17.0553V14.8176C4.31052 14.6438 4.24148 14.4772 4.1186 14.3543C3.99571 14.2314 3.82905 14.1624 3.65526 14.1624C3.48147 14.1624 3.31481 14.2314 3.19192 14.3543C3.06904 14.4772 3 14.6438 3 14.8176V17.0553C3.00087 17.9301 3.34874 18.7687 3.96728 19.3873C4.58582 20.0058 5.42449 20.3537 6.29924 20.3546H17.7008C18.5755 20.3537 19.4142 20.0058 20.0327 19.3873C20.6513 18.7687 20.9991 17.9301 21 17.0553V14.8176C21 14.6438 20.931 14.4772 20.8081 14.3543C20.6852 14.2314 20.5185 14.1624 20.3447 14.1624Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
    <path
      d="M11.5348 16.0756C11.5957 16.137 11.6682 16.1857 11.748 16.219C11.8279 16.2522 11.9135 16.2694 12 16.2694C12.0865 16.2694 12.1722 16.2522 12.252 16.219C12.3319 16.1857 12.4043 16.137 12.4652 16.0756L16.1937 12.3471C16.2977 12.2219 16.3514 12.0625 16.3444 11.8999C16.3373 11.7373 16.27 11.5831 16.1555 11.4674C16.0411 11.3517 15.8876 11.2828 15.7251 11.274C15.5626 11.2652 15.4026 11.3172 15.2763 11.4199L12.6553 14.041V4.30052C12.6553 4.12674 12.5862 3.96007 12.4634 3.83718C12.3405 3.7143 12.1738 3.64526 12 3.64526C11.8262 3.64526 11.6596 3.7143 11.5367 3.83718C11.4138 3.96007 11.3448 4.12674 11.3448 4.30052V14.0311L8.72371 11.4101C8.60076 11.2871 8.434 11.2181 8.26012 11.2181C8.08623 11.2181 7.91947 11.2871 7.79652 11.4101C7.67357 11.5331 7.60449 11.6998 7.60449 11.8737C7.60449 12.0476 7.67357 12.2143 7.79652 12.3373L11.5348 16.0756Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
  </svg>
)

const AddChargerIcon = () => (
  <span className="primary-add-button__icon" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 12H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5V19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
)

const hasCoordinates = (entry) =>
  entry &&
  Number.isFinite(entry.latitude) &&
  Number.isFinite(entry.longitude)

const toLatLngOrNull = (entry) => {
  if (!hasCoordinates(entry)) {
    return null
  }
  return { lat: Number(entry.latitude), lng: Number(entry.longitude) }
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  const stringValue =
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : String(value)
  const needsQuotes = /[",\n]/.test(stringValue)
  const escaped = stringValue.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

const downloadCsv = ({ headers, rows, filename }) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  const csvLines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const formatDateTime = (input) => {
  if (!input) {
    return '—'
  }
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeChargerRow = (row, fallbackIndex = 0) => {
  const statusValue = row?.status?.value || row?.status
  // Normalize status to one of the 3 allowed values
  const normalizedStatus = normalizeChargerStatus(statusValue)
  const visibilityValue = row?.visibility?.value || row?.visibility
  const stationId = row?.station?.id ? String(row.station.id) : null
  const number =
    row?.number ||
    row?.charger_box_id ||
    row?.box_id ||
    row?.serial_number ||
    row?.ocpp_identifier ||
    row?.identifier ||
    `charger-${fallbackIndex}`
  return {
    id: row?.id ? String(row.id) : `charger-${fallbackIndex}`,
    name: row?.name?.trim() || number,
    number,
    station: row?.station
      ? {
          id: stationId,
          name: row.station.name,
          governorate: row.station.governorate,
        }
      : null,
    governorate: row?.governorate || row?.station?.governorate || null,
    chargerBoxId: row?.charger_box_id || row?.box_id || null,
    status: {
      value: normalizedStatus,
      label: CHARGER_STATUS_LABELS[normalizedStatus] || normalizedStatus,
      color: CHARGER_STATUS_COLORS[normalizedStatus] || CHARGER_STATUS_COLORS.planned,
    },
    connectorStatus: row?.connector_status || { summary: {}, total: 0, indicators: [] },
    visibility: row?.visibility
      ? {
          value: visibilityValue,
          label: row.visibility.label || visibilityValue,
          color: row.visibility.color,
        }
      : { value: visibilityValue, label: visibilityValue },
    brand: row?.brand
      ? { ...row.brand, logo: buildMediaUrl(row.brand.logo) }
      : { name: row?.brand_name || '—', logo: buildMediaUrl(row?.brand_logo) },
    kwhLimit: row?.kwh_limit ?? row?.kwhLimit,
    lastHeartbeatAt: row?.last_heartbeat_at || row?.lastHeartbeatAt || null,
    updatedAt: row?.updated_at || row?.updatedAt || null,
    actions: row?.actions?.length ? row.actions : undefined,
  }
}

const buildChargerStatusBadge = (statusValue) => {
  const normalizedStatus = normalizeChargerStatus(statusValue)
  return {
    value: normalizedStatus,
    label: CHARGER_STATUS_LABELS[normalizedStatus] || normalizedStatus,
    color: CHARGER_STATUS_COLORS[normalizedStatus] || CHARGER_STATUS_COLORS.planned,
  }
}

const buildConnectorSummaryFromTooltips = (tooltips = []) => {
  const summary = {}
  CONNECTOR_STATUS_ORDER.forEach((status) => {
    summary[status] = 0
  })
  tooltips.forEach((tooltip) => {
    const normalized = normalizeConnectorStatus(tooltip?.status)
    summary[normalized] = (summary[normalized] || 0) + 1
  })
  const indicators = tooltips.slice(0, 2).map((tooltip) => {
    const normalized = normalizeConnectorStatus(tooltip?.status)
    return {
      status: normalized,
      color: CONNECTOR_STATUS_COLORS[normalized] || CONNECTOR_STATUS_COLORS.unavailable,
    }
  })
  const total = Object.values(summary).reduce((acc, value) => acc + Number(value || 0), 0)
  return { summary, total, indicators, tooltips }
}
function Chargers() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('chargers')
  const { subscribeMany, registerReconnectRefetch } = useDashboardLiveUpdates()
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST)
  const [chargers, setChargers] = useState([])
  const [allChargersForCounts, setAllChargersForCounts] = useState([])
  const [mapChargers, setMapChargers] = useState([])
  const [availableFilters, setAvailableFilters] = useState({
    governorates: [],
    visibilities: [],
    statuses: [],
  })
  const [filters, setFilters] = useState(() => createEmptyFilters())
  const [countries, setCountries] = useState([])
  const [selectedCountries, setSelectedCountries] = useState(() => new Set())
  const [draftCountries, setDraftCountries] = useState(() => new Set())
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false)
  const countryMenuRef = useRef(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  })
  const [stationDirectory, setStationDirectory] = useState(new Map())
  const [selectedChargerId, setSelectedChargerId] = useState(null)
  const [selectedChargerIds, setSelectedChargerIds] = useState(() => new Set())
  const selectAllCheckboxRef = useRef(null)
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    charger: null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [error, setError] = useState('')
  const [openFilterKey, setOpenFilterKey] = useState(null)
  const [draftFilters, setDraftFilters] = useState(() => createEmptyFilters())
  const [socketResyncKey, setSocketResyncKey] = useState(0)

  const isMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY)
  const { isLoaded: isGoogleMapsReady, loadError: mapLoadError } = useGoogleMapsLoader()

  const mapPinIcon = useMemo(() => {
    const googleMaps = typeof window !== 'undefined' && isGoogleMapsReady ? window.google?.maps : null
    return createMapPinIcon(googleMaps)
  }, [isGoogleMapsReady])

  const infoWindowOptions = useMemo(() => {
    if (
      !isGoogleMapsReady ||
      typeof window === 'undefined' ||
      !window.google?.maps
    ) {
      return { disableAutoPan: true }
    }
    return {
      disableAutoPan: true,
      pixelOffset: new window.google.maps.Size(0, MAP_PIN_SIZE.height),
    }
  }, [isGoogleMapsReady])

  const updateChargerCollections = useCallback((matcher, updater) => {
    const chargerId = matcher?.chargerId || matcher?.charger_id || null
    const chargeBoxId = matcher?.chargeBoxId || matcher?.charge_box_id || null
    const connectorId = matcher?.connectorId || matcher?.connector_id || null
    if (!chargerId && !chargeBoxId && !connectorId) {
      return
    }
    const normalizedId = chargerId ? String(chargerId) : null
    const normalizedChargeBoxId = chargeBoxId ? String(chargeBoxId) : null
    const normalizedConnectorId = connectorId ? String(connectorId) : null
    const applyUpdate = (prev) => {
      let updated = false
      const next = prev.map((charger) => {
        const idMatches = normalizedId && String(charger.id) === normalizedId
        const boxIdMatches =
          normalizedChargeBoxId &&
          charger.chargerBoxId &&
          String(charger.chargerBoxId) === normalizedChargeBoxId
        const connectorMatches =
          normalizedConnectorId &&
          Array.isArray(charger.connectorStatus?.tooltips) &&
          charger.connectorStatus.tooltips.some(
            (connector) => String(connector?.id) === normalizedConnectorId
          )
        if (!idMatches && !boxIdMatches && !connectorMatches) {
          return charger
        }
        updated = true
        return updater(charger)
      })
      return updated ? next : prev
    }
    setChargers(applyUpdate)
    setMapChargers(applyUpdate)
    setAllChargersForCounts(applyUpdate)
  }, [])

  const resolveConnectorStatusUpdate = useCallback((charger, payload) => {
    if (!payload) {
      return charger.connectorStatus
    }
    const connectorStatusPayload = payload.connector_status || payload.connectorStatus
    if (connectorStatusPayload) {
      return connectorStatusPayload
    }
    const connectorId = payload.connector_id || payload.connectorId
    const statusValue = payload.status
    if (!connectorId || !statusValue) {
      return charger.connectorStatus
    }
    const existingTooltips = Array.isArray(charger.connectorStatus?.tooltips)
      ? charger.connectorStatus.tooltips
      : []
    if (!existingTooltips.length) {
      return charger.connectorStatus
    }
    const normalizedStatus = normalizeConnectorStatus(statusValue)
    const nextTooltips = existingTooltips.map((tooltip) => {
      if (String(tooltip.id) !== String(connectorId)) {
        return tooltip
      }
      return {
        ...tooltip,
        status: normalizedStatus,
        status_label: CONNECTOR_STATUS_LABELS[normalizedStatus] || normalizedStatus,
        color: CONNECTOR_STATUS_COLORS[normalizedStatus] || CONNECTOR_STATUS_COLORS.unavailable,
        background:
          CONNECTOR_STATUS_BACKGROUNDS[normalizedStatus] ||
          tooltip.background,
      }
    })
    return buildConnectorSummaryFromTooltips(nextTooltips)
  }, [])

  useEffect(() => {
    if (!error) {
      return undefined
    }
    showToast({ message: error, variant: 'error' })
    return () => {}
  }, [error, showToast])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((items) => {
        if (!isActive || !Array.isArray(items)) {
          return
        }
        const sorted = items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setCountries(sorted)
        setSelectedCountries((prev) => {
          if (prev.size > 0) {
            return prev
          }
          // Default to all countries selected so every user sees all chargers on
          // load; they can deselect countries manually afterwards.
          const allCodes = sorted.map((country) => country.code).filter(Boolean)
          return allCodes.length ? new Set(allCodes) : prev
        })
      })
      .catch((loadError) => {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        console.error(loadError)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const cleanupSubscriptions = subscribeMany({
      'charger.status.update': (message) => {
        const data = message?.data || {}
        const chargerMatcher = {
          chargerId: data.charger_id || data.chargerId || null,
          chargeBoxId: data.charge_box_id || data.chargeBoxId || null,
          connectorId: data.connector_id || data.connectorId || null,
        }
        if (
          !chargerMatcher.chargerId &&
          !chargerMatcher.chargeBoxId &&
          !chargerMatcher.connectorId
        ) {
          return
        }
        const statusValue = data.status
        const lastHeartbeatAt = data.last_heartbeat_at || data.lastHeartbeatAt
        const updatedAt = data.updated_at || data.updatedAt
        updateChargerCollections(chargerMatcher, (charger) => ({
          ...charger,
          status: statusValue ? buildChargerStatusBadge(statusValue) : charger.status,
          lastHeartbeatAt: lastHeartbeatAt || charger.lastHeartbeatAt,
          updatedAt: updatedAt || charger.updatedAt,
        }))
      },
      'charger.heartbeat.update': (message) => {
        const data = message?.data || {}
        const chargerMatcher = {
          chargerId: data.charger_id || data.chargerId || null,
          chargeBoxId: data.charge_box_id || data.chargeBoxId || null,
          connectorId: data.connector_id || data.connectorId || null,
        }
        if (
          !chargerMatcher.chargerId &&
          !chargerMatcher.chargeBoxId &&
          !chargerMatcher.connectorId
        ) {
          return
        }
        const statusValue = data.status
        const lastHeartbeatAt = data.last_heartbeat_at || data.lastHeartbeatAt
        const updatedAt = data.updated_at || data.updatedAt
        updateChargerCollections(chargerMatcher, (charger) => ({
          ...charger,
          status: statusValue ? buildChargerStatusBadge(statusValue) : charger.status,
          lastHeartbeatAt: lastHeartbeatAt || charger.lastHeartbeatAt,
          updatedAt: updatedAt || charger.updatedAt,
        }))
      },
      'connector.status.update': (message) => {
        const data = message?.data || {}
        const chargerMatcher = {
          chargerId: data.charger_id || data.chargerId || null,
          chargeBoxId: data.charge_box_id || data.chargeBoxId || null,
          connectorId: data.connector_id || data.connectorId || null,
        }
        if (
          !chargerMatcher.chargerId &&
          !chargerMatcher.chargeBoxId &&
          !chargerMatcher.connectorId
        ) {
          return
        }
        const connectorStatusPayload = data.connector_status || data.connectorStatus
        const updatedAt = data.updated_at || data.updatedAt
        updateChargerCollections(chargerMatcher, (charger) => {
          if (connectorStatusPayload) {
            return {
              ...charger,
              connectorStatus: connectorStatusPayload,
              updatedAt: updatedAt || charger.updatedAt,
            }
          }
          const nextConnectorStatus = resolveConnectorStatusUpdate(charger, data)
          if (!nextConnectorStatus) {
            return charger
          }
          return {
            ...charger,
            connectorStatus: nextConnectorStatus,
            updatedAt: updatedAt || charger.updatedAt,
          }
        })
      },
    })

    return cleanupSubscriptions
  }, [resolveConnectorStatusUpdate, subscribeMany, updateChargerCollections])

  useEffect(() => {
    const unregisterReconnectRefetch = registerReconnectRefetch('chargers', () => {
      setSocketResyncKey((value) => value + 1)
    })

    return () => {
      unregisterReconnectRefetch()
    }
  }, [registerReconnectRefetch])

  useEffect(() => {
    if (!openFilterKey) {
      return undefined
    }
    const resetDraft = () => {
      setDraftFilters((prev) => ({
        ...prev,
        [openFilterKey]: Array.from(filters[openFilterKey] ?? []),
      }))
    }
    const handleClickOutside = (event) => {
      const container = document.getElementById(`filter-control-${openFilterKey}`)
      if (container && !container.contains(event.target)) {
        resetDraft()
        setOpenFilterKey(null)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        resetDraft()
        setOpenFilterKey(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [filters, openFilterKey])

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const loadStations = async () => {
      try {
        const aggregated = new Map()
        let nextPage = 1
        let totalPages = 1
        while (
          nextPage <= totalPages &&
          nextPage <= MAX_STATION_PAGES &&
          !controller.signal.aborted
        ) {
          const params = new URLSearchParams()
          params.set('page', String(nextPage))
          params.set('page_size', String(STATION_PAGE_SIZE))
          const response = await fetch(`${API_BASE}/stations/?${params.toString()}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          })
          if (!response.ok) {
            break
          }
          const data = await response.json()
          const results = Array.isArray(data) ? data : data.results ?? []
          results.forEach((station) => {
            const id = station.id ?? station.identifier
            if (!id) {
              return
            }
            aggregated.set(String(id), {
              id: String(id),
              name: station.name,
              governorate: station.governorate,
              latitude: toNumberOrNull(station.latitude),
              longitude: toNumberOrNull(station.longitude),
            })
          })
          const paginationMeta = Array.isArray(data)
            ? { total_pages: 1 }
            : data.pagination ?? {
                total_pages:
                  data.total_pages ??
                  (data.count && STATION_PAGE_SIZE
                    ? Math.max(1, Math.ceil(data.count / STATION_PAGE_SIZE))
                    : 1),
              }
          totalPages = paginationMeta.total_pages ?? 1
          nextPage += 1
        }
        if (isMounted) {
          setStationDirectory(aggregated)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Unable to load stations for chargers map', err)
        }
      }
    }

    loadStations()
    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  // Fetch filtered chargers for filter counts (based on search and other filters)
  // This makes filter counts dynamic - they update based on current search/filters
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadFilteredChargersForCounts = async () => {
      try {
        const allResults = []
        let currentPage = 1
        let totalPages = 1
        const pageSize = 1000 // Use a reasonable page size

        while (currentPage <= totalPages && !controller.signal.aborted) {
          const params = new URLSearchParams()
          params.set('page', String(currentPage))
          params.set('page_size', String(pageSize))
          
          // Include search term
          const trimmedSearch = debouncedSearch.trim()
          if (trimmedSearch) {
            params.set('name', trimmedSearch)
          }
          
          // Include other filters (governorate, visibility, status) - these affect the counts
          // Note: We don't exclude any filters here - all filters affect the counts
          // This makes filters work together
          applyChargerFiltersToParams(params, filters, selectedCountries)

          const response = await fetch(`${API_BASE}/chargers/?${params.toString()}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            break
          }

          const data = await response.json()
          const results = Array.isArray(data) ? data : data.results ?? []
          allResults.push(...results)

          const paginationMeta = Array.isArray(data)
            ? { total_pages: 1 }
            : data.pagination ?? {
                total_pages:
                  data.total_pages ??
                  (data.total_items && pageSize
                    ? Math.max(1, Math.ceil(data.total_items / pageSize))
                    : 1),
              }
          totalPages = paginationMeta.total_pages ?? 1
          currentPage += 1
        }

        const normalized = allResults.map((row, index) => normalizeChargerRow(row, index))

        if (!cancelled) {
          setAllChargersForCounts(normalized)
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Failed to load filtered chargers for counts:', loadError)
        }
      }
    }

    loadFilteredChargersForCounts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedSearch, filters, selectedCountries, socketResyncKey])

  useEffect(() => {
    let isCurrent = true
    const controller = new AbortController()
    const loadChargers = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        const trimmedSearch = debouncedSearch.trim()
        if (trimmedSearch) {
          params.set('name', trimmedSearch)
        }
        applyChargerFiltersToParams(params, filters, selectedCountries)
        const response = await fetch(`${API_BASE}/chargers/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Failed to fetch chargers.')
        }
        const data = await response.json()
        const results = Array.isArray(data) ? data : data.results ?? []
        const normalized = results.map((row, index) => normalizeChargerRow(row, index))
        if (!isCurrent) {
          return
        }
        setChargers(normalized)
        if (data.available_filters) {
          setAvailableFilters({
            governorates: data.available_filters.governorates ?? [],
            visibilities: data.available_filters.visibilities ?? [],
            statuses: data.available_filters.statuses ?? [],
          })
        }
        const paginationMeta = Array.isArray(data)
          ? {
              page,
              page_size: pageSize,
              total_pages: normalized.length ? 1 : 1,
              total_items: normalized.length,
            }
          : data.pagination ?? {}
        const serverPage = Number(paginationMeta.page ?? page)
        const serverPageSize = Number(paginationMeta.page_size ?? pageSize)
        const totalPages = Number(
          paginationMeta.total_pages ??
            (paginationMeta.total_items && pageSize
              ? Math.max(1, Math.ceil(paginationMeta.total_items / pageSize))
              : 1)
        )
        const totalItems = Number(
          paginationMeta.total_items ?? data.count ?? normalized.length
        )

        if (Number.isFinite(serverPage) && serverPage > 0 && serverPage !== page) {
          setPage(serverPage)
        }
        if (
          Number.isFinite(serverPageSize) &&
          serverPageSize > 0 &&
          serverPageSize !== pageSize
        ) {
          setPageSize(serverPageSize)
        }
        setPagination({
          page: Number.isFinite(serverPage) && serverPage > 0 ? serverPage : page,
          pageSize:
            Number.isFinite(serverPageSize) && serverPageSize > 0 ? serverPageSize : pageSize,
          totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
          totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : 0,
        })
      } catch (err) {
        if (err.name === 'AbortError') {
          return
        }
        console.error(err)
        if (isCurrent) {
          setError(err.message || 'Unable to load chargers.')
          setChargers([])
          setPagination((prev) => ({
            ...prev,
            totalItems: 0,
            totalPages: 1,
          }))
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    loadChargers()

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [debouncedSearch, filters, page, pageSize, selectedCountries, socketResyncKey])

  useEffect(() => {
    if (viewMode !== VIEW_MODES.MAP) {
      return undefined
    }

    let isMounted = true
    const controller = new AbortController()

    const fetchPage = async (pageNumber) => {
      const params = new URLSearchParams()
      params.set('page', String(pageNumber))
      params.set('page_size', String(MAP_PAGE_SIZE))
      const trimmedSearch = debouncedSearch.trim()
      if (trimmedSearch) {
        params.set('name', trimmedSearch)
      }
      applyChargerFiltersToParams(params, filters, selectedCountries)
      const response = await fetch(`${API_BASE}/chargers/?${params.toString()}`, {
        signal: controller.signal,
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error('Failed to fetch chargers for map view.')
      }
      const data = await response.json()
      const results = Array.isArray(data) ? data : data.results ?? []
      const normalized = results.map((row, index) =>
        normalizeChargerRow(row, index + (pageNumber - 1) * MAP_PAGE_SIZE)
      )
      const paginationMeta = Array.isArray(data) ? { total_pages: 1 } : data.pagination ?? {}
      return {
        results: normalized,
        totalPages:
          paginationMeta.total_pages ??
          (paginationMeta.total_items && MAP_PAGE_SIZE
            ? Math.max(1, Math.ceil(paginationMeta.total_items / MAP_PAGE_SIZE))
            : 1),
      }
    }

    const loadMapData = async () => {
      setIsMapLoading(true)
      try {
        const aggregated = []
        const firstPage = await fetchPage(1)
        aggregated.push(...firstPage.results)
        const totalPages = Math.min(firstPage.totalPages ?? 1, MAX_MAP_PAGES)
        let next = 2
        while (next <= totalPages) {
          const pageData = await fetchPage(next)
          aggregated.push(...pageData.results)
          next += 1
        }
        if (isMounted) {
          setMapChargers(aggregated)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          if (isMounted) {
            setMapChargers([])
          }
        }
      } finally {
        if (isMounted) {
          setIsMapLoading(false)
        }
      }
    }

    loadMapData()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [debouncedSearch, filters, viewMode, selectedCountries, socketResyncKey])

  useEffect(() => {
    if (viewMode === VIEW_MODES.LIST) {
      setSelectedChargerId(null)
    }
  }, [viewMode])

  const filteredChargers = useMemo(
    () => chargers.filter((charger) => chargerMatchesFilters(charger, filters)),
    [chargers, filters]
  )

  const filteredMapChargers = useMemo(
    () => mapChargers.filter((charger) => chargerMatchesFilters(charger, filters)),
    [mapChargers, filters]
  )

  const filterCounts = useMemo(() => {
    const governorate = {}
    const visibility = {}
    const status = {}
    const connector = {}
    
    // Filter by connectorStatuses (client-side filter) before counting
    // This makes all filters work together - connectorStatuses affects other filter counts
    const filteredForCounts = allChargersForCounts.filter((charger) => {
      if (filters.connectorStatuses?.length) {
        const summary = charger.connectorStatus?.summary || {}
        const hasMatch = filters.connectorStatuses.some(
          (status) => (summary[status] ?? 0) > 0
        )
        if (!hasMatch) {
          return false
        }
      }
      return true
    })
    
    // Calculate counts from filtered chargers
    // These counts reflect the current search and filter state
    filteredForCounts.forEach((charger) => {
      const governorateKey = getChargerGovernorate(charger)
      if (governorateKey) {
        governorate[governorateKey] = (governorate[governorateKey] || 0) + 1
      }
      const visibilityKey = getChargerVisibility(charger)
      if (visibilityKey) {
        visibility[visibilityKey] = (visibility[visibilityKey] || 0) + 1
      }
      const statusKey = getChargerStatus(charger)
      // Normalize status to ensure it's one of the 3 allowed values
      const normalizedStatus = normalizeChargerStatus(statusKey)
      if (normalizedStatus) {
        status[normalizedStatus] = (status[normalizedStatus] || 0) + 1
      }
      // Count chargers (not connectors) that have at least one connector with each status
      // Each charger is counted once per status, regardless of how many connectors it has with that status
      const summary = charger.connectorStatus?.summary || {}
      Object.entries(summary).forEach(([key, value]) => {
        if (Number(value || 0) > 0) {
          // Normalize connector status to one of the 4 allowed values
          const normalizedKey = normalizeConnectorStatus(key)
          // Increment by 1 for each charger (not by the connector count)
          connector[normalizedKey] = (connector[normalizedKey] || 0) + 1
        }
      })
    })
    return { governorate, visibility, status, connector }
  }, [allChargersForCounts, filters.connectorStatuses])
  const chargersWithCoordinates = useMemo(() => {
    if (!stationDirectory.size) {
      return []
    }
    return filteredMapChargers
      .map((charger) => {
        const stationId = charger.station?.id
        if (!stationId) {
          return null
        }
        const station = stationDirectory.get(String(stationId))
        if (!station || !hasCoordinates(station)) {
          return null
        }
        const latitude = toNumberOrNull(station.latitude)
        const longitude = toNumberOrNull(station.longitude)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null
        }
        return {
          ...charger,
          latitude,
          longitude,
          stationMeta: station,
        }
      })
      .filter(Boolean)
  }, [filteredMapChargers, stationDirectory])

  const selectedMapCharger = useMemo(
    () => chargersWithCoordinates.find((charger) => charger.id === selectedChargerId) || null,
    [chargersWithCoordinates, selectedChargerId]
  )

  const selectedMapPosition = useMemo(
    () => toLatLngOrNull(selectedMapCharger),
    [selectedMapCharger]
  )

  const mapCenter = useMemo(() => {
    if (selectedMapPosition) {
      return selectedMapPosition
    }
    if (chargersWithCoordinates.length === 1) {
      const singlePosition = toLatLngOrNull(chargersWithCoordinates[0])
      if (singlePosition) {
        return singlePosition
      }
    }
    if (chargersWithCoordinates.length > 1) {
      const totals = chargersWithCoordinates.reduce(
        (sum, charger) => ({
          lat: sum.lat + charger.latitude,
          lng: sum.lng + charger.longitude,
        }),
        { lat: 0, lng: 0 }
      )
      return {
        lat: totals.lat / chargersWithCoordinates.length,
        lng: totals.lng / chargersWithCoordinates.length,
      }
    }
    return DEFAULT_MAP_CENTER
  }, [chargersWithCoordinates, selectedMapPosition])

  const mapZoom = useMemo(() => {
    if (selectedMapPosition) {
      return 12
    }
    if (chargersWithCoordinates.length === 1) {
      return 11
    }
    if (chargersWithCoordinates.length > 1) {
      return 7
    }
    return 6
  }, [chargersWithCoordinates, selectedMapPosition])

  const governorateOptions = useMemo(() => {
    const values = availableFilters.governorates ?? []
    const counts = filterCounts.governorate || {}
    return values.map((value) => ({
      value,
      label: value,
      count: counts[value] ?? 0,
    }))
  }, [availableFilters.governorates, filterCounts.governorate])

  const visibilityOptions = useMemo(() => {
    const values = availableFilters.visibilities ?? []
    const counts = filterCounts.visibility || {}
    return values.map((option) => ({
      value: option.value,
      label: option.label ?? option.value,
      color: option.color,
      count: counts[option.value] ?? 0,
    }))
  }, [availableFilters.visibilities, filterCounts.visibility])

  const statusOptions = useMemo(() => {
    const values = availableFilters.statuses ?? []
    const counts = filterCounts.status || {}
    return values.map((option) => ({
      value: option.value,
      label: option.label ?? option.value,
      color: option.color,
      count: counts[option.value] ?? 0,
    }))
  }, [availableFilters.statuses, filterCounts.status])

  const connectorOptions = useMemo(() => {
    const counts = filterCounts.connector || {}
    return CONNECTOR_FILTERS_BASE.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }))
  }, [filterCounts.connector])

  const totalPages = Math.max(1, pagination.totalPages || 1)
  const chargerPageBounds = useMemo(() => {
    if (!filteredChargers.length) {
      return { start: 0, end: 0 }
    }
    const start = (pagination.page - 1) * pagination.pageSize + 1
    const end = start + filteredChargers.length - 1
    return { start, end }
  }, [filteredChargers.length, pagination.page, pagination.pageSize])

  const areAllFilteredSelected =
    filteredChargers.length > 0 &&
    filteredChargers.every((charger) => selectedChargerIds.has(charger.id))
  const hasSelection = selectedChargerIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  useEffect(() => {
    if (!filteredChargers.length) {
      return
    }
    // Clear selection when filters change (optional - you can remove this if you want selection to persist)
    // setSelectedChargerIds(new Set())
  }, [debouncedSearch, filters, selectedCountries])

  const handlePageChange = (target) => {
    const next = Math.min(Math.max(1, target), totalPages)
    if (next !== page) {
      setPage(next)
    }
  }

  const handlePageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size !== pageSize) {
      setPageSize(size)
      setPage(1)
    }
  }

  const handleSelectAll = () => {
    setSelectedChargerIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredChargers.forEach((charger) => {
          next.delete(charger.id)
        })
      } else {
        filteredChargers.forEach((charger) => {
          if (charger.id != null) {
            next.add(charger.id)
          }
        })
      }
      return next
    })
  }

  const toggleChargerSelection = (chargerId) => {
    setSelectedChargerIds((prev) => {
      const next = new Set(prev)
      if (next.has(chargerId)) {
        next.delete(chargerId)
      } else {
        next.add(chargerId)
      }
      return next
    })
  }

  const handleDownload = async () => {
    let rowsToExport = []

    // If records are selected, use only those
    if (hasSelection) {
      rowsToExport = filteredChargers.filter((charger) => selectedChargerIds.has(charger.id))
    } else {
      // Fetch all data based on current filters
      try {
        const allResults = []
        let currentPage = 1
        let totalPages = 1
        const pageSize = 1000 // Use large page size to minimize requests

        while (currentPage <= totalPages) {
          const params = new URLSearchParams()
          params.set('page', String(currentPage))
          params.set('page_size', String(pageSize))
          
          const trimmedSearch = debouncedSearch.trim()
          if (trimmedSearch) {
            params.set('name', trimmedSearch)
          }
          
          applyChargerFiltersToParams(params, filters, selectedCountries)

          const response = await fetch(`${API_BASE}/chargers/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch chargers for export (${response.status})`)
          }

          const data = await response.json()
          const results = Array.isArray(data) ? data : data.results ?? []
          allResults.push(...results)

          const paginationMeta = Array.isArray(data)
            ? { total_pages: 1 }
            : data.pagination ?? {
                total_pages:
                  data.total_pages ??
                  (data.total_items && pageSize
                    ? Math.max(1, Math.ceil(data.total_items / pageSize))
                    : 1),
              }
          totalPages = paginationMeta.total_pages ?? 1
          currentPage += 1
        }

        // Normalize the results
        rowsToExport = allResults.map((row, index) => normalizeChargerRow(row, index))
        
        // Apply client-side filters (connectorStatuses)
        rowsToExport = rowsToExport.filter((charger) => chargerMatchesFilters(charger, filters))
      } catch (error) {
        console.error('Failed to fetch all chargers for export:', error)
        alert('Failed to fetch all chargers. Please try again.')
        return
      }
    }

    if (!rowsToExport.length) {
      alert('No charger data to export.')
      return
    }

    const headers = [
      'No',
      'Name',
      'Identifier',
      'Charger',
      'Governorate',
      'Status',
      'Visibility',
      'Connectors',
    ]
    const rows = rowsToExport.map((charger, index) => ({
      No: index + 1,
      Name: charger.name,
      Identifier: charger.number,
      Charger: charger.name || '—',
      Governorate: charger.governorate || charger.station?.governorate || '—',
      Status: charger.status?.label || charger.status?.value || '—',
      Visibility: charger.visibility?.label || charger.visibility?.value || '—',
      Connectors: charger.connectorStatus?.total ?? 0,
    }))
    downloadCsv({
      headers,
      rows,
      filename: `chargers_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  const handleAction = (charger, action) => {
    if (action === 'edit') {
      navigate(`/chargers/${charger.id}/edit`)
      return
    }
    if (action === 'remote_actions') {
      navigate(`/chargers/${charger.id}`, { state: { openRemoteActions: true } })
      return
    }
    if (action === 'logs') {
      navigate(`/chargers/${charger.id}`, { state: { focusTab: 'logs' } })
      return
    }
    if (action === 'delete') {
      handleDeleteClick(charger)
      return
    }
  }

  const handleDeleteClick = (charger) => {
    setDeleteModalState({ isOpen: true, charger })
  }

  const handleDelete = async () => {
    const charger = deleteModalState.charger
    if (!charger) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/chargers/${charger.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete charger.')
      }
      setChargers((prev) => prev.filter((item) => item.id !== charger.id))
      setSelectedChargerId((prev) => (prev === charger.id ? null : prev))
      setSelectedChargerIds((prev) => {
        if (!prev.has(charger.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(charger.id)
        return next
      })
      let nextPageValue = page
      setPagination((prev) => {
        const pageSizeValue = prev.page_size ?? pageSize
        const nextTotalItems = Math.max(0, (prev.total_items ?? 0) - 1)
        const nextTotalPages = pageSizeValue
          ? Math.max(1, Math.ceil(nextTotalItems / pageSizeValue))
          : 1
        const previousPage = prev.page ?? page
        nextPageValue = Math.min(previousPage, nextTotalPages)
        return {
          ...prev,
          total_items: nextTotalItems,
          total_pages: nextTotalPages,
          page: nextPageValue,
        }
      })
      if (nextPageValue !== page) {
        setPage(nextPageValue)
      }
      showToast({
        title: 'Charger deleted',
        message: `${charger.name || charger.identifier || 'Charger'} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete charger.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, charger: null })
    }
  }

  const [selectedConnector, setSelectedConnector] = useState(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.connector-dot-wrapper') && !event.target.closest('.connector-popup')) {
        setSelectedConnector(null)
      }
    }
    if (selectedConnector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [selectedConnector])

  const renderConnectorSummary = (charger) => {
    const tooltips = charger.connectorStatus?.tooltips || []
    const total = charger.connectorStatus?.total ?? 0

    if (total === 0) {
      return <span className="connector-empty">No connectors</span>
    }

    return (
      <div className="charger-connector-dots">
        <div className="connector-dots-container">
          {tooltips.map((connector, index) => {
            const isSelected = selectedConnector?.id === connector.id && selectedConnector?.chargerId === charger.id
            // Normalize connector status
            const normalizedStatus = normalizeConnectorStatus(connector.status)
            const statusColor = CONNECTOR_STATUS_COLORS[normalizedStatus] || CONNECTOR_STATUS_COLORS.unavailable
            const statusLabel = CONNECTOR_STATUS_LABELS[normalizedStatus] || 'Unavailable'
            
            return (
              <div
                key={connector.id || index}
                className={`connector-dot-wrapper ${isSelected ? 'popup-open' : ''}`}
              >
                <button
                  type="button"
                  className="connector-dot-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedConnector(isSelected ? null : { ...connector, chargerId: charger.id })
                  }}
                  style={{
                    backgroundColor: connector.color || statusColor,
                  }}
                  aria-label={`Connector ${connector.label || index + 1} - ${statusLabel}`}
                />
                {isSelected && (
                  <div className="connector-popup">
                    <div className="connector-popup-status">
                      <span
                        className="connector-popup-status-badge"
                        style={{
                          backgroundColor: (() => {
                            const color = connector.color || statusColor
                            const hex = color.replace('#', '')
                            const r = parseInt(hex.slice(0, 2), 16)
                            const g = parseInt(hex.slice(2, 4), 16)
                            const b = parseInt(hex.slice(4, 6), 16)
                            return `rgba(${r}, ${g}, ${b}, 0.12)`
                          })(),
                          color: connector.color || statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="connector-popup-identifier">
                      {connector.label || `Connector ${index + 1}`}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderStatusBadge = (status) => {
    if (!status?.label) {
      return <span className="status-badge">—</span>
    }
    // Use design from Labels.js
    const themeColors = getThemeColors()
    const statusValue = status.value || ''
    let backgroundColor, textColor
    if (statusValue === 'available') {
      backgroundColor = 'rgba(46, 165, 98, 0.12)' // rgba(46.49, 164.62, 97.50, 0.12)
      textColor = '#2EA561'
    } else if (statusValue === 'unavailable') {
      backgroundColor = 'rgba(237, 74, 74, 0.12)' // rgba(237.48, 74.26, 74.26, 0.12)
      textColor = '#ED4A4A'
    } else if (statusValue === 'planned') {
      backgroundColor = 'rgba(62, 79, 68, 0.12)' // rgba(62.37, 78.79, 68.34, 0.12)
      textColor = '#3E4F44'
    } else {
      const fallbackColor = themeColors.secondary
      backgroundColor = hexToRgba(status.color || fallbackColor, 0.15)
      textColor = status.color || fallbackColor
    }
    return (
      <span
        className="status-badge charger-status-badge"
        style={{ backgroundColor, color: textColor }}
      >
        {status.label}
      </span>
    )
  }

  const renderVisibilityPill = (visibility) => {
    if (!visibility?.label) {
      return <span className="status-pill charger-visibility-pill">—</span>
    }
    const backgroundColor = hexToRgba(visibility.color || '#1f2937', 0.15)
    const textColor = visibility.color || '#1f2937'
    return (
      <span
        className="status-pill charger-visibility-pill"
        style={{ backgroundColor, color: textColor }}
      >
        {visibility.label}
      </span>
    )
  }

  const searchField = (
    <div className="filter-field search-field">
      <label className="sr-only" htmlFor="charger-search">
        Search chargers by charger name or box ID
      </label>
      <div className="filter-search">
        <span className="filter-search__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16.4226 15.2476L19.2559 18.0726C19.4137 18.229 19.5024 18.442 19.5024 18.6642C19.5024 18.8864 19.4137 19.0994 19.2559 19.2559C19.0994 19.4137 18.8864 19.5024 18.6642 19.5024C18.442 19.5024 18.229 19.4137 18.0726 19.2559L15.2476 16.4226C14.0829 17.3367 12.6448 17.8327 11.1642 17.8309C7.48233 17.8309 4.49756 14.8461 4.49756 11.1642C4.49756 7.48233 7.48233 4.49756 11.1642 4.49756C14.8461 4.49756 17.8309 7.48233 17.8309 11.1642C17.8327 12.6448 17.3367 14.0829 16.4226 15.2476ZM11.1642 6.16423C8.4028 6.16423 6.16423 8.4028 6.16423 11.1642C6.16423 13.9256 8.4028 16.1642 11.1642 16.1642C13.9256 16.1642 16.1642 13.9256 16.1642 11.1642C16.1642 8.4028 13.9256 6.16423 11.1642 6.16423Z"
              fill="#67716B"
            />
          </svg>
        </span>
        <input
          id="charger-search"
          type="search"
          placeholder="Search by charger name / Box ID"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
      </div>
    </div>
  )

  const renderFilterMenu = (key, label, options) => {
    const appliedValues = filters[key] ?? []
    const isOpen = openFilterKey === key
    const draftValues = isOpen ? draftFilters[key] ?? appliedValues : appliedValues
    const displayValues = isOpen ? draftValues : appliedValues
    const buttonLabel = displayValues.length ? `${displayValues.length} selected` : label

    const toggleValue = (optionValue) => {
      if (!isOpen) {
        return
      }
      setDraftFilters((prev) => {
        const current = new Set(prev[key] ?? [])
        if (current.has(optionValue)) {
          current.delete(optionValue)
        } else {
          current.add(optionValue)
        }
        return {
          ...prev,
          [key]: Array.from(current),
        }
      })
    }

    const handleTrigger = () => {
      if (isOpen) {
        setDraftFilters((prev) => ({ ...prev, [key]: Array.from(appliedValues) }))
        setOpenFilterKey(null)
      } else {
        setDraftFilters((prev) => ({ ...prev, [key]: Array.from(appliedValues) }))
        setOpenFilterKey(key)
      }
    }

    return (
      <div className="filter-field governorate-filter" id={`filter-control-${key}`}>
        <div className={`multi-select ${isOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls={`filter-menu-${key}`}
            onClick={handleTrigger}
          >
            {buttonLabel}
          </button>
          {isOpen ? (
            <div
              id={`filter-menu-${key}`}
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label={label}
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">{label}</span>
                <span className="filter-menu__badge">{draftValues.length}</span>
              </div>
              <div className="filter-menu__body">
                {options.length ? (
                  options.map((option) => {
                    const isSelected = draftValues.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleValue(option.value)}
                        />
                        <span className="filter-menu__item-content">
                          <span className="filter-menu__checkbox" aria-hidden="true">
                            {isSelected ? (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <rect width="18" height="18" rx="4" fill="var(--theme-primary)" />
                                <path
                                  d="M13.7273 6L7.72727 12L5 9.27273"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <rect
                                  x="0.75"
                                  y="0.75"
                                  width="16.5"
                                  height="16.5"
                                  rx="2.25"
                                  stroke="#99A19D"
                                  strokeWidth="1.5"
                                />
                                <rect
                                  x="0.5"
                                  y="0.5"
                                  width="17"
                                  height="17"
                                  rx="3.5"
                                  stroke="#99A19D"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="filter-menu__name">{option.label}</span>
                        </span>
                        <span className="filter-menu__count">
                          {(option.count ?? 0).toLocaleString()}
                        </span>
                      </label>
                    )
                  })
                ) : (
                  <p className="filter-menu__empty">No options available.</p>
                )}
              </div>
              <div className="filter-menu__footer">
                <button
                  type="button"
                  className="filter-menu__apply"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      [key]: Array.from(new Set(draftValues)),
                    }))
                    setOpenFilterKey(null)
                    setPage(1)
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="filter-menu__cancel"
                  onClick={() => {
                    setDraftFilters((prev) => ({ ...prev, [key]: Array.from(appliedValues) }))
                    setOpenFilterKey(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <div className={`stations-page chargers-page${viewMode === VIEW_MODES.MAP ? ' map-mode' : ''}`}>
      <header className="stations-header chargers-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Chargers' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Chargers</h1>
            </div>
            <nav className="stations-tabs chargers-tabs" aria-label="View mode">
              <button
                type="button"
                className={viewMode === VIEW_MODES.LIST ? 'active' : ''}
                onClick={() => setViewMode(VIEW_MODES.LIST)}
              >
                List
              </button>
              <button
                type="button"
                className={viewMode === VIEW_MODES.MAP ? 'active' : ''}
                onClick={() => setViewMode(VIEW_MODES.MAP)}
              >
                Map View
              </button>
            </nav>
          </div>
        </div>
        <div className="stations-header-actions chargers-header-actions">
          {viewMode === VIEW_MODES.LIST ? (
            <button
              type="button"
              className="download-button"
              onClick={handleDownload}
              disabled={!filteredChargers.length}
            >
              <DownloadIcon />
              <span className="download-button__label">Download</span>
            </button>
          ) : null}
          <button type="button" className="primary-add-button" onClick={() => navigate('/chargers/new')}>
            <AddChargerIcon />
            <span className="primary-add-button__label">Add Charger</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="chargers" />

      <div className="stations-filters chargers-filters">
        <div className="filter-field country-filter">
          <label className="sr-only">Filter by country</label>
          <div
            className={`multi-select ${isCountryMenuOpen ? 'open' : ''}`}
            ref={countryMenuRef}
          >
            <button
              type="button"
              className="multi-select-trigger"
              aria-haspopup="dialog"
              aria-expanded={isCountryMenuOpen}
              aria-controls="chargers-country-filter-menu"
              onClick={() => {
                if (isCountryMenuOpen) {
                  setDraftCountries(new Set(selectedCountries))
                  setIsCountryMenuOpen(false)
                } else {
                  setDraftCountries(new Set(selectedCountries))
                  setIsCountryMenuOpen(true)
                }
              }}
            >
              {selectedCountries.size > 1
                ? `${selectedCountries.size} countries`
                : (countries.find((c) => selectedCountries.has(c.code))?.name || 'Country')}
            </button>
            {isCountryMenuOpen ? (
              <div
                id="chargers-country-filter-menu"
                className="multi-select-menu filter-menu"
                role="dialog"
                aria-label="Filter countries"
              >
                <div className="filter-menu__header">
                  <span className="filter-menu__title">Country</span>
                  <span className="filter-menu__badge">{draftCountries.size}</span>
                </div>
                <div className="filter-menu__body">
                  {countries.length ? (
                    countries.map((country) => {
                      const isSelected = draftCountries.has(country.code)
                      const isOnlyOne = isSelected && draftCountries.size === 1
                      return (
                        <label
                          key={country.code}
                          className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isOnlyOne}
                            onChange={() => {
                              setDraftCountries((prev) => {
                                const next = new Set(prev)
                                if (next.has(country.code)) {
                                  if (next.size <= 1) return prev
                                  next.delete(country.code)
                                } else {
                                  next.add(country.code)
                                }
                                return next
                              })
                            }}
                          />
                          <span className="filter-menu__item-content">
                            <span className="filter-menu__checkbox" aria-hidden="true">
                              {isSelected ? (
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="18" height="18" rx="4" fill="var(--theme-primary)"/>
                                  <path d="M13.7273 6L7.72727 12L5 9.27273" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="#99A19D" strokeWidth="1.5"/>
                                  <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D"/>
                                </svg>
                              )}
                            </span>
                            <span className="filter-menu__name">{country.name}</span>
                          </span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="filter-menu__empty">No countries available.</p>
                  )}
                </div>
                <div className="filter-menu__footer">
                  <button
                    type="button"
                    className="filter-menu__apply"
                    disabled={draftCountries.size === 0}
                    onClick={() => {
                      if (draftCountries.size === 0) return
                      const next = new Set(draftCountries)
                      let changed = next.size !== selectedCountries.size
                      if (!changed) {
                        for (const value of next) {
                          if (!selectedCountries.has(value)) {
                            changed = true
                            break
                          }
                        }
                      }
                      if (changed) {
                        setSelectedCountries(next)
                        setFilters(createEmptyFilters())
                        setPage(1)
                      }
                      setIsCountryMenuOpen(false)
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="filter-menu__cancel"
                    onClick={() => {
                      setDraftCountries(new Set(selectedCountries))
                      setIsCountryMenuOpen(false)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {searchField}
        {renderFilterMenu('governorates', 'Governorate', governorateOptions)}
        {renderFilterMenu('visibilities', 'Visibility', visibilityOptions)}
        {renderFilterMenu('statuses', 'Charger status', statusOptions)}
        {renderFilterMenu('connectorStatuses', 'Connector status', connectorOptions)}
      </div>

      {error ? <div className="data-warning">{error}</div> : null}

      {viewMode === VIEW_MODES.LIST ? (
        <div className="chargers-table" aria-busy={isLoading}>
          <div className="chargers-table-header">
            <div className="charger-cell charger-select-cell">
              <input
                type="checkbox"
                ref={selectAllCheckboxRef}
                className="select-checkbox"
                checked={filteredChargers.length > 0 && areAllFilteredSelected}
                onChange={handleSelectAll}
                aria-label={
                  areAllFilteredSelected ? 'Clear charger selection' : 'Select all chargers'
                }
              />
            </div>
            <div className="charger-cell order">No</div>
            <div className="charger-cell charger-name-cell">Charger</div>
            <div className="charger-cell charger-governorate">Governorate</div>
            <div className="charger-cell charger-box-id">Charge box id</div>
            <div className="charger-cell charger-status-cell">Charger status</div>
            <div className="charger-cell charger-connectors">Connectors</div>
            <div className="charger-cell charger-visibility-cell">Visibility</div>
            <div className="charger-cell">Brand</div>
            <div className="charger-cell charger-actions-cell"></div>
          </div>
          {isLoading ? <p className="data-placeholder">Loading chargers…</p> : null}
          {!isLoading && !filteredChargers.length ? (
            <p className="data-placeholder">No chargers match the selected filters.</p>
          ) : null}
          {!isLoading
            ? filteredChargers.map((charger, index) => (
                <article
                  key={charger.id}
                  className={`charger-row clickable ${
                    selectedChargerIds.has(charger.id) ? 'selected' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (
                      event.target instanceof HTMLElement &&
                      event.target.closest('.charger-select-cell')
                    ) {
                      return
                    }
                    navigate(`/chargers/${charger.id}`)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      if (
                        event.target instanceof HTMLElement &&
                        event.target.closest('.charger-select-cell')
                      ) {
                        return
                      }
                      event.preventDefault()
                      navigate(`/chargers/${charger.id}`)
                    }
                  }}
                >
                  <div className="charger-cell charger-select-cell">
                    <input
                      type="checkbox"
                      className="select-checkbox"
                      checked={selectedChargerIds.has(charger.id)}
                      onChange={(event) => {
                        event.stopPropagation()
                        toggleChargerSelection(charger.id)
                      }}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${charger.name || charger.number}`}
                    />
                  </div>
                  <div className="charger-cell order">{chargerPageBounds.start + index}</div>
                  <div className="charger-cell charger-name-cell">
                    <span>{charger.name || '—'}</span>
                  </div>
                  <div className="charger-cell charger-governorate">
                    <span>{charger.governorate || charger.station?.governorate || '—'}</span>
                  </div>
                  <div className="charger-cell charger-box-id">
                    <span>{charger.chargerBoxId || '—'}</span>
                  </div>
                  <div className="charger-cell charger-status-cell">
                    {renderStatusBadge(charger.status)}
                  </div>
                  <div className="charger-cell charger-connectors">{renderConnectorSummary(charger)}</div>
                  <div className="charger-cell charger-visibility-cell">
                    {renderVisibilityPill(charger.visibility)}
                  </div>
                  <div className="charger-cell charger-brand">
                    {charger.brand?.logo ? (
                      <img
                        src={charger.brand.logo}
                        alt={charger.brand.name || 'Brand logo'}
                        className="brand-icon"
                      />
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                  <div className="charger-cell charger-actions-cell" onClick={(event) => event.stopPropagation()}>
                    <ChargerActionMenu
                      actions={charger.actions}
                      onAction={(action) => handleAction(charger, action)}
                    />
                  </div>
                </article>
              ))
            : null}
          <footer className="chargers-footer">
            <div className="pagination-info">
              {pagination.totalItems
                ? `Showing ${chargerPageBounds.start}-${chargerPageBounds.end} of ${pagination.totalItems} chargers`
                : 'No chargers to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {pagination.page} of {totalPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="charger-page-size">Rows per page</label>
              <select
                id="charger-page-size"
                value={pageSize}
                onChange={handlePageSizeChange}
                disabled={isLoading}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : (
        <div className="stations-map-view chargers-map-view" aria-busy={isMapLoading}>
          <div className="stations-map-canvas">
            {!isMapsConfigured ? (
              <div className="map-placeholder">
                Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the interactive map.
              </div>
            ) : mapLoadError ? (
              <div className="map-placeholder">Unable to load Google Maps.</div>
            ) : !isGoogleMapsReady ? (
              <p className="map-loading">Loading map…</p>
            ) : isMapLoading ? (
              <p className="map-loading">Preparing chargers…</p>
            ) : !chargersWithCoordinates.length ? (
              <div className="map-placeholder">No chargers with coordinates to display yet.</div>
            ) : (
              <GoogleMap
                key="chargers-map"
                mapContainerStyle={MAP_CONTAINER_STYLE}
                options={MAP_OPTIONS}
                center={mapCenter}
                zoom={mapZoom}
                onClick={() => setSelectedChargerId(null)}
              >
                {chargersWithCoordinates.map((charger) => {
                  const markerPosition = toLatLngOrNull(charger)
                  if (!markerPosition) {
                    return null
                  }
                  return (
                    <Marker
                      key={charger.id}
                      icon={mapPinIcon}
                      position={markerPosition}
                      onClick={() => setSelectedChargerId(charger.id)}
                    />
                  )
                })}
                {selectedMapCharger && selectedMapPosition ? (
                  <InfoWindow
                    position={selectedMapPosition}
                    onCloseClick={() => setSelectedChargerId(null)}
                    options={infoWindowOptions}
                  >
                    <div className="map-info-card">
                      <h3 className="map-info-title">{selectedMapCharger.station?.name || 'Unassigned'}</h3>
                      <div className="map-info-row">
                        <span className="map-info-label">Charger ID :</span>
                        <span className="map-info-value">
                          {selectedMapCharger.number || selectedMapCharger.chargerBoxId || '—'}
                        </span>
                      </div>
                      {selectedMapCharger.status?.label && (
                        <div 
                          className="map-info-status-badge"
                          style={{
                            backgroundColor: (() => {
                              const statusValue = selectedMapCharger.status.value || ''
                              if (statusValue === 'available') {
                                return 'rgba(46, 165, 98, 0.12)'
                              } else if (statusValue === 'unavailable') {
                                return 'rgba(237, 74, 74, 0.12)'
                              } else if (statusValue === 'planned') {
                                return 'rgba(62, 79, 68, 0.12)'
                              }
                              return 'rgba(46, 165, 98, 0.12)'
                            })(),
                          }}
                        >
                          <span 
                            className="map-info-status-badge-text"
                            style={{
                              color: selectedMapCharger.status.color || '#2EA561',
                            }}
                          >
                            {selectedMapCharger.status.label}
                          </span>
                        </div>
                      )}
                      <div className="map-info-row">
                        <span className="map-info-label">City :</span>
                        <span className="map-info-value">
                          {selectedMapCharger.governorate ||
                            selectedMapCharger.station?.governorate ||
                            '—'}
                        </span>
                      </div>
                      <div className="map-info-row map-info-row--chargers">
                        <span className="map-info-label">Connectors :</span>
                        {(() => {
                          const tooltips = selectedMapCharger.connectorStatus?.tooltips || []
                          if (tooltips.length === 0) {
                            return <span className="map-info-value">No connectors</span>
                          }
                          return (
                            <div className="map-info-status-dots">
                              {tooltips.map((connector, index) => {
                                // Normalize connector status
                                const normalizedStatus = normalizeConnectorStatus(connector.status)
                                const statusColor = CONNECTOR_STATUS_COLORS[normalizedStatus] || CONNECTOR_STATUS_COLORS.unavailable
                                const statusLabel = CONNECTOR_STATUS_LABELS[normalizedStatus] || 'Unavailable'
                                
                                return (
                                  <span
                                    key={`${selectedMapCharger.id}-connector-${connector.id || index}`}
                                    className="map-info-dot"
                                    style={{
                                      background: connector.color || statusColor,
                                    }}
                                    title={statusLabel}
                                    aria-label={statusLabel}
                                  />
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                      <button
                        type="button"
                        className="map-info-button"
                        onClick={() => navigate(`/chargers/${selectedMapCharger.id}`)}
                      >
                        <span>View Charger</span>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M7 17L17 7M17 7H7M17 7V17"
                            stroke="var(--theme-secondary)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </InfoWindow>
                ) : null}
              </GoogleMap>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, charger: null })}
        onConfirm={handleDelete}
        title="Delete Charger"
        itemName={deleteModalState.charger?.name || deleteModalState.charger?.number}
        confirmationMessage={
          deleteModalState.charger
            ? `Are you sure you want to delete "${deleteModalState.charger.name || deleteModalState.charger.number}"?`
            : undefined
        }
      />
    </div>
  )
}

export default Chargers
