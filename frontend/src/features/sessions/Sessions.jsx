import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import DateFilterPicker from '@/components/ui/organisms/DateFilterPicker'
import StopSessionPopup from './StopSessionPopup'
import StartSessionPopup from './StartSessionPopup'
import PricingSnapshotInfoButton from './PricingSnapshotInfoButton'
import { resolveEnergyCharge } from './pricingSnapshotHelpers'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 25
const LIVE_SESSIONS_POLL_INTERVAL_MS = 15000
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]

const SESSION_STATUS_OPTIONS = [
  { value: 'charging', label: 'Charging' },
  { value: 'error', label: 'Error' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'finished', label: 'Finished' },
  { value: 'finishing', label: 'Finishing' },
]

const STATUS_FILTER_EXPANSIONS = {
  charging: ['pending'],
  finished: ['cancelled', 'canceled'],
  error: ['failed', 'faulted'],
}

const normalizeSessionStatus = (status) => {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'pending') return 'charging'
  if (normalized === 'cancelled' || normalized === 'canceled') return 'finished'
  if (normalized === 'failed' || normalized === 'faulted') return 'error'
  return normalized
}

const expandStatusFilters = (values = []) => {
  const expanded = new Set()
  values.forEach((value) => {
    const normalized = normalizeSessionStatus(value)
    if (!normalized) {
      return
    }
    expanded.add(normalized)
    const extras = STATUS_FILTER_EXPANSIONS[normalized] || []
    extras.forEach((extra) => expanded.add(extra))
  })
  return Array.from(expanded)
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

const StopIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="7.5" stroke="#ED4A4A" strokeWidth="1.5" />
    <rect x="7" y="7" width="6" height="6" rx="1" stroke="#ED4A4A" strokeWidth="1.5" />
  </svg>
)

const EndIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6.5 10.5L9 13L13.5 7.5"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="10" r="7.5" stroke="#011309" strokeWidth="1.5" />
  </svg>
)

const DeleteIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 6.286h16M13.714 4h-3.428a1.286 1.286 0 0 0-1.286 1.143V6.286h6.572V5.143A1.143 1.143 0 0 0 13.714 4Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10.286 16V10.286M13.714 16V10.286" stroke="#ED4A4A" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M17.23 18.952a1.2 1.2 0 0 1-1.138 1.048H7.909a1.2 1.2 0 0 1-1.138-1.048L5.714 6.286h12.571l-1.055 12.666Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const AddSessionIcon = () => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 4.25C10.4142 4.25 10.75 4.58579 10.75 5V9.25H15C15.4142 9.25 15.75 9.58579 15.75 10C15.75 10.4142 15.4142 10.75 15 10.75H10.75V15C10.75 15.4142 10.4142 15.75 10 15.75C9.58579 15.75 9.25 15.4142 9.25 15V10.75H5C4.58579 10.75 4.25 10.4142 4.25 10C4.25 9.58579 4.58579 9.25 5 9.25H9.25V5C9.25 4.58579 9.58579 4.25 10 4.25Z"
      fill="currentColor"
    />
  </svg>
)

const formatDateOnly = (dateString) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateString
  }
}

const formatTimeOnly = (dateString) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return '-'
  }
}

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '-'
  const totalSeconds = Number(seconds)
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return '-'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

const formatAmountWithCurrency = (amount, currency) => {
  if (amount === null || amount === undefined) return '-'
  const numeric = Number(amount)
  if (Number.isNaN(numeric)) return '-'
  const amountStr = numeric.toFixed(2)
  return currency ? `${amountStr} ${currency}` : amountStr
}

const formatAmountOnly = (amount) => {
  if (amount === null || amount === undefined) return '-'
  const numeric = Number(amount)
  if (Number.isNaN(numeric)) return '-'
  return numeric.toFixed(2)
}

const resolveSessionChargingAmount = (session) => {
  if (session?.charging_amount !== null && session?.charging_amount !== undefined) {
    const numeric = Number(session.charging_amount)
    if (Number.isFinite(numeric)) {
      return numeric
    }
  }
  return resolveEnergyCharge(session?.pricing_snapshot)
}

const formatBillableMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) return '-'
  const numeric = Number(minutes)
  if (Number.isNaN(numeric) || numeric < 0) return '-'
  return `${numeric} min`
}

const renderBillingSummary = (totalAmount, chargingAmount, currency) => (
  <div className="billing-breakdown">
    <span className="billing-breakdown-primary">
      {formatAmountWithCurrency(totalAmount, currency)}
    </span>
    <span className="billing-breakdown-note">
      Charging: {formatAmountWithCurrency(chargingAmount, currency)}
    </span>
  </div>
)

