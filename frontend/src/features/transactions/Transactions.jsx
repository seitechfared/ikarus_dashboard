import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import DateFilterPicker from '@/components/ui/organisms/DateFilterPicker'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]

const TRANSACTION_TYPE_OPTIONS = [
  { value: 'package_purchase', label: 'Package' },
  { value: 'custom_topup', label: 'Custom Wallet Charge' },
  { value: 'gift_bonus', label: 'Gift / Bonus' },
  { value: 'admin_deduction', label: 'Admin Deduction' },
  { value: 'session_charge', label: 'Session Charge' },
  { value: 'refund', label: 'Refund' },
]

const TRANSACTION_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CREDIT_TRANSACTION_TYPES = new Set(['package_purchase', 'custom_topup', 'gift_bonus', 'refund'])
const DEBIT_TRANSACTION_TYPES = new Set(['admin_deduction', 'session_charge'])

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

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `${dateStr} ${timeStr}`
  } catch {
    return dateString
  }
}

const formatCurrency = (amount, currency = 'EGP') => {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EGP',
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return '-'
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

const formatBillableMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) return '-'
  const numeric = Number(minutes)
  if (Number.isNaN(numeric) || numeric < 0) return '-'
  return `${numeric} min`
}

const renderTransactionBreakdown = (tx) => {
  const billing = tx?.session_billing
  if (!billing) {
    return '-'
  }
  const currency = billing.currency || tx.currency
  return (
    <div className="billing-breakdown">
      <span className="billing-breakdown-note">
        Charging: {formatCurrency(billing.charging_amount, currency)}
      </span>
      <span className="billing-breakdown-note">
        Idle fee: {formatCurrency(billing.idle_fee, currency)}
      </span>
      <span className="billing-breakdown-note">
        Idle: {formatDuration(billing.idle_time_seconds ?? billing.idle_time)} / {formatBillableMinutes(billing.idle_billable_minutes)}
      </span>
    </div>
  )
}

const getSignedAmount = (tx) => {
  const rawAmount = Number(tx?.amount) || 0
  if (!rawAmount) {
    return 0
  }
  if (DEBIT_TRANSACTION_TYPES.has(tx?.type)) {
    return -Math.abs(rawAmount)
  }
  if (CREDIT_TRANSACTION_TYPES.has(tx?.type)) {
    return Math.abs(rawAmount)
  }
  return rawAmount
}

