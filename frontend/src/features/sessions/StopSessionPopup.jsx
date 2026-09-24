import { useState } from 'react'
import '@/styles/dashboard.css'

function StopSessionPopup({ session, onClose, onConfirm, isStop = false }) {
  const [meterStopValue, setMeterStopValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const requiresMeter = !isStop

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (requiresMeter && (!meterStopValue || isNaN(parseFloat(meterStopValue)))) {
      return
    }
    setIsSubmitting(true)
    try {
      if (requiresMeter) {
        const meterStopWh = parseFloat(meterStopValue)
        const meterStopKwh = meterStopWh / 1000
        await onConfirm(meterStopKwh)
      } else {
        await onConfirm()
      }
    } catch (error) {
      console.error('Error ending session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = isStop ? 'Stop Session' : 'End Manual Session'
  const buttonText = isStop ? 'Stop Session' : 'End Session'

  return (
    <div className="remote-actions-overlay" onClick={onClose}>
      <div className="remote-actions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="remote-actions-header">
          <div className="remote-actions-heading">
            <p className="remote-actions-title">{title}</p>
            <p className="remote-actions-subtitle">Session {session?.id?.substring(0, 8) || '-'}</p>
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

        <div className="remote-actions-body">
          {requiresMeter ? (
            <div className="remote-actions-field">
              <label className="remote-actions-label" htmlFor="meter-stop-value">
                Meter Stop Value (Wh)
              </label>
              <div className="remote-actions-control">
                <input
                  id="meter-stop-value"
                  type="number"
                  value={meterStopValue}
                  onChange={(e) => setMeterStopValue(e.target.value)}
                  placeholder="Enter value in Wh"
                  step="1"
                  min="0"
                  required
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(32, 44, 36, 0.6)', marginTop: '4px' }}>
                We will convert Wh to kWh before ending the session.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: '0.95rem', color: 'rgba(32, 44, 36, 0.7)', margin: 0 }}>
              This will send a remote stop request. The meter values and duration will update when
              the charger reports the stop transaction.
            </p>
          )}
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
            type="button"
            className="remote-actions-submit"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (requiresMeter && (!meterStopValue || isNaN(parseFloat(meterStopValue))))
            }
          >
            {isSubmitting ? 'Processing...' : buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StopSessionPopup
