import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCompanyTypes, fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

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

const AddPartnerIcon = () => (
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

function Partners() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('partners')

  const [partners, setPartners] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    partner: null,
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedPartnerIds, setSelectedPartnerIds] = useState(() => new Set())
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
    partners.forEach((partner) => {
      if (!partner.company_type) {
        return
      }
      counts[partner.company_type] = (counts[partner.company_type] || 0) + 1
    })
    return counts
  }, [partners])

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

  // Debounce search input
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
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((items) => {
        if (!isActive || !Array.isArray(items)) {
          return
        }
        setCountries(items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      })
      .catch((error) => {
        if (!isActive || error?.name === 'AbortError') {
          return
        }
        console.error(error)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadPartners = async () => {
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

        const response = await fetch(`${API_BASE}/partners/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch partners (${response.status})`)
        }

        const json = await response.json()
        if (!Array.isArray(json) && Array.isArray(json.company_type_options)) {
          setCompanyTypeOptions(json.company_type_options)
        }
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

        const normalized = rawResults.map((partner) => ({
          id: partner.id,
          name: partner.name?.trim() || 'Unnamed partner',
          company_name: partner.company_name?.trim() || null,
          company_type: partner.company_type || null,
          company_type_label: partner.company_type_label || partner.company_type || null,
          email: partner.email?.trim() || null,
          phone_e164: partner.phone_e164?.trim() || null,
          first_name: partner.first_name?.trim() || null,
          last_name: partner.last_name?.trim() || null,
          job_title: partner.job_title?.trim() || null,
          zip_code: partner.zip_code?.trim() || null,
          country_code: partner.country_code || null,
          country_name: partner.country_name || null,
          city_id: partner.city_id || null,
          city_name: partner.city_name || null,
          street: partner.street?.trim() || null,
          notes: partner.notes?.trim() || null,
          created_at: partner.created_at,
          updated_at: partner.updated_at,
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

          setPartners(normalized)
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
          setPartners([])
          setPagination((prev) => ({
            ...prev,
            page: 1,
            total_items: 0,
            total_pages: 1,
          }))
          setPage(1)
          setError('Unable to load partners.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPartners()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [page, pageSize, debouncedSearch, selectedCompanyTypes, selectedCountry])

  useEffect(() => {
    if (companyTypeOptions.length) {
      return
    }
    let isActive = true
    const controller = new AbortController()
    const loadCompanyTypes = async () => {
      try {
        const options = await fetchCompanyTypes({ signal: controller.signal })
        if (isActive && Array.isArray(options)) {
          setCompanyTypeOptions(options)
        }
      } catch (metadataError) {
        if (isActive) {
          console.error(metadataError)
        }
      }
    }
    loadCompanyTypes()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [companyTypeOptions.length])

  const filteredPartners = partners

  useEffect(() => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => filteredPartners.some((partner) => partner.id === id))
      )
      if (next.size === prev.size) {
        return prev
      }
      return next
    })
  }, [filteredPartners])

  const totalPartnersCount = pagination.total_items ?? 0
  const effectivePage = pagination.page ?? page
  const effectivePageSize = pagination.page_size ?? pageSize
  const totalPartnerPages = Math.max(1, pagination.total_pages ?? 1)

  const partnerPageBounds = useMemo(() => {
    if (!filteredPartners.length) {
      return { start: 0, end: 0 }
    }
    const start = (effectivePage - 1) * effectivePageSize + 1
    const end = start + filteredPartners.length - 1
    return { start, end }
  }, [effectivePage, effectivePageSize, filteredPartners])

  const areAllFilteredSelected =
    filteredPartners.length > 0 &&
    filteredPartners.every((partner) => selectedPartnerIds.has(partner.id))
  const hasSelection = selectedPartnerIds.size > 0
  const hasPartialSelection = hasSelection && !areAllFilteredSelected

  const selectAllCheckboxRef = useRef(null)

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = hasPartialSelection
    }
  }, [hasPartialSelection])

  const handleSelectAll = () => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev)
      if (areAllFilteredSelected) {
        filteredPartners.forEach((partner) => {
          next.delete(partner.id)
        })
      } else {
        filteredPartners.forEach((partner) => {
          if (partner.id != null) {
            next.add(partner.id)
          }
        })
      }
      return next
    })
  }

  const togglePartnerSelection = (partnerId) => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev)
      if (next.has(partnerId)) {
        next.delete(partnerId)
      } else {
        next.add(partnerId)
      }
      return next
    })
  }

  const handleDeleteClick = (partner) => {
    setDeleteModalState({ isOpen: true, partner })
  }

  const handleDelete = async () => {
    const partner = deleteModalState.partner
    if (!partner) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/partners/${partner.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete partner.')
      }
      setPartners((prev) => prev.filter((item) => item.id !== partner.id))
      setSelectedPartnerIds((prev) => {
        if (!prev.has(partner.id)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(partner.id)
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
        title: 'Partner deleted',
        message: `${partner.name} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete partner.',
        variant: 'error',
      })
    } finally {
      setDeleteModalState({ isOpen: false, partner: null })
    }
  }

  const handleDownload = async () => {
    let rowsToExport = []

    if (hasSelection) {
      rowsToExport = filteredPartners.filter((partner) => selectedPartnerIds.has(partner.id))
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

          const response = await fetch(`${API_BASE}/partners/?${params.toString()}`, {
            credentials: 'include',
            headers: appendAuthHeader(),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch partners for export (${response.status})`)
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

        rowsToExport = allResults.map((partner) => ({
          id: partner.id,
          name: partner.name?.trim() || 'Unnamed partner',
          company_name: partner.company_name?.trim() || 'N/A',
          company_type: partner.company_type || null,
          company_type_label: partner.company_type_label || partner.company_type || 'N/A',
          email: partner.email?.trim() || 'N/A',
          phone_e164: partner.phone_e164?.trim() || 'N/A',
          notes: partner.notes?.trim() || 'N/A',
        }))
      } catch (error) {
        console.error('Failed to fetch all partners for export:', error)
        showToast({
          title: 'Export failed',
          message: 'Failed to fetch all partners. Please try again.',
          variant: 'error',
        })
        return
      }
    }

    if (!rowsToExport.length) {
      showToast({
        title: 'Export failed',
        message: 'No partner data to export.',
        variant: 'error',
      })
      return
    }

    const dataRows = rowsToExport.map((partner, index) => ({
      '#': index + 1,
      Name: partner.name,
      'Company Type': partner.company_type_label || partner.company_type || 'N/A',
      Email: partner.email,
      Phone: partner.phone_e164,
      Notes: partner.notes,
    }))

    const headers = ['#', 'Name', 'Company Type', 'Email', 'Phone', 'Notes']

    downloadCsv({
      headers,
      rows: dataRows,
      filename: `partners_${new Date().toISOString().slice(0, 10)}.csv`,
    })

    showToast({
      title: 'Export successful',
      message: `Exported ${rowsToExport.length} partner(s).`,
      variant: 'success',
    })
  }

  const handlePartnersPageChange = (nextPage) => {
    setPage((prev) => {
      const target = Math.min(Math.max(1, nextPage), totalPartnerPages)
      return target === prev ? prev : target
    })
  }

  const handlePartnersPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    if (size === pageSize) {
      return
    }
    setPageSize(size)
    setPage(1)
  }

  const partnerPageSizeOptions = useMemo(() => {
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
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Partners' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Partners</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredPartners.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
          <button
            type="button"
            className="primary-add-button"
            onClick={() => navigate('/partners/new')}
          >
            <AddPartnerIcon />
            <span className="primary-add-button__label">Add Partner</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="partners" />

      <div className="stations-filters">
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="partner-search">
            Search partners by name
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
              id="partner-search"
              className="filter-search__input"
              placeholder="Search partners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CountryFilterMenu
          id="partner-country-filter"
          title="Country"
          value={selectedCountry}
          options={countries}
          onChange={(nextValue) => {
            setSelectedCountry(nextValue)
            setPage(1)
          }}
        />
        <div className="filter-field">
          <label className="sr-only">Filter partners by company type</label>
          <div
            className={`multi-select ${isCompanyTypeMenuOpen ? 'open' : ''}`}
            ref={companyTypeMenuRef}
          >
            <button
              type="button"
              className="multi-select-trigger"
              aria-haspopup="dialog"
              aria-expanded={isCompanyTypeMenuOpen}
              aria-controls="company-type-filter-menu"
              onClick={handleCompanyTypeMenuToggle}
            >
              {selectedCompanyTypes.size > 0
                ? `${selectedCompanyTypes.size} selected`
                : 'Company type'}
            </button>
            {isCompanyTypeMenuOpen ? (
              <div
                id="company-type-filter-menu"
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
      {isLoading ? <p className="data-placeholder">Loading partners…</p> : null}

      {!isLoading && !error && filteredPartners.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div className="chargers-table-header" style={{ gridTemplateColumns: 'minmax(32px, 0.4fr) minmax(40px, 0.5fr) 1.5fr 1.5fr 1.5fr 1.5fr 0.7fr' }}>
              <div className="charger-cell charger-select-cell">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  className="select-checkbox"
                  checked={filteredPartners.length > 0 && areAllFilteredSelected}
                  onChange={handleSelectAll}
                  aria-label={
                    areAllFilteredSelected ? 'Clear partner selection' : 'Select all partners'
                  }
                />
              </div>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">Name</div>
              <div className="charger-cell">Company Type</div>
              <div className="charger-cell">Email</div>
              <div className="charger-cell">Phone</div>
              <div className="charger-cell charger-actions-cell"></div>
            </div>
          {filteredPartners.map((partner, index) => {
            const rowNumber = partnerPageBounds.start + index
            return (
              <article
                key={partner.id}
                className={`charger-row clickable ${
                  selectedPartnerIds.has(partner.id) ? 'selected' : ''
                }`}
                style={{ gridTemplateColumns: 'minmax(32px, 0.4fr) minmax(40px, 0.5fr) 1.5fr 1.5fr 1.5fr 1.5fr 0.7fr' }}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if (
                    event.target instanceof HTMLElement &&
                    event.target.closest('.charger-select-cell')
                  ) {
                    return
                  }
                  navigate(`/partners/${partner.id}`)
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
                    navigate(`/partners/${partner.id}`)
                  }
                }}
              >
                <div className="charger-cell charger-select-cell">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    checked={selectedPartnerIds.has(partner.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      togglePartnerSelection(partner.id)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${partner.name}`}
                  />
                </div>
                <div className="charger-cell order">{rowNumber}</div>
                <div className="charger-cell">
                  <div className="station-name-cell" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{partner.name}</span>
                  </div>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {partner.company_type_label || partner.company_type || '—'}
                  </span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{partner.email || '—'}</span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{partner.phone_e164 || '—'}</span>
                </div>
                <div className="charger-cell charger-actions-cell">
                  <StationActionMenu
                    onEdit={() => navigate(`/partners/${partner.id}/edit`)}
                    onDelete={() => handleDeleteClick(partner)}
                  />
                </div>
              </article>
            )
          })}
          <footer className="chargers-footer">
            <div className="pagination-info">
              {totalPartnersCount
                ? `Showing ${partnerPageBounds.start}-${partnerPageBounds.end} of ${totalPartnersCount} partners`
                : 'No partners to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePartnersPageChange(effectivePage - 1)}
                disabled={effectivePage <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {effectivePage} of {totalPartnerPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePartnersPageChange(effectivePage + 1)}
                disabled={effectivePage >= totalPartnerPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="partner-page-size">Rows per page</label>
              <select
                id="partner-page-size"
                value={effectivePageSize}
                onChange={handlePartnersPageSizeChange}
                disabled={isLoading}
              >
                {partnerPageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </footer>
        </div>
      </div>
      ) : null}

      {!isLoading && !error && filteredPartners.length === 0 ? (
        <div className="data-placeholder">
          {search.trim() ? 'No partners found matching your search.' : 'No partners found.'}
        </div>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, partner: null })}
        onConfirm={handleDelete}
        title="Delete Partner"
        itemName={deleteModalState.partner?.name}
        confirmationMessage={
          deleteModalState.partner
            ? `Are you sure you want to delete "${deleteModalState.partner.name}"?`
            : undefined
        }
      />
    </div>
  )
}

export default Partners

