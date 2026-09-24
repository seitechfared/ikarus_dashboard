import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import '@/styles/dashboard.css'

function StartSessionPopup({ chargers, customers, onClose, onConfirm }) {
  const [chargerId, setChargerId] = useState('')
  const [connectorId, setConnectorId] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [connectors, setConnectors] = useState([])
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false)
  const [connectorError, setConnectorError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const customerSuggestions = useMemo(
    () =>
      (customers || [])
        .map((customer) => customer?.email)
        .filter((email) => typeof email === 'string' && email.trim()),
    [customers]
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadConnectors = async () => {
      if (!chargerId) {
        setConnectors([])
        setConnectorId('')
        setConnectorError('')
        return
      }

      setIsLoadingConnectors(true)
      setConnectorError('')
      try {
        const params = new URLSearchParams()
        params.set('charger_id', chargerId)
        params.set('page_size', '200')
        const response = await fetch(`${API_BASE}/connectors/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Failed to load connectors')
        }
        const json = await response.json()
        const results = Array.isArray(json) ? json : json.results ?? []
        if (!cancelled) {
          setConnectors(results)
          setConnectorId('')
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setConnectorError('Unable to load connectors for this charger.')
          setConnectors([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConnectors(false)
        }
      }
    }

    loadConnectors()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [chargerId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!chargerId || !connectorId || !customerEmail) {
      return
    }
    setIsSubmitting(true)
    try {
      await onConfirm({
        chargerId,
        connectorId,
        customerEmail: customerEmail.trim(),
      })
    } catch (error) {
      console.error('Error starting session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSubmitDisabled =
    isSubmitting || !chargerId || !connectorId || !customerEmail.trim()

  return (
    <div className="remote-actions-overlay" onClick={onClose}>
      <div className="remote-actions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="remote-actions-header">
          <div className="remote-actions-heading">
            <p className="remote-actions-title">Start Session</p>
            <p className="remote-actions-subtitle">Create a new remote charging session</p>
          </div>
          <button
            type="button"
            className="remote-actions-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="remote-actions-body">
            <div className="remote-actions-field">
              <label className="remote-actions-label" htmlFor="start-session-charger">
                Charger
              </label>
              <div className="remote-actions-control">
                <select
                  id="start-session-charger"
                  value={chargerId}
                  onChange={(e) => setChargerId(e.target.value)}
                  required
                >
                  <option value="">Select charger</option>
                  {(chargers || []).map((charger) => (
                    <option key={charger.id} value={charger.id}>
                      {charger.name || charger.box_id || charger.ocpp_identifier || charger.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="remote-actions-field">
              <label className="remote-actions-label" htmlFor="start-session-connector">
                Connector
              </label>
              <div className="remote-actions-control">
                <select
                  id="start-session-connector"
                  value={connectorId}
                  onChange={(e) => setConnectorId(e.target.value)}
                  required
                  disabled={!chargerId || isLoadingConnectors}
                >
                  <option value="">
                    {isLoadingConnectors ? 'Loading connectors...' : 'Select connector'}
                  </option>
                  {connectors.map((connector) => (
                    <option key={connector.id} value={connector.id}>
                      {connector.connector_name ||
                        connector.label ||
                        `Connector ${connector.connector_number ?? '-'}`}
                    </option>
                  ))}
                </select>
              </div>
              {connectorError ? (
                <p style={{ fontSize: '0.85rem', color: '#ED4A4A', marginTop: '4px' }}>
                  {connectorError}
                </p>
              ) : null}
            </div>

            <div className="remote-actions-field">
              <label className="remote-actions-label" htmlFor="start-session-customer">
                Customer Email
              </label>
              <div className="remote-actions-control">
                <input
                  id="start-session-customer"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  list="start-session-customer-list"
                  required
                />
              </div>
              {customerSuggestions.length ? (
                <datalist id="start-session-customer-list">
                  {customerSuggestions.map((email) => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
              ) : null}
            </div>
          </div>

          <div className="remote-actions-footer">
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ marginRight: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="remote-actions-submit"
              disabled={isSubmitDisabled}
            >
              {isSubmitting ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StartSessionPopup
