import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import {
  API_BASE,
  GOOGLE_MAPS_API_KEY,
} from '@/constants'
import { MAP_PIN_SIZE, createMapPinIcon } from '@/utils/mapPinIcon'
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_OPTIONS,
  MAP_CONTAINER_STYLE,
  useGoogleMapsLoader,
} from '@/utils/mapConfig'
import {
  CHARGER_STATUS_COLORS,
  CHARGER_STATUS_LABELS,
  CONNECTOR_STATUS_COLORS,
  CONNECTOR_STATUS_LABELS,
  CONNECTOR_STATUS_ORDER,
  normalizeChargerStatus,
} from '@/utils/status'
import { appendAuthHeader } from '@/utils/session'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { fetchCountries } from '@/services/referenceApi'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useDashboardLiveUpdates from '@/hooks/useDashboardLiveUpdates'
import useInlineToast from '@/hooks/useInlineToast'
import '@/styles/dashboard.css'

const VIEW_MODES = {
  LIST: 'list',
  MAP: 'map',
}

const MAP_OPTIONS = DEFAULT_MAP_OPTIONS

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]

const hasCoordinates = (station) =>
  station &&
  Number.isFinite(station.latitude) &&
  Number.isFinite(station.longitude)

const toLatLngOrNull = (station) => {
  if (!hasCoordinates(station)) {
    return null
  }
  return { lat: Number(station.latitude), lng: Number(station.longitude) }
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

const AddStationIcon = () => (
  <span className="primary-add-button__icon" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 12H19"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5V19"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
)

const aggregateGovernorates = (stations) => {
  const totals = new Map()
  stations.forEach((station) => {
    const name = station.governorate || 'Unknown'
    // Count stations, not chargers
    totals.set(name, (totals.get(name) ?? 0) + 1)
  })
  return Array.from(totals.entries())
    .map(([name, count]) => ({ name, chargers: count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const providersSet = (stations) => {
  const values = new Set()
  stations.forEach((station) => {
    if (station.service_provider) {
      values.add(station.service_provider)
    }
  })
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

const toConnectorStatusEntries = (summarySource) => {
  if (!summarySource || typeof summarySource !== 'object' || Array.isArray(summarySource)) {
    return []
  }
  const entries = []
  const seen = new Set()

  CONNECTOR_STATUS_ORDER.forEach((status) => {
    const value = Number(summarySource[status] ?? 0)
    if (Number.isFinite(value) && value > 0) {
      entries.push({ label: status, value })
      seen.add(status)
    }
  })

  Object.entries(summarySource).forEach(([label, rawValue]) => {
    if (seen.has(label)) {
      return
    }
    const value = Number(rawValue ?? 0)
    if (Number.isFinite(value) && value > 0) {
      entries.push({ label, value })
    }
  })

  return entries
}

const normaliseConnectorStatus = (station) => {
  if (Array.isArray(station.connector_status)) {
    return station.connector_status
  }
  if (Array.isArray(station.connectorStatus)) {
    return station.connectorStatus
  }
  if (station.connector_summary && typeof station.connector_summary === 'object') {
    return toConnectorStatusEntries(station.connector_summary)
  }
  if (station.connectorSummary && typeof station.connectorSummary === 'object') {
    return toConnectorStatusEntries(station.connectorSummary)
  }
  if (station.connectorStatus && typeof station.connectorStatus === 'object') {
    return toConnectorStatusEntries(station.connectorStatus)
  }
  return []
}

const formatConnectorSummaryText = (connectorStatuses) => {
  if (!Array.isArray(connectorStatuses) || !connectorStatuses.length) {
    return 'No connector data'
  }
  return connectorStatuses
    .map(({ label, value }) => {
      const normalizedLabel = String(label || '').trim().toLowerCase()
      const statusLabel = CONNECTOR_STATUS_LABELS[normalizedLabel] || label || 'Unknown'
      return `${value} ${statusLabel}`
    })
    .join(' · ')
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function Stations() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('stations')
  const { subscribe, registerReconnectRefetch } = useDashboardLiveUpdates()

  const [stations, setStations] = useState([])
  const [allStationsForCounts, setAllStationsForCounts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedStationChargerStatuses, setSelectedStationChargerStatuses] = useState([])
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    station: null,
  })

  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [countries, setCountries] = useState([])
  const [selectedCountries, setSelectedCountries] = useState(() => new Set())
  const [draftCountries, setDraftCountries] = useState(() => new Set())
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false)
  const [selectedGovernorates, setSelectedGovernorates] = useState(() => new Set())
  const [selectedProviders, setSelectedProviders] = useState(() => new Set())
  const [selectedStationId, setSelectedStationId] = useState(null)
  const [selectedStationIds, setSelectedStationIds] = useState(() => new Set())
  const [draftGovernorates, setDraftGovernorates] = useState(() => new Set())
  const [draftProviders, setDraftProviders] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [socketResyncKey, setSocketResyncKey] = useState(0)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })
  
  // Debounce search input to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // Reset to first page when search changes
    }, 300) // 300ms debounce delay
    
    return () => clearTimeout(timer)
  }, [search])

  const isMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY)
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useGoogleMapsLoader()
  const isGoogleMapsReady = useMemo(
    () =>
      Boolean(
        isMapsConfigured &&
          (isMapLoaded || (typeof window !== 'undefined' && window.google?.maps))
      ),
    [isMapLoaded, isMapsConfigured]
  )
  const mapPinIcon = useMemo(() => {
    const googleMaps = typeof window !== 'undefined' ? window.google?.maps : undefined
    return createMapPinIcon(googleMaps)
  }, [isGoogleMapsReady])

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  const countryMenuRef = useRef(null)
  const governorateMenuRef = useRef(null)
  const providerMenuRef = useRef(null)
  const [isGovernorateMenuOpen, setIsGovernorateMenuOpen] = useState(false)
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false)
  const selectAllCheckboxRef = useRef(null)

  const updateStationCollections = useCallback((stationId, updater) => {
    if (!stationId || typeof updater !== 'function') {
      return
    }
    const normalizedStationId = String(stationId)
    setStations((prev) => {
      let updated = false
      const next = prev.map((station) => {
        if (String(station.id) !== normalizedStationId) {
          return station
        }
        updated = true
        return updater(station)
      })
      return updated ? next : prev
    })
  }, [])

  const toggleDraftCountry = useCallback((code) => {
    setDraftCountries((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        if (next.size <= 1) {
          return prev
        }
        next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }, [])

  const applyCountries = useCallback(() => {
    if (draftCountries.size === 0) {
      return
    }
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
      setSelectedGovernorates(new Set())
      setSelectedProviders(new Set())
      setPage(1)
    }
    setIsCountryMenuOpen(false)
  }, [draftCountries, selectedCountries])

  const cancelCountries = useCallback(() => {
    setDraftCountries(new Set(selectedCountries))
    setIsCountryMenuOpen(false)
  }, [selectedCountries])

  const handleCountryMenuToggle = useCallback(() => {
    if (isCountryMenuOpen) {
      cancelCountries()
    } else {
      setDraftCountries(new Set(selectedCountries))
      setIsCountryMenuOpen(true)
    }
  }, [cancelCountries, isCountryMenuOpen, selectedCountries])

  const toggleDraftGovernorate = useCallback((name) => {
    setDraftGovernorates((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const applyGovernorates = useCallback(() => {
    const next = new Set(draftGovernorates)
    let changed = next.size !== selectedGovernorates.size
    if (!changed) {
      for (const value of next) {
        if (!selectedGovernorates.has(value)) {
          changed = true
          break
        }
      }
    }
    if (changed) {
      setSelectedGovernorates(next)
      setPage(1)
    }
    setIsGovernorateMenuOpen(false)
  }, [draftGovernorates, selectedGovernorates])

  const cancelGovernorates = useCallback(() => {
    setDraftGovernorates(new Set(selectedGovernorates))
    setIsGovernorateMenuOpen(false)
  }, [selectedGovernorates])

  const handleGovernorateMenuToggle = useCallback(() => {
    if (isGovernorateMenuOpen) {
      cancelGovernorates()
    } else {
      setDraftGovernorates(new Set(selectedGovernorates))
      setIsGovernorateMenuOpen(true)
    }
  }, [cancelGovernorates, isGovernorateMenuOpen, selectedGovernorates])

  const toggleDraftProvider = useCallback((name) => {
    setDraftProviders((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const applyProviders = useCallback(() => {
    const next = new Set(draftProviders)
    let changed = next.size !== selectedProviders.size
    if (!changed) {
      for (const value of next) {
        if (!selectedProviders.has(value)) {
          changed = true
          break
        }
      }
    }
    if (changed) {
      setSelectedProviders(next)
      setPage(1)
    }
    setIsProviderMenuOpen(false)
  }, [draftProviders, selectedProviders])

  const cancelProviders = useCallback(() => {
    setDraftProviders(new Set(selectedProviders))
    setIsProviderMenuOpen(false)
  }, [selectedProviders])

  const handleProviderMenuToggle = useCallback(() => {
    if (isProviderMenuOpen) {
      cancelProviders()
    } else {
      setDraftProviders(new Set(selectedProviders))
      setIsProviderMenuOpen(true)
    }
  }, [cancelProviders, isProviderMenuOpen, selectedProviders])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isCountryMenuOpen &&
        countryMenuRef.current &&
        !countryMenuRef.current.contains(event.target)
      ) {
        cancelCountries()
      }
      if (
        isGovernorateMenuOpen &&
        governorateMenuRef.current &&
        !governorateMenuRef.current.contains(event.target)
      ) {
        cancelGovernorates()
      }
      if (
        isProviderMenuOpen &&
        providerMenuRef.current &&
        !providerMenuRef.current.contains(event.target)
      ) {
        cancelProviders()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isCountryMenuOpen) {
        cancelCountries()
      }
      if (event.key === 'Escape' && isGovernorateMenuOpen) {
        cancelGovernorates()
      }
      if (event.key === 'Escape' && isProviderMenuOpen) {
        cancelProviders()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelCountries, cancelGovernorates, cancelProviders, isCountryMenuOpen, isGovernorateMenuOpen, isProviderMenuOpen])

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
          // Default to all countries selected so every user sees all stations on
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

  // Fetch all stations for filter counts (only filtered by country)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadAllStationsForCounts = async () => {
      try {
        const allResults = []
        let currentPage = 1
        let totalPages = 1
        const pageSize = 1000 // Use a reasonable page size

        while (currentPage <= totalPages && !controller.signal.aborted) {
          const params = new URLSearchParams()
          params.set('page', String(currentPage))
          params.set('page_size', String(pageSize))
          Array.from(selectedCountries).forEach((code) => {
            if (code) {
              params.append('country', code)
            }
          })

          const response = await fetch(`${API_BASE}/stations/?${params.toString()}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            break
          }

          const json = await response.json()
          const rawResults = Array.isArray(json) ? json : json.results ?? []
          allResults.push(...rawResults)

          const paginationMeta = Array.isArray(json)
            ? { total_pages: 1 }
            : json.pagination ?? {
                total_pages:
                  json.total_pages ??
                  (json.total_items && pageSize
                    ? Math.max(1, Math.ceil(json.total_items / pageSize))
                    : 1),
              }
          totalPages = paginationMeta.total_pages ?? 1
          currentPage += 1
        }

        const normalized = allResults.map((station, index) => {
          const chargersRaw =
            station.chargers ?? station.chargers_count ?? station.chargersCount ?? 0
          const chargersCount = Number(chargersRaw)
          return {
            id: station.id ?? station.identifier ?? `station-${index}`,
            name: station.name?.trim() || 'Unnamed station',
            arabic_name: station.arabic_name?.trim() || '',
            governorate: station.governorate?.trim() || 'Unknown',
            service_provider: station.service_provider?.trim() || 'N/A',
            chargers: Number.isFinite(chargersCount) ? chargersCount : 0,
          }
        })

        if (!cancelled) {
          setAllStationsForCounts(normalized)
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Failed to load all stations for counts:', loadError)
        }
      }
    }

    loadAllStationsForCounts()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedCountries])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadStations = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        const trimmedSearch = debouncedSearch.trim()
        if (trimmedSearch) {
          params.set('search', trimmedSearch)
        }
        Array.from(selectedCountries).forEach((code) => {
          if (code) {
            params.append('country', code)
          }
        })
        Array.from(selectedGovernorates).forEach((name) => {
          if (name) {
            params.append('governorate', name)
          }
        })
        Array.from(selectedProviders).forEach((name) => {
          if (name) {
            params.append('service_provider', name)
          }
        })

        const response = await fetch(`${API_BASE}/stations/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch stations (${response.status})`)
        }

        const json = await response.json()
        const rawResults = Array.isArray(json) ? json : json.results ?? []
        const paginationMeta = Array.isArray(json)
          ? {
              page,
              page_size: pageSize,
              total_pages: rawResults.length ? 1 : 1,
              total_items: rawResults.length,
            }
          : json.pagination ?? {
              page: json.page ?? page,
              page_size: json.page_size ?? pageSize,
              total_pages:
                json.total_pages ??
                (json.count && pageSize
                  ? Math.max(1, Math.ceil(json.count / pageSize))
                  : 1),
              total_items: json.total_items ?? json.count ?? rawResults.length,
            }

        const normalized = rawResults.map((station, index) => {
          const chargersRaw =
            station.chargers ?? station.chargers_count ?? station.chargersCount ?? 0
          const chargersCount = Number(chargersRaw)
          const latitude = toNumberOrNull(station.latitude)
          const longitude = toNumberOrNull(station.longitude)
          return {
            id: station.id ?? station.identifier ?? `station-${index}`,
            name: station.name?.trim() || 'Unnamed station',
            arabic_name: station.arabic_name?.trim() || '',
            governorate: station.governorate?.trim() || 'Unknown',
            service_provider: station.service_provider?.trim() || 'N/A',
            maintenance_partner: station.maintenance_partner?.trim() || 'N/A',
            site_owner: station.site_owner?.trim() || 'N/A',
            country: station.country || 'N/A',
            address: station.address?.trim() || station.location?.trim() || 'N/A',
            chargers: Number.isFinite(chargersCount) ? chargersCount : 0,
            latitude,
            longitude,
            status: station.status ?? 'operational',
            visibility: station.visibility ?? 'public',
            connector_status: normaliseConnectorStatus(station),
            images: station.images ?? [],
          }
        })

        if (!cancelled) {
          const serverPage = Number(paginationMeta.page ?? page)
          const serverPageSize = Number(paginationMeta.page_size ?? pageSize)
          const serverTotalPages = Number(paginationMeta.total_pages ?? 1)
          const serverTotalItems = Number(
            paginationMeta.total_items ?? normalized.length
          )

          const normalizedPagination = {
            page:
              Number.isFinite(serverPage) && serverPage > 0 ? serverPage : page,
            page_size:
              Number.isFinite(serverPageSize) && serverPageSize > 0
                ? serverPageSize
                : pageSize,
            total_pages:
              Number.isFinite(serverTotalPages) && serverTotalPages > 0
                ? serverTotalPages
                : 1,
            total_items:
              Number.isFinite(serverTotalItems) && serverTotalItems >= 0
                ? serverTotalItems
                : normalized.length,
          }

          setStations(normalized)
          setPagination(normalizedPagination)
          if (normalizedPagination.page !== page) {
            setPage(normalizedPagination.page)
          }
          if (normalizedPagination.page_size !== pageSize) {
            setPageSize(normalizedPagination.page_size)
          }
          setSelectedStationId((prev) => {
            if (prev && normalized.some((station) => station.id === prev)) {
              return prev
            }
            return normalized[0]?.id ?? null
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setStations([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load stations.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadStations()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    selectedCountries,
    selectedGovernorates,
    selectedProviders,
    socketResyncKey,
  ])

  const governorateOptions = useMemo(() => {
    const base = aggregateGovernorates(allStationsForCounts)
    const known = new Set(base.map((item) => item.name))
    selectedGovernorates.forEach((name) => {
      if (name && !known.has(name)) {
        base.push({ name, chargers: 0 })
        known.add(name)
      }
    })
    return base.sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedGovernorates, allStationsForCounts])

  const providerOptions = useMemo(() => {
    const base = providersSet(allStationsForCounts)
    const providerMap = new Map()
    
    // Count stations per provider from all records
    allStationsForCounts.forEach((station) => {
      if (station.service_provider) {
        const current = providerMap.get(station.service_provider) || 0
        providerMap.set(station.service_provider, current + 1)
      }
    })
    
    // Build options with counts
    const options = base.map((provider) => ({
      name: provider,
      count: providerMap.get(provider) || 0,
    }))
    
    // Add selected providers that might not be in current stations
    selectedProviders.forEach((provider) => {
      if (!base.includes(provider)) {
        options.push({ name: provider, count: 0 })
      }
    })
    
    return options.sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedProviders, allStationsForCounts])

  // Backend now handles all filtering, so filteredStations is just the stations from API
  // This eliminates redundant client-side filtering and improves performance
  const filteredStations = stations

  useEffect(() => {
    setSelectedStationIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) =>
          filteredStations.some((station) => station.id === id)
        )
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredStations])

  const stationsWithCoordinates = useMemo(
    () =>
      filteredStations.filter(
        (station) => hasCoordinates(station)
      ),
    [filteredStations]
  )

  const totalStationsCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalStationPages = Math.max(1, pagination.total_pages ?? 1)

  const stationPageBounds = useMemo(() => {
    if (!filteredStations.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredStations.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredStations])

  const stationPageSizeOptions = useMemo(() => {
    if (PAGE_SIZE_OPTIONS.some((option) => option.value === effectivePageSize)) {
      return PAGE_SIZE_OPTIONS
    }
    return [...PAGE_SIZE_OPTIONS, { value: effectivePageSize, label: `${effectivePageSize} / page` }].sort(
      (a, b) => a.value - b.value
    )
  }, [effectivePageSize])

  const areAllFilteredSelected =
    filteredStations.length > 0 &&
    filteredStations.every((station) => selectedStationIds.has(station.id))
  const hasSelection = selectedStationIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  useEffect(() => {
    if (!filteredStations.length) {
      setSelectedStationId(null)
      return
    }
    setSelectedStationId((prev) =>
      prev && filteredStations.some((station) => station.id === prev) ? prev : null
    )
  }, [filteredStations])

  const selectedStation = useMemo(
    () => filteredStations.find((station) => station.id === selectedStationId) ?? null,
    [filteredStations, selectedStationId]
  )

  const selectedMapStation = useMemo(
    () =>
      stationsWithCoordinates.find(
        (station) => String(station.id) === String(selectedStationId)
      ) ?? null,
    [stationsWithCoordinates, selectedStationId]
  )

  const selectedMapPosition = useMemo(
    () => toLatLngOrNull(selectedMapStation),
    [selectedMapStation]
  )

  const mapCenter = useMemo(() => {
    if (selectedMapPosition) {
      return selectedMapPosition
    }
    if (stationsWithCoordinates.length) {
      const totals = stationsWithCoordinates.reduce(
        (accumulator, station) => ({
          lat: accumulator.lat + station.latitude,
          lng: accumulator.lng + station.longitude,
        }),
        { lat: 0, lng: 0 }
      )
      return {
        lat: totals.lat / stationsWithCoordinates.length,
        lng: totals.lng / stationsWithCoordinates.length,
      }
    }
    return DEFAULT_MAP_CENTER
  }, [selectedMapPosition, stationsWithCoordinates])

  const mapZoom = useMemo(() => {
    if (selectedMapPosition) {
      return 12
    }
    if (stationsWithCoordinates.length === 1) {
      return 11
    }
    if (stationsWithCoordinates.length > 1) {
      return 7
    }
    return 6
  }, [selectedMapPosition, stationsWithCoordinates])

  const selectedStationConnectors = useMemo(
    () => (selectedStation ? normaliseConnectorStatus(selectedStation) : []),
    [selectedStation]
  )

  // Fetch charger statuses for the selected station
  useEffect(() => {
    if (!selectedStation?.id) {
      setSelectedStationChargerStatuses([])
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadChargerStatuses = async () => {
      try {
        const response = await fetch(`${API_BASE}/stations/${selectedStation.id}/chargers/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        const chargers = Array.isArray(data) ? data : []

        // Create one dot per charger (not grouped by status)
        const chargerStatuses = chargers.map((charger, index) => {
          const statusValue = charger.status?.value || charger.status || 'planned'
          const normalizedStatus = normalizeChargerStatus(statusValue)

          return {
            id: charger.id || `charger-${index}`,
            status: normalizedStatus,
            label: CHARGER_STATUS_LABELS[normalizedStatus] || normalizedStatus,
            color: CHARGER_STATUS_COLORS[normalizedStatus] || CHARGER_STATUS_COLORS.planned,
          }
        })

        if (!cancelled) {
          setSelectedStationChargerStatuses(chargerStatuses)
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Failed to load charger statuses:', loadError)
        }
      }
    }

    loadChargerStatuses()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedStation?.id, socketResyncKey])

  useEffect(() => {
    const unsubscribe = subscribe('station.connector_summary.update', (message) => {
      const data = message?.data || {}
      const stationId = data.station_id || data.stationId
      if (!stationId) {
        return
      }

      const hasConnectorSummaryPayload =
        Object.prototype.hasOwnProperty.call(data, 'connector_summary') ||
        Object.prototype.hasOwnProperty.call(data, 'connectorSummary')
      const connectorSummaryPayload = hasConnectorSummaryPayload
        ? (data.connector_summary ?? data.connectorSummary ?? {})
        : null

      updateStationCollections(stationId, (station) => ({
        ...station,
        status: data.status || station.status,
        connector_status: hasConnectorSummaryPayload
          ? normaliseConnectorStatus({ connector_summary: connectorSummaryPayload })
          : station.connector_status,
      }))
    })

    return () => {
      unsubscribe()
    }
  }, [subscribe, updateStationCollections])

  useEffect(() => {
    const unregisterReconnectRefetch = registerReconnectRefetch('stations', () => {
      setSocketResyncKey((value) => value + 1)
    })

    return () => {
      unregisterReconnectRefetch()
    }
  }, [registerReconnectRefetch])

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

  const handleSelectAll = () => {
    setSelectedStationIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredStations.forEach((station) => {
          next.delete(station.id)
        })
      } else {
        filteredStations.forEach((station) => {
          if (station.id != null) {
            next.add(station.id)
          }
        })
      }
      return next
    })
  }

  const toggleStationSelection = (stationId) => {
    setSelectedStationIds((prev) => {
      const next = new Set(prev)
      if (next.has(stationId)) {
        next.delete(stationId)
      } else {
        next.add(stationId)
      }
      return next
    })
  }

  const handleDeleteClick = (station) => {
    setDeleteModalState({ isOpen: true, station })
  }

  const handleDelete = async () => {
    const station = deleteModalState.station
    if (!station) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/stations/${station.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete station.')
      }
      setStations((prev) => prev.filter((item) => item.id !== station.id))
      setSelectedStationId((prev) => (prev === station.id ? null : prev))
      setSelectedStationIds((prev) => {
        if (!prev.has(station.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(station.id)
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
        title: 'Station deleted',
        message: `${station.name || 'Station'} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete station.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, station: null })
    }
  }

  const handleDownload = async () => {
    let rowsToExport = []

    // If records are selected, use only those
    if (hasSelection) {
      rowsToExport = filteredStations.filter((station) => selectedStationIds.has(station.id))
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
            params.set('search', trimmedSearch)
          }
          Array.from(selectedCountries).forEach((code) => {
            if (code) {
              params.append('country', code)
            }
          })

          Array.from(selectedGovernorates).forEach((name) => {
            if (name) {
              params.append('governorate', name)
            }
          })
          
          Array.from(selectedProviders).forEach((name) => {
            if (name) {
              params.append('service_provider', name)
            }
          })

          const response = await fetch(`${API_BASE}/stations/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch stations for export (${response.status})`)
          }

          const json = await response.json()
          const rawResults = Array.isArray(json) ? json : json.results ?? []
          allResults.push(...rawResults)

          const paginationMeta = Array.isArray(json)
            ? { total_pages: 1 }
            : json.pagination ?? {
                total_pages:
                  json.total_pages ??
                  (json.total_items && pageSize
                    ? Math.max(1, Math.ceil(json.total_items / pageSize))
                    : 1),
              }
          totalPages = paginationMeta.total_pages ?? 1
          currentPage += 1
        }

        // Normalize the results
        rowsToExport = allResults.map((station, index) => {
          const chargersRaw =
            station.chargers ?? station.chargers_count ?? station.chargersCount ?? 0
          const chargersCount = Number(chargersRaw)
          return {
            id: station.id ?? station.identifier ?? `station-${index}`,
            name: station.name?.trim() || 'Unnamed station',
            arabic_name: station.arabic_name?.trim() || '',
            address: station.address?.trim() || station.location?.trim() || 'N/A',
            governorate: station.governorate?.trim() || 'Unknown',
            service_provider: station.service_provider?.trim() || 'N/A',
            chargers: Number.isFinite(chargersCount) ? chargersCount : 0,
            status: station.status ?? 'Unknown',
            visibility: station.visibility ?? 'Unknown',
          }
        })
      } catch (error) {
        console.error('Failed to fetch all stations for export:', error)
        alert('Failed to fetch all stations. Please try again.')
        return
      }
    }

    if (!rowsToExport.length) {
      alert('No station data to export.')
      return
    }

    const dataRows = rowsToExport.map((station, index) => ({
      '#': index + 1,
      Name: station.name,
      Address: station.address,
      Governorate: station.governorate,
      'Service Provider': station.service_provider,
      Chargers: station.chargers ?? 0,
      Status: station.status ?? 'Unknown',
      Visibility: station.visibility ?? 'Unknown',
    }))

    const headers = [
      '#',
      'Name',
      'Address',
      'Governorate',
      'Service Provider',
      'Chargers',
      'Status',
      'Visibility',
    ]

    downloadCsv({
      headers,
      rows: dataRows,
      filename: `stations_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  const handleStationsPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalStationPages)
      return target === prev ? prev : target
    })
  }

  const handleStationsPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const isMapMode = viewMode === VIEW_MODES.MAP

  return (
    <div className={`stations-page${isMapMode ? ' map-mode' : ''}`}>
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Stations' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Stations</h1>
            </div>
            <nav className="stations-tabs" aria-label="View mode">
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
        <div className="stations-header-actions">
          {viewMode === VIEW_MODES.LIST ? (
            <button
              type="button"
              className="download-button"
              onClick={handleDownload}
              disabled={!filteredStations.length}
            >
              <DownloadIcon />
              <span className="download-button__label">Download</span>
            </button>
          ) : null}
          <button
            type="button"
            className="primary-add-button"
            onClick={() => navigate('/stations/new')}
          >
            <AddStationIcon />
            <span className="primary-add-button__label">Add Station</span>
          </button>
        </div>
        
      </header>
<InlineToastRegion region="stations" />
      

      <div className="stations-filters">
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
              aria-controls="country-filter-menu"
              onClick={handleCountryMenuToggle}
            >
              {selectedCountries.size > 1
                ? `${selectedCountries.size} countries`
                : (countries.find((c) => selectedCountries.has(c.code))?.name || 'Country')}
            </button>
            {isCountryMenuOpen ? (
              <div
                id="country-filter-menu"
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
                          className={`filter-menu__item${isSelected ? ' is-selected' : ''}${isOnlyOne ? ' is-locked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isOnlyOne}
                            onChange={() => toggleDraftCountry(country.code)}
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
                    onClick={applyCountries}
                    disabled={draftCountries.size === 0}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="filter-menu__cancel"
                    onClick={cancelCountries}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="station-search">
            Search stations by name
          </label>
          <div className="filter-search">
            <span className="filter-search__icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16.4226 15.2476L19.2559 18.0726C19.4137 18.229 19.5024 18.442 19.5024 18.6642C19.5024 18.8864 19.4137 19.0994 19.2559 19.2559C19.0994 19.4137 18.8864 19.5024 18.6642 19.5024C18.442 19.5024 18.229 19.4137 18.0726 19.2559L15.2476 16.4226C14.0829 17.3367 12.6448 17.8327 11.1642 17.8309C7.48233 17.8309 4.49756 14.8461 4.49756 11.1642C4.49756 7.48233 7.48233 4.49756 11.1642 4.49756C14.8461 4.49756 17.8309 7.48233 17.8309 11.1642C17.8327 12.6448 17.3367 14.0829 16.4226 15.2476ZM11.1642 6.16423C8.4028 6.16423 6.16423 8.4028 6.16423 11.1642C6.16423 13.9256 8.4028 16.1642 11.1642 16.1642C13.9256 16.1642 16.1642 13.9256 16.1642 11.1642C16.1642 8.4028 13.9256 6.16423 11.1642 6.16423Z"
                  fill="#67716B"
                />
              </svg>
            </span>
            <input
              id="station-search"
              type="search"
              placeholder="Search by name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                // Page reset is handled by debounce effect
              }}
            />
          </div>
        </div>

        <div className="filter-field governorate-filter">
          <label className="sr-only">Filter by governorate</label>
          <div
            className={`multi-select ${isGovernorateMenuOpen ? 'open' : ''}`}
            ref={governorateMenuRef}
          >
            <button
              type="button"
              className="multi-select-trigger"
              aria-haspopup="dialog"
              aria-expanded={isGovernorateMenuOpen}
              aria-controls="governorate-filter-menu"
              onClick={handleGovernorateMenuToggle}
            >
              {selectedGovernorates.size > 0
                ? `${selectedGovernorates.size} selected`
                : 'Governorate'}
            </button>
            {isGovernorateMenuOpen ? (
              <div
                id="governorate-filter-menu"
                className="multi-select-menu filter-menu"
                role="dialog"
                aria-label="Filter governorates"
              >
                <div className="filter-menu__header">
                  <span className="filter-menu__title">Governorate</span>
                  <span className="filter-menu__badge">{draftGovernorates.size}</span>
                </div>
                <div className="filter-menu__body">
                  {governorateOptions.length ? (
                    governorateOptions.map((option) => {
                      const isSelected = draftGovernorates.has(option.name)
                      return (
                        <label
                          key={option.name}
                          className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDraftGovernorate(option.name)}
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
                                  <rect width="18" height="18" rx="4" fill="var(--theme-primary)"/>
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
                                  <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="#99A19D" strokeWidth="1.5"/>
                                  <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D"/>
                                </svg>
                              )}
                            </span>
                            <span className="filter-menu__name">{option.name}</span>
                          </span>
                          <span className="filter-menu__count">
                            {option.chargers.toLocaleString()}
                          </span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="filter-menu__empty">No governorates available.</p>
                  )}
                </div>
                <div className="filter-menu__footer">
                  <button
                    type="button"
                    className="filter-menu__apply"
                    onClick={applyGovernorates}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="filter-menu__cancel"
                    onClick={cancelGovernorates}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="filter-field provider-filter">
          <label className="sr-only">Filter by service provider</label>
          <div
            className={`multi-select ${isProviderMenuOpen ? 'open' : ''}`}
            ref={providerMenuRef}
          >
            <button
              type="button"
              className="multi-select-trigger"
              aria-haspopup="dialog"
              aria-expanded={isProviderMenuOpen}
              aria-controls="provider-filter-menu"
              onClick={handleProviderMenuToggle}
            >
              {selectedProviders.size > 0
                ? `${selectedProviders.size} selected`
                : 'Service provider'}
            </button>
            {isProviderMenuOpen ? (
              <div
                id="provider-filter-menu"
                className="multi-select-menu filter-menu"
                role="dialog"
                aria-label="Filter service providers"
              >
                <div className="filter-menu__header">
                  <span className="filter-menu__title">Service provider</span>
                  <span className="filter-menu__badge">{draftProviders.size}</span>
                </div>
                <div className="filter-menu__body">
                  {providerOptions.length ? (
                    providerOptions.map((option) => {
                      const isSelected = draftProviders.has(option.name)
                      return (
                        <label
                          key={option.name}
                          className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDraftProvider(option.name)}
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
                                  <rect width="18" height="18" rx="4" fill="var(--theme-primary)"/>
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
                                  <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="#99A19D" strokeWidth="1.5"/>
                                  <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D"/>
                                </svg>
                              )}
                            </span>
                            <span className="filter-menu__name">{option.name}</span>
                          </span>
                          <span className="filter-menu__count">
                            {option.count.toLocaleString()}
                          </span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="filter-menu__empty">No service providers available.</p>
                  )}
                </div>
                <div className="filter-menu__footer">
                  <button
                    type="button"
                    className="filter-menu__apply"
                    onClick={applyProviders}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="filter-menu__cancel"
                    onClick={cancelProviders}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="data-warning">{error}</div> : null}

      {viewMode === VIEW_MODES.LIST ? (
        <div className="stations-table" aria-busy={isLoading}>
          <div className="stations-table-header">
            <span className="cell station-select-cell">
              <input
                type="checkbox"
                ref={selectAllCheckboxRef}
                className="select-checkbox"
                checked={filteredStations.length > 0 && areAllFilteredSelected}
                onChange={handleSelectAll}
                aria-label={
                  areAllFilteredSelected ? 'Clear station selection' : 'Select all stations'
                }
              />
            </span>
            <span>No</span>
            <span>Name</span>
            <span>Address</span>
            <span>Governorate</span>
            <span>Partner</span>
            <span>Chargers</span>
            <span></span>
          </div>
          {isLoading ? <p className="data-placeholder">Loading stations...</p> : null}
          {!isLoading && !filteredStations.length ? (
            <p className="data-placeholder">No stations match the selected filters.</p>
          ) : null}
          {!isLoading
            ? filteredStations.map((station, index) => (
                <article
                  key={station.id}
                  className={`station-row clickable ${
                    selectedStationIds.has(station.id) ? 'selected' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (
                      event.target instanceof HTMLElement &&
                      event.target.closest('.station-select-cell')
                    ) {
                      return
                    }
                    navigate(`/stations/${station.id}`)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      if (
                        event.target instanceof HTMLElement &&
                        event.target.closest('.station-select-cell')
                      ) {
                        return
                      }
                      event.preventDefault()
                      navigate(`/stations/${station.id}`)
                    }
                  }}
                >
                  <span className="cell station-select-cell">
                    <input
                      type="checkbox"
                      className="select-checkbox"
                      checked={selectedStationIds.has(station.id)}
                      onChange={(event) => {
                        event.stopPropagation()
                        toggleStationSelection(station.id)
                      }}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${station.name}`}
                    />
                  </span>
                  <span className="cell order">{stationPageBounds.start + index}</span>
	                  <span className="cell name">
	                    <span>{station.name}</span>
	                    {station.arabic_name ? (
	                      <span className="station-secondary-text">{station.arabic_name}</span>
	                    ) : null}
	                    <span className="station-secondary-text">
	                      {formatConnectorSummaryText(station.connector_status)}
	                    </span>
	                  </span>
                  <span className="cell address">{station.address}</span>
                  <span className="cell governorate">{station.governorate}</span>
                  <span className="cell provider">{station.maintenance_partner || station.service_provider || 'N/A'}</span>
                  <span className="cell chargers">{station.chargers ?? 0}</span>
                  <span className="cell actions">
                    <StationActionMenu
                      onEdit={() => navigate(`/stations/${station.id}`)}
                      onDelete={() => handleDeleteClick(station)}
                    />
                  </span>
                </article>
              ))
            : null}
          <footer className="stations-table-footer">
            <div className="pagination-info">
              {totalStationsCount
                ? `Showing ${stationPageBounds.start}-${stationPageBounds.end} of ${totalStationsCount} stations`
                : 'No stations to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleStationsPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalStationPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleStationsPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalStationPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="station-page-size">Rows per page</label>
              <select
                id="station-page-size"
                value={effectivePageSize}
                onChange={handleStationsPageSizeChange}
                disabled={isLoading}
              >
                {stationPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : (
        <div className="stations-map-view" aria-busy={isLoading}>
          <div className="stations-map-canvas">
            {!isMapsConfigured ? (
              <div className="map-placeholder">
                Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the interactive map.
              </div>
            ) : mapLoadError ? (
              <div className="map-placeholder">Unable to load Google Maps.</div>
            ) : !isGoogleMapsReady ? (
              <p className="map-loading">Loading map...</p>
            ) : !stationsWithCoordinates.length ? (
              <div className="map-placeholder">No stations with coordinates to display yet.</div>
            ) : (
              <GoogleMap
                key="stations-map"
                mapContainerStyle={MAP_CONTAINER_STYLE}
                options={MAP_OPTIONS}
                center={mapCenter}
                zoom={mapZoom}
                onClick={() => setSelectedStationId(null)}
              >
                {stationsWithCoordinates.map((station) => {
                  const markerPosition = toLatLngOrNull(station)
                  if (!markerPosition) {
                    return null
                  }
                  return (
                    <Marker
                      key={station.id}
                      icon={mapPinIcon}
                      position={markerPosition}
                      onClick={() => setSelectedStationId(station.id)}
                    />
                  )
                })}

                {selectedStation && selectedMapPosition ? (
                  <InfoWindow
                    position={selectedMapPosition}
                    options={infoWindowOptions}
                  >
                    <div className="map-info-card">
                      <h3 className="map-info-title">{selectedStation.name}</h3>
                      <div className="map-info-row">
                        <span className="map-info-label">Owner :</span>
                        <span className="map-info-value">
                          {selectedStation.site_owner || selectedStation.service_provider || 'N/A'}
                        </span>
                      </div>
                      <div className="map-info-row">
                        <span className="map-info-label">City :</span>
                        <span className="map-info-value">
                          {selectedStation.governorate || 'N/A'}
                        </span>
                      </div>
	                      <div className="map-info-row map-info-row--chargers">
	                        <span className="map-info-label">Chargers :</span>
	                        {selectedStationChargerStatuses.length > 0 ? (
                          <div className="map-info-status-dots">
                            {selectedStationChargerStatuses.map((charger) => (
                              <span
                                key={`${selectedStation.id}-charger-${charger.id}`}
                                className="map-info-dot"
                                style={{
                                  background: charger.color,
                                }}
                                title={charger.label}
                                aria-label={charger.label}
                              />
                            ))}
                          </div>
	                        ) : (
	                          <span className="map-info-value">No charger data</span>
	                        )}
	                      </div>
	                      <div className="map-info-row map-info-row--chargers">
	                        <span className="map-info-label">Connectors :</span>
	                        {selectedStationConnectors.length > 0 ? (
	                          <div className="map-info-status-dots">
	                            {selectedStationConnectors.map(({ label, value }) => {
	                              const normalizedStatus = String(label || '').trim().toLowerCase()
	                              const statusColor =
	                                CONNECTOR_STATUS_COLORS[normalizedStatus] ||
	                                CONNECTOR_STATUS_COLORS.unavailable
	                              const statusLabel =
	                                CONNECTOR_STATUS_LABELS[normalizedStatus] || label || 'Unknown'
	                              return (
	                                <span
	                                  key={`${selectedStation.id}-connector-summary-${normalizedStatus}`}
	                                  className="map-info-dot"
	                                  style={{ background: statusColor }}
	                                  title={`${statusLabel}: ${value}`}
	                                  aria-label={`${statusLabel}: ${value}`}
	                                />
	                              )
	                            })}
	                          </div>
	                        ) : (
	                          <span className="map-info-value">No connector data</span>
	                        )}
	                      </div>
	                      <button
                        type="button"
                        className="map-info-button"
                        onClick={() => navigate(`/stations/${selectedStation.id}`)}
                      >
                        <span>View Station</span>
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
        onClose={() => setDeleteModalState({ isOpen: false, station: null })}
        onConfirm={handleDelete}
        title="Delete Station"
        itemName={deleteModalState.station?.name}
        confirmationMessage={
          deleteModalState.station
            ? `Are you sure you want to delete "${deleteModalState.station.name}"?`
            : undefined
        }
      />
    </div>
  )
}

export default Stations