function Transactions() {
  const { showToast } = useInlineToast('transactions')

  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    phone: '',
    email: '',
    type: [],
    customer_country: [],
    status: [],
    date: '',
    admin_action_only: false,
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [selectedTransactionIds, setSelectedTransactionIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })

  // Filter option counts (aggregated across the whole dataset, independent of applied filters)
  const [filterOptionCounts, setFilterOptionCounts] = useState({
    types: {},
    statuses: {},
    countries: [],
  })

  // Filter menu states
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false)
  const [typeDraft, setTypeDraft] = useState([])
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
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  // Load transactions
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadTransactions = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))

        if (debouncedFilters.phone.trim()) {
          params.set('phone', debouncedFilters.phone.trim())
        }
        if (debouncedFilters.email.trim()) {
          params.set('email', debouncedFilters.email.trim())
        }
        if (debouncedFilters.customer_country.length > 0) {
          debouncedFilters.customer_country.forEach((code) => {
            if (code) params.append('customer_country', code)
          })
        }
        if (debouncedFilters.type.length > 0) {
          debouncedFilters.type.forEach((type) => {
            if (type) params.append('type', type)
          })
        }
        if (debouncedFilters.status.length > 0) {
          debouncedFilters.status.forEach((status) => {
            if (status) params.append('status', status)
          })
        }
        if (debouncedFilters.date.trim()) {
          params.set('date', debouncedFilters.date.trim())
        }
        if (debouncedFilters.admin_action_only) {
          params.set('admin_action', 'true')
        }

        const response = await fetch(`${API_BASE}/wallet/transactions/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch transactions (${response.status})`)
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

          setTransactions(rawResults)
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
          setTransactions([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load transactions.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadTransactions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedFilters])

  // Load aggregated filter option counts (whole dataset, independent of applied filters)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadFilterOptions = async () => {
      try {
        const response = await fetch(`${API_BASE}/wallet/transactions/filter-options/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error(`Failed to load transaction filter options (${response.status})`)
        }
        const payload = await response.json()
        if (cancelled) {
          return
        }
        const types = {}
        ;(Array.isArray(payload?.types) ? payload.types : []).forEach((entry) => {
          const key = String(entry?.value || '').trim().toLowerCase()
          if (key) types[key] = Number(entry?.count || 0)
        })
        const statuses = {}
        ;(Array.isArray(payload?.statuses) ? payload.statuses : []).forEach((entry) => {
          const key = String(entry?.value || '').trim().toLowerCase()
          if (key) statuses[key] = Number(entry?.count || 0)
        })
        const countries = (Array.isArray(payload?.countries) ? payload.countries : [])
          .map((entry) => ({
            value: String(entry?.value || '').trim().toUpperCase(),
            label: entry?.label || String(entry?.value || '').trim().toUpperCase(),
            count: Number(entry?.count || 0),
          }))
          .filter((entry) => entry.value)
        setFilterOptionCounts({ types, statuses, countries })
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          console.error('Failed to load transaction filter options:', err)
        }
      }
    }

    loadFilterOptions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const filteredTransactions = transactions

  useEffect(() => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredTransactions.some((tx) => tx.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredTransactions])

  const totalTransactionsCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalTransactionPages = Math.max(1, pagination.total_pages ?? 1)

  const transactionPageBounds = useMemo(() => {
    if (!filteredTransactions.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredTransactions.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredTransactions])

  const areAllFilteredSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTransactionIds.has(tx.id))
  const hasSelection = selectedTransactionIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredTransactions.forEach((tx) => {
          next.delete(tx.id)
        })
      } else {
        filteredTransactions.forEach((tx) => {
          if (tx.id != null) {
            next.add(tx.id)
          }
        })
      }
      return next
    })
  }

  const toggleTransactionSelection = (txId) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }

  const handleDownload = async () => {
    try {
      const selectedIds = hasSelection ? Array.from(selectedTransactionIds) : []
      const response = await fetch(`${API_BASE}/wallet/transactions/export/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          selected_ids: selectedIds,
          filters: {
            phone: debouncedFilters.phone || '',
            email: debouncedFilters.email || '',
            customer_country: debouncedFilters.customer_country || [],
            type: debouncedFilters.type || [],
            status: debouncedFilters.status || [],
            date: debouncedFilters.date || '',
            admin_action_only: Boolean(debouncedFilters.admin_action_only),
          },
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || `Failed to export transactions (${response.status})`)
      }

      const blob = await response.blob()
      if (!blob || blob.size === 0) {
        throw new Error('No transaction data to export.')
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      showToast({
        title: 'Export successful',
        message: hasSelection
          ? `Exported ${selectedIds.length} selected transaction(s).`
          : `Exported ${totalTransactionsCount || 0} transaction(s).`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to export transactions:', error)
      showToast({
        title: 'Export failed',
        message: error?.message || 'Failed to export transactions. Please try again.',
        variant: 'error',
      })
    }
  }

  const handleTransactionsPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalTransactionPages)
      return target === prev ? prev : target
    })
  }

  const handleTransactionsPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const transactionPageSizeOptions = useMemo(() => {
    if (PAGE_SIZE_OPTIONS.some((option) => option.value === effectivePageSize)) {
      return PAGE_SIZE_OPTIONS
    }
    return [...PAGE_SIZE_OPTIONS, { value: effectivePageSize, label: `${effectivePageSize} / page` }].sort(
      (a, b) => a.value - b.value
    )
  }, [effectivePageSize])

  const filterRowStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    paddingBottom: '8px',
  }
  const filterFieldStyle = { flex: '1 1 240px', minWidth: '210px' }

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0
      }
      if (typeof value === 'boolean') {
        return value
      }
      return value.trim().length > 0
    })
  }, [filters])

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  // Filter menu handlers
  const toggleTypeMenu = () => {
    if (isTypeFilterOpen) {
      setTypeDraft(Array.from(filters.type ?? []))
      setIsTypeFilterOpen(false)
    } else {
      setTypeDraft(Array.from(filters.type ?? []))
      setIsTypeFilterOpen(true)
    }
  }

  const applyTypeFilter = () => {
    updateFilter('type', Array.from(new Set(typeDraft)))
    setIsTypeFilterOpen(false)
  }

  const cancelTypeFilter = () => {
    setTypeDraft(Array.from(filters.type ?? []))
    setIsTypeFilterOpen(false)
  }

  const toggleTypeValue = (type) => {
    setTypeDraft((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
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

  const typeFilterOptions = useMemo(
    () =>
      TRANSACTION_TYPE_OPTIONS.map((option) => ({
        ...option,
        count: filterOptionCounts.types[option.value] ?? 0,
      })),
    [filterOptionCounts]
  )

  const statusFilterOptions = useMemo(
    () =>
      TRANSACTION_STATUS_OPTIONS.map((option) => ({
        ...option,
        count: filterOptionCounts.statuses[option.value] ?? 0,
      })),
    [filterOptionCounts]
  )

  const countryFilterOptions = useMemo(
    () => filterOptionCounts.countries,
    [filterOptionCounts]
  )

  // Render filter menus
  const renderTypeFilter = () => {
    const appliedValues = Array.isArray(filters.type) ? filters.type : []
    const displayValues = isTypeFilterOpen ? typeDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount
      ? `${selectedCount} type${selectedCount > 1 ? 's' : ''}`
      : 'Type'
    return (
      <div className="filter-field" id="type-filter-control" style={filterFieldStyle}>
        <div className={`multi-select ${isTypeFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isTypeFilterOpen}
            aria-controls="filter-menu-type"
            onClick={toggleTypeMenu}
          >
            {buttonLabel}
          </button>
          {isTypeFilterOpen ? (
            <div
              id="filter-menu-type"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by type"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Type</span>
                <span className="filter-menu__badge">{typeDraft.length}</span>
              </div>
              <div className="filter-menu__body">
                {typeFilterOptions.map((option) => {
                  const isSelected = typeDraft.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTypeValue(option.value)}
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
                <button type="button" className="filter-menu__apply" onClick={applyTypeFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelTypeFilter}>
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
      <div className="filter-field" id="country-filter-control" style={filterFieldStyle}>
        <div className={`multi-select ${isCountryFilterOpen ? 'open' : ''}`} style={{ width: '100%' }}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isCountryFilterOpen}
            aria-controls="filter-menu-country"
            onClick={toggleCountryMenu}
          >
            {buttonLabel}
          </button>
          {isCountryFilterOpen ? (
            <div
              id="filter-menu-country"
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
      <div className="filter-field" id="status-filter-control" style={filterFieldStyle}>
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

  const renderStatusBadge = (status) => {
    const statusMap = {
      completed: { label: 'Completed', style: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561' } },
      pending: { label: 'Pending', style: { backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' } },
      failed: { label: 'Failed', style: { backgroundColor: 'rgba(237, 74, 74, 0.12)', color: '#ED4A4A' } },
      cancelled: { label: 'Cancelled', style: { backgroundColor: 'rgba(156, 163, 175, 0.12)', color: '#9CA3AF' } },
    }
    const statusInfo = statusMap[status] || { label: status || '-', style: {} }
    return (
      <span className="status-badge charger-status-badge" style={statusInfo.style}>
        {statusInfo.label}
      </span>
    )
  }

  // Close filter menus on outside click
  useEffect(() => {
    if (!isTypeFilterOpen && !isStatusFilterOpen) {
      return undefined
    }
    const handleClickOutside = (event) => {
      const containers = [
        document.getElementById('type-filter-control'),
        document.getElementById('status-filter-control'),
      ]
      if (containers.some((container) => container && container.contains(event.target))) {
        return
      }
      setIsTypeFilterOpen(false)
      setIsStatusFilterOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isTypeFilterOpen, isStatusFilterOpen])

  return (
    <div className="stations-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Transactions' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Transactions</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredTransactions.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="transactions" />

      <div className="stations-filters" style={filterRowStyle}>
        <div className="filter-field search-field" style={filterFieldStyle}>
          <label className="sr-only" htmlFor="phone-filter">
            Filter by phone
          </label>
          <div className="filter-search" style={{ width: '100%' }}>
            <input
              type="text"
              id="phone-filter"
              className="filter-search__input"
              placeholder="Filter by phone..."
              value={filters.phone}
              onChange={(e) => updateFilter('phone', e.target.value)}
            />
          </div>
        </div>
        <div className="filter-field search-field" style={filterFieldStyle}>
          <label className="sr-only" htmlFor="email-filter">
            Filter by email
          </label>
          <div className="filter-search" style={{ width: '100%' }}>
            <span className="filter-search__icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                  stroke="#67716B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 21L16.65 16.65"
                  stroke="#67716B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              type="text"
              id="email-filter"
              className="filter-search__input"
              placeholder="Filter by email..."
              value={filters.email}
              onChange={(e) => updateFilter('email', e.target.value)}
            />
          </div>
        </div>
        {renderTypeFilter()}
        {renderCountryFilter()}
        <div className="filter-field" style={filterFieldStyle}>
          <DateFilterPicker
            id="date-filter"
            placeholder="Date"
            value={filters.date}
            onChange={(value) => updateFilter('date', value)}
          />
        </div>
        {renderStatusFilter()}
        <div
          className="filter-field"
          style={{ ...filterFieldStyle, display: 'flex', alignItems: 'center', minWidth: '200px' }}
        >
          <label
            htmlFor="admin-action-only"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input
              id="admin-action-only"
              type="checkbox"
              checked={filters.admin_action_only}
              onChange={(e) => updateFilter('admin_action_only', e.target.checked)}
            />
            <span>Admin actions only</span>
          </label>
        </div>
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading transactions…</p> : null}

      {!isLoading && !error && filteredTransactions.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div
              className="chargers-table-header"
              style={{
                gridTemplateColumns:
                  'minmax(32px, 0.4fr) minmax(40px, 0.5fr) minmax(140px, 1.4fr) minmax(120px, 1.2fr) minmax(140px, 1.4fr) minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(220px, 1.6fr) minmax(140px, 1.4fr) minmax(100px, 1fr)',
              }}
            >
              <div className="charger-cell charger-select-cell">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  className="select-checkbox"
                  checked={filteredTransactions.length > 0 && areAllFilteredSelected}
                  onChange={handleSelectAll}
                  aria-label={
                    areAllFilteredSelected ? 'Clear transaction selection' : 'Select all transactions'
                  }
                />
              </div>
              <div className="charger-cell order">No</div>
              <div className="charger-cell" >Customer</div>
              <div className="charger-cell">Phone</div>
              <div className="charger-cell">Type</div>
              <div className="charger-cell">Date</div>
              <div className="charger-cell">Amount</div>
              <div className="charger-cell">Breakdown</div>
              <div className="charger-cell">Admin Action</div>
              <div className="charger-cell">Status</div>
            </div>
            {filteredTransactions.map((tx, index) => {
              const rowNumber = transactionPageBounds.start + index

              return (
                <article
                  key={tx.id}
                  className={`charger-row ${selectedTransactionIds.has(tx.id) ? 'selected' : ''}`}
                  style={{
                    gridTemplateColumns:
                      'minmax(32px, 0.4fr) minmax(40px, 0.5fr) minmax(140px, 1.4fr) minmax(120px, 1.2fr) minmax(140px, 1.4fr) minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(220px, 1.6fr) minmax(140px, 1.4fr) minmax(100px, 1fr)',
                  }}
                >
                  <div className="charger-cell charger-select-cell">
                    <input
                      type="checkbox"
                      className="select-checkbox"
                      checked={selectedTransactionIds.has(tx.id)}
                      onChange={(event) => {
                        event.stopPropagation()
                        toggleTransactionSelection(tx.id)
                      }}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select transaction ${tx.id}`}
                    />
                  </div>
                  <div className="charger-cell order">{rowNumber}</div>
                  <div className="charger-cell">
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {tx.customer_email || '-'}
                    </span>
                  </div>
                  <div className="charger-cell">
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {tx.customer_phone || '-'}
                    </span>
                  </div>
                  <div className="charger-cell">
                    <div className="billing-breakdown">
                      <span className="billing-breakdown-primary">
                        {tx.type_label || tx.type || '-'}
                      </span>
                      <span className="billing-breakdown-note">
                        Receipt: {tx.receipt_number || '-'}
                      </span>
                    </div>
                  </div>
                  <div className="charger-cell">
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {formatDateTime(tx.created_at)}
                    </span>
                  </div>
                  <div className="charger-cell">
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {formatCurrency(getSignedAmount(tx), tx.currency)}
                    </span>
                  </div>
                  <div className="charger-cell">{renderTransactionBreakdown(tx)}</div>
                  <div className="charger-cell">
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {tx.admin_action || '-'}
                    </span>
                  </div>
                  <div className="charger-cell">{renderStatusBadge(tx.status)}</div>
                </article>
              )
            })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalTransactionsCount
                ? `Showing ${transactionPageBounds.start}-${transactionPageBounds.end} of ${totalTransactionsCount} transactions`
                : 'No transactions to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleTransactionsPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalTransactionPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleTransactionsPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalTransactionPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="transaction-page-size">Rows per page</label>
              <select
                id="transaction-page-size"
                value={effectivePageSize}
                onChange={handleTransactionsPageSizeChange}
                disabled={isLoading}
              >
                {transactionPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : null}

      {!isLoading && !error && filteredTransactions.length === 0 ? (
        <div className="data-placeholder">
          {hasActiveFilters ? 'No transactions found matching your filters.' : 'No transactions found.'}
        </div>
      ) : null}
    </div>
  )
}

export default Transactions
