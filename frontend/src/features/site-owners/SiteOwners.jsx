import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal'
import StationActionMenu from '@/components/common/StationActionMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCompanyTypes, fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseLocalDate = (value) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const text = String(value)
  if (DATE_ONLY_PATTERN.test(text)) {
    const [year, month, day] = text.split('-').map((part) => Number(part))
    if (!year || !month || !day) {
      return null
    }
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

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

const AddSiteOwnerIcon = () => (
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

const SITE_OWNER_TABLE_TEMPLATE =
  'minmax(32px, 0.4fr) minmax(48px, 0.5fr) 2.3fr 1.3fr 1.3fr 1.4fr 1.6fr 0.7fr'

const formatDate = (value) => {
  if (!value) {
    return '—'
  }
  const date = parseLocalDate(value)
  if (!date) {
    return '—'
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function SiteOwners() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('site-owners')

  const [siteOwners, setSiteOwners] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    siteOwner: null,
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedSiteOwnerIds, setSelectedSiteOwnerIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
    total_items: 0,
  })
  const [companyTypeOptions, setCompanyTypeOptions] = useState([])
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState(() => new Set())
  const [draftCompanyTypes, setDraftCompanyTypes] = useState(() => new Set())
  const [isCompanyTypeMenuOpen, setIsCompanyTypeMenuOpen] = useState(false)
  const companyTypeMenuRef = useRef(null)
  const companyTypeCounts = useMemo(() => {
    const counts = Object.create(null)
    siteOwners.forEach((owner) => {
      if (!owner.company_type) {
        return
      }
      counts[owner.company_type] = (counts[owner.company_type] || 0) + 1
    })
    return counts
  }, [siteOwners])

  const handleCompanyTypeMenuToggle = () => {
    setDraftCompanyTypes(new Set(selectedCompanyTypes))
    setIsCompanyTypeMenuOpen((prev) => !prev)
  }

  const handleApplyCompanyTypes = () => {
    setSelectedCompanyTypes(new Set(draftCompanyTypes))
    setIsCompanyTypeMenuOpen(false)
    setPage(1)
  }

  const handleCancelCompanyTypes = () => {
    setDraftCompanyTypes(new Set(selectedCompanyTypes))
    setIsCompanyTypeMenuOpen(false)
  }

  const toggleDraftCompanyType = (value) => {
    setDraftCompanyTypes((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    Promise.all([
      fetchCompanyTypes({ signal: controller.signal }),
      fetchCountries({ signal: controller.signal }).catch(() => []),
    ])
      .then(([options, countriesList]) => {
        if (!isActive) {
          return
        }
        if (Array.isArray(options)) {
          setCompanyTypeOptions(options)
        }
        if (Array.isArray(countriesList)) {
          setCountries(countriesList.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')))
        }
      })
      .catch((metadataError) => {
        if (!isActive || metadataError?.name === 'AbortError') {
          return
        }
        console.error(metadataError)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!isCompanyTypeMenuOpen) {
      return
    }
    const handleClickOutside = (event) => {
      if (
        companyTypeMenuRef.current &&
        !companyTypeMenuRef.current.contains(event.target)
      ) {
        setIsCompanyTypeMenuOpen(false)
        setDraftCompanyTypes(new Set(selectedCompanyTypes))
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCompanyTypeMenuOpen, selectedCompanyTypes])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadSiteOwners = async () => {
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
        if (selectedCountry) {
          params.set('country', selectedCountry)
        }

        if (selectedCompanyTypes.size) {
          Array.from(selectedCompanyTypes).forEach((value) => {
            params.append('company_type', value)
          })
        }

        const response = await fetch(`${API_BASE}/site-owners/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch site owners (${response.status})`)
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

        const normalized = rawResults.map((owner) => ({
          id: owner.id,
          name: owner.name || owner.display_name || owner.company_name || 'Unknown',
          display_name: owner.display_name,
          company_name: owner.company_name,
          owner_code: owner.owner_code,
          valid_from: owner.valid_from,
          email: owner.contact_email || owner.email,
          phone_e164: owner.contact_phone_e164 || owner.phone_e164,
          company_type: owner.company_type,
          country_code: owner.country_code || null,
          country_name: owner.country_name || null,
          login_email: owner.email,
          login_phone: owner.phone_e164,
          profile_image: owner.profile_image,
          created_at: owner.created_at,
          updated_at: owner.updated_at,
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

          setSiteOwners(normalized)
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
          setSiteOwners([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load site owners.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSiteOwners()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedSearch, selectedCompanyTypes, selectedCountry])

  const filteredSiteOwners = siteOwners

  useEffect(() => {
    setSelectedSiteOwnerIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredSiteOwners.some((owner) => owner.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredSiteOwners])

  const totalSiteOwnersCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalSiteOwnerPages = Math.max(1, pagination.total_pages ?? 1)

  const siteOwnerPageBounds = useMemo(() => {
    if (!filteredSiteOwners.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredSiteOwners.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredSiteOwners])

  const areAllFilteredSelected =
    filteredSiteOwners.length > 0 &&
    filteredSiteOwners.every((owner) => selectedSiteOwnerIds.has(owner.id))
  const hasSelection = selectedSiteOwnerIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedSiteOwnerIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredSiteOwners.forEach((owner) => {
          next.delete(owner.id)
        })
      } else {
        filteredSiteOwners.forEach((owner) => {
          if (owner.id != null) {
            next.add(owner.id)
          }
        })
      }
      return next
    })
  }

  const toggleSiteOwnerSelection = (siteOwnerId) => {
    setSelectedSiteOwnerIds((prev) => {
      const next = new Set(prev)
      if (next.has(siteOwnerId)) {
        next.delete(siteOwnerId)
      } else {
        next.add(siteOwnerId)
      }
      return next
    })
  }

  const handleDeleteClick = (siteOwner) => {
    setDeleteModalState({ isOpen: true, siteOwner })
  }

  const handleDelete = async () => {
    const siteOwner = deleteModalState.siteOwner
    if (!siteOwner) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/site-owners/${siteOwner.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete site owner.')
      }
      setSiteOwners((prev) => prev.filter((item) => item.id !== siteOwner.id))
      setSelectedSiteOwnerIds((prev) => {
        if (!prev.has(siteOwner.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(siteOwner.id)
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
        title: 'Site owner deleted',
        message: `${siteOwner.name} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete site owner.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, siteOwner: null })
    }
  }

  const handleDownload = async () => {
    let rowsToExport = []

    if (hasSelection) {
      rowsToExport = filteredSiteOwners.filter((owner) => selectedSiteOwnerIds.has(owner.id))
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

          const trimmedSearch = debouncedSearch.trim()
          if (trimmedSearch) {
            params.set('search', trimmedSearch)
          }
          if (selectedCountry) {
            params.set('country', selectedCountry)
          }
          if (selectedCompanyTypes.size) {
            Array.from(selectedCompanyTypes).forEach((value) => {
              params.append('company_type', value)
            })
          }

          const response = await fetch(`${API_BASE}/site-owners/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch site owners for export (${response.status})`)
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

        rowsToExport = allResults.map((owner) => ({
          id: owner.id,
          name: owner.name || owner.display_name || owner.company_name || 'Unknown',
          display_name: owner.display_name || 'N/A',
          company_name: owner.company_name || 'N/A',
          owner_code: owner.owner_code || 'N/A',
          valid_from: owner.valid_from || '',
          email: owner.contact_email || owner.email || 'N/A',
          phone_e164: owner.contact_phone_e164 || owner.phone_e164 || 'N/A',
        }))
      } catch (error) {
        console.error('Failed to fetch all site owners for export:', error)
        showToast({
          title: 'Export failed',
          message: 'Failed to fetch all site owners. Please try again.',
          variant: 'error',
        })
        return
      }
    }

    if (!rowsToExport.length) {
      showToast({
        title: 'Export failed',
        message: 'No site owner data to export.',
        variant: 'error',
      })
      return
    }

    const dataRows = rowsToExport.map((owner, index) => ({
      '#': index + 1,
      Name: owner.name,
      'Display Name': owner.display_name,
      'Company Name': owner.company_name,
      'Owner ID': owner.owner_code,
      'Valid From': formatDate(owner.valid_from),
      Email: owner.email,
      Phone: owner.phone_e164,
    }))

    const headers = ['#', 'Name', 'Display Name', 'Company Name', 'Owner ID', 'Valid From', 'Email', 'Phone']

    downloadCsv({
      headers,
      rows: dataRows,
      filename: `site-owners_${new Date().toISOString().slice(0, 10)}.csv`,
    })

    showToast({
      title: 'Export successful',
      message: `Exported ${rowsToExport.length} site owner(s).`,
      variant: 'success',
    })
  }

  const handleSiteOwnersPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalSiteOwnerPages)
      return target === prev ? prev : target
    })
  }

  const handleSiteOwnersPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const siteOwnerPageSizeOptions = useMemo(() => {
    if (PAGE_SIZE_OPTIONS.some((option) => option.value === effectivePageSize)) {
      return PAGE_SIZE_OPTIONS
    }
    return [...PAGE_SIZE_OPTIONS, { value: effectivePageSize, label: `${effectivePageSize} / page` }].sort(
      (a, b) => a.value - b.value
    )
  }, [effectivePageSize])

  return (
    <div className="stations-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Site Owners' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Site Owners</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredSiteOwners.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
          <button
            type="button"
            className="primary-add-button"
            onClick={() => navigate('/site-owners/new')}
          >
            <AddSiteOwnerIcon />
            <span className="primary-add-button__label" style={{ whiteSpace: 'nowrap' }}>
              Add Site Owner
            </span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="site-owners" />

      <div className="stations-filters">
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="site-owner-search">
            Search site owners by name
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
              id="site-owner-search"
              className="filter-search__input"
              placeholder="Search site owners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CountryFilterMenu
          id="site-owner-country-filter"
          title="Country"
          value={selectedCountry}
          options={countries}
          onChange={(nextValue) => {
            setSelectedCountry(nextValue)
            setPage(1)
          }}
        />
        <div className="filter-field">
          <label className="sr-only">Filter site owners by company type</label>
          <div
            className={`multi-select ${isCompanyTypeMenuOpen ? 'open' : ''}`}
            ref={companyTypeMenuRef}
          >
            <button
              type="button"
              className="multi-select-trigger"
              aria-haspopup="dialog"
              aria-expanded={isCompanyTypeMenuOpen}
              aria-controls="site-owner-company-type-filter"
              onClick={handleCompanyTypeMenuToggle}
            >
              {selectedCompanyTypes.size > 0
                ? `${selectedCompanyTypes.size} selected`
                : 'Company type'}
            </button>
            {isCompanyTypeMenuOpen ? (
              <div
                id="site-owner-company-type-filter"
                className="multi-select-menu filter-menu"
                role="dialog"
                aria-label="Filter by company type"
              >
                <div className="filter-menu__header">
                  <span className="filter-menu__title">Company type</span>
                  <span className="filter-menu__badge">{draftCompanyTypes.size}</span>
                </div>
                <div className="filter-menu__body">
                  {companyTypeOptions.length ? (
                    companyTypeOptions.map((option) => {
                      const isSelected = draftCompanyTypes.has(option.value)
                      return (
                        <label
                          key={option.value}
                          className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDraftCompanyType(option.value)}
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
                                  <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D" />
                                </svg>
                              )}
                            </span>
                            <span className="filter-menu__name">{option.label}</span>
                          </span>
                          <span className="filter-menu__count">
                            {(companyTypeCounts[option.value] || 0).toLocaleString()}
                          </span>
                        </label>
                      )
                    })
                  ) : (
                    <p className="filter-menu__empty">No company types available.</p>
                  )}
                </div>
                <div className="filter-menu__footer">
                  <button type="button" className="filter-menu__apply" onClick={handleApplyCompanyTypes}>
                    Apply
                  </button>
                  <button type="button" className="filter-menu__cancel" onClick={handleCancelCompanyTypes}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading site owners…</p> : null}

      {!isLoading && !error && filteredSiteOwners.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table site-owner-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div className="chargers-table-header" style={{ gridTemplateColumns: SITE_OWNER_TABLE_TEMPLATE }}>
            <div className="charger-cell charger-select-cell">
              <input
                type="checkbox"
                ref={selectAllCheckboxRef}
                className="select-checkbox"
                checked={filteredSiteOwners.length > 0 && areAllFilteredSelected}
                onChange={handleSelectAll}
                aria-label={
                  areAllFilteredSelected ? 'Clear site owner selection' : 'Select all site owners'
                }
              />
            </div>
            <div className="charger-cell order">No</div>
            <div className="charger-cell">Name</div>
            <div className="charger-cell">ID</div>
            <div className="charger-cell">Valid from</div>
            <div className="charger-cell">Phone</div>
            <div className="charger-cell">Email</div>
            <div className="charger-cell charger-actions-cell"></div>
          </div>
          {filteredSiteOwners.map((owner, index) => {
            const rowNumber = siteOwnerPageBounds.start + index
            return (
              <article
                key={owner.id}
                className={`charger-row clickable ${
                  selectedSiteOwnerIds.has(owner.id) ? 'selected' : ''
                }`}
                style={{ gridTemplateColumns: SITE_OWNER_TABLE_TEMPLATE }}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('.charger-select-cell')
                  ) {
                    return
                  }
                  navigate(`/site-owners/${owner.id}`)
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
                    navigate(`/site-owners/${owner.id}`)
                  }
                }}
              >
                <div className="charger-cell charger-select-cell">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={selectedSiteOwnerIds.has(owner.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleSiteOwnerSelection(owner.id)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${owner.name}`}
                  />
                </div>
                <div className="charger-cell order site-owner-table-order">{rowNumber}</div>
                <div className="charger-cell">
                  <div className="station-name-cell" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <span
                      className="site-owner-table-text"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                    >
                      {owner.name}
                    </span>
                  </div>
                </div>
                <div className="charger-cell">
                  <span className="site-owner-table-text">
                    {owner.owner_code || '—'}
                  </span>
                </div>
                <div className="charger-cell">
                  <span className="site-owner-table-text">
                    {formatDate(owner.valid_from)}
                  </span>
                </div>
                <div className="charger-cell">
                  <span className="site-owner-table-text">
                    {owner.phone_e164 || '—'}
                  </span>
                </div>
                <div className="charger-cell">
                  <span className="site-owner-table-text">
                    {owner.email || '—'}
                  </span>
                </div>
                <div className="charger-cell charger-actions-cell">
                  <StationActionMenu
                    onEdit={() => navigate(`/site-owners/${owner.id}/edit`)}
                    onDelete={() => handleDeleteClick(owner)}
                  />
                </div>
              </article>
            )
          })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalSiteOwnersCount
                ? `Showing ${siteOwnerPageBounds.start}-${siteOwnerPageBounds.end} of ${totalSiteOwnersCount} site owners`
                : 'No site owners to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleSiteOwnersPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalSiteOwnerPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handleSiteOwnersPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalSiteOwnerPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="site-owner-page-size">Rows per page</label>
              <select
                id="site-owner-page-size"
                value={effectivePageSize}
                onChange={handleSiteOwnersPageSizeChange}
                disabled={isLoading}
              >
                {siteOwnerPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>
        </footer>
        </div>
      ) : null}

      {!isLoading && !error && filteredSiteOwners.length === 0 ? (
        <div className="data-placeholder">
          {search.trim() ? 'No site owners found matching your search.' : 'No site owners found.'}
        </div>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, siteOwner: null })}
        onConfirm={handleDelete}
        title="Delete Site Owner"
        itemName={deleteModalState.siteOwner?.name}
        confirmationMessage={
          deleteModalState.siteOwner
            ? `Are you sure you want to delete "${deleteModalState.siteOwner.name}"?`
            : undefined
        }
      />
    </div>
  )
}

export default SiteOwners
