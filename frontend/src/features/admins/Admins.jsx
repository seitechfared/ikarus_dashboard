import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import '@/styles/dashboard.css'
import {
  ADMIN_ROLE_OPTIONS,
  canonicalizeAdminRole,
  formatAdminRoleLabel,
} from './adminRoleUtils'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 25, label: '25 / page' },
  { value: 50, label: '50 / page' },
  { value: 100, label: '100 / page' },
]

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

const AddAdminIcon = () => (
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

const trimString = (value) => (typeof value === 'string' ? value.trim() : '')

const getAdminDisplayName = (admin) => {
  if (!admin) {
    return ''
  }
  const normalizedDisplay = trimString(admin.display_name)
  if (normalizedDisplay) {
    return normalizedDisplay
  }
  const firstName = trimString(admin.first_name)
  const lastName = trimString(admin.last_name)
  const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()
  return fallbackName || trimString(admin.email) || ''
}

const normalizeAdminRecord = (admin) => {
  const firstName = trimString(admin?.first_name ?? admin?.firstName)
  const lastName = trimString(admin?.last_name ?? admin?.lastName)
  const email = trimString(admin?.email)
  const position = trimString(admin?.position)
  const profileImageRaw = admin?.profile_image ?? admin?.profileImage
  const normalizedRole = canonicalizeAdminRole(admin?.role ?? admin?.role_value)
  return {
    id: admin?.id ?? null,
    user_id: admin?.user_id ?? admin?.userId ?? null,
    first_name: firstName,
    last_name: lastName,
    email,
    role: normalizedRole,
    position,
    profile_image: profileImageRaw ? buildMediaUrl(profileImageRaw) : '',
    display_name: [firstName, lastName].filter(Boolean).join(' ').trim() || email || '',
    normalized_role: normalizedRole,
    created_at: admin?.created_at ?? admin?.createdAt ?? null,
    updated_at: admin?.updated_at ?? admin?.updatedAt ?? null,
  }
}

const ADMIN_TABLE_COLUMNS =
  'minmax(32px, 0.4fr) minmax(40px, 0.5fr) 1.3fr 1.3fr 1.8fr 1.2fr 1.2fr 0.7fr'

function Admins() {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canManageAdmins = roleCapabilities.canEdit
  const { showToast } = useInlineToast('admins')

  const [admins, setAdmins] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    admin: null,
  })
  const [filters, setFilters] = useState({
    email: '',
    position: '',
    roles: [],
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [selectedAdminIds, setSelectedAdminIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false)
  const [roleDraft, setRoleDraft] = useState([])

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
    if (!isRoleFilterOpen || typeof document === 'undefined') {
      return undefined
    }
    const handleClickOutside = (event) => {
      const container = document.getElementById('role-filter-control')
      if (container && !container.contains(event.target)) {
        setRoleDraft(Array.from(filters.roles ?? []))
        setIsRoleFilterOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setRoleDraft(Array.from(filters.roles ?? []))
        setIsRoleFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isRoleFilterOpen, filters.roles])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadAdmins = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        
        applyFiltersToParams(params, debouncedFilters)

        const response = await fetch(`${API_BASE}/admins/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch admins (${response.status})`)
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

        const normalized = rawResults.map(normalizeAdminRecord)

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

          setAdmins(normalized)
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
          setAdmins([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load admins.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadAdmins()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedFilters])

  const filteredAdmins = admins

  useEffect(() => {
    setSelectedAdminIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredAdmins.some((admin) => admin.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredAdmins])

  const totalAdminsCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalAdminPages = Math.max(1, pagination.total_pages ?? 1)

  const adminPageBounds = useMemo(() => {
    if (!filteredAdmins.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredAdmins.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredAdmins])

  const areAllFilteredSelected =
    filteredAdmins.length > 0 &&
    filteredAdmins.every((admin) => selectedAdminIds.has(admin.id))
  const hasSelection = selectedAdminIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedAdminIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredAdmins.forEach((admin) => {
          next.delete(admin.id)
        })
      } else {
        filteredAdmins.forEach((admin) => {
          if (admin.id != null) {
            next.add(admin.id)
          }
        })
      }
      return next
    })
  }

  const toggleAdminSelection = (adminId) => {
    setSelectedAdminIds((prev) => {
      const next = new Set(prev)
      if (next.has(adminId)) {
        next.delete(adminId)
      } else {
        next.add(adminId)
      }
      return next
    })
  }

  const handleDeleteClick = (admin) => {
    if (!canManageAdmins) {
      return
    }
    setDeleteModalState({ isOpen: true, admin })
  }

  const handleDelete = async () => {
    if (!canManageAdmins) {
      return
    }
    const admin = deleteModalState.admin
    if (!admin) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/admins/${admin.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete admin.')
      }
      setAdmins((prev) => prev.filter((item) => item.id !== admin.id))
      setSelectedAdminIds((prev) => {
        if (!prev.has(admin.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(admin.id)
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
      const adminLabel = getAdminDisplayName(admin) || 'Admin'
      showToast({
        title: 'Admin deleted',
        message: `${adminLabel} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete admin.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, admin: null })
    }
  }

  const handleDownload = async () => {
    let rowsToExport = []

    if (hasSelection) {
      rowsToExport = filteredAdmins.filter((admin) => selectedAdminIds.has(admin.id))
    } else {
      try {
        const allResults = []
        let currentPage = 1
        let totalPages = 1
        const pageSize = 1000

        while (currentPage <= totalPages) {
          const params = new URLSearchParams()
          params.set('page', String(currentPage))
          params.set('page_size', String(pageSize))

          applyFiltersToParams(params, debouncedFilters)

          const response = await fetch(`${API_BASE}/admins/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch admins for export (${response.status})`)
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

        rowsToExport = allResults.map(normalizeAdminRecord)
      } catch (error) {
        console.error('Failed to fetch all admins for export:', error)
        showToast({
          title: 'Export failed',
          message: 'Failed to fetch all admins. Please try again.',
          variant: 'error',
        })
        return
      }
    }

    if (!rowsToExport.length) {
      showToast({
        title: 'Export failed',
        message: 'No admin data to export.',
        variant: 'error',
      })
      return
    }

    const dataRows = rowsToExport.map((admin, index) => ({
      '#': index + 1,
      'First Name': admin.first_name || 'N/A',
      'Last Name': admin.last_name || 'N/A',
      Email: admin.email || 'N/A',
      Role: formatAdminRoleLabel(admin.role),
      Position: admin.position || 'N/A',
    }))

    const headers = ['#', 'First Name', 'Last Name', 'Email', 'Role', 'Position']

    downloadCsv({
      headers,
      rows: dataRows,
      filename: `admins_${new Date().toISOString().slice(0, 10)}.csv`,
    })

    showToast({
      title: 'Export successful',
      message: `Exported ${rowsToExport.length} admin(s).`,
      variant: 'success',
    })
  }

  const handleAdminsPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalAdminPages)
      return target === prev ? prev : target
    })
  }

  const handleAdminsPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const adminPageSizeOptions = useMemo(() => {
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

  const applyFiltersToParams = (params, sourceFilters) => {
    const workingFilters = sourceFilters || {}
    if (workingFilters.email && workingFilters.email.trim()) {
      params.set('email', workingFilters.email.trim())
    }
    if (workingFilters.position && workingFilters.position.trim()) {
      params.set('position', workingFilters.position.trim())
    }
    if (Array.isArray(workingFilters.roles) && workingFilters.roles.length) {
      workingFilters.roles.forEach((role) => {
        if (role) {
          params.append('role', role)
        }
      })
    }
  }

  const toggleRoleMenu = () => {
    if (isRoleFilterOpen) {
      setRoleDraft(Array.from(filters.roles ?? []))
      setIsRoleFilterOpen(false)
    } else {
      setRoleDraft(Array.from(filters.roles ?? []))
      setIsRoleFilterOpen(true)
    }
  }

  const applyRoleFilter = () => {
    updateFilter('roles', Array.from(new Set(roleDraft)))
    setIsRoleFilterOpen(false)
  }

  const cancelRoleFilter = () => {
    setRoleDraft(Array.from(filters.roles ?? []))
    setIsRoleFilterOpen(false)
  }

  const toggleRoleValue = (roleValue) => {
    setRoleDraft((prev) => {
      const next = new Set(prev)
      if (next.has(roleValue)) {
        next.delete(roleValue)
      } else {
        next.add(roleValue)
      }
      return Array.from(next)
    })
  }

  const roleCounts = useMemo(() => {
    const counts = ADMIN_ROLE_OPTIONS.reduce((acc, option) => {
      acc[option.value] = 0
      return acc
    }, {})
    admins.forEach((admin) => {
      const key = admin.normalized_role
      if (!key) {
        return
      }
      if (Object.prototype.hasOwnProperty.call(counts, key)) {
        counts[key] += 1
      } else {
        counts[key] = 1
      }
    })
    return counts
  }, [admins])

  const roleFilterOptions = useMemo(
    () =>
      ADMIN_ROLE_OPTIONS.map((option) => ({
        ...option,
        count: roleCounts[option.value] ?? 0,
      })),
    [roleCounts]
  )

  const renderRoleFilter = () => {
    const appliedValues = Array.isArray(filters.roles) ? filters.roles : []
    const displayValues = isRoleFilterOpen ? roleDraft : appliedValues
    const selectedCount = displayValues.length
    const buttonLabel = selectedCount ? `${selectedCount} role${selectedCount > 1 ? 's' : ''}` : 'Role'
    return (
      <div className="filter-field governorate-filter" id="role-filter-control">
        <div className={`multi-select ${isRoleFilterOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="multi-select-trigger"
            aria-haspopup="dialog"
            aria-expanded={isRoleFilterOpen}
            aria-controls="filter-menu-roles"
            onClick={toggleRoleMenu}
          >
            {buttonLabel}
          </button>
          {isRoleFilterOpen ? (
            <div
              id="filter-menu-roles"
              className="multi-select-menu filter-menu"
              role="dialog"
              aria-label="Filter by role"
            >
              <div className="filter-menu__header">
                <span className="filter-menu__title">Role</span>
                <span className="filter-menu__badge">{roleDraft.length}</span>
              </div>
              <div className="filter-menu__body">
                {roleFilterOptions.map((option) => {
                  const isSelected = roleDraft.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRoleValue(option.value)}
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
                      <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                    </label>
                  )
                })}
              </div>
              <div className="filter-menu__footer">
                <button type="button" className="filter-menu__apply" onClick={applyRoleFilter}>
                  Apply
                </button>
                <button type="button" className="filter-menu__cancel" onClick={cancelRoleFilter}>
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
    <div className="stations-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Admins' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Admins</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredAdmins.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
          {canManageAdmins ? (
            <button
              type="button"
              className="primary-add-button"
              onClick={() => navigate('/admins/new')}
            >
              <AddAdminIcon />
              <span className="primary-add-button__label">Add Admin</span>
            </button>
          ) : null}
        </div>
      </header>

      <InlineToastRegion region="admins" />

      <div className="stations-filters">
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="admin-email-filter">
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
              id="admin-email-filter"
              className="filter-search__input"
              placeholder="Filter by email..."
              value={filters.email}
              onChange={(e) => updateFilter('email', e.target.value)}
            />
          </div>
        </div>
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="admin-position-filter">
            Filter by position
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
              id="admin-position-filter"
              className="filter-search__input"
              placeholder="Filter by position..."
              value={filters.position}
              onChange={(e) => updateFilter('position', e.target.value)}
            />
          </div>
        </div>
        {renderRoleFilter()}
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading admins…</p> : null}

      {!isLoading && !error && filteredAdmins.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div
              className="chargers-table-header"
              style={{ gridTemplateColumns: ADMIN_TABLE_COLUMNS }}
            >
              <div className="charger-cell charger-select-cell">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  className="select-checkbox"
                  checked={filteredAdmins.length > 0 && areAllFilteredSelected}
                  onChange={handleSelectAll}
                  aria-label={
                    areAllFilteredSelected ? 'Clear admin selection' : 'Select all admins'
                  }
                />
              </div>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">First Name</div>
              <div className="charger-cell">Last Name</div>
              <div className="charger-cell">Email</div>
              <div className="charger-cell">Role</div>
              <div className="charger-cell">Position</div>
              <div className="charger-cell charger-actions-cell"></div>
            </div>
          {filteredAdmins.map((admin, index) => {
            const rowNumber = adminPageBounds.start + index
            return (
              <article
                key={admin.id}
                className={`charger-row clickable ${
                  selectedAdminIds.has(admin.id) ? 'selected' : ''
                }`}
                style={{ gridTemplateColumns: ADMIN_TABLE_COLUMNS }}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('.charger-select-cell')
                  ) {
                    return
                  }
                  navigate(`/admins/${admin.id}`)
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
                    navigate(`/admins/${admin.id}`)
                  }
                }}
              >
                <div className="charger-cell charger-select-cell">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={selectedAdminIds.has(admin.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleAdminSelection(admin.id)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${getAdminDisplayName(admin) || 'admin'}`}
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
                    {admin.first_name || 'N/A'}
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
                    {admin.last_name || 'N/A'}
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
                    {admin.email || 'N/A'}
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
                    {formatAdminRoleLabel(admin.role)}
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
                    {admin.position || 'N/A'}
                  </span>
                </div>
                <div className="charger-cell charger-actions-cell">
                  <StationActionMenu
                    onEdit={() => navigate(`/admins/${admin.id}/edit`)}
                    onDelete={() => handleDeleteClick(admin)}
                    disabled={!canManageAdmins}
                  />
                </div>
              </article>
            )
          })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalAdminsCount
                ? `Showing ${adminPageBounds.start}-${adminPageBounds.end} of ${totalAdminsCount} admins`
                : 'No admins to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleAdminsPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalAdminPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleAdminsPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalAdminPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="admin-page-size">Rows per page</label>
              <select
                id="admin-page-size"
                value={effectivePageSize}
                onChange={handleAdminsPageSizeChange}
                disabled={isLoading}
              >
                {adminPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      ) : null}

      {!isLoading && !error && filteredAdmins.length === 0 ? (
        <div className="data-placeholder">
          {Object.values(filters).some((candidate) => {
            if (typeof candidate === 'string') {
              return candidate.trim().length > 0
            }
            if (Array.isArray(candidate)) {
              return candidate.length > 0
            }
            return Boolean(candidate)
          })
            ? 'No admins found matching your filters.'
            : 'No admins found.'}
        </div>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, admin: null })}
        onConfirm={handleDelete}
        title="Delete Admin"
        itemName={
          deleteModalState.admin
            ? getAdminDisplayName(deleteModalState.admin) ||
              deleteModalState.admin.email ||
              'Admin'
            : undefined
        }
        confirmationMessage={
          deleteModalState.admin
            ? `Are you sure you want to delete this admin?`
            : undefined
        }
      />
    </div>
  )
}

export default Admins

