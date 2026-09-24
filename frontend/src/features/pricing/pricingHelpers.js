import { validateName } from '@/utils/validation'

const PERIOD_LABELS = [
  'First Period',
  'Second Period',
  'Third Period',
  'Fourth Period',
  'Fifth Period',
  'Sixth Period',
  'Seventh Period',
  'Eighth Period',
  'Ninth Period',
  'Tenth Period',
]

const ARABIC_PERIOD_LABELS = [
  'الفترة الأولى',
  'الفترة الثانية',
  'الفترة الثالثة',
  'الفترة الرابعة',
  'الفترة الخامسة',
  'الفترة السادسة',
  'الفترة السابعة',
  'الفترة الثامنة',
  'الفترة التاسعة',
  'الفترة العاشرة',
]

export const MAX_CUSTOM_PERIODS = PERIOD_LABELS.length

export const getPeriodLabel = (index) => PERIOD_LABELS[index] || `Period ${index + 1}`

export const getArabicPeriodLabel = (index) => ARABIC_PERIOD_LABELS[index] || `الفترة ${index + 1}`

const trimOrFallback = (value, fallback) => {
  const text = value === null || value === undefined ? '' : String(value).trim()
  return text || fallback
}

export const resolvePeriodLabels = (period, index) => ({
  english: trimOrFallback(
    period.englishPeriodLabel ??
      period.english_period_label ??
      period.label ??
      period.periodName,
    getPeriodLabel(index)
  ),
  arabic: trimOrFallback(
    period.arabicPeriodLabel ?? period.arabic_period_label,
    getArabicPeriodLabel(index)
  ),
})

export const formatBilingualPeriodTitle = (period, index) => resolvePeriodLabels(period, index)

export const validateCustomPeriodLabels = (period, index) => {
  const ordinal = index + 1
  return {
    englishPeriodLabel: validateName(period.englishPeriodLabel, {
      required: true,
      label: `Period ${ordinal} English label`,
    }),
    arabicPeriodLabel: validateName(period.arabicPeriodLabel, {
      required: true,
      label: `Period ${ordinal} Arabic label`,
    }),
  }
}

export const valueOrEmptyString = (value) =>
  value === null || value === undefined || Number.isNaN(value) ? '' : String(value)

export const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/,/g, '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export const toMinutesOrNull = (value) => {
  if (value === null || value === undefined) return null
  const match = String(value).match(/\d+/)
  if (!match) return null
  const minutes = Number(match[0])
  return Number.isFinite(minutes) ? minutes : null
}

export const normalizeTimeValue = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  if (!text) return ''
  const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/)
  if (!match) return text
  const hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return text
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export const normalizePricingPayload = (pricing) => {
  if (!pricing) return null
  const source = pricing.pricing ?? pricing
  const balanceRules =
    source.balance_rules ??
    source.balanceRules ??
    pricing.balance_rules ??
    pricing.balanceRules ??
    {}
  const minBalanceToStart =
    source.min_balance_to_start ??
    balanceRules.min_balance_to_start ??
    balanceRules.minBalanceToStart ??
    balanceRules.minStart ??
    ''
  const lowBalanceThreshold =
    source.low_balance_threshold ??
    balanceRules.low_balance_threshold ??
    balanceRules.lowBalanceThreshold ??
    balanceRules.lowBalance ??
    ''
  const stopSessionBalance =
    source.stop_session_balance ??
    balanceRules.stop_session_balance ??
    balanceRules.stopSessionBalance ??
    balanceRules.stopBalance ??
    ''
  return {
    dc: valueOrEmptyString(source.dc ?? source.dc_rate_per_kwh ?? ''),
    ac: valueOrEmptyString(source.ac ?? source.ac_rate_per_kwh ?? ''),
    idleAfter: valueOrEmptyString(source.idle_after ?? source.idle_after_minutes ?? ''),
    idleFees: valueOrEmptyString(source.idle_fees ?? source.idle_fee_amount ?? ''),
    idleForEach: valueOrEmptyString(source.idle_for_each ?? source.idle_interval_minutes ?? ''),
    dcIdleAfter: valueOrEmptyString(source.dc_idle_after_minutes ?? ''),
    dcIdleFees: valueOrEmptyString(source.dc_idle_fee_amount ?? ''),
    dcIdleForEach: valueOrEmptyString(source.dc_idle_interval_minutes ?? ''),
    acIdleAfter: valueOrEmptyString(source.ac_idle_after_minutes ?? ''),
    acIdleFees: valueOrEmptyString(source.ac_idle_fee_amount ?? ''),
    acIdleForEach: valueOrEmptyString(source.ac_idle_interval_minutes ?? ''),
    minBalanceToStart: valueOrEmptyString(minBalanceToStart),
    lowBalanceThreshold: valueOrEmptyString(lowBalanceThreshold),
    stopSessionBalance: valueOrEmptyString(stopSessionBalance),
    currency: source.currency ?? source.currency_code ?? pricing.currency ?? pricing.currency_code ?? '',
  }
}

