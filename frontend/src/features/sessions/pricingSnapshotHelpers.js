/**
 * Normalize snapshot display text.
 * New API: English-only strings.
 * Legacy stored snapshots may still have { en, ar } — prefer .en only; never use .ar.
 */
export const snapshotText = (value) => {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'object' && !Array.isArray(value) && 'en' in value) {
    return typeof value.en === 'string' && value.en.trim() ? value.en.trim() : null
  }
  return null
}

export const hasUsefulPricingSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return false
  }
  if (Object.keys(snapshot).length === 0) {
    return false
  }
  const hasSummary = Boolean(snapshotText(snapshot.summary))
  const hasSegments = Array.isArray(snapshot.segments) && snapshot.segments.length > 0
  const hasEnergyCharge =
    snapshot.energy_charge !== null &&
    snapshot.energy_charge !== undefined &&
    Number.isFinite(Number(snapshot.energy_charge))
  return hasSummary || hasSegments || hasEnergyCharge
}

/**
 * Segment title: English period_label primary; period_label_ar secondary only.
 * rate_source_label / rate_source are English-only fallbacks (no invented Arabic).
 */
export const getSegmentTitle = (segment = {}) => {
  const periodEn =
    typeof segment.period_label === 'string' ? segment.period_label.trim() : ''
  const periodAr =
    typeof segment.period_label_ar === 'string' ? segment.period_label_ar.trim() : ''
  if (periodEn || periodAr) {
    return {
      primary: periodEn || periodAr,
      secondary: periodEn && periodAr ? periodAr : '',
    }
  }
  const rateSourceLabel = snapshotText(segment.rate_source_label)
  if (rateSourceLabel) {
    return { primary: rateSourceLabel, secondary: '' }
  }
  const code = typeof segment.rate_source === 'string' ? segment.rate_source.trim() : ''
  return { primary: code || 'Segment', secondary: '' }
}

const SNAPSHOT_MAX_DECIMALS = 5

/** Round to 5 decimals, then drop all trailing zeros. */
const formatSnapshotNumber = (numeric) => {
  const fixed = numeric.toFixed(SNAPSHOT_MAX_DECIMALS)
  if (!fixed.includes('.')) {
    return fixed
  }
  const [whole, fraction] = fixed.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

export const formatMoney = (value, currency) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  const amount = formatSnapshotNumber(numeric)
  return currency ? `${amount} ${currency}` : amount
}

export const formatKwh = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return `${formatSnapshotNumber(numeric)} kWh`
}

/**
 * Backend summary text embeds its own kWh formatting (e.g. "10.00 kWh");
 * rewrite it so it matches formatKwh / the Energy metric.
 */
export const normalizeSummaryKwhPrecision = (summary) => {
  if (!summary || typeof summary !== 'string') {
    return summary
  }
  return summary.replace(/(\d+(?:\.\d+)?)\s*kWh/gi, (match, raw) => {
    const numeric = Number(raw)
    if (!Number.isFinite(numeric)) {
      return match
    }
    return `${formatSnapshotNumber(numeric)} kWh`
  })
}

/**
 * Authoritative energy charge only.
 * 0 is a valid billed amount; null/missing/NaN means unresolved — do not invent from segments.
 */
export const resolveEnergyCharge = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null
  }
  if (snapshot.energy_charge === null || snapshot.energy_charge === undefined) {
    return null
  }
  const direct = Number(snapshot.energy_charge)
  return Number.isFinite(direct) ? direct : null
}

export const resolveTotalKwh = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null
  }
  if (snapshot.total_kwh === null || snapshot.total_kwh === undefined) {
    return null
  }
  const value = Number(snapshot.total_kwh)
  return Number.isFinite(value) ? value : null
}

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

/**
 * Optional diagnostic mismatch fields. Returns null when BE omits them or values are non-finite.
 */
export const getEnergyMismatchInfo = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return null
  }
  const meterDelta = toFiniteNumber(snapshot.meter_delta_kwh)
  const mismatch = toFiniteNumber(snapshot.energy_mismatch_kwh)
  if (meterDelta === null && mismatch === null) {
    return null
  }
  return {
    meterDelta,
    mismatch,
  }
}

export const DEGRADED_REASON_FALLBACK = {
  large_meter_drift: 'Meter curve unreliable; fallback allocation used',
  extreme_meter_drift: 'Severe meter disagreement; fallback allocation used',
  insufficient_meter_points: 'Not enough meter points for reliable allocation',
  manual_end_untrusted_window: 'Manual end window is untrusted',
}

/**
 * @returns {'extreme' | 'warning' | null}
 */
export const getDegradedSeverity = (reason) => {
  if (reason == null || reason === '') {
    return null
  }
  const key = String(reason)
  if (key === 'extreme_meter_drift') {
    return 'extreme'
  }
  return 'warning'
}

export const resolveDegradedMessage = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'Pricing used a fallback method.'
  }
  const fromLabel = snapshotText(snapshot.degraded_reason_label)
  if (fromLabel) {
    return fromLabel
  }
  const reason = snapshot.degraded_reason
  if (typeof reason === 'string' && DEGRADED_REASON_FALLBACK[reason]) {
    return DEGRADED_REASON_FALLBACK[reason]
  }
  if (typeof reason === 'string' && reason.trim()) {
    return reason.trim()
  }
  return 'Pricing used a fallback method.'
}

export const formatSessionWindow = (window) => {
  if (!window || typeof window !== 'object') {
    return null
  }
  const start = window.start_local || window.start || ''
  const end = window.end_local || window.end || ''
  if (!start && !end) {
    return null
  }
  if (start && end) {
    return `${start} – ${end}`
  }
  return start || end
}

export const formatSegmentTime = (segment = {}) => {
  const start = segment.start_local || segment.start || ''
  const end = segment.end_local || segment.end || ''
  if (!start && !end) {
    return null
  }
  if (start && end) {
    return `${start} – ${end}`
  }
  return start || end
}

export const formatSegmentMath = (segment = {}, currency) => {
  const kwh = formatKwh(segment.segment_kwh)
  const rate = formatMoney(segment.rate_per_kwh, currency)
  const amount = formatMoney(segment.segment_amount, currency)
  if (!kwh && !rate && !amount) {
    return null
  }
  if (kwh && rate && amount) {
    return `${kwh.replace(' kWh', '')} kWh × ${rate} = ${amount}`
  }
  return [kwh, rate, amount].filter(Boolean).join(' · ')
}
