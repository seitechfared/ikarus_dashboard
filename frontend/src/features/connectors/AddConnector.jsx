import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import PillDropdown from '@/components/ui/molecules/PillDropdown'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { validateName, validateNonNegativeNumber, validatePositiveNumber } from '@/utils/validation'
import { fetchAllPages } from '@/utils/fetchAllPages'
import '@/styles/dashboard.css'

const statusOptions = [
  { value: 'charging', label: 'Charging' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'faulted', label: 'Faulted' },
  { value: 'available', label: 'Available' },
]

const connectorTypes = [
  { value: 'ac', label: 'AC' },
  { value: 'dc', label: 'DC' },
]

const plugTypeOptions = [
  { value: 'Type 2', label: 'Type 2' },
  { value: 'CCS 2', label: 'CCS 2' },
  { value: 'CHAdeMO', label: 'CHAdeMO' },
  { value: 'GB/T DC', label: 'GB/T DC' },
  { value: 'Type 1', label: 'Type 1' },
  { value: 'CCS 1', label: 'CCS 1' },
  { value: 'GB/AC', label: 'GB/AC' },
  { value: 'Tesla', label: 'Tesla' },
]

const connectorFormatOptions = [
  { value: 'cable', label: 'Cable' },
  { value: 'socket', label: 'Socket' },
]

const defaultForm = {
  connectorNumber: '',
  connectorName: '',
  identifier: '',
  connectorType: 'ac',
  status: 'available',
  availabilityOverride: false,
  format: '',
  plugType: '',
  powerKw: '',
  voltage: '',
  amperage: '',
  meterSerial: '',
  isLocked: false,
  showInMobile: true,
  chargerId: '',
}

