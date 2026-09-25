import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import ConnectorRemoteActionsDrawer from './ConnectorRemoteActionsDrawer'
import { CONNECTOR_STATUS_BACKGROUNDS, CONNECTOR_STATUS_COLORS } from '@/utils/status'
import '@/styles/dashboard.css'

const getConnectorDeleteErrorMessage = (message) => {
  if (!message) {
    return 'Unable to delete connector.'
  }
  const normalized = message.toLowerCase()
  if (normalized.includes('charger_log')) {
    return 'This connector has charger logs associated with it and cannot be deleted. Remove the related logs before retrying.'
  }
  if (normalized.includes('foreign') && normalized.includes('key')) {
    return 'This connector is still referenced by other records and cannot be deleted.'
  }
  return message
}

const normalizeBoolean = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false
  }
  return null
}

const renderToggleIndicator = (value, label) => {
  if (value === null || value === undefined) {
    return '-'
  }
  const isOn = Boolean(value)
  return (
    <button
      type="button"
      className={`package-toggle-button ${isOn ? 'is-active' : ''}`}
      aria-pressed={isOn}
      aria-label={`${label}: ${isOn ? 'On' : 'Off'}`}
      tabIndex={-1}
    >
      <span className="package-toggle-circle" />
    </button>
  )
}

function ConnectorDetails() {
  const { connectorId } = useParams()
  const navigate = useNavigate()
  const toast = useInlineToast('connectors')
  const [connector, setConnector] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRemoteOpen, setRemoteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })

  useEffect(() => {
    if (!connectorId) {
      return
    }
    const controller = new AbortController()
    const loadConnector = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/connectors/${connectorId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load connector details.')
        }
        const data = await response.json()
        if (!controller.signal.aborted) {
          setConnector(data)
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load connector', fetchError)
          setError(fetchError.message || 'Unable to load connector details.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadConnector()
    return () => controller.abort()
  }, [connectorId])

  const statusPill = useMemo(() => {
    if (!connector?.status) {
      return null
    }
    const status = connector.status
    const value = status.value || status.status || ''
    const label = status.label || status.status_label || value
    const color = status.color || CONNECTOR_STATUS_COLORS[value] || '#3E4F44'
    const background =
      status.background || CONNECTOR_STATUS_BACKGROUNDS[value] || 'rgba(1, 19, 9, 0.08)'
    return (
      <span className="status-pill connector-status-pill" style={{ color, backgroundColor: background }}>
        {label}
      </span>
    )
  }, [connector?.status])

  const handleDeleteClick = () => {
    if (!connector?.id || isDeleting) {
      return
    }
    setDeleteModalState({ isOpen: true })
  }

  const handleDelete = async () => {
    if (!connector?.id || isDeleting) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/connectors/${connector.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error('Unable to delete connector.')
      }
      toast.pushSuccess('Connector deleted.')
      navigate('/connectors')
    } catch (deleteError) {
      console.error('Failed to delete connector', deleteError)
      toast.pushError(getConnectorDeleteErrorMessage(deleteError.message))
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }

  const showInMobileValue = normalizeBoolean(connector?.show_in_mobile ?? connector?.showInMobile)

  const overviewItems = [
    { label: 'Connector Name', value: connector?.connector_name || '—' },
    { label: 'Connector Number', value: connector?.connector_number ?? '—' },
    { label: 'Identifier', value: connector?.identifier || '—' },
    { label: 'Power Type', value: connector?.energy_type?.label || connector?.energy_type_value || '—' },
    { label: 'Plug Type', value: connector?.plug_type || '—' },
    { label: 'Power (kW)', value: connector?.power_kw ?? '—' },
    { label: 'Voltage (V)', value: connector?.voltage ?? '—' },
    { label: 'Current (A)', value: connector?.amperage ?? '—' },
    { label: 'Status' + (connector?.availability_override ? ' (Manual)' : ' (Auto)'), value: statusPill || '—', isStatus: true },
    {
      label: 'Show in Mobile',
      value: renderToggleIndicator(showInMobileValue, 'Show in Mobile'),
      isToggle: true,
    },
  ]

  const chargerItems = [
    { label: 'Charger', value: connector?.charger?.name || connector?.charger_name || '—' },
    { label: 'Charger Box ID', value: connector?.charger_box_id || '—' },
    { label: 'Station', value: connector?.charger?.station?.name || '—' },
    { label: 'Governorate', value: connector?.governorate || connector?.charger?.station?.governorate || '—' },
    { label: 'Last Status Change', value: connector?.last_status_change || '—' },
    { label: 'Meter Serial', value: connector?.meter_serial || '—' },
    { label: 'Locked', value: connector?.is_locked ? 'Yes' : 'No' },
  ]

  const title = connector?.connector_name || connector?.identifier || 'Connector Details'

  return (
    <section className="stations-page connector-details-page">
      <header className="stations-header connector-details-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Connectors', to: '/connectors' },
                { label: title },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/connectors" ariaLabel="Back to connectors" />
              <h1>{title}</h1>
            </div>
            {connector?.charger_name ? (
              <p className="page-heading-subtitle">Charger: {connector.charger_name}</p>
            ) : null}
          </div>
        </div>
        <div className="stations-header-actions connector-details-actions">
          <button
            type="button"
            className="connector-remote-button"
            onClick={() => setRemoteOpen(true)}
            disabled={!connector}
          >
            Remote Actions
          </button>
          
          
          <button type="button" className="ghost-button danger" onClick={handleDeleteClick} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            className="connector-edit-button"
            onClick={() => navigate(`/connectors/${connectorId}/edit`)}
          >
            Edit
          </button>
        </div>
      </header>

      <InlineToastRegion region="connectors" />

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading connector…</p> : null}

      {!isLoading && !error && connector ? (
        <div className="connector-details-grid">
          <section className="station-card connector-info-card">
            <header>
              <h2>Connector Overview</h2>
              <p>Key technical details for this connector.</p>
            </header>
            <div className="connector-info-grid">
              {overviewItems.map((item) => (
                <div className="connector-info-item" key={item.label}>
                  <span>{item.label}</span>
                  {item.isStatus || item.isToggle ? item.value : <strong>{item.value}</strong>}
                </div>
              ))}
            </div>
          </section>

          <section className="station-card connector-info-card">
            <header>
              <h2>Linked Assets</h2>
              <p>Charging asset and location details.</p>
            </header>
            <div className="connector-info-grid">
              {chargerItems.map((item) => (
                <div className="connector-info-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value || '—'}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <ConnectorRemoteActionsDrawer
        connector={connector}
        isOpen={isRemoteOpen}
        onClose={() => setRemoteOpen(false)}
      />

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Connector"
        itemName={
          connector?.connector_name ||
          connector?.identifier ||
          (connector?.connector_number != null ? `Connector #${connector.connector_number}` : '')
        }
        confirmationMessage={
          connector
            ? `Are you sure you want to delete ${
                connector.connector_name ||
                connector.identifier ||
                (connector.connector_number != null ? `Connector #${connector.connector_number}` : 'this connector')
              }?`
            : undefined
        }
      />
    </section>
  )
}

export default ConnectorDetails
