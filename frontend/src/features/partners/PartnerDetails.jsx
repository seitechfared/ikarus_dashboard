import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import '@/styles/dashboard.css'

function PartnerDetails() {
  const navigate = useNavigate()
  const { partnerId } = useParams()
  const { showToast } = useInlineToast('partners')

  const [partner, setPartner] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })

  useEffect(() => {
    if (!partnerId) {
      navigate('/partners', { replace: true })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadPartner = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/partners/${partnerId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Partner not found.')
          }
          throw new Error(`Failed to load partner (${response.status})`)
        }

        const data = await response.json()
        if (!cancelled) {
          setPartner(data)
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setError(loadError.message || 'Unable to load partner.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPartner()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [partnerId, navigate])

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  const handleEditClick = useCallback(() => {
    navigate(`/partners/${partnerId}/edit`)
  }, [navigate, partnerId])

  const handleDeleteClick = useCallback(() => {
    if (!partner) {
      return
    }
    setDeleteModalState({ isOpen: true })
  }, [partner])

  const handleDelete = useCallback(async () => {
    if (!partner) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/partners/${partnerId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete partner.')
      }
      showToast({
        title: 'Partner deleted',
        message: `${partner.name} was removed successfully.`,
        variant: 'success',
      })
      navigate('/partners', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete partner.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }, [partner, partnerId, navigate, showToast])

  if (isLoading) {
    return (
      <div className="stations-page">
        <p className="data-placeholder">Loading partner details…</p>
      </div>
    )
  }

  if (error || !partner) {
    return (
      <div className="stations-page">
        <div className="data-warning">{error || 'Partner not found.'}</div>
      </div>
    )
  }

  const infoColumnStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 200px',
    minWidth: '200px',
  }

  const infoLabelStyle = {
    color: 'var(--Netural-600, #67716B)',
    fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: 400,
    lineHeight: '24px',
  }

  const infoValueStyle = {
    color: 'var(--Primary, #011309)',
    fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: 500,
    lineHeight: '24px',
  }

  const profileImageUrl = partner.profile_image ? buildMediaUrl(partner.profile_image) : null

  return (
    <div className="stations-page charger-details-page">
      <header className="stations-header connector-details-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Partners', to: '/partners' },
                { label: partner.name },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/partners" ariaLabel="Back to partners" />
              <h1>{partner.name}</h1>
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

      <InlineToastRegion region="partners" />

      <div className="charger-details-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Profile Card */}
          <div
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
            }}
          >
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={partner.name}
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
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
                {partner.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#011309' }}>{partner.name}</h2>
      
            </div>
          </div>

          {/* Company Details Card */}
          <div
            style={{
              padding: '16px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Company Details
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Company Name</span>
                <span style={infoValueStyle}>
                  {partner.company_name || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Company Type</span>
                <span style={infoValueStyle}>
                  {partner.company_type_label || partner.company_type || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Person Card */}
          <div
            style={{
              padding: '16px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Contact Person
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>First Name</span>
                <span style={infoValueStyle}>
                  {partner.first_name || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Last Name</span>
                <span style={infoValueStyle}>
                  {partner.last_name || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Job Title</span>
                <span style={infoValueStyle}>
                  {partner.job_title || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details Card */}
          <div
            style={{
              padding: '16px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Contact Details
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Email</span>
                <span style={infoValueStyle}>
                  {partner.email || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Phone</span>
                <span style={infoValueStyle}>
                  {partner.phone_e164 || '—'}
                </span>
              </div>
            </div>
            {partner.notes ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={infoLabelStyle}>Notes</span>
                <span style={infoValueStyle}>{partner.notes}</span>
              </div>
            ) : null}
          </div>

          {/* Address Details Card */}
          <div
            style={{
              padding: '16px',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#011309' }}>
              Address Details
            </h3>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '24px',
                flexWrap: 'wrap',
              }}
            >
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Street</span>
                <span style={infoValueStyle}>
                  {partner.street || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>City</span>
                <span style={infoValueStyle}>
                  {partner.city_name || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Zip Code</span>
                <span style={infoValueStyle}>
                  {partner.zip_code || '—'}
                </span>
              </div>
              <div style={infoColumnStyle}>
                <span style={infoLabelStyle}>Country</span>
                <span style={infoValueStyle}>
                  {partner.country_name || partner.country_code || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Partner"
        itemName={partner.name}
        confirmationMessage={
          partner ? `Are you sure you want to delete "${partner.name}"?` : undefined
        }
      />
    </div>
  )
}

export default PartnerDetails
