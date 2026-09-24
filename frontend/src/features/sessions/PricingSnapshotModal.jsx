import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  formatKwh,
  formatMoney,
  formatSegmentMath,
  formatSegmentTime,
  formatSessionWindow,
  getDegradedSeverity,
  getEnergyMismatchInfo,
  getSegmentTitle,
  normalizeSummaryKwhPrecision,
  resolveDegradedMessage,
  resolveEnergyCharge,
  resolveTotalKwh,
  snapshotText,
} from './pricingSnapshotHelpers'
import '@/styles/dashboard.css'

function PricingSnapshotModal({ snapshot, currency, onClose }) {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!snapshot) {
    return null
  }

  const summary = normalizeSummaryKwhPrecision(snapshotText(snapshot.summary))
  const method =
    snapshotText(snapshot.allocation_mode_label) ||
    (typeof snapshot.allocation_mode === 'string' ? snapshot.allocation_mode : null)
  const calculationMode =
    snapshotText(snapshot.calculation_mode_label) ||
    (typeof snapshot.calculation_mode === 'string' ? snapshot.calculation_mode : null)
  const degradedSeverity = getDegradedSeverity(snapshot.degraded_reason)
  const degradedMessage = resolveDegradedMessage(snapshot)
  const displayCurrency = snapshot.currency_code || currency || ''
  const energyCharge = resolveEnergyCharge(snapshot)
  const energyChargeText = formatMoney(energyCharge, displayCurrency)
  const totalKwh = resolveTotalKwh(snapshot)
  const totalKwhText = formatKwh(totalKwh)
  const sessionWindowText = formatSessionWindow(snapshot.session_window)
  const mismatchInfo = getEnergyMismatchInfo(snapshot)
  const segments = Array.isArray(snapshot.segments) ? snapshot.segments : []

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div className="remote-actions-overlay pricing-snapshot-overlay" onClick={handleBackdropClick}>
      <div
        className="remote-actions-modal pricing-snapshot-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-snapshot-title"
      >
        <div className="remote-actions-header">
          <div className="remote-actions-heading">
            <p className="remote-actions-title" id="pricing-snapshot-title">
              Energy charge breakdown
            </p>
            <p className="remote-actions-subtitle">
              How this session amount was calculated
            </p>
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

        <div className="remote-actions-body pricing-snapshot-body">
          {summary ? (
            <div className="pricing-snapshot-summary">
              <p className="pricing-snapshot-summary-text">{summary}</p>
            </div>
          ) : null}

          <div className="pricing-snapshot-totals">
            <div className="pricing-snapshot-metric">
              <span className="pricing-snapshot-metric-label">Energy charge</span>
              <strong className="pricing-snapshot-metric-value">
                {energyCharge !== null && energyChargeText ? energyChargeText : 'Unavailable'}
              </strong>
            </div>
            <div className="pricing-snapshot-metric">
              <span className="pricing-snapshot-metric-label">Energy</span>
              <strong className="pricing-snapshot-metric-value">
                {totalKwh !== null && totalKwhText ? totalKwhText : 'Unavailable'}
              </strong>
            </div>
            {sessionWindowText ? (
              <div className="pricing-snapshot-metric pricing-snapshot-metric-wide">
                <span className="pricing-snapshot-metric-label">Session window</span>
                <strong className="pricing-snapshot-metric-value">{sessionWindowText}</strong>
              </div>
            ) : null}
          </div>

          <div className="pricing-snapshot-badges">
            {method ? <span className="pricing-snapshot-badge">{method}</span> : null}
            {calculationMode ? (
              <span className="pricing-snapshot-badge pricing-snapshot-badge-muted">
                {calculationMode}
              </span>
            ) : null}
          </div>

          {degradedSeverity ? (
            <div
              className={`pricing-snapshot-warning${degradedSeverity === 'extreme' ? ' is-extreme' : ''}`}
              role="status"
            >
              <strong>
                {degradedSeverity === 'extreme'
                  ? 'Severe meter disagreement'
                  : 'Degraded calculation'}
              </strong>
              <p>{degradedMessage}</p>
            </div>
          ) : null}

          {mismatchInfo ? (
            <div className="pricing-snapshot-mismatch" role="note">
              <strong className="pricing-snapshot-mismatch-title">Meter mismatch</strong>
              <div className="pricing-snapshot-mismatch-rows">
                {mismatchInfo.meterDelta !== null ? (
                  <div className="pricing-snapshot-mismatch-row">
                    <span>Meter delta</span>
                    <strong>{formatKwh(mismatchInfo.meterDelta)}</strong>
                  </div>
                ) : null}
                {mismatchInfo.mismatch !== null ? (
                  <div className="pricing-snapshot-mismatch-row">
                    <span>Disagreement</span>
                    <strong>{formatKwh(mismatchInfo.mismatch)}</strong>
                  </div>
                ) : null}
              </div>
              <p className="pricing-snapshot-mismatch-note">
                Billing uses the authoritative energy total / charge; this is diagnostic only.
              </p>
            </div>
          ) : null}

          {segments.length > 0 ? (
            <div className="pricing-snapshot-segments">
              <h3 className="pricing-snapshot-section-title">Time periods</h3>
              <ul className="pricing-snapshot-segment-list">
                {segments.map((segment, index) => {
                  const title = getSegmentTitle(segment)
                  const time = formatSegmentTime(segment)
                  const math = formatSegmentMath(segment, displayCurrency)
                  return (
                    <li
                      key={`${segment.start || ''}-${segment.end || ''}-${index}`}
                      className="pricing-snapshot-segment"
                    >
                      <div className="pricing-snapshot-segment-header">
                        <div>
                          <p className="pricing-snapshot-segment-title">{title.primary}</p>
                          {title.secondary ? (
                            <p className="station-secondary-text" dir="rtl">
                              {title.secondary}
                            </p>
                          ) : null}
                        </div>
                        {time ? <span className="pricing-snapshot-segment-time">{time}</span> : null}
                      </div>
                      {math ? <p className="pricing-snapshot-segment-math">{math}</p> : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <p className="pricing-snapshot-footnote">
            Idle fee is billed separately and is not included in this breakdown.
          </p>
        </div>

        <div className="remote-actions-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PricingSnapshotModal