function Sessions() {
  const { showToast } = useInlineToast('sessions')

  const [sessions, setSessions] = useState([])
  const [chargers, setChargers] = useState([])
  const [customers, setCustomers] = useState([])
  const [countries, setCountries] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    session: null,
  })
  const [stopSessionModalState, setStopSessionModalState] = useState({
    isOpen: false,
    session: null,
  })
  const [startSessionModalOpen, setStartSessionModalOpen] = useState(false)
  const [endManualModalState, setEndManualModalState] = useState({
    isOpen: false,
    session: null,
  })
  const [filters, setFilters] = useState({
    charger_id: [],
    customer_id: [],
    customer_country: [],
    start_date: '',
    end_date: '',
    tid: '',
    status: [],
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [selectedSessionIds, setSelectedSessionIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })
  const [refreshToken, setRefreshToken] = useState(0)
  const silentRefreshRef = useRef(false)

  // Filter menu states
  const [isChargerFilterOpen, setIsChargerFilterOpen] = useState(false)
  const [chargerDraft, setChargerDraft] = useState([])
  const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false)
  const [customerDraft, setCustomerDraft] = useState([])
  const [isCountryFilterOpen, setIsCountryFilterOpen] = useState(false)
  const [countryDraft, setCountryDraft] = useState([])
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false)
  const [statusDraft, setStatusDraft] = useState([])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch])

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  // Load filter options (lightweight, aggregated in backend)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const fetchAllPages = async (resource) => {
      const allResults = []
      let currentPage = 1
      let totalPages = 1
      const pageSize = 200

      while (!cancelled && currentPage <= totalPages) {
        const params = new URLSearchParams()
        params.set('page', String(currentPage))
        params.set('page_size', String(pageSize))

        const response = await fetch(`${API_BASE}/${resource}/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          break
        }

        const json = await response.json()
        const results = Array.isArray(json) ? json : json.results ?? []
        allResults.push(...results)

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

      return allResults
    }

    const loadFilterOptions = async () => {
      try {
        const params = new URLSearchParams()
        params.set('customer_limit', '300')
        if (debouncedCustomerSearch) {
          params.set('customer_search', debouncedCustomerSearch)
        }
        const response = await fetch(`${API_BASE}/sessions/filter-options/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error(`Failed to load session filter options (${response.status})`)
        }
        const payload = await response.json()

        if (!cancelled) {
          setChargers(Array.isArray(payload?.chargers) ? payload.chargers : [])
          setCountries(Array.isArray(payload?.countries) ? payload.countries : [])
          const customerResults = Array.isArray(payload?.customers?.results)
            ? payload.customers.results
            : []
          setCustomers(customerResults)
          const statusEntries = Array.isArray(payload?.statuses) ? payload.statuses : []
          const nextStatusCounts = {}
          statusEntries.forEach((entry) => {
            const key = String(entry?.value || '').trim().toLowerCase()
            if (!key) return
            nextStatusCounts[key] = Number(entry?.count || 0)
          })
          setStatusCounts(nextStatusCounts)
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Failed to load aggregated session filter options, falling back:', err)
          try {
            const [chargersList, customersList] = await Promise.all([
              fetchAllPages('chargers'),
              fetchAllPages('customers'),
            ])
            if (cancelled) return

            setChargers(chargersList)
            setCustomers(customersList)
            setStatusCounts({})

            const countryMap = new Map()
            customersList.forEach((customer) => {
              const code = String(customer?.country_code || '').trim().toUpperCase()
              if (!code) return
              if (!countryMap.has(code)) {
                countryMap.set(code, customer?.country || code)
              }
            })
            const countryList = Array.from(countryMap.entries()).map(([code, label]) => ({
              code,
              label,
              count: 0,
            }))
            setCountries(countryList)
          } catch (fallbackError) {
            if (!cancelled && fallbackError.name !== 'AbortError') {
              console.error('Fallback filter loading also failed', fallbackError)
            }
          }
        }
      }
    }

    loadFilterOptions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedCustomerSearch, refreshToken])

  const triggerRefresh = useCallback(() => {
    silentRefreshRef.current = true
    setRefreshToken((prev) => prev + 1)
  }, [])

  // Load sessions with pagination
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const silent = silentRefreshRef.current
    silentRefreshRef.current = false

    const loadSessions = async () => {
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))

        if (debouncedFilters.charger_id.length > 0) {
          debouncedFilters.charger_id.forEach((id) => {
            if (id) params.append('charger_id', id)
          })
        }
        if (debouncedFilters.customer_id.length > 0) {
          debouncedFilters.customer_id.forEach((id) => {
            if (id) params.append('customer_id', id)
          })
        }
        if (debouncedFilters.customer_country.length > 0) {
          debouncedFilters.customer_country.forEach((code) => {
            if (code) params.append('customer_country', code)
          })
        }
        if (debouncedFilters.start_date) {
          params.set('start_date', debouncedFilters.start_date)
        }
        if (debouncedFilters.end_date) {
          params.set('end_date', debouncedFilters.end_date)
        }
        if ((debouncedFilters.tid || '').trim()) {
          params.set('tid', debouncedFilters.tid.trim())
        }
        if (debouncedFilters.status.length > 0) {
          expandStatusFilters(debouncedFilters.status).forEach((status) => {
            if (status) params.append('status', status)
          })
        }

        const response = await fetch(`${API_BASE}/sessions/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch sessions (${response.status})`)
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
                (json.count && pageSize ? Math.max(1, Math.ceil(json.count / pageSize)) : 1),
              total_items: json.total_items ?? json.count ?? rawResults.length,
            }

        if (!cancelled) {
          const serverPage = Number(paginationMeta.page ?? page)
          const serverPageSize = Number(paginationMeta.page_size ?? pageSize)
          const serverTotalPages = Number(paginationMeta.total_pages ?? 1)
          const serverTotalItems = Number(paginationMeta.total_items ?? rawResults.length)

          const normalizedPagination = {
            page: Number.isFinite(serverPage) && serverPage > 0 ? serverPage : page,
            page_size:
              Number.isFinite(serverPageSize) && serverPageSize > 0 ? serverPageSize : pageSize,
            total_pages:
              Number.isFinite(serverTotalPages) && serverTotalPages > 0 ? serverTotalPages : 1,
            total_items:
              Number.isFinite(serverTotalItems) && serverTotalItems >= 0
                ? serverTotalItems
                : rawResults.length,
          }

          setSessions(rawResults)
          setPagination(normalizedPagination)
          if (normalizedPagination.page !== page) {
            setPage(normalizedPagination.page)
          }
          if (normalizedPagination.page_size !== pageSize) {
            setPageSize(normalizedPagination.page_size)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setSessions([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load sessions.')
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false)
          setIsLoading(false)
        }
      }
    }

    loadSessions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedFilters, refreshToken])

  const filteredSessions = sessions
  const hasLiveSessions = useMemo(
    () =>
      filteredSessions.some((session) => {
        const normalizedStatus = normalizeSessionStatus(session.status)
        return normalizedStatus === 'charging' || normalizedStatus === 'finishing'
      }),
    [filteredSessions]
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLiveSessions) {
      return undefined
    }
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }
      triggerRefresh()
    }, LIVE_SESSIONS_POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [hasLiveSessions, triggerRefresh])

  useEffect(() => {
    setSelectedSessionIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredSessions.some((session) => session.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredSessions])

  const totalSessionsCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalSessionPages = Math.max(1, pagination.total_pages ?? 1)

  const sessionPageBounds = useMemo(() => {
    if (!filteredSessions.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredSessions.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredSessions])

  const areAllFilteredSelected =
    filteredSessions.length > 0 &&
    filteredSessions.every((session) => selectedSessionIds.has(session.id))
  const hasSelection = selectedSessionIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredSessions.forEach((session) => {
          next.delete(session.id)
        })
      } else {
        filteredSessions.forEach((session) => {
          if (session.id != null) {
            next.add(session.id)
          }
        })
      }
      return next
    })
  }

  const toggleSessionSelection = (sessionId) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const handleDownload = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const selectedIds = hasSelection ? Array.from(selectedSessionIds) : []
      const response = await fetch(`${API_BASE}/sessions/export/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          selected_ids: selectedIds,
          filters: {
            charger_id: debouncedFilters.charger_id || [],
            customer_id: debouncedFilters.customer_id || [],
            customer_country: debouncedFilters.customer_country || [],
            start_date: debouncedFilters.start_date || '',
            end_date: debouncedFilters.end_date || '',
            tid: (debouncedFilters.tid || '').trim(),
            status: expandStatusFilters(debouncedFilters.status || []),
          },
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || `Failed to export sessions (${response.status})`)
      }

      const blob = await response.blob()
      if (!blob || blob.size === 0) {
        throw new Error('No session data to export.')
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sessions_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      showToast({
        title: 'Export successful',
        message: hasSelection
          ? `Exported ${selectedIds.length} selected session(s).`
          : `Exported ${totalSessionsCount || 0} session(s).`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to export sessions:', error)
      showToast({
        title: 'Export failed',
        message: error?.message || 'Failed to export sessions. Please try again.',
        variant: 'error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleSessionsPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalSessionPages)
      return target === prev ? prev : target
    })
  }

  const handleSessionsPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const sessionPageSizeOptions = useMemo(() => {
    if (PAGE_SIZE_OPTIONS.some((option) => option.value === effectivePageSize)) {
      return PAGE_SIZE_OPTIONS
    }
    return [...PAGE_SIZE_OPTIONS, { value: effectivePageSize, label: `${effectivePageSize} / page` }].sort(
      (a, b) => a.value - b.value
    )
  }, [effectivePageSize])

  const filterRowStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    paddingBottom: '12px',
  }
  const filterFieldStyle = { flex: '0 0 180px', minWidth: '160px' }
  const sessionsGridTemplateColumns =
    'minmax(18px, 0.1fr) minmax(32px, 0.12fr) minmax(110px, 1.1fr) minmax(70px, 0.7fr) minmax(170px, 1.4fr) minmax(90px, 0.7fr) minmax(100px, 0.8fr) minmax(90px, 0.7fr) minmax(100px, 0.8fr) minmax(90px, 0.7fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr) minmax(140px, 1fr) minmax(90px, 0.8fr) minmax(100px, 0.9fr) minmax(100px, 0.9fr) minmax(90px, 0.8fr) minmax(75px, 0.6fr) minmax(80px, 0.8fr) minmax(70px, 0.4fr)'

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  // Filter menu handlers
  const toggleChargerMenu = () => {
    if (isChargerFilterOpen) {
      setChargerDraft(Array.from(filters.charger_id ?? []))
      setIsChargerFilterOpen(false)
    } else {
      setChargerDraft(Array.from(filters.charger_id ?? []))
      setIsChargerFilterOpen(true)
    }
  }

  const applyChargerFilter = () => {
    updateFilter('charger_id', Array.from(new Set(chargerDraft)))
    setIsChargerFilterOpen(false)
  }

  const cancelChargerFilter = () => {
    setChargerDraft(Array.from(filters.charger_id ?? []))
    setIsChargerFilterOpen(false)
  }

  const toggleChargerValue = (chargerId) => {
    setChargerDraft((prev) => {
      const next = new Set(prev)
      if (next.has(chargerId)) {
        next.delete(chargerId)
      } else {
        next.add(chargerId)
      }
      return Array.from(next)
    })
  }

  const toggleCustomerMenu = () => {
    if (isCustomerFilterOpen) {
      setCustomerDraft(Array.from(filters.customer_id ?? []))
      setCustomerSearch('')
      setIsCustomerFilterOpen(false)
    } else {
      setCustomerDraft(Array.from(filters.customer_id ?? []))
      setCustomerSearch('')
      setIsCustomerFilterOpen(true)
    }
  }

  const applyCustomerFilter = () => {
    updateFilter('customer_id', Array.from(new Set(customerDraft)))
    setCustomerSearch('')
    setIsCustomerFilterOpen(false)
  }

  const cancelCustomerFilter = () => {
    setCustomerDraft(Array.from(filters.customer_id ?? []))
    setCustomerSearch('')
    setIsCustomerFilterOpen(false)
  }

  const toggleCustomerValue = (customerId) => {
    setCustomerDraft((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return Array.from(next)
    })
  }

  const toggleCountryMenu = () => {
    if (isCountryFilterOpen) {
      setCountryDraft(Array.from(filters.customer_country ?? []))
      setIsCountryFilterOpen(false)
    } else {
      setCountryDraft(Array.from(filters.customer_country ?? []))
      setIsCountryFilterOpen(true)
    }
  }

  const applyCountryFilter = () => {
    updateFilter('customer_country', Array.from(new Set(countryDraft)))
    setIsCountryFilterOpen(false)
  }

  const cancelCountryFilter = () => {
    setCountryDraft(Array.from(filters.customer_country ?? []))
    setIsCountryFilterOpen(false)
  }

  const toggleCountryValue = (code) => {
    setCountryDraft((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return Array.from(next)
    })
  }

  const toggleStatusMenu = () => {
    if (isStatusFilterOpen) {
      setStatusDraft(Array.from(filters.status ?? []))
      setIsStatusFilterOpen(false)
    } else {
      setStatusDraft(Array.from(filters.status ?? []))
      setIsStatusFilterOpen(true)
    }
  }

  const applyStatusFilter = () => {
    updateFilter('status', Array.from(new Set(statusDraft)))
    setIsStatusFilterOpen(false)
  }

  const cancelStatusFilter = () => {
    setStatusDraft(Array.from(filters.status ?? []))
    setIsStatusFilterOpen(false)
  }

  const toggleStatusValue = (status) => {
    setStatusDraft((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return Array.from(next)
    })
  }

  const chargerFilterOptions = useMemo(
    () =>
      chargers.map((charger) => ({
        value: charger.id,
        label: charger.name || charger.id,
        count: Number(charger.count ?? 0),
      })),
    [chargers]
  )

  const customerFilterOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: customer.label || customer.email || customer.id_tag || customer.id,
        count: Number(customer.count ?? 0),
      })),
    [customers]
  )

  const countryFilterOptions = useMemo(() => {
    return countries
      .map((country) => ({
        value: country.code,
        label: country.label || country.code,
        count: Number(country.count ?? 0),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [countries])

  const statusFilterOptions = useMemo(
    () =>
      SESSION_STATUS_OPTIONS.map((option) => ({
        ...option,
        count: statusCounts[option.value] ?? 0,
      })),
    [statusCounts]
  )

  // Render filter menus
  const renderChargerFilter = () => {
    const appliedValues = Array.isArray(filters.charger_id) ? filters.charger_id : []
    const displayValues = isChargerFilterOpen ? chargerDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount
      ? `${selectedCount} charger${selectedCount > 1 ? 's' : ''}`
      : 'Charger'
    return (
      <div id="charger-filter-control" className="filter-field" style={filterFieldStyle}>
        <div className={`multi-select ${isChargerFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isChargerFilterOpen}
            aria-controls="filter-menu-chargers"
            onClick={toggleChargerMenu}
          >
            {buttonLabel}
          </button>
          {isChargerFilterOpen ? (
            <div
              id="filter-menu-chargers"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by charger"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Charger</span>
                <span className="filter-menu__badge">{chargerDraft.length}</span>
              </div>
              <div className="filter-menu__body">
                {chargerFilterOptions.length > 0 ? (
                  chargerFilterOptions.map((option) => {
                    const isSelected = chargerDraft.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleChargerValue(option.value)}
                        />
                        <span className="filter-menu__item-content">
                          <span className="filter-menu__checkbox" aria-hidden="true">
                            {isSelected ? (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect
                                  x="0.75"
                                  y="0.75"
                                  width="16.5"
                                  height="16.5"
                                  rx="2.25"
                                  stroke="#99A19D"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="filter-menu__name">{option.label}</span>
                        </span>
                        <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                      </label>
                    )
                  })
                ) : (
                  <div className="filter-menu__empty">No chargers available</div>
                )}
              </div>
              <div className="filter-menu__footer">
                <button type="button" className="filter-menu__apply" onClick={applyChargerFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelChargerFilter}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const renderCustomerFilter = () => {
    const appliedValues = Array.isArray(filters.customer_id) ? filters.customer_id : []
    const displayValues = isCustomerFilterOpen ? customerDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount
      ? `${selectedCount} customer${selectedCount > 1 ? 's' : ''}`
      : 'Customer'
    return (
      <div id="customer-filter-control" className="filter-field" style={filterFieldStyle}>
        <div className={`multi-select ${isCustomerFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isCustomerFilterOpen}
            aria-controls="filter-menu-customers"
            onClick={toggleCustomerMenu}
          >
            {buttonLabel}
          </button>
          {isCustomerFilterOpen ? (
            <div
              id="filter-menu-customers"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by customer"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Customer</span>
                <span className="filter-menu__badge">{customerDraft.length}</span>
              </div>
              <div style={{ padding: '0 12px 8px 12px' }}>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Search customer email or ID tag"
                  style={{
                    width: '100%',
                    border: '1px solid #d6dbd8',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div className="filter-menu__body">
                {customerFilterOptions.length > 0 ? (
                  customerFilterOptions.map((option) => {
                    const isSelected = customerDraft.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCustomerValue(option.value)}
                        />
                        <span className="filter-menu__item-content">
                          <span className="filter-menu__checkbox" aria-hidden="true">
                            {isSelected ? (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect
                                  x="0.75"
                                  y="0.75"
                                  width="16.5"
                                  height="16.5"
                                  rx="2.25"
                                  stroke="#99A19D"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="filter-menu__name">{option.label}</span>
                        </span>
                        <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                      </label>
                    )
                  })
                ) : (
                  <div className="filter-menu__empty">No customers available</div>
                )}
              </div>
              <div className="filter-menu__footer">
                <button type="button" className="filter-menu__apply" onClick={applyCustomerFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelCustomerFilter}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const renderCountryFilter = () => {
    const appliedValues = Array.isArray(filters.customer_country) ? filters.customer_country : []
    const displayValues = isCountryFilterOpen ? countryDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount
      ? `${selectedCount} countr${selectedCount > 1 ? 'ies' : 'y'}`
      : 'Country'
    return (
      <div id="country-filter-control" className="filter-field" style={filterFieldStyle}>
        <div className={`multi-select ${isCountryFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isCountryFilterOpen}
            aria-controls="filter-menu-countries"
            onClick={toggleCountryMenu}
          >
            {buttonLabel}
          </button>
          {isCountryFilterOpen ? (
            <div
              id="filter-menu-countries"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by country"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Country</span>
                <span className="filter-menu__badge">{countryDraft.length}</span>
              </div>
              <div className="filter-menu__body">
                {countryFilterOptions.length > 0 ? (
                  countryFilterOptions.map((option) => {
                    const isSelected = countryDraft.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCountryValue(option.value)}
                        />
                        <span className="filter-menu__item-content">
                          <span className="filter-menu__checkbox" aria-hidden="true">
                            {isSelected ? (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect
                                  x="0.75"
                                  y="0.75"
                                  width="16.5"
                                  height="16.5"
                                  rx="2.25"
                                  stroke="#99A19D"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="filter-menu__name">{option.label}</span>
                        </span>
                        <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                      </label>
                    )
                  })
                ) : (
                  <div className="filter-menu__empty">No countries available</div>
                )}
              </div>
              <div className="filter-menu__footer">
                <button type="button" className="filter-menu__apply" onClick={applyCountryFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelCountryFilter}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const renderStatusFilter = () => {
    const appliedValues = Array.isArray(filters.status) ? filters.status : []
    const displayValues = isStatusFilterOpen ? statusDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount
      ? `${selectedCount} status${selectedCount > 1 ? 'es' : ''}`
      : 'Status'
    return (
      <div id="status-filter-control" className="filter-field" style={filterFieldStyle}>
        <div className={`multi-select ${isStatusFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isStatusFilterOpen}
            aria-controls="filter-menu-status"
            onClick={toggleStatusMenu}
          >
            {buttonLabel}
          </button>
          {isStatusFilterOpen ? (
            <div
              id="filter-menu-status"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by status"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Status</span>
                <span className="filter-menu__badge">{statusDraft.length}</span>
              </div>
              <div className="filter-menu__body">
                {statusFilterOptions.map((option) => {
                  const isSelected = statusDraft.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStatusValue(option.value)}
                      />
                      <span className="filter-menu__item-content">
                        <span className="filter-menu__checkbox" aria-hidden="true">
                          {isSelected ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect
                                x="0.75"
                                y="0.75"
                                width="16.5"
                                height="16.5"
                                rx="2.25"
                                stroke="#99A19D"
                                strokeWidth="1.5"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="filter-menu__name">{option.label}</span>
                      </span>
                      <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                    </label>
                  )
                })}
              </div>
              <div className="filter-menu__footer">
                <button type="button" className="filter-menu__apply" onClick={applyStatusFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelStatusFilter}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const handleStartSession = async ({ chargerId, connectorId, customerEmail }) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/start/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...appendAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          charger_id: chargerId,
          connector_id: connectorId,
          customer_email: customerEmail,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to start session')
      }

      showToast({
        title: 'Success',
        message: 'Remote start requested. The session will activate when the charger confirms.',
        variant: 'success',
      })

      setStartSessionModalOpen(false)
      triggerRefresh()
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to start session',
        variant: 'error',
      })
    }
  }

  const handleRemoteStopSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/stop/`, {
        method: 'POST',
        credentials: 'include',
        headers: appendAuthHeader(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to stop session')
      }

      showToast({
        title: 'Success',
        message: 'Remote stop requested. The session will finish when the charger confirms.',
        variant: 'success',
      })

      setStopSessionModalState({ isOpen: false, session: null })
      triggerRefresh()
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to stop session',
        variant: 'error',
      })
    }
  }

  const handleManualEndSession = async (sessionId, meterStopValue) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/end-manual/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...appendAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meter_stop: meterStopValue }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to stop session')
      }

      showToast({
        title: 'Success',
        message: 'The session has been successfully ended, and the charging cost has been deducted from the driver.',
        variant: 'success',
      })

      setEndManualModalState({ isOpen: false, session: null })
      triggerRefresh()
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to stop session',
        variant: 'error',
      })
    }
  }

  // Handle delete session
  const handleDeleteSession = async () => {
    if (!deleteModalState.session) return

    try {
      const response = await fetch(`${API_BASE}/sessions/${deleteModalState.session.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }

      showToast({
        title: 'Success',
        message: 'Session deleted successfully',
        variant: 'success',
      })

      setDeleteModalState({ isOpen: false, session: null })

      triggerRefresh()
    } catch (err) {
      showToast({
        title: 'Error',
        message: err.message || 'Failed to delete session',
        variant: 'error',
      })
    }
  }

  // Session actions are always available regardless of status
  const getSessionActions = (session) => {
    return [
      {
        key: 'stop',
        label: 'Stop',
        icon: StopIcon,
        onClick: () => setStopSessionModalState({ isOpen: true, session }),
        variant: 'danger',
      },
      {
        key: 'end',
        label: 'End',
        icon: EndIcon,
        onClick: () => setEndManualModalState({ isOpen: true, session }),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: DeleteIcon,
        onClick: () => setDeleteModalState({ isOpen: true, session }),
        variant: 'danger',
      },
    ]
  }

  // Render status badge based on CSS reference
  const renderStatusBadge = (status) => {
    const normalizedStatus = normalizeSessionStatus(status)
    const cancelledStyle = {
      backgroundColor: 'rgba(62, 79, 68, 0.12)',
      color: '#3E4F44',
      fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
      fontSize: '12px',
      fontWeight: 700,
      lineHeight: '20px',
      textTransform: 'capitalize',
      padding: '2px 8px',
      borderRadius: '6px',
    }
    const statusConfig = {
      charging: {
        label: 'Charging',
        style: {
          backgroundColor: 'rgba(0, 108, 156, 0.12)',
          color: '#006C9C',
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
          padding: '2px 8px',
          borderRadius: '6px',
        },
      },
      finishing: {
        label: 'Finishing',
        style: cancelledStyle,
      },
      error: {
        label: 'Error',
        style: {
          backgroundColor: 'rgba(237, 74, 74, 0.12)',
          color: '#ED4A4A',
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
          padding: '2px 8px',
          borderRadius: '6px',
        },
      },
      finished: {
        label: 'Finished',
        style: {
          backgroundColor: 'rgba(46, 165, 97, 0.12)',
          color: '#2EA561',
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
          padding: '2px 8px',
          borderRadius: '6px',
        },
      },
      blocked: {
        label: 'Blocked',
        style: {
          backgroundColor: 'rgba(237, 74, 74, 0.12)',
          color: '#ED4A4A',
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
          padding: '2px 8px',
          borderRadius: '6px',
        },
      },
      cancelled: {
        label: 'Cancelled',
        style: cancelledStyle,
      },
      canceled: {
        label: 'Canceled',
        style: cancelledStyle,
      },
    }
    const config = statusConfig[normalizedStatus] || {
      label: normalizedStatus || status || '-',
      style: {},
    }
    return (
      <span className="status-badge charger-status-badge" style={config.style}>
        {config.label}
      </span>
    )
  }

  // Close filter menus on outside click
  useEffect(() => {
    if (!isChargerFilterOpen && !isCustomerFilterOpen && !isStatusFilterOpen) {
      return undefined
    }
    const handleClickOutside = (event) => {
      const containers = [
        document.getElementById('charger-filter-control'),
        document.getElementById('customer-filter-control'),
        document.getElementById('status-filter-control'),
      ]
      if (containers.some((container) => container && container.contains(event.target))) {
        return
      }
      setIsChargerFilterOpen(false)
      setIsCustomerFilterOpen(false)
      setIsStatusFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isChargerFilterOpen, isCustomerFilterOpen, isStatusFilterOpen])

  return (
    <div className="stations-page sessions-list-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Sessions' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Sessions</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredSessions.length || isExporting}
          >
            <DownloadIcon />
            <span className="download-button__label">{isExporting ? 'Exporting…' : 'Download'}</span>
          </button>
          <button
            type="button"
            className="primary-add-button"
            onClick={() => setStartSessionModalOpen(true)}
          >
            <AddSessionIcon />
            <span className="primary-add-button__label">Start Session</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="sessions" />

      <div className="stations-filters" style={filterRowStyle}>
        {renderChargerFilter()}
        {renderCustomerFilter()}
        {renderCountryFilter()}
        <div className="filter-field" style={filterFieldStyle}>
          <DateFilterPicker
            id="start-date-filter"
            placeholder="Start Date"
            value={filters.start_date}
            onChange={(value) => updateFilter('start_date', value)}
          />
        </div>
        <div className="filter-field" style={filterFieldStyle}>
          <DateFilterPicker
            id="end-date-filter"
            placeholder="End Date"
            value={filters.end_date}
            onChange={(value) => updateFilter('end_date', value)}
          />
        </div>
        <div className="filter-field" style={filterFieldStyle}>
          <input
            id="tid-filter"
            type="text"
            placeholder="Search TID"
            value={filters.tid}
            onChange={(event) => updateFilter('tid', event.target.value)}
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '10px',
              border: '1px solid #D5DDD8',
              background: '#FFFFFF',
              padding: '0 12px',
              color: 'var(--theme-secondary)',
            }}
          />
        </div>
        {renderStatusFilter()}
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading sessions…</p> : null}

      {!isLoading && !error && filteredSessions.length > 0 ? (
        <div style={{ width: '100%' }}>
          <div
            className="chargers-table"
            aria-busy={isLoading || isRefreshing}
            style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', borderRadius: '20px' }}
          >
            <div
              className="chargers-table-header"
              style={{
                gridTemplateColumns: sessionsGridTemplateColumns,
                display: 'grid',
                minWidth: '1420px',
              }}
            >
              <div className="charger-cell charger-select-cell">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  className="select-checkbox"
                  checked={filteredSessions.length > 0 && areAllFilteredSelected}
                  onChange={handleSelectAll}
                  aria-label={
                    areAllFilteredSelected ? 'Clear session selection' : 'Select all sessions'
                  }
                />
              </div>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">Charger</div>
              <div className="charger-cell">
                <span className="sessions-connector-label">Connector</span>
              </div>
              <div className="charger-cell">User</div>
              <div className="charger-cell">TID</div>
              <div className="charger-cell">Start Date</div>
              <div className="charger-cell">Start Time</div>
              <div className="charger-cell">End Date</div>
              <div className="charger-cell">End Time</div>
              <div className="charger-cell">Duration</div>
              <div className="charger-cell">
                <span>
                  Energy (<span className="unit-label">kWh</span>)
                </span>
              </div>
              <div className="charger-cell">Charging Amount</div>
              <div className="charger-cell">Idle Duration</div>
              <div className="charger-cell">Billable Idle</div>
              <div className="charger-cell">Idle Fee</div>
              <div className="charger-cell">Total Amount</div>
              <div className="charger-cell">Currency</div>
              <div className="charger-cell">Status</div>
              <div className="charger-cell charger-actions-cell">Action</div>
            </div>
            {filteredSessions.map((session, index) => {
              const rowNumber = sessionPageBounds.start + index
              const actions = getSessionActions(session)

              return (
                <article
                  key={session.id}
                  className={`charger-row ${selectedSessionIds.has(session.id) ? 'selected' : ''}`}
                  style={{
                    gridTemplateColumns: sessionsGridTemplateColumns,
                    display: 'grid',
                    minWidth: '1660px',
                  }}
                >
                  <div className="charger-cell charger-select-cell">
                    <input
                      type="checkbox"
                      className="select-checkbox"
                      checked={selectedSessionIds.has(session.id)}
                      onChange={(event) => {
                        event.stopPropagation()
                        toggleSessionSelection(session.id)
                      }}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select session ${session.id}`}
                    />
                  </div>
                  <div className="charger-cell order">{rowNumber}</div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.charger_name || '-'}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.connector_number || '-'}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.customer_email || '-'}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.ocpp_transaction_id ?? '-'}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatDateOnly(session.started_at)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatTimeOnly(session.started_at)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatDateOnly(session.ended_at)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatTimeOnly(session.ended_at)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatDuration(session.duration_seconds)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.energy_kwh ? session.energy_kwh.toFixed(2) : '-'}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div className="sessions-amount-cell">
                      <span className="sessions-amount-value">
                        {formatAmountOnly(resolveSessionChargingAmount(session))}
                      </span>
                      <PricingSnapshotInfoButton
                        snapshot={session.pricing_snapshot}
                        currency={session.currency}
                      />
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatDuration(session.idle_time_seconds ?? session.idle_time)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatBillableMinutes(session.idle_billable_minutes)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatAmountOnly(session.idle_fee)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {formatAmountOnly(session.amount)}
                    </div>
                  </div>
                  <div className="charger-cell">
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                      {session.currency || '-'}
                    </div>
                  </div>
                  <div className="charger-cell">{renderStatusBadge(session.status)}</div>
                  <div
                    className="charger-cell charger-actions-cell"
                    style={{ overflow: 'visible', padding: '4px 8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <StationActionMenu actions={actions} />
                  </div>
                </article>
              )
            })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalSessionsCount
                ? `Showing ${sessionPageBounds.start}-${sessionPageBounds.end} of ${totalSessionsCount} sessions`
                : 'No sessions to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleSessionsPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalSessionPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleSessionsPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalSessionPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="session-page-size">Rows per page</label>
              <select
                id="session-page-size"
                value={effectivePageSize}
                onChange={handleSessionsPageSizeChange}
                disabled={isLoading}
              >
                {sessionPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : null}

      {!isLoading && !error && filteredSessions.length === 0 ? (
        <div className="data-placeholder">
          {Object.values(filters).some((f) => (Array.isArray(f) ? f.length > 0 : f.trim()))
            ? 'No sessions found matching your filters.'
            : 'No sessions found.'}
        </div>
      ) : null}

      {/* Stop Session Modal */}
      {stopSessionModalState.isOpen && stopSessionModalState.session ? (
        <StopSessionPopup
          session={stopSessionModalState.session}
          isStop={true}
          onClose={() => setStopSessionModalState({ isOpen: false, session: null })}
          onConfirm={() => handleRemoteStopSession(stopSessionModalState.session.id)}
        />
      ) : null}

      {/* End Manual Modal */}
      {endManualModalState.isOpen && endManualModalState.session ? (
        <StopSessionPopup
          session={endManualModalState.session}
          isStop={false}
          onClose={() => setEndManualModalState({ isOpen: false, session: null })}
          onConfirm={(meterStopValue) =>
            handleManualEndSession(endManualModalState.session.id, meterStopValue)
          }
        />
      ) : null}

      {/* Start Session Modal */}
      {startSessionModalOpen ? (
        <StartSessionPopup
          chargers={chargers}
          customers={customers}
          onClose={() => setStartSessionModalOpen(false)}
          onConfirm={handleStartSession}
        />
      ) : null}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, session: null })}
        onConfirm={handleDeleteSession}
        title="Delete Session"
        itemName={`${deleteModalState.session?.id || ''}`}
        confirmationMessage="Are you sure you want to delete this session?"
      />
    </div>
  )
}

export default Sessions