export const mapServerCustomPeriods = (periods) => {
  if (!Array.isArray(periods)) return []
  return periods.slice(0, MAX_CUSTOM_PERIODS).map((period, index) => {
    const dcValue =
      period.dc ??
      period.dc_rate_per_kwh ??
      period.dc_price ??
      period.price_dc ??
      period.rate_per_kwh ??
      null
    const acValue =
      period.ac ??
      period.ac_rate_per_kwh ??
      period.ac_price ??
      period.price_ac ??
      period.rate_per_kwh ??
      null
    const labels = resolvePeriodLabels(period, index)
    return {
      id: index + 1,
      backendId: period.id || period.period_id || null,
      englishPeriodLabel: labels.english,
      arabicPeriodLabel: labels.arabic,
      from: normalizeTimeValue(period.from || period.starts_at || ''),
      to: normalizeTimeValue(period.to || period.ends_at || ''),
      dc: valueOrEmptyString(dcValue ?? ''),
      ac: valueOrEmptyString(acValue ?? ''),
      enabled: period.enabled !== false,
    }
  })
}

export const buildPricingPayload = (pricing = {}, idleFees = {}, currency, balanceRules = null, defaultPrices = null) => {
  const payload = {
    currency: currency || 'EGP',
    dc_rate_per_kwh: toNumberOrNull(pricing.dc || defaultPrices?.dc || defaultPrices?.dc_rate_per_kwh),
    ac_rate_per_kwh: toNumberOrNull(pricing.ac || defaultPrices?.ac || defaultPrices?.ac_rate_per_kwh),
    idle_after_minutes: toMinutesOrNull(idleFees.idleAfter),
    idle_fee_amount: toNumberOrNull(idleFees.fees),
    idle_interval_minutes: toMinutesOrNull(idleFees.forEach),
    dc_idle_after_minutes: toMinutesOrNull(idleFees.dcIdleAfter),
    dc_idle_fee_amount: toNumberOrNull(idleFees.dcFees),
    dc_idle_interval_minutes: toMinutesOrNull(idleFees.dcForEach),
    ac_idle_after_minutes: toMinutesOrNull(idleFees.acIdleAfter),
    ac_idle_fee_amount: toNumberOrNull(idleFees.acFees),
    ac_idle_interval_minutes: toMinutesOrNull(idleFees.acForEach),
  }
  if (balanceRules) {
    payload.min_balance_to_start = toNumberOrNull(balanceRules.minStart)
    payload.low_balance_threshold = toNumberOrNull(balanceRules.lowBalance)
    payload.stop_session_balance = toNumberOrNull(balanceRules.stopBalance)
  }
  return payload
}

export const buildCustomPeriodsPayload = (customPricing = [], defaultPrices = null) =>
  customPricing.slice(0, MAX_CUSTOM_PERIODS).map((period, index) => {
    const englishLabel = trimOrFallback(period.englishPeriodLabel, getPeriodLabel(index))
    const arabicLabel = trimOrFallback(period.arabicPeriodLabel, getArabicPeriodLabel(index))
    return {
      id: period.backendId || null,
      label: englishLabel,
      english_period_label: englishLabel,
      arabic_period_label: arabicLabel,
      starts_at: normalizeTimeValue(period.from),
      ends_at: normalizeTimeValue(period.to),
      dc_rate_per_kwh: toNumberOrNull(period.dc || defaultPrices?.dc || defaultPrices?.dc_rate_per_kwh),
      ac_rate_per_kwh: toNumberOrNull(period.ac || defaultPrices?.ac || defaultPrices?.ac_rate_per_kwh),
      enabled: period.enabled !== false,
      display_order: index,
    }
  })
