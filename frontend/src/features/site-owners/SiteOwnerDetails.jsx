import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { getThemeColors } from '@/utils/theme'
import { hexToRgba } from '@/utils/color'
import '@/styles/dashboard.css'
import { buildMediaUrl } from '@/utils/media'

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

function SiteOwnerDetails() {
  const navigate = useNavigate()
  const { siteOwnerId } = useParams()
  const { showToast } = useInlineToast('site-owners')

  const [siteOwner, setSiteOwner] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })

  useEffect(() => {
    if (!siteOwnerId) {
      navigate('/site-owners', { replace: true })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadSiteOwner = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/site-owners/${siteOwnerId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Site owner not found.')
          }
          throw new Error(`Failed to load site owner (${response.status})`)
        }

        const data = await response.json()
        if (!cancelled) {
          setSiteOwner(data)
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setError(loadError.message || 'Unable to load site owner.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSiteOwner()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [siteOwnerId, navigate])

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  const handleEditClick = useCallback(() => {
    navigate(`/site-owners/${siteOwnerId}/edit`)
  }, [navigate, siteOwnerId])

  const handleDeleteClick = useCallback(() => {
    if (!siteOwner) {
      return
    }
    setDeleteModalState({ isOpen: true })
  }, [siteOwner])

  const handleDelete = useCallback(async () => {
    if (!siteOwner) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/site-owners/${siteOwnerId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete site owner.')
      }
      showToast({
        title: 'Site owner deleted',
        message: `${siteOwner.name} was removed successfully.`,
        variant: 'success',
      })
      navigate('/site-owners', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete site owner.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }, [siteOwner, siteOwnerId, navigate, showToast])

  if (isLoading) {
    return (
      <div className="stations-page">
        <p className="data-placeholder">Loading site owner details…</p>
      </div>
    )
  }

  if (error || !siteOwner) {
    return (
      <div className="stations-page">
        <div className="data-warning">{error || 'Site owner not found.'}</div>
      </div>
    )
  }

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
  const statusLabel = siteOwner.status_label || siteOwner.status || '—'
  const validFromLabel = formatDate(siteOwner.valid_from)
  const validToLabel = formatDate(siteOwner.valid_to)
  const createdAtLabel = formatDate(siteOwner.created_at)
  const contactFullName =
    [siteOwner.contact_first_name, siteOwner.contact_last_name].filter(Boolean).join(' ') || '—'
  const loginEmail = siteOwner.email || '—'
  const contactEmail = siteOwner.contact_email || '—'
  const contactPhone = siteOwner.contact_phone_e164 || '—'
  const loginPhone = siteOwner.phone_e164 || '—'
  const locationSummary =
    [siteOwner.country_name, siteOwner.city_name].filter(Boolean).join(', ') || '—'
  const streetValue = siteOwner.street || '—'
  const partnerName = siteOwner.partner_name || '—'
  const companyType = siteOwner.company_type_label || siteOwner.company_type || '—'
  const ownerCode = siteOwner.owner_code || '—'
  const internalNumber = siteOwner.internal_client_number || '—'
  const displayName = siteOwner.display_name || '—'
  const companyName = siteOwner.company_name || '—'

  const cardStyle = {
    padding: '16px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const infoGridStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '24px',
    width: '100%',
  }

  const infoCellStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 220px',
    minWidth: '200px',
  }

  const infoLabelStyle = {
    margin: 0,
    color: 'var(--Netural-600, #67716B)',
    fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '24px',
  }
  const infoValueStyle = {
    margin: 0,
    color: 'var(--Primary, #011309)',
    fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: '24px',
  }

  const renderStatusBadge = () => {
    const themeColors = getThemeColors()
    const value = siteOwner.status || 'active'
    const label = statusLabel || 'Status'
    let backgroundColor = hexToRgba(themeColors.secondary, 0.15) || 'rgba(18, 77, 94, 0.15)'
    let textColor = themeColors.secondary
    if (value === 'active') {
      backgroundColor = 'rgba(46, 165, 98, 0.12)'
      textColor = '#2EA561'
    } else if (value === 'inactive') {
      backgroundColor = 'rgba(62, 79, 68, 0.12)'
      textColor = '#3E4F44'
    } else if (value === 'on_hold') {
      backgroundColor = 'rgba(222, 142, 21, 0.12)'
      textColor = '#DE8E15'
    } else if (value === 'blocked') {
      backgroundColor = 'rgba(237, 74, 74, 0.12)'
      textColor = '#ED4A4A'
    }
    return (
      <span
        className="status-badge charger-status-badge"
        style={{
          backgroundColor,
          color: textColor,
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <div className="stations-page charger-details-page">
      <header className="stations-header connector-details-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Site Owners', to: '/site-owners' },
                { label: siteOwner.name },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/site-owners" ariaLabel="Back to site owners" />
              <h1>{siteOwner.name}</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions connector-details-actions">
          <button
            type="button"
            className="ghost-button danger"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            className="connector-edit-button"
            onClick={handleEditClick}
          >
            Edit
          </button>
        </div>
      </header>

      <InlineToastRegion region="site-owners" />

      <div className="charger-details-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: '24px' }}>
            {siteOwner.profile_image ? (
              <img
                src={buildMediaUrl(siteOwner.profile_image)}
                alt={siteOwner.name}
                style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  backgroundColor: '#F2F3F3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#67716B',
                  fontSize: '24px',
                  fontWeight: 600,
                }}
              >
                {siteOwner.name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#011309' }}>
                {siteOwner.name}
              </h2>
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Owner Details
            </h3>
            <div style={infoGridStyle}>
              {[
                { label: 'Code', value: ownerCode },
                { label: 'Internal client number', value: internalNumber },
                { label: 'Status', render: renderStatusBadge },
                { label: 'Valid from', value: validFromLabel },
                { label: 'Valid to', value: validToLabel },
              ].map((item) => (
                <div key={item.label} style={infoCellStyle}>
                  <p style={infoLabelStyle}>{item.label}</p>
                  {item.render ? (
                    item.render()
                  ) : (
                    <p style={infoValueStyle}>{item.value || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Company Details
            </h3>
            <div style={infoGridStyle}>
              {[
                { label: 'Company name', value: companyName },
                { label: 'Company type', value: companyType },
              ].map((item) => (
                <div key={item.label} style={infoCellStyle}>
                  <p style={infoLabelStyle}>{item.label}</p>
                  <p style={infoValueStyle}>{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Contact &amp; Location
            </h3>
            <div style={infoGridStyle}>
              {[
                { label: 'Contact person', value: contactFullName },
                { label: 'Contact email', value: contactEmail },
                { label: 'Contact phone', value: contactPhone },
                { label: 'Location', value: locationSummary },
                { label: 'Address', value: streetValue },
              ].map((item) => (
                <div key={item.label} style={infoCellStyle}>
                  <p style={infoLabelStyle}>{item.label}</p>
                  <p style={infoValueStyle}>{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Site Owner"
        itemName={siteOwner.name}
        confirmationMessage={
          siteOwner ? `Are you sure you want to delete "${siteOwner.name}"?` : undefined
        }
      />
    </div>
  )
}

export default SiteOwnerDetails

