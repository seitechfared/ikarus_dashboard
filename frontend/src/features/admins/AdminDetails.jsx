import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import '@/styles/dashboard.css'
import { formatAdminRoleLabel } from './adminRoleUtils'
import { deriveRoleCapabilities } from '@/utils/adminRoles'

const getInitials = (value) => {
  if (!value) {
    return 'A'
  }
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'A'
}

function AdminDetails() {
  const { adminId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useInlineToast('admins')
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canManageAdmins = roleCapabilities.canEdit

  const [admin, setAdmin] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  useEffect(() => {
    if (!adminId) return

    let cancelled = false
    const controller = new AbortController()

    const loadAdmin = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/admins/${adminId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })

        if (!response.ok) {
          throw new Error(`Failed to load admin (${response.status})`)
        }

        const data = await response.json()
        if (!cancelled) {
          setAdmin(data)
        }
      } catch (loadError) {
        if (!cancelled && loadError.name !== 'AbortError') {
          console.error(loadError)
          setError('Unable to load admin details.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadAdmin()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [adminId])

  const handleDelete = async () => {
    if (!canManageAdmins) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/admins/${adminId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })

      if (!response.ok) {
        throw new Error('Failed to delete admin')
      }

      showToast({
        title: 'Admin deleted',
        message: 'Admin has been removed successfully.',
        variant: 'success',
      })
      navigate('/admins')
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: 'Unable to delete admin.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }

  if (isLoading) {
    return (
      <div className="stations-page">
        <header className="stations-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs
                items={[
                  { label: 'Home', to: '/overview' },
                  { label: 'Admins', to: '/admins' },
                  { label: 'Admin Details' },
                ]}
              />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
                <h1>Admin Details</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="data-placeholder">Loading admin details…</div>
      </div>
    )
  }

  if (error && !admin) {
    return (
      <div className="stations-page">
        <header className="stations-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs
                items={[
                  { label: 'Home', to: '/overview' },
                  { label: 'Admins', to: '/admins' },
                  { label: 'Admin Details' },
                ]}
              />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
                <h1>Admin Details</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="data-warning">{error}</div>
      </div>
    )
  }

  if (!admin) {
    return null
  }

  const displayName =
    [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() ||
    admin.email ||
    'Admin'
  const heroEmail = admin.email || 'No email on file'
  const roleLabel = formatAdminRoleLabel(admin.role)
  const joinedDate = admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'

  const infoFields = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: admin.email || '—' },
    { label: 'Role', value: roleLabel },
    { label: 'Position', value: admin.position || '—' },
    { label: 'Date Joined', value: joinedDate },
  ]

  const headerActions = canManageAdmins ? (
    <div className="customer-details-actions connector-details-actions">
      <button
        type="button"
        className="customer-outline-button danger"
        onClick={() => setDeleteModalState({ isOpen: true })}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
      <button
        type="button"
        className="connector-edit-button"
        onClick={() => navigate(`/admins/${adminId}/edit`)}
        disabled={isDeleting}
      >
        Edit
      </button>
    </div>
  ) : null

  const renderInfoCard = () => (
    <section className="customer-card">
      <div className="customer-card-header">
        <h3>Admin Information</h3>
        <p>Primary details for this admin.</p>
      </div>
      <div className="customer-info-grid">
        {infoFields.map((field) => (
          <div className="customer-info-field" key={field.label}>
            <span className="customer-info-label">{field.label}</span>
            <span className="customer-info-value">{field.value}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const profileImageUrl = admin.profile_image ? buildMediaUrl(admin.profile_image) : null

  const avatarContent = profileImageUrl ? (
    <img src={profileImageUrl} alt={displayName} />
  ) : (
    getInitials(displayName)
  )

  return (
    <div className="customer-details-page admin-details-page">
      <header className="customer-details-header">
        <div className="customer-details-heading">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/overview' },
              { label: 'Admins', to: '/admins' },
              { label: displayName },
            ]}
          />
          <div className="customer-details-title">
            <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
            <h1>Admin Details</h1>
          </div>
        </div>
        {headerActions}
      </header>

      <InlineToastRegion region="admins" />

      <section className="customer-hero-card admin-hero-card">
        <div className="customer-hero-info">
          <div className="customer-hero-avatar">{avatarContent}</div>
          <div className="customer-hero-meta">
            <h2>{displayName}</h2>
            <p>{heroEmail}</p>
          </div>
        </div>
        <div className="customer-summary-grid">
          <div className="customer-summary-card">
            <span className="customer-summary-label">Role</span>
            <span className="customer-summary-value">{roleLabel}</span>
          </div>
          <div className="customer-summary-card">
            <span className="customer-summary-label">Date Joined</span>
            <span className="customer-summary-value">{joinedDate}</span>
          </div>
          
        </div>
      </section>

      {renderInfoCard()}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Admin"
        itemName={displayName}
        confirmationMessage="Are you sure you want to delete this admin?"
      />
    </div>
  )
}

export default AdminDetails
