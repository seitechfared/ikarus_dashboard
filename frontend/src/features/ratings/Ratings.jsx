import { useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import CountryFilterMenu from '@/components/CountryFilterMenu'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 30, label: '30 / page' },
  { value: 50, label: '50 / page' },
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

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
      fill="url(#paint0_linear_rating)"
    />
    <defs>
      <linearGradient id="paint0_linear_rating" x1="9.99998" y1="2.01737" x2="9.99998" y2="17.984" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE61C" />
        <stop offset="1" stopColor="#FFA929" />
      </linearGradient>
    </defs>
  </svg>
)

const renderStars = (rating) => {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  for (let i = 0; i < fullStars; i++) {
    stars.push(<StarIcon key={i} />)
  }
  if (hasHalfStar && fullStars < 5) {
    stars.push(
      <svg key="half" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="paint0_linear_half">
            <stop offset="0%" stopColor="#FFE61C" />
            <stop offset="50%" stopColor="#FFA929" />
            <stop offset="50%" stopColor="#E0E0E0" />
            <stop offset="100%" stopColor="#E0E0E0" />
          </linearGradient>
        </defs>
        <path
          d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
          fill="url(#paint0_linear_half)"
        />
      </svg>
    )
  }
  for (let i = stars.length; i < 5; i++) {
    stars.push(
      <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
          fill="#E0E0E0"
        />
      </svg>
    )
  }
  return stars
}