function AddConnector() {
  const { connectorId } = useParams()
  const navigate = useNavigate()
  const toast = useInlineToast('connectors')
  const isEditMode = Boolean(connectorId)

  const [form, setForm] = useState(defaultForm)
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState('')
  const [stationChargers, setStationChargers] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const controller = new AbortController()
    const fetchStations = async () => {
      try {
        const data = await fetchAllPages(`${API_BASE}/stations/`, {
          pageSize: 200,
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!controller.signal.aborted) {
          setStations(
            data
              .slice()
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          )
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load stations', fetchError)
          toast.pushError('Unable to load stations.')
        }
      }
    }
    fetchStations()
    return () => controller.abort()
  }, [toast])

  useEffect(() => {
    if (!selectedStation) {
      setStationChargers([])
      setForm((prev) => ({ ...prev, chargerId: '' }))
      return
    }
    const controller = new AbortController()
    const fetchChargers = async () => {
      try {
        const data = await fetchAllPages(`${API_BASE}/stations/${selectedStation}/chargers/`, {
          pageSize: 200,
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!controller.signal.aborted) {
          setStationChargers(Array.isArray(data) ? data : [])
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load chargers for station', fetchError)
          toast.pushError('Unable to load chargers for station.')
        }
      }
    }
    fetchChargers()
    return () => controller.abort()
  }, [selectedStation, toast])

  useEffect(() => {
    if (!isEditMode || !connectorId) {
      return
    }
    const controller = new AbortController()
    const loadConnector = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_BASE}/connectors/${connectorId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load connector.')
        }
        const data = await response.json()
        if (controller.signal.aborted) {
          return
        }
        if (data.charger?.station?.id) {
          setSelectedStation(data.charger.station.id)
        }
        setForm({
          connectorNumber: data.connector_number?.toString() || '',
          connectorName: data.connector_name || '',
          identifier: data.identifier || '',
          connectorType: data.energy_type_value || data.energy_type?.value || 'ac',
          status: data.status_value || data.status?.value || 'available',
          availabilityOverride: data.availability_override || false,
          format: data.format || '',
          plugType: data.plug_type || '',
          powerKw: data.power_kw?.toString() || '',
          voltage: data.voltage?.toString() || '',
          amperage: data.amperage?.toString() || '',
          meterSerial: data.meter_serial || '',
          isLocked: Boolean(data.is_locked),
          showInMobile: data.show_in_mobile !== false,
          chargerId: data.charger?.id || '',
        })
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error('Failed to load connector', fetchError)
          setErrors({ form: fetchError.message || 'Unable to load connector details.' })
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadConnector()
    return () => controller.abort()
  }, [connectorId, isEditMode])

  const currentStation = useMemo(
    () => stations.find((station) => station.id === selectedStation),
    [stations, selectedStation]
  )

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (errors[field] || errors.form) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        delete next.form
        return next
      })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!selectedStation) {
      nextErrors.station = 'Please select a station.'
    }
    if (!form.chargerId) {
      nextErrors.chargerId = 'Please select a charger.'
    }
    const connectorNumberError = validatePositiveNumber(form.connectorNumber, {
      required: true,
      label: 'Connector number',
    })
    if (connectorNumberError) {
      nextErrors.connectorNumber = connectorNumberError
    }
    const connectorNameError = validateName(form.connectorName, {
      required: false,
      label: 'Connector name',
    })
    if (connectorNameError) {
      nextErrors.connectorName = connectorNameError
    }
    const powerError = validateNonNegativeNumber(form.powerKw, { required: false, label: 'Power (kW)' })
    if (powerError) {
      nextErrors.powerKw = powerError
    }
    const voltageError = validateNonNegativeNumber(form.voltage, { required: false, label: 'Voltage (V)' })
    if (voltageError) {
      nextErrors.voltage = voltageError
    }
    const amperageError = validateNonNegativeNumber(form.amperage, { required: false, label: 'Current (A)' })
    if (amperageError) {
      nextErrors.amperage = amperageError
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.pushError('Please fix the highlighted fields.')
      return
    }

    const payload = {
      charger_id: form.chargerId,
      connector_number: Number(form.connectorNumber),
      connector_name: form.connectorName || undefined,
      identifier: form.identifier || undefined,
      connector_type: form.connectorType || undefined,
      status: form.status || undefined,
      availability_override: Boolean(form.availabilityOverride),
      format: form.format || undefined,
      plug_type: form.plugType || undefined,
      power_kw: form.powerKw ? Number(form.powerKw) : null,
      voltage: form.voltage ? Number(form.voltage) : null,
      amperage: form.amperage ? Number(form.amperage) : null,
      meter_serial: form.meterSerial || undefined,
      is_locked: Boolean(form.isLocked),
      show_in_mobile: Boolean(form.showInMobile),
    }

    setIsSaving(true)
    try {
      const response = await fetch(
        isEditMode ? `${API_BASE}/connectors/${connectorId}/` : `${API_BASE}/connectors/`,
        {
          method: isEditMode ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...appendAuthHeader(),
          },
          body: JSON.stringify(payload),
        }
      )
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to save connector.')
      }
      setErrors({})
      const savedConnector =
        data && typeof data === 'object' ? data.connector || data : null
      const nextConnectorId = savedConnector?.id ?? connectorId ?? savedConnector?.connector_id ?? null
      const connectorLabel =
        savedConnector?.connector_name ||
        savedConnector?.name ||
        savedConnector?.identifier ||
        form.connectorName ||
        form.identifier ||
        'Connector'
      toast.pushSuccess(`${connectorLabel} ${isEditMode ? 'updated' : 'created'} successfully.`)
      if (nextConnectorId) {
        navigate(`/connectors/${nextConnectorId}`, { replace: true })
      } else {
        navigate('/connectors', { replace: true })
      }
    } catch (submitError) {
      console.error('Failed to save connector', submitError)
      setErrors({ form: submitError.message || 'Unable to save connector.' })
      toast.pushError(submitError.message || 'Unable to save connector.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditMode && isLoading) {
    return (
      <div className="add-charger-page add-connector-page">
        <header className="add-charger-header add-connector-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Connectors', to: '/connectors' }, { label: 'Edit Connector' }]} />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/connectors" ariaLabel="Back to connectors" />
                <h1>Edit Connector</h1>
              </div>
            </div>
          </div>
        </header>
        <InlineToastRegion region="connectors" />
        <div className="connector-form-loading">Loading connector details…</div>
      </div>
    )
  }

  return (
    <div className="add-charger-page add-connector-page">
      <header className="add-charger-header add-connector-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Connectors', to: '/connectors' },
                { label: isEditMode ? 'Edit Connector' : 'Add Connector' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/connectors" ariaLabel="Back to connectors" />
              <h1>{isEditMode ? 'Edit Connector' : 'Add Connector'}</h1>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : isEditMode ? 'Save' : 'Save'}
        </button>
      </header>

      <InlineToastRegion region="connectors" />

      <form className="add-charger-form add-connector-form" onSubmit={handleSubmit} noValidate>
        <div className="add-charger-stage-container">
          <div className="add-charger-stage-content">
            {/* Link to Charger Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Link to Charger</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.station || errors.form ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Station <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <PillDropdown
                    id="connector-station"
                    value={selectedStation || ''}
                    onChange={(event) => {
                      setSelectedStation(event.target.value)
                      if (errors.station || errors.form) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.station
                          delete next.form
                          return next
                        })
                      }
                    }}
                    searchable
                    searchPlaceholder="Search stations"
                    options={[
                      { value: '', label: 'Select a station' },
                      ...stations.map((station) => ({
                        value: station.id,
                        label: `${station.name}${station.governorate ? ` (${station.governorate})` : ''}`,
                      })),
                    ]}
                  />
                  {errors.station || errors.form ? (
                    <span className="add-charger-field-error">{errors.station || errors.form}</span>
                  ) : null}
                </div>
                <div className={`add-charger-input-field${errors.chargerId ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Charger <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <PillDropdown
                    id="connector-charger"
                    value={form.chargerId || ''}
                    onChange={(event) => {
                      handleFieldChange('chargerId', event.target.value)
                      if (errors.chargerId) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.chargerId
                          return next
                        })
                      }
                    }}
                    searchable
                    searchPlaceholder="Search chargers"
                    options={[
                      { value: '', label: selectedStation ? 'Select a charger' : 'Select a station first' },
                      ...stationChargers.map((charger) => ({
                        value: charger.id,
                        label: charger.name || charger.ocpp_identifier || charger.serial_number || 'Unnamed charger',
                      })),
                    ]}
                    disabled={!selectedStation || stationChargers.length === 0}
                  />
                  {errors.chargerId ? <span className="add-charger-field-error">{errors.chargerId}</span> : null}
                </div>
                {currentStation?.governorate ? (
                  <div className="add-charger-input-field">
                    <div className="add-charger-input-header">
                      <span className="add-charger-input-label">Governorate</span>
                    </div>
                    <div className="add-charger-input-field-status">
                      <p style={{ margin: 0, padding: '10px 12px', color: '#011309' }}>{currentStation.governorate}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Connector Details Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Connector Details</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.connectorNumber ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Connector Number <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="number"
                      min="1"
                      value={form.connectorNumber}
                      onChange={(event) => handleFieldChange('connectorNumber', event.target.value)}
                      placeholder="Enter connector number"
                      required
                    />
                  </div>
                  {errors.connectorNumber ? (
                    <span className="add-charger-field-error">{errors.connectorNumber}</span>
                  ) : null}
                </div>
                <div className={`add-charger-input-field${errors.connectorName ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Connector Name</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.connectorName}
                      onChange={(event) => handleFieldChange('connectorName', event.target.value)}
                      placeholder="e.g. CCS 1"
                    />
                  </div>
                  {errors.connectorName ? (
                    <span className="add-charger-field-error">{errors.connectorName}</span>
                  ) : null}
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Identifier</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.identifier}
                      onChange={(event) => handleFieldChange('identifier', event.target.value)}
                      placeholder="Optional identifier"
                    />
                  </div>
                </div>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Connector Type</span>
                  </div>
                  <PillDropdown
                    id="connector-type"
                    value={form.connectorType || ''}
                    onChange={(event) => handleFieldChange('connectorType', event.target.value)}
                    options={[
                      { value: '', label: 'Select type' },
                      ...connectorTypes,
                    ]}
                  />
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Status</span>
                    <div className="manual-override-toggle" style={{marginLeft: 8}}>
                      <label className="manual-override-toggle-switch">
                        <input
                          type="checkbox"
                          checked={form.availabilityOverride}
                          onChange={(e) => handleFieldChange('availabilityOverride', e.target.checked)}
                        />
                        <span className="manual-override-toggle-slider"></span>
                      </label>
                      <span style={{ marginLeft: 8, fontSize: '14px', color: '#555' }}>{"(Manual)"}</span>
                    </div>
                  </div>
                  <PillDropdown
                    id="connector-status"
                    value={form.status || ''}
                    onChange={(event) => handleFieldChange('status', event.target.value)}
                    disabled={!form.availabilityOverride}
                    options={[
                      { value: '', label: 'Select status' },
                      ...statusOptions,
                    ]}
                  />
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Format</span>
                  </div>
                  <PillDropdown
                    id="connector-format"
                    value={form.format || ''}
                    onChange={(event) => handleFieldChange('format', event.target.value)}
                    options={[
                      { value: '', label: 'Select format' },
                      ...connectorFormatOptions,
                    ]}
                  />
                </div>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Plug Type</span>
                  </div>
                  <PillDropdown
                    id="connector-plug-type"
                    value={form.plugType || ''}
                    onChange={(event) => handleFieldChange('plugType', event.target.value)}
                    options={[
                      { value: '', label: 'Select plug type' },
                      ...plugTypeOptions,
                    ]}
                  />
                </div>
                <div className={`add-charger-input-field${errors.powerKw ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Power (kW)</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.powerKw}
                      onChange={(event) => handleFieldChange('powerKw', event.target.value)}
                      placeholder="Enter power"
                    />
                  </div>
                  {errors.powerKw ? <span className="add-charger-field-error">{errors.powerKw}</span> : null}
                </div>
                <div className={`add-charger-input-field${errors.voltage ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Voltage (V)</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.voltage}
                      onChange={(event) => handleFieldChange('voltage', event.target.value)}
                      placeholder="Enter voltage"
                    />
                  </div>
                  {errors.voltage ? <span className="add-charger-field-error">{errors.voltage}</span> : null}
                </div>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.amperage ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Current (A)</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.amperage}
                      onChange={(event) => handleFieldChange('amperage', event.target.value)}
                      placeholder="Enter current"
                    />
                  </div>
                  {errors.amperage ? <span className="add-charger-field-error">{errors.amperage}</span> : null}
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Meter Serial</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.meterSerial}
                      onChange={(event) => handleFieldChange('meterSerial', event.target.value)}
                      placeholder="Enter meter serial"
                    />
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Show in Mobile</span>
                  </div>
                  <div className="add-charger-input-field-status add-charger-input-field-status--transparent">
                    <button
                      type="button"
                      className={`add-charger-toggle-button ${form.showInMobile ? 'enabled' : ''}`}
                      onClick={() => handleFieldChange('showInMobile', !form.showInMobile)}
                      aria-pressed={form.showInMobile}
                      aria-label={`Show in Mobile: ${form.showInMobile ? 'On' : 'Off'}`}
                    >
                      <div className="add-charger-toggle-circle" />
                    </button>
                  </div>
                </div>
                {isEditMode ? (
                  <div className="add-charger-input-field">
                    <div className="add-charger-input-header">
                      <span className="add-charger-input-label">Locked</span>
                    </div>
                    <div className="add-charger-input-field-status">
                      <p style={{ margin: 0, padding: '10px 12px', color: '#011309' }}>
                        {form.isLocked ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  )
}

export default AddConnector
