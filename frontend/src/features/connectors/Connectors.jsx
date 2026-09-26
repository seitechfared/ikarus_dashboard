import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import ConnectorActionMenu from '@/components/ui/organisms/ConnectorActionMenu'
import ConnectorRemoteActionsDrawer from './ConnectorRemoteActionsDrawer'
import { fetchCountries } from '@/services/referenceApi'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import useDashboardLiveUpdates from '@/hooks/useDashboardLiveUpdates'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import {
  CONNECTOR_STATUS_BACKGROUNDS,
  CONNECTOR_STATUS_COLORS,
  CONNECTOR_STATUS_LABELS,
  normalizeConnectorStatus,
} from '@/utils/status'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]
const FILTER_COUNT_PAGE_SIZE = 250
const MAX_FILTER_COUNT_PAGES = 12

const createEmptyFilterState = () => ({
  stations: [],
  governorates: [],
  chargers: [],
  statuses: [],
})

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

const applyConnectorFiltersToParams = (params, appliedFilters, countries = null) => {
  appendFilterParams(params, 'status', appliedFilters.statuses)
  appendFilterParams(params, 'station_id', appliedFilters.stations)
  appendFilterParams(params, 'governorate', appliedFilters.governorates)
  appendFilterParams(params, 'charger_id', appliedFilters.chargers)
  if (countries) {
    const list = countries instanceof Set ? Array.from(countries) : Array.isArray(countries) ? countries : [countries]
    list.forEach((code) => {
      if (code) {
        params.append('country', code)
      }
    })
  }
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
      d="M20.345 14.162a.656.656 0 0 0-.464.192.656.656 0 0 0-.192.463v2.238a1.774 1.774 0 0 1-.582 1.406 1.774 1.774 0 0 1-1.406.582H6.299a1.774 1.774 0 0 1-1.406-.582 1.774 1.774 0 0 1-.582-1.406v-2.238a.656.656 0 0 0-.964-.463.656.656 0 0 0-.192.463v2.238c0 .875.348 1.713.967 2.332a3.294 3.294 0 0 0 2.332.966H17.7a3.294 3.294 0 0 0 2.333-.966 3.294 3.294 0 0 0 .966-2.332v-2.238a.657.657 0 0 0-.655-.656Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
    <path
      d="M11.535 16.076a.656.656 0 0 0 .465.193.656.656 0 0 0 .465-.193l3.728-3.728a.658.658 0 0 0 .01-.9.658.658 0 0 0-.9-.01l-2.62 2.622V4.3a.656.656 0 0 0-1.312 0V14.06l-2.62-2.621a.657.657 0 0 0-.93.93l3.738 3.707Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
  </svg>
)

const AddConnectorIcon = () => (
  <span className="primary-add-button__icon" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5v14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
)

const createEmptyFilterCounts = () => ({
  stations: {},
  governorates: {},
  chargers: {},
  statuses: {},
})

const buildConnectorStatusBadge = (statusValue, fallback = {}) => {
  const normalized = normalizeConnectorStatus(statusValue)
  return {
    ...fallback,
    value: normalized,
    label: CONNECTOR_STATUS_LABELS[normalized] || normalized,
    color: CONNECTOR_STATUS_COLORS[normalized] || CONNECTOR_STATUS_COLORS.unavailable,
    background: CONNECTOR_STATUS_BACKGROUNDS[normalized] || fallback.background,
  }
}

const getConnectorDeleteErrorMessage = (message) => {
  if (!message) {
    return 'Unable to delete connector.'
  }
  const normalized = message.toLowerCase()
  if (normalized.includes('charger_log')) {
    return 'This connector has charger logs associated with it and cannot be deleted. Remove the related logs before retrying.'
  }
  if (normalized.includes('foreign') && normalized.includes('key')) {
    return 'This connector is still referenced by other records and cannot be deleted.'
  }
  return message
}