function Ratings() {
  const { showToast } = useInlineToast('ratings')

  const [feedbacks, setFeedbacks] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    email: '',
    country: '',
  })
  const [countries, setCountries] = useState([])
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

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

    const loadFeedbacks = async () => {
      setIsLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (debouncedFilters.email.trim()) {
          params.set('email', debouncedFilters.email.trim())
        }
        if (debouncedFilters.country.trim()) {
          params.set('country', debouncedFilters.country.trim())
        }

        const response = await fetch(`${API_BASE}/feedback/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch feedback (${response.status})`)
        }

        const data = await response.json()
        if (!cancelled) {
          const normalized = (Array.isArray(data) ? data : []).map((feedback) => ({
            id: feedback.id,
            email: feedback.email,
            rating: feedback.rating,
            comment: feedback.comment,
            submitted_at: feedback.submitted_at,
          }))
          setFeedbacks(normalized)
        }
      } catch (loadError) {
        if (!cancelled && loadError.name !== 'AbortError') {
          console.error(loadError)
          setFeedbacks([])
          setError('Unable to load feedback.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadFeedbacks()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedFilters])

  const filteredFeedbacks = useMemo(() => {
    return feedbacks
  }, [feedbacks])

  const paginatedFeedbacks = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filteredFeedbacks.slice(start, end)
  }, [filteredFeedbacks, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredFeedbacks.length / pageSize))
  const averageRating = useMemo(() => {
    if (filteredFeedbacks.length === 0) return 0
    const sum = filteredFeedbacks.reduce((acc, fb) => acc + (fb.rating || 0), 0)
    return sum / filteredFeedbacks.length
  }, [filteredFeedbacks])

  const handleDownload = () => {
    if (!filteredFeedbacks.length) {
      showToast({
        title: 'Export failed',
        message: 'No feedback data to export.',
        variant: 'error',
      })
      return
    }

    const dataRows = filteredFeedbacks.map((feedback, index) => ({
      '#': index + 1,
      Date: feedback.submitted_at
        ? new Date(feedback.submitted_at).toLocaleDateString()
        : 'N/A',
      Email: feedback.email || 'N/A',
      Rating: feedback.rating || 'N/A',
      Comment: feedback.comment || 'N/A',
    }))

    const headers = ['#', 'Date', 'Email', 'Rating', 'Comment']

    downloadCsv({
      headers,
      rows: dataRows,
      filename: `ratings_feedback_${new Date().toISOString().slice(0, 10)}.csv`,
    })

    showToast({
      title: 'Export successful',
      message: `Exported ${filteredFeedbacks.length} feedback entry(ies).`,
      variant: 'success',
    })
  }

  const handlePageChange = (nextPage) => {
    setPage(Math.min(Math.max(1, nextPage), totalPages))
  }

  const handlePageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_PAGE_SIZE
    setPageSize(size)
    setPage(1)
  }

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const totalReviews = filteredFeedbacks.length
  const positiveReviews = filteredFeedbacks.filter((entry) => (entry.rating || 0) >= 4).length

  return (
    <div className="stations-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Rating & Feedback' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Rating & Feedback</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="download-button"
            onClick={handleDownload}
            disabled={!filteredFeedbacks.length}
          >
            <DownloadIcon />
            <span className="download-button__label">Download</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="ratings" />

      {totalReviews > 0 ? (
        <div className="rating-overview-card">
          <div className="rating-overview-header">
            <span className="rating-overview-title">Rating Average</span>
            <div className="rating-overview-icon">
              <StarIcon />
            </div>
          </div>
          <div className="rating-overview-body">
            <div className="rating-overview-score">
              <span className="rating-overview-value">{averageRating.toFixed(1)}</span>
              <div className="rating-overview-score-star">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M12 18.9556L7.31298 21.4196C6.30298 21.9506 5.12298 21.0936 5.31498 19.9686L6.20998 14.7486L2.41798 11.0506C1.59998 10.2546 2.05098 8.86663 3.17998 8.70063L8.42198 7.94063L10.765 3.19062C11.27 2.16562 12.729 2.16562 13.235 3.19062L15.578 7.94063L20.82 8.70063C21.949 8.86563 22.4 10.2526 21.583 11.0506L17.79 14.7486L18.685 19.9686C18.877 21.0936 17.697 21.9516 16.687 21.4196L12 18.9556Z"
                    fill="url(#ratingCardStar)"
                  />
                  <defs>
                    <linearGradient id="ratingCardStar" x1="12" y1="2.42163" x2="12" y2="21.5816" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FFE61C" />
                      <stop offset="1" stopColor="#FFA929" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            <div className="rating-overview-meta">
              <div className="rating-overview-meta-item">
                <span className="rating-overview-meta-value">{positiveReviews}</span>
                <span className="rating-overview-meta-label">Positive</span>
              </div>
              <div className="rating-overview-meta-item">
                <span className="rating-overview-meta-value">{Math.max(totalReviews - positiveReviews, 0)}</span>
                <span className="rating-overview-meta-label">Other</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="stations-filters">
        <div className="filter-field search-field">
          <label className="sr-only" htmlFor="feedback-email-filter">
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
              id="feedback-email-filter"
              className="filter-search__input"
              placeholder="Filter by email..."
              value={filters.email}
              onChange={(e) => updateFilter('email', e.target.value)}
            />
          </div>
        </div>
        <CountryFilterMenu
          id="feedback-country-filter"
          title="Country"
          value={filters.country}
          options={countries}
          onChange={(nextValue) => updateFilter('country', nextValue)}
        />
      </div>

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading feedback…</p> : null}

      {!isLoading && !error && paginatedFeedbacks.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div className="chargers-table" aria-busy={isLoading} style={{ width: '100%', minWidth: '100%' }}>
            <div className="chargers-table-header" style={{ gridTemplateColumns: 'minmax(40px, 0.5fr) 1.2fr 1.5fr 1fr 2fr' }}>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">Date</div>
              <div className="charger-cell">Email</div>
              <div className="charger-cell">Rating</div>
              <div className="charger-cell">Comment</div>
            </div>
          {paginatedFeedbacks.map((feedback, index) => {
            const rowNumber = (page - 1) * pageSize + index + 1
            return (
              <article key={feedback.id} className="charger-row" style={{ gridTemplateColumns: 'minmax(40px, 0.5fr) 1.2fr 1.5fr 1fr 2fr' }}>
                <div className="charger-cell order">{rowNumber}</div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {feedback.submitted_at
                      ? new Date(feedback.submitted_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{feedback.email || '—'}</span>
                </div>
                <div className="charger-cell">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feedback.rating || '—'}</span>
                    {feedback.rating && renderStars(feedback.rating)}
                  </div>
                </div>
                <div className="charger-cell">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{feedback.comment || '—'}</span>
                </div>
              </article>
            )
          })}
          </div>
          <footer className="chargers-footer">
            <div className="pagination-info">
              {filteredFeedbacks.length
                ? `Showing ${paginatedFeedbacks.length > 0 ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, filteredFeedbacks.length)} of ${filteredFeedbacks.length} feedback entries`
                : 'No feedback to display'}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="ghost-button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </button>
            </div>
            <div className="page-size-picker">
              <label htmlFor="rating-page-size">Rows per page</label>
              <select
                id="rating-page-size"
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
      ) : null}

      {!isLoading && !error && paginatedFeedbacks.length === 0 ? (
        <div className="data-placeholder">
          {Object.values(filters).some((f) => f.trim())
            ? 'No feedback found matching your filters.'
            : 'No feedback found.'}
        </div>
      ) : null}
    </div>
  )
}

export default Ratings

