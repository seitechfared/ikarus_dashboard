import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import CountryFilterMenu from '@/components/common/CountryFilterMenu'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import DateFilterPicker from '@/components/ui/organisms/DateFilterPicker'
import { fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]
const INVITATION_MODE_INITIAL = 'initial'
const INVITATION_JOB_POLL_MS = 3000
const VERIFICATION_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Not Verified' },
]
const INVITATION_FILTER_OPTIONS = [
  { value: '', label: 'All Invitations' },
  { value: 'invited', label: 'Invited' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'not_invited', label: 'Not Invited' },
]

const FilterCheckIcon = () => (
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
)

function SingleSelectFilter({ id, title, value, options, onChange, defaultLabel }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const onMouseDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  const selectedOption = options.find((option) => String(option.value) === String(value))
  const triggerLabel = selectedOption?.value ? selectedOption.label : defaultLabel
  const selectedCount = selectedOption?.value ? 1 : 0

  return (
    <div className="filter-field" ref={containerRef}>
      <div className={`multi-select ${isOpen ? 'open' : ''}`} style={{ width: '100%' }}>
        <button
          type="button"
          className="multi-select-trigger"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={`${id}-menu`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {triggerLabel}
        </button>
        {isOpen ? (
          <div id={`${id}-menu`} className="multi-select-menu filter-menu" role="dialog" aria-label={title}>
            <div className="filter-menu__header">
              <span className="filter-menu__title">{title}</span>
              <span className="filter-menu__badge">{selectedCount}</span>
            </div>
            <div className="filter-menu__body">
              {options.map((option) => {
                const isSelected = String(option.value) === String(value)
                return (
                  <button
                    key={`${id}-${String(option.value)}`}
                    type="button"
                    className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                  >
                    <span className="filter-menu__item-content">
                      <span className="filter-menu__checkbox" aria-hidden="true">
                        {isSelected ? <FilterCheckIcon /> : null}
                      </span>
                      <span className="filter-menu__name">{option.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
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

const AddCustomerIcon = () => (
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

const resolveVerificationFlag = (customer, key) => {
  if (typeof customer?.[key] === 'boolean') {
    return customer[key]
  }
  if (typeof customer?.user?.[key] === 'boolean') {
    return customer.user[key]
  }
  return null
}

const formatDateTimeShort = (value) => {
  if (!value) {
    return 'N/A'
  }
  try {
    const date = new Date(value)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return value
  }
}

function Customers() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('customers')

  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    customer: null,
  })
  const [inviteAllModalOpen, setInviteAllModalOpen] = useState(false)
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const [isAnalyzingInvites, setIsAnalyzingInvites] = useState(false)
  const [inviteAnalysis, setInviteAnalysis] = useState(null)
  const [invitationJob, setInvitationJob] = useState(null)
  const [filters, setFilters] = useState({
    email: '',
    mobile: '',
    id_tag: '',
    date_joined: '',
    email_verified: '',
    mobile_verified: '',
    invitation: '',
    country: '',
  })
  const [countries, setCountries] = useState([])
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })
  const invitationPollTimeoutRef = useRef(null)
  const invitationCompletionToastRef = useRef('')

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

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((items) => {
        if (!isActive || !Array.isArray(items)) {
          return
        }
        setCountries(items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')))
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
    let cancelled = false
    const controller = new AbortController()

    const loadCustomers = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        
        if (debouncedFilters.email.trim()) {
          params.set('email', debouncedFilters.email.trim())
        }
        if (debouncedFilters.country.trim()) {
          params.set('country', debouncedFilters.country.trim())
        }
        if (debouncedFilters.mobile.trim()) {
          params.set('mobile', debouncedFilters.mobile.trim())
        }
        if (debouncedFilters.id_tag.trim()) {
          params.set('id_tag', debouncedFilters.id_tag.trim())
        }
        if (debouncedFilters.date_joined.trim()) {
          params.set('date_joined', debouncedFilters.date_joined.trim())
        }
        if (debouncedFilters.email_verified.trim()) {
          params.set('email_verified', debouncedFilters.email_verified.trim())
        }
        if (debouncedFilters.mobile_verified.trim()) {
          params.set('mobile_verified', debouncedFilters.mobile_verified.trim())
        }
        if (debouncedFilters.invitation.trim()) {
          params.set('invitation', debouncedFilters.invitation.trim())
        }

        const response = await fetch(`${API_BASE}/customers/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch customers (${response.status})`)
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

        const normalized = rawResults.map((customer) => ({
          id: customer.id,
          user_id: customer.user_id,
          id_tag: customer.id_tag,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone_e164: customer.phone_e164,
          country_code: customer.country_code,
          preferred_currency: customer.preferred_currency,
          current_balance:
            typeof customer.current_balance === 'number'
              ? customer.current_balance
              : Number(customer.current_balance ?? 0),
          is_blocked: Boolean(customer.is_blocked),
          date_of_birth: customer.date_of_birth,
          profile_image: customer.profile_image,
          email_verified: resolveVerificationFlag(customer, 'email_verified'),
          mobile_verified: resolveVerificationFlag(customer, 'mobile_verified'),
          is_active: customer.is_active !== false,
          invitation: customer.invitation || null,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        }))

        if (!cancelled) {
          const serverPage = Number(paginationMeta.page ?? page)
          const serverPageSize = Number(paginationMeta.page_size ?? pageSize)
          const serverTotalPages = Number(paginationMeta.total_pages ?? 1)
          const serverTotalItems = Number(paginationMeta.total_items ?? normalized.length)

          const normalizedPagination = {
            page: Number.isFinite(serverPage) && serverPage > 0 ? serverPage : page,
            page_size:
              Number.isFinite(serverPageSize) && serverPageSize > 0 ? serverPageSize : pageSize,
            total_pages:
              Number.isFinite(serverTotalPages) && serverTotalPages > 0 ? serverTotalPages : 1,
            total_items:
              Number.isFinite(serverTotalItems) && serverTotalItems >= 0
                ? serverTotalItems
                : normalized.length,
          }

          setCustomers(normalized)
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
          setCustomers([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load customers.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadCustomers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedFilters])

  const filteredCustomers = customers

  useEffect(() => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredCustomers.some((customer) => customer.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredCustomers])

  const totalCustomersCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalCustomerPages = Math.max(1, pagination.total_pages ?? 1)

  const customerPageBounds = useMemo(() => {
    if (!filteredCustomers.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredCustomers.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredCustomers])

  const areAllFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((customer) => selectedCustomerIds.has(customer.id))
  const hasSelection = selectedCustomerIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredCustomers.forEach((customer) => {
          next.delete(customer.id)
        })
      } else {
        filteredCustomers.forEach((customer) => {
          if (customer.id != null) {
            next.add(customer.id)
          }
        })
      }
      return next
    })
  }

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) {
        next.delete(customerId)
      } else {
        next.add(customerId)
      }
      return next
    })
  }

  const handleDeleteClick = (customer) => {
    setDeleteModalState({ isOpen: true, customer })
  }

  const handleDelete = async () => {
    const customer = deleteModalState.customer
    if (!customer) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/customers/${customer.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete customer.')
      }
      setCustomers((prev) => prev.filter((item) => item.id !== customer.id))
      setSelectedCustomerIds((prev) => {
        if (!prev.has(customer.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(customer.id)
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
        title: 'Customer deleted',
        message: `${customer.first_name || customer.email} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete customer.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, customer: null })
    }
  }

  const handleDownload = async () => {
    try {
      const selectedIds = hasSelection ? Array.from(selectedCustomerIds) : []
      const response = await fetch(`${API_BASE}/customers/export/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          selected_ids: selectedIds,
          filters: {
            email: debouncedFilters.email || '',
            mobile: debouncedFilters.mobile || '',
            id_tag: debouncedFilters.id_tag || '',
            date_joined: debouncedFilters.date_joined || '',
            email_verified: debouncedFilters.email_verified || '',
            mobile_verified: debouncedFilters.mobile_verified || '',
            invitation: debouncedFilters.invitation || '',
          },
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.detail || `Failed to export customers (${response.status})`)
      }

      const blob = await response.blob()
      if (!blob || blob.size === 0) {
        throw new Error('No customer data to export.')
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      showToast({
        title: 'Export successful',
        message: hasSelection
          ? `Exported ${selectedIds.length} selected customer(s).`
          : `Exported ${totalCustomersCount || 0} customer(s).`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to export customers:', error)
      showToast({
        title: 'Export failed',
        message: error?.message || 'Failed to export customers. Please try again.',
        variant: 'error',
      })
    }
  }

  const clearInvitationPollTimer = useCallback(() => {
    if (invitationPollTimeoutRef.current) {
      clearTimeout(invitationPollTimeoutRef.current)
      invitationPollTimeoutRef.current = null
    }
  }, [])

  const pollInvitationJobStatus = useCallback(
    async (jobId, { notifyCompletion = true } = {}) => {
      try {
        const query = jobId ? `?job_id=${encodeURIComponent(jobId)}` : ''
        const response = await fetch(`${API_BASE}/customers/invitations/send-all/status/${query}`, {
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data?.detail || 'Failed to fetch invitation job status.')
        }
        const job = data?.job || null
        setInvitationJob(job)
        const active = Boolean(data?.is_active)
        setIsSendingInvites(active)
        if (active && job?.id) {
          clearInvitationPollTimer()
          invitationPollTimeoutRef.current = setTimeout(() => {
            pollInvitationJobStatus(job.id)
          }, INVITATION_JOB_POLL_MS)
          return
        }
        if (notifyCompletion && job?.id && !active) {
          const completionKey = `${job.id}:${job.status || ''}`
          if (invitationCompletionToastRef.current !== completionKey) {
            invitationCompletionToastRef.current = completionKey
            if (job.status === 'completed') {
              showToast({
                title: 'Invitations processed',
                message: `Sent ${job.sent_count || 0}, skipped ${job.skipped_count || 0}.`,
                variant: 'success',
              })
            } else if (job.status === 'failed') {
              showToast({
                title: 'Bulk invitation failed',
                message: job.error_message || 'Invitation processing failed.',
                variant: 'error',
              })
            }
          }
        }
      } catch (statusError) {
        console.error(statusError)
        clearInvitationPollTimer()
        setIsSendingInvites(false)
      }
    },
    [clearInvitationPollTimer, showToast]
  )

  useEffect(() => {
    pollInvitationJobStatus(null, { notifyCompletion: false })
  }, [pollInvitationJobStatus])

  useEffect(() => {
    return () => {
      clearInvitationPollTimer()
    }
  }, [clearInvitationPollTimer])

  const loadInvitationAnalysis = useCallback(async () => {
    setInviteAnalysis(null)
    setIsAnalyzingInvites(true)
    try {
      const response = await fetch(`${API_BASE}/customers/invitations/send-all/analysis/`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to analyze invitations.')
      }
      setInviteAnalysis(data?.analysis || null)
    } catch (analysisError) {
      console.error(analysisError)
      setInviteAnalysis(null)
      showToast({
        title: 'Analysis failed',
        message: analysisError.message || 'Unable to analyze invitation targets.',
        variant: 'error',
      })
    } finally {
      setIsAnalyzingInvites(false)
    }
  }, [showToast])

  const handleSendInvitationsToAll = useCallback(async () => {
    setIsSendingInvites(true)
    invitationCompletionToastRef.current = ''
    try {
      const response = await fetch(`${API_BASE}/customers/invitations/send-all/`, {
        method: 'POST',
        credentials: 'include',
        headers: appendAuthHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ mode: INVITATION_MODE_INITIAL }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409 && data?.job?.id) {
          setInvitationJob(data.job)
          setIsSendingInvites(true)
          showToast({
            title: 'Bulk invitation in progress',
            message: data?.detail || 'A bulk invitation job is already running.',
            variant: 'error',
          })
          await pollInvitationJobStatus(data.job.id)
          return
        }
        throw new Error(data?.detail || 'Failed to send invitations.')
      }
      const job = data?.job || null
      setInvitationJob(job)
      if (job?.id) {
        await pollInvitationJobStatus(job.id)
      } else {
        setIsSendingInvites(false)
      }
      showToast({
        title: 'Sending started',
        message: 'Bulk sending has started for eligible customers.',
        variant: 'success',
      })
    } catch (inviteError) {
      console.error(inviteError)
      setIsSendingInvites(false)
      showToast({
        title: 'Invitation failed',
        message: inviteError.message || 'Unable to send invitations.',
        variant: 'error',
      })
    }
  }, [pollInvitationJobStatus, showToast])

  const handleCustomersPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalCustomerPages)
      return target === prev ? prev : target
    })
  }

  const handleCustomersPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const customerPageSizeOptions = useMemo(() => {
    if (PAGE_SIZE_OPTIONS.some((option) => option.value === effectivePageSize)) {
      return PAGE_SIZE_OPTIONS
    }
    return [...PAGE_SIZE_OPTIONS, { value: effectivePageSize, label: `${effectivePageSize} / page` }].sort(
      (a, b) => a.value - b.value
    )
  }, [effectivePageSize])

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const renderVerificationBadge = (value) => {
    if (value === null) {
      return 'N/A'
    }
    const style = value
      ? { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561' }
      : { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280' }
    return (
      <span className="status-badge charger-status-badge" style={style}>
        {value ? 'Verified' : 'Not Verified'}
      </span>
    )
  }

  const renderInvitationBadge = (invitation) => {
    const statusValue = String(invitation?.status || 'unknown').toLowerCase()
    const palette = {
      completed: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561', label: 'Completed' },
      pending: { backgroundColor: 'rgba(0, 108, 156, 0.12)', color: '#006C9C', label: 'Pending' },
      expired: { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280', label: 'Expired' },
      revoked: { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280', label: 'Revoked' },
      active: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561', label: 'Invited' },
      blocked: { backgroundColor: 'rgba(237, 74, 74, 0.12)', color: '#ED4A4A', label: 'Blocked' },
      no_email: { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280', label: 'No Email' },
      invalid_email: { backgroundColor: 'rgba(237, 74, 74, 0.12)', color: '#ED4A4A', label: 'Invalid Email' },
      user_missing: { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280', label: 'Missing User' },
      already_verified: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561', label: 'Invited' },
      not_invited: { backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#A16207', label: 'Not Invited' },
      unknown: { backgroundColor: 'rgba(156, 163, 175, 0.14)', color: '#6B7280', label: 'Unknown' },
    }
    const entry = palette[statusValue] || palette.unknown
    return (
      <span className="status-badge charger-status-badge" style={{ backgroundColor: entry.backgroundColor, color: entry.color }}>
        {entry.label}
      </span>
    )
  }

  const inviteJobProgressLabel = useMemo(() => {
    if (!isSendingInvites || !invitationJob) {
      return null
    }
    const processed = Number(invitationJob.processed_count || 0)
    const total = Number(invitationJob.total_count || 0)
    if (total > 0) {
      return `${processed}/${total}`
    }
    return 'Starting'
  }, [invitationJob, isSendingInvites])

  const inviteAnalysisWarning = useMemo(() => {
    if (isAnalyzingInvites) {
      return 'Analyzing customers before sending invitations...'
    }
    const analysis = inviteAnalysis
    if (!analysis) {
      return 'Analysis is unavailable. Blocked users, invalid emails, users without email, and fully verified users are skipped automatically.'
    }
    const total = Number(analysis.total_count || 0)
    const eligible = Number(analysis.eligible_count || 0)
    const skipped = Number(analysis.skipped_count || 0)
    const reasonCounts = analysis.reason_counts || {}
    const verifiedSkipped = Number(reasonCounts.already_verified || 0)
    const invalidEmailSkipped = Number(reasonCounts.invalid_email || 0)
    const noEmailSkipped = Number(reasonCounts.no_email || 0)
    const blockedSkipped = Number(reasonCounts.blocked || 0)
    const pendingSkipped = Number(reasonCounts.already_pending || 0)
    const missingUserSkipped = Number(reasonCounts.user_missing || 0)

    return [
      `Total customers: ${total}.`,
      `Will send: ${eligible}.`,
      `Will skip: ${skipped}.`,
      `Skipped (email+mobile already verified): ${verifiedSkipped}.`,
      `Skipped (invalid email): ${invalidEmailSkipped}.`,
      `Skipped (no email): ${noEmailSkipped}.`,
      `Skipped (blocked): ${blockedSkipped}.`,
      `Skipped (already pending invitation): ${pendingSkipped}.`,
      `Skipped (missing user): ${missingUserSkipped}.`,
    ].join(' ')
  }, [inviteAnalysis, isAnalyzingInvites])

  return (
    <div className="stations-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Customers' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Customers</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={async () => {
              setInviteAllModalOpen(true)
              await loadInvitationAnalysis()
            }}
            disabled={isSendingInvites || isLoading || isAnalyzingInvites}
          >
            <span className="download-button__label">
              {isSendingInvites
                ? `Sending${inviteJobProgressLabel ? ` (${inviteJobProgressLabel})` : '...'}`
                : isAnalyzingInvites
                  ? 'Analyzing...'
                : 'Send Invitations'}
            </span>
          </button>
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredCustomers.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
          <button
            type="button"
            className="primary-add-button"
            onClick={() => navigate('/customers/new')}
          >
            <AddCustomerIcon />
            <span className="primary-add-button__label">Add Customer</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="customers" />

      <div className="stations-filters">
      <DateFilterPicker
          id="customer-date-joined-filter"
          placeholder="Date Joined"
          value={filters.date_joined}
          onChange={(nextValue) => updateFilter('date_joined', nextValue)}
        />
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="customer-email-filter">
            Filter by email
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
              id="customer-email-filter"
              className="filter-search__input"
              placeholder="Filter by email..."
              value={filters.email}
              onChange={(e) => updateFilter('email', e.target.value)}
            />
          </div>
        </div>
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="customer-mobile-filter">
            Filter by mobile
          </label>
          <div className="filter-search">
            <input
              type="text"
              id="customer-mobile-filter"
              className="filter-search__input"
              placeholder="Filter by mobile..."
              value={filters.mobile}
              onChange={(e) => updateFilter('mobile', e.target.value)}
            />
          </div>
        </div>
        <CountryFilterMenu
          id="customer-country-filter"
          title="Country"
          value={filters.country}
          options={countries}
          onChange={(nextValue) => updateFilter('country', nextValue)}
        />
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="customer-id-tag-filter">
            Filter by ID Tag
          </label>
          <div className="filter-search">
            <input
              type="text"
              id="customer-id-tag-filter"
              className="filter-search__input"
              placeholder="Filter by ID Tag..."
              value={filters.id_tag}
              onChange={(e) => updateFilter('id_tag', e.target.value)}
            />
          </div>
        </div>
        <SingleSelectFilter
          id="customer-email-verified-filter"
          title="Email Verified"
          value={filters.email_verified}
          options={VERIFICATION_FILTER_OPTIONS}
          defaultLabel="Email Verified"
          onChange={(nextValue) => updateFilter('email_verified', nextValue)}
        />
        <SingleSelectFilter
          id="customer-mobile-verified-filter"
          title="Mobile Verified"
          value={filters.mobile_verified}
          options={VERIFICATION_FILTER_OPTIONS}
          defaultLabel="Mobile Verified"
          onChange={(nextValue) => updateFilter('mobile_verified', nextValue)}
        />
        <SingleSelectFilter
          id="customer-invitation-filter"
          title="Invitation"
          value={filters.invitation}
          options={INVITATION_FILTER_OPTIONS}
          defaultLabel="Invitation"
          onChange={(nextValue) => updateFilter('invitation', nextValue)}
        />
        
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading customers…</p> : null}

      {!isLoading && !error && filteredCustomers.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div className="chargers-table-header" style={{ gridTemplateColumns: 'minmax(32px, 0.4fr) minmax(40px, 0.5fr) 1.1fr 1fr 1fr 1fr 1.2fr 0.95fr 0.95fr 1.05fr 1.15fr 1fr 0.7fr' }}>
              <div className="charger-cell charger-select-cell">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  className="select-checkbox"
                  checked={filteredCustomers.length > 0 && areAllFilteredSelected}
                  onChange={handleSelectAll}
                  aria-label={
                    areAllFilteredSelected ? 'Clear customer selection' : 'Select all customers'
                  }
                />
              </div>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">ID Tag</div>
              <div className="charger-cell">First Name</div>
              <div className="charger-cell">Last Name</div>
              <div className="charger-cell">Phone</div>
              <div className="charger-cell">Email</div>
              <div className="charger-cell">Email Verified</div>
              <div className="charger-cell">Mobile Verified</div>
              <div className="charger-cell">Invitation</div>
              <div className="charger-cell">Valid Till</div>
              <div className="charger-cell">Created</div>
              <div className="charger-cell charger-actions-cell"></div>
            </div>
          {filteredCustomers.map((customer, index) => {
            const rowNumber = customerPageBounds.start + index
            return (
              <article
                key={customer.id}
                className={`charger-row clickable ${
                  selectedCustomerIds.has(customer.id) ? 'selected' : ''
                }`}
                style={{ gridTemplateColumns: 'minmax(32px, 0.4fr) minmax(40px, 0.5fr) 1.1fr 1fr 1fr 1fr 1.2fr 0.95fr 0.95fr 1.05fr 1.15fr 1fr 0.7fr' }}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('.charger-select-cell')
                  ) {
                    return
                  }
                  navigate(`/customers/${customer.id}`)
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
                    navigate(`/customers/${customer.id}`)
                  }
                }}
              >
                <div className="charger-cell charger-select-cell">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={selectedCustomerIds.has(customer.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleCustomerSelection(customer.id)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${customer.first_name || customer.email}`}
                  />
                </div>
                <div className="charger-cell order">{rowNumber}</div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{customer.id_tag || 'N/A'}</span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{customer.first_name || 'N/A'}</span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{customer.last_name || 'N/A'}</span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{customer.phone_e164 || 'N/A'}</span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{customer.email || 'N/A'}</span>
                </div>
                <div className="charger-cell">{renderVerificationBadge(customer.email_verified)}</div>
                <div className="charger-cell">{renderVerificationBadge(customer.mobile_verified)}</div>
                <div className="charger-cell">{renderInvitationBadge(customer.invitation)}</div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {formatDateTimeShort(customer.invitation?.expires_at)}
                  </span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {customer.created_at
                      ? new Date(customer.created_at).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="charger-cell charger-actions-cell">
                  <StationActionMenu
                    onEdit={() => navigate(`/customers/${customer.id}/edit`)}
                    onDelete={() => handleDeleteClick(customer)}
                  />
                </div>
              </article>
            )
          })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalCustomersCount
                ? `Showing ${customerPageBounds.start}-${customerPageBounds.end} of ${totalCustomersCount} customers`
                : 'No customers to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleCustomersPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalCustomerPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleCustomersPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalCustomerPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="customer-page-size">Rows per page</label>
              <select
                id="customer-page-size"
                value={effectivePageSize}
                onChange={handleCustomersPageSizeChange}
                disabled={isLoading}
              >
                {customerPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : null}

      {!isLoading && !error && filteredCustomers.length === 0 ? (
        <div className="data-placeholder">
          {Object.values(filters).some((f) => f.trim())
            ? 'No customers found matching your filters.'
            : 'No customers found.'}
        </div>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, customer: null })}
        onConfirm={handleDelete}
        title="Delete Customer"
        itemName={deleteModalState.customer?.first_name || deleteModalState.customer?.email}
        confirmationMessage={
          deleteModalState.customer
            ? `Are you sure you want to delete this customer?`
            : undefined
        }
      />

      <DeleteConfirmationModal
        isOpen={inviteAllModalOpen}
        onClose={() => setInviteAllModalOpen(false)}
        onConfirm={handleSendInvitationsToAll}
        title="Send Invitations"
        confirmationMessage="Send invitation links to all eligible customers?"
        warningMessage={inviteAnalysisWarning}
        confirmLabel="Send"
        confirmDisabled={isAnalyzingInvites}
      />
    </div>
  )
}

export default Customers