function Connectors() {
  const navigate = useNavigate()
  const toast = useInlineToast('connectors')
  const { subscribe, registerReconnectRefetch } = useDashboardLiveUpdates()
  const [connectors, setConnectors] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 0,
    total_items: 0,
  })
  const [filters, setFilters] = useState(() => createEmptyFilterState())
  const [draftFilters, setDraftFilters] = useState(() => createEmptyFilterState())
  const [countries, setCountries] = useState([])
  const [selectedCountries, setSelectedCountries] = useState(() => new Set())
  const [draftCountries, setDraftCountries] = useState(() => new Set())
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false)
  const countryMenuRef = useRef(null)
  const [openFilterKey, setOpenFilterKey] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [availableFilters, setAvailableFilters] = useState({
    statuses: [],
    governorates: [],
    stations: [],
    chargers: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedConnector, setSelectedConnector] = useState(null)
  const [isRemoteActionsOpen, setRemoteActionsOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    connector: null,
  })
  const [selectedConnectorIds, setSelectedConnectorIds] = useState(() => new Set())
  const selectAllCheckboxRef = useRef(null)
  const [filterCounts, setFilterCounts] = useState(() => createEmptyFilterCounts())
  const stationOptions = useMemo(() => {
    const options = Array.isArray(availableFilters.stations) ? availableFilters.stations : []
    return options
      .filter((station) => station && station.value)
      .map((station) => ({
        value: station.value,
        label: station.label || station.name || 'Station',
        count: filterCounts.stations?.[String(station.value)] ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [availableFilters.stations, filterCounts.stations])

  const chargerOptions = useMemo(() => {
    const options = Array.isArray(availableFilters.chargers) ? availableFilters.chargers : []
    return options
      .filter((charger) => charger && charger.value)
      .map((charger) => ({
        value: charger.value,
        label: charger.label || charger.name || charger.box_id || 'Charger',
        count: filterCounts.chargers?.[String(charger.value)] ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [availableFilters.chargers, filterCounts.chargers])

  const governorateOptions = useMemo(
    () =>
      (availableFilters.governorates || []).map((value) => ({
        value,
        label: value || 'Unknown',
        count: value ? filterCounts.governorates?.[value] ?? 0 : 0,
      })),
    [availableFilters.governorates, filterCounts.governorates]
  )

  const statusOptions = useMemo(
    () =>
      (availableFilters.statuses || []).map((status) => ({
        value: status.value,
        label: status.label || status.value,
        count: filterCounts.statuses?.[status.value] ?? 0,
      })),
    [availableFilters.statuses, filterCounts.statuses]
  )

  const connectorsWithIds = useMemo(
    () => connectors.filter((connector) => connector?.id !== undefined && connector?.id !== null),
    [connectors]
  )
  const areAllConnectorsSelected =
    connectorsWithIds.length > 0 &&
    connectorsWithIds.every((connector) => selectedConnectorIds.has(connector.id))
  const hasPartialSelection = selectedConnectorIds.size > 0 && !areAllConnectorsSelected

  const updateConnectorStatus = useCallback((connectorId, statusValue) => {
    if (!connectorId || !statusValue) {
      return
    }
    const normalizedId = String(connectorId)
    setConnectors((prev) => {
      let updated = false
      const next = prev.map((connector) => {
        if (String(connector.id) !== normalizedId) {
          return connector
        }
        updated = true
        const statusPayload = buildConnectorStatusBadge(statusValue, connector.status || {})
        return {
          ...connector,
          status: statusPayload,
        }
      })
      return updated ? next : prev
    })
  }, [])

  const connectorSearchField = (
    <div className="filter-field search-field">
      <label className="sr-only" htmlFor="connector-search">
        Search connectors
      </label>
      <div className="filter-search">
        <span className="filter-search__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16.4226 15.248L19.2559 18.073C19.4137 18.2295 19.5024 18.4425 19.5024 18.6647C19.5024 18.8869 19.4137 19.0999 19.2559 19.2564C19.0994 19.4141 18.8865 19.5029 18.6643 19.5029C18.4421 19.5029 18.2291 19.4141 18.0726 19.2564L15.2476 16.423C14.083 17.3372 12.6448 17.8332 11.1643 17.8314C7.48236 17.8314 4.49759 14.8466 4.49759 11.1647C4.49759 7.48282 7.48236 4.49805 11.1643 4.49805C14.8462 4.49805 17.8309 7.48282 17.8309 11.1647C17.8328 12.6453 17.3367 14.0834 16.4226 15.248ZM11.1643 6.16471C8.40283 6.16471 6.16426 8.40329 6.16426 11.1647C6.16426 13.9261 8.40283 16.1647 11.1643 16.1647C13.9257 16.1647 16.1643 13.9261 16.1643 11.1647C16.1643 8.40329 13.9257 6.16471 11.1643 6.16471Z"
              fill="#67716B"
            />
          </svg>
        </span>
        <input
          id="connector-search"
          type="search"
          placeholder="Search by connector, governorate"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
    </div>
  )

  const renderConnectorFilterMenu = (key, label, options) => {
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
        const current = new Set(prev[key] ?? appliedValues)
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
                          {option.count !== undefined ? (option.count ?? 0).toLocaleString() : ''}
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
                    const nextValues = Array.from(new Set(draftValues))
                    setFilters((prev) => ({
                      ...prev,
                      [key]: nextValues,
                    }))
                    setDraftFilters((prev) => ({ ...prev, [key]: nextValues }))
                    setPagination((prev) => ({ ...prev, page: 1 }))
                    setOpenFilterKey(null)
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

  useEffect(() => {
    setSelectedConnectorIds((prev) => {
      if (!prev.size) {
        return prev
      }
      const validIds = new Set(connectorsWithIds.map((connector) => connector.id))
      const filteredIds = Array.from(prev).filter((id) => validIds.has(id))
      return filteredIds.length === prev.size ? prev : new Set(filteredIds)
    })
  }, [connectorsWithIds])

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
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
          const firstCode = sorted[0]?.code
          return firstCode ? new Set([firstCode]) : prev
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
    const unsubscribe = subscribe('connector.status.update', (message) => {
      const data = message?.data || {}
      const connectorId = data.connector_id || data.connectorId
      const statusValue = data.status
      if (!connectorId || !statusValue) {
        return
      }
      updateConnectorStatus(connectorId, statusValue)
    })

    return () => {
      unsubscribe()
    }
  }, [subscribe, updateConnectorStatus])

  useEffect(() => {
    const unregisterReconnectRefetch = registerReconnectRefetch('connectors', () => {
      setReloadKey((prev) => prev + 1)
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
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [filters, debouncedSearch, selectedCountries])

  useEffect(() => {
    let isCancelled = false
    const controller = new AbortController()
    const loadFilterCounts = async () => {
      const aggregateResults = []
      let currentPage = 1
      let totalPages = 1
      try {
        while (
          !isCancelled &&
          currentPage <= totalPages &&
          currentPage <= MAX_FILTER_COUNT_PAGES
        ) {
          const params = new URLSearchParams()
          params.set('page', String(currentPage))
          params.set('page_size', String(FILTER_COUNT_PAGE_SIZE))
          if (debouncedSearch) params.set('search', debouncedSearch)
          applyConnectorFiltersToParams(params, filters, selectedCountries)

          const response = await fetch(`${API_BASE}/connectors/?${params.toString()}`, {
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          })
          if (!response.ok) {
            break
          }
          const data = await response.json()
          const results = Array.isArray(data.results) ? data.results : []
          aggregateResults.push(...results)
          const paginationMeta = data.pagination ?? {
            total_pages:
              data.total_pages ??
              (data.total_items && FILTER_COUNT_PAGE_SIZE
                ? Math.max(1, Math.ceil(data.total_items / FILTER_COUNT_PAGE_SIZE))
                : 1),
          }
          totalPages = paginationMeta.total_pages ?? 1
          currentPage += 1
        }

        if (isCancelled) {
          return
        }

        const nextCounts = createEmptyFilterCounts()
        const increment = (bucket, rawKey) => {
          if (rawKey === undefined || rawKey === null) {
            return
          }
          const key = String(rawKey).trim()
          if (!key) {
            return
          }
          bucket[key] = (bucket[key] || 0) + 1
        }

        aggregateResults.forEach((connector) => {
          const chargerPayload = connector?.charger
          const stationPayload = connector?.charger_station || chargerPayload?.station
          if (stationPayload?.id) {
            increment(nextCounts.stations, stationPayload.id)
          }
          if (chargerPayload?.id) {
            increment(nextCounts.chargers, chargerPayload.id)
          } else if (connector?.charger_id) {
            increment(nextCounts.chargers, connector.charger_id)
          }

          const governorateValue =
            connector?.governorate ||
            stationPayload?.governorate ||
            chargerPayload?.station?.governorate
          if (governorateValue) {
            increment(nextCounts.governorates, governorateValue)
          }

          const statusValue = connector?.status?.value || connector?.status_value || connector?.status
          if (statusValue) {
            increment(nextCounts.statuses, statusValue)
          }
        })

        setFilterCounts(nextCounts)
      } catch (loadError) {
        if (!isCancelled && loadError.name !== 'AbortError') {
          console.error('Failed to load connector filter counts', loadError)
        }
      }
    }

    loadFilterCounts()
    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [debouncedSearch, filters, reloadKey, selectedCountries])

  useEffect(() => {
    const controller = new AbortController()
    const loadConnectors = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', pagination.page)
        params.set('page_size', pagination.page_size)
        if (debouncedSearch) params.set('search', debouncedSearch)
        applyConnectorFiltersToParams(params, filters, selectedCountries)

        const response = await fetch(`${API_BASE}/connectors/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load connectors.')
        }
        const data = await response.json()
        if (controller.signal.aborted) {
          return
        }
        setConnectors(Array.isArray(data.results) ? data.results : [])
        setAvailableFilters(
          data.available_filters || {
            statuses: [],
            governorates: [],
            stations: [],
            chargers: [],
          }
        )
        setPagination((prev) => ({
          ...prev,
          ...(data.pagination || {}),
        }))
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Failed to load connectors', fetchError)
        setError(fetchError.message || 'Unable to load connectors.')
        toast.pushError('Unable to load connectors.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadConnectors()
    return () => controller.abort()
  }, [
    debouncedSearch,
    filters,
    selectedCountries,
    pagination.page,
    pagination.page_size,
    reloadKey,
    toast,
  ])

  const handlePageChange = (nextPage) => {
    setPagination((prev) => ({
      ...prev,
      page: nextPage,
    }))
  }

  const handlePageSizeChange = (event) => {
    const nextSize = Number(event.target.value) || DEFAULT_PAGE_SIZE
    setPagination((prev) => ({
      ...prev,
      page_size: nextSize,
      page: 1,
    }))
  }

  const handleDeleteConnectorClick = (connector) => {
    if (!connector?.id) {
      return
    }
    setDeleteModalState({ isOpen: true, connector })
  }

  const handleDeleteConnector = async () => {
    const connector = deleteModalState.connector
    if (!connector?.id) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/connectors/${connector.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error('Failed to delete connector.')
      }
      toast.pushSuccess('Connector deleted.')
      setPagination((prev) => {
        if (connectors.length <= 1 && prev.page > 1) {
          return { ...prev, page: prev.page - 1 }
        }
        return prev
      })
      triggerDataRefresh()
    } catch (deleteError) {
      console.error('Failed to delete connector', deleteError)
      toast.pushError(getConnectorDeleteErrorMessage(deleteError.message))
    } finally {
      setDeleteModalState({ isOpen: false, connector: null })
    }
  }

  const handleAction = (connector, action) => {
    if (action === 'edit') {
      navigate(`/connectors/${connector.id}/edit`)
      return
    }
    if (action === 'remote_actions') {
      setSelectedConnector(connector)
      setRemoteActionsOpen(true)
      return
    }
    if (action === 'delete') {
      handleDeleteConnectorClick(connector)
    }
  }

  const toggleConnectorSelection = (connectorId) => {
    if (connectorId === undefined || connectorId === null) {
      return
    }
    setSelectedConnectorIds((prev) => {
      const next = new Set(prev)
      if (next.has(connectorId)) {
        next.delete(connectorId)
      } else {
        next.add(connectorId)
      }
      return next
    })
  }

  const handleSelectAllConnectors = () => {
    if (areAllConnectorsSelected) {
      setSelectedConnectorIds(new Set())
      return
    }
    setSelectedConnectorIds(new Set(connectorsWithIds.map((connector) => connector.id)))
  }

  const handleDownload = async () => {
    let rowsToExport = []

    // If records are selected, use only those
    if (selectedConnectorIds.size > 0) {
      rowsToExport = connectors.filter((connector) => selectedConnectorIds.has(connector.id))
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
          
          if (debouncedSearch) {
            params.set('search', debouncedSearch)
          }
          applyConnectorFiltersToParams(params, filters, selectedCountries)

          const response = await fetch(`${API_BASE}/connectors/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch connectors for export (${response.status})`)
          }

          const data = await response.json()
          const results = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : [])
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

        rowsToExport = allResults
      } catch (error) {
        console.error('Failed to fetch all connectors for export:', error)
        toast.pushError('Failed to fetch all connectors. Please try again.')
        return
      }
    }

    if (!rowsToExport.length) {
      toast.pushInfo('There are no connectors to download.')
      return
    }

    const rows = rowsToExport.map((connector) => ({
      'Connector Number': connector.connector_number ?? '',
      'Connector Name': connector.connector_name ?? '',
      'Identifier': connector.identifier ?? '',
      'Charger Name': connector.charger_name ?? '',
      'Charger Box ID': connector.charger_box_id ?? '',
      Governorate: connector.governorate ?? '',
      'Connector Type': connector.energy_type?.label || connector.energy_type?.value || '',
      'Power (kW)': connector.power_kw ?? '',
      'Voltage (V)': connector.voltage ?? '',
      'Current (A)': connector.amperage ?? '',
      Status: connector.status?.label || connector.status?.value || '',
    }))
    downloadCsv({
      headers: Object.keys(rows[0]),
      rows,
      filename: `connectors_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  const closeRemoteActions = () => {
    setRemoteActionsOpen(false)
  }

  const pageOffset = Math.max(0, (pagination.page - 1) * (pagination.page_size || DEFAULT_PAGE_SIZE))
  const connectorPageBounds = useMemo(() => {
    const start = pageOffset + 1
    const end = Math.min(pageOffset + (pagination.page_size || DEFAULT_PAGE_SIZE), pagination.total_items || 0)
    return { start, end }
  }, [pageOffset, pagination.page_size, pagination.total_items])
  const triggerDataRefresh = () => setReloadKey((prev) => prev + 1)
  const handleRowNavigation = (event, connectorId) => {
    if (
      event.target instanceof HTMLElement &&
      (event.target.closest('.connector-actions-cell') ||
        event.target.closest('.connector-select-cell'))
    ) {
      return
    }
    navigate(`/connectors/${connectorId}`)
  }

  return (
    <div className="stations-page connectors-page">
      <header className="stations-header connectors-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Connectors' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Connectors</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions connectors-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!connectors.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
          <button type="button" className="primary-add-button" onClick={() => navigate('/connectors/new')}>
            <AddConnectorIcon />
            <span className="primary-add-button__label">Add&nbsp;Connector</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="connectors" />

      <div className="stations-filters connectors-filters" aria-label="Connector filters">
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
              aria-controls="connectors-country-filter-menu"
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
                id="connectors-country-filter-menu"
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
                        setFilters(createEmptyFilterState())
                        setDraftFilters(createEmptyFilterState())
                        setPagination((prev) => ({ ...prev, page: 1 }))
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
        {connectorSearchField}
        {renderConnectorFilterMenu('stations', 'Station', stationOptions)}
        {renderConnectorFilterMenu('governorates', 'Governorate', governorateOptions)}
        {renderConnectorFilterMenu('chargers', 'Charger', chargerOptions)}
        {renderConnectorFilterMenu('statuses', 'Connector status', statusOptions)}
      </div>

      {error ? <div className="data-warning">{error}</div> : null}

      <div className="chargers-table connectors-table" aria-busy={isLoading}>
        <div className="chargers-table-header connectors-table-header">
          <div className="charger-cell connector-cell connector-select-cell">
            <input
              type="checkbox"
              ref={selectAllCheckboxRef}
              className="select-checkbox"
              checked={connectorsWithIds.length > 0 && areAllConnectorsSelected}
              onChange={(event) => {
                event.stopPropagation()
                handleSelectAllConnectors()
              }}
              aria-label={areAllConnectorsSelected ? 'Clear connector selection' : 'Select all connectors'}
              disabled={!connectorsWithIds.length}
            />
          </div>
          <div className="charger-cell connector-cell order">No</div>
          <div className="charger-cell connector-cell connector-station">Charger</div>
          <div className="charger-cell connector-cell">Governorate</div>
          <div className="charger-cell connector-cell">Charger Box ID</div>
          <div className="charger-cell connector-cell">Connector ID</div>
          <div className="charger-cell connector-cell">Power Type</div>
          <div className="charger-cell connector-cell">
            <span>
              Power (<span className="unit-label">kW</span>)
            </span>
          </div>
          <div className="charger-cell connector-cell">Voltage</div>
          <div className="charger-cell connector-cell">
            <span>
              Amperage (<span className="unit-label">A</span>)
            </span>
          </div>
          <div className="charger-cell connector-cell">Status</div>
          <div className="charger-cell connector-cell connector-actions-cell"></div>
        </div>
        {error ? (
          <p className="connectors-empty-state data-warning">{error}</p>
        ) : isLoading ? (
          <p className="connectors-empty-state data-placeholder">Loading connectors�</p>
        ) : connectors.length === 0 ? (
          <p className="connectors-empty-state data-placeholder">No connectors match the selected filters.</p>
        ) : (
          connectors.map((connector, index) => {
            const chargerName =
              connector.charger?.name ||
              connector.charger_name
            const connectorIdDisplay =
              connector.identifier || (connector.connector_number != null ? `#${connector.connector_number}` : '�')
            const connectorStatus = connector.status
            const energyType = connector.energy_type?.label || connector.energy_type?.value || '�'
            const displayNumber = String(pageOffset + index + 1).padStart(2, '0')
            const formatMetric = (value) => (value || value === 0 ? value : '�')
            const canSelectConnector = connector?.id !== undefined && connector?.id !== null
            const isSelected = canSelectConnector && selectedConnectorIds.has(connector.id)
            const connectorLabel =
              connector.connector_name ||
              connector.identifier ||
              (connector.connector_number != null ? `#${connector.connector_number}` : 'Connector')

            return (
              <article
                className={`charger-row connector-row clickable${isSelected ? ' selected' : ''}`}
                key={connector.id}
                role="button"
                tabIndex={0}
                onClick={(event) => handleRowNavigation(event, connector.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    if (
                      event.target instanceof HTMLElement &&
                      (event.target.closest('.connector-actions-cell') ||
                        event.target.closest('.connector-select-cell'))
                    ) {
                      return
                    }
                    event.preventDefault()
                    handleRowNavigation(event, connector.id)
                  }
                }}
              >
                <div className="charger-cell connector-cell connector-select-cell">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={isSelected}
                    disabled={!canSelectConnector}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleConnectorSelection(connector.id)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${connectorLabel}`}
                  />
                </div>
                <div className="charger-cell connector-cell connector-index">
                  <span>{displayNumber}</span>
                </div>
                <div className="charger-cell connector-cell connector-station">
                  <span className="connector-name">{chargerName || '�'}</span>
                </div>
                <div className="charger-cell connector-cell connector-governorate">
                  {connector.governorate || connector.charger?.station?.governorate || '�'}
                </div>
                <div className="charger-cell connector-cell connector-box">{connector.charger_box_id || '�'}</div>
                <div className="charger-cell connector-cell connector-id">{connectorIdDisplay}</div>
                <div className="charger-cell connector-cell connector-type">{energyType}</div>
                <div className="charger-cell connector-cell connector-metric">{formatMetric(connector.power_kw)}</div>
                <div className="charger-cell connector-cell connector-metric">{formatMetric(connector.voltage)}</div>
                <div className="charger-cell connector-cell connector-metric">{formatMetric(connector.amperage)}</div>
                <div className="charger-cell connector-cell connector-status-cell">
                  {connectorStatus ? (
                    <span
                      className="status-pill connector-status-pill"
                      style={{
                        color:
                          connectorStatus.color ||
                          CONNECTOR_STATUS_COLORS[connectorStatus.value] ||
                          '#3E4F44',
                        backgroundColor:
                          connectorStatus.background ||
                          CONNECTOR_STATUS_BACKGROUNDS[connectorStatus.value] ||
                          'rgba(1, 19, 9, 0.08)',
                      }}
                    >
                      {connectorStatus.label || connectorStatus.value}
                    </span>
                  ) : (
                    '�'
                  )}
                </div>
                <div
                  className="charger-cell connector-cell connector-actions-cell"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ConnectorActionMenu onAction={(action) => handleAction(connector, action)} />
                </div>
              </article>
            )
          })
        )}
        <footer className="chargers-footer">
          <div className="pagination-info">
            {pagination.total_items
              ? `Showing ${connectorPageBounds.start}-${connectorPageBounds.end} of ${pagination.total_items} connectors`
              : 'No connectors to display'}
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="ghost-button"
              onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1 || isLoading}
            >
              Previous
            </button>
            <span className="pagination-status">
              Page {pagination.page} of {pagination.total_pages || 1}
            </span>
            <button
              type="button"
              className="ghost-button"
              onClick={() =>
                handlePageChange(
                  pagination.total_pages ? Math.min(pagination.total_pages, pagination.page + 1) : pagination.page + 1
                )
              }
              disabled={(pagination.total_pages !== 0 && pagination.page >= pagination.total_pages) || isLoading}
            >
              Next
            </button>
          </div>
          <div className="page-size-picker">
            <label htmlFor="connector-page-size">Rows per page</label>
            <select
              id="connector-page-size"
              value={pagination.page_size}
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

      <ConnectorRemoteActionsDrawer
          connector={selectedConnector}
          isOpen={isRemoteActionsOpen}
          onClose={closeRemoteActions}
        />

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, connector: null })}
        onConfirm={handleDeleteConnector}
        title="Delete Connector"
        itemName={
          deleteModalState.connector?.connector_name ||
          deleteModalState.connector?.identifier ||
          (deleteModalState.connector?.connector_number != null
            ? `#${deleteModalState.connector.connector_number}`
            : '')
        }
        confirmationMessage={
          deleteModalState.connector
            ? `Are you sure you want to delete ${
                deleteModalState.connector.connector_name ||
                deleteModalState.connector.identifier ||
                (deleteModalState.connector.connector_number != null
                  ? `#${deleteModalState.connector.connector_number}`
                  : 'this connector')
              }?`
            : undefined
        }
      />
    </div>
  )
}

export default Connectors

  
