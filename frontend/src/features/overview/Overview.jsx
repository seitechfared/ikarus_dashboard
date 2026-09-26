import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useToast } from '@/components/ui/organisms/ToastProvider'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { fetchCountries } from '@/services/referenceApi'

const SUMMARY_ICON_MAP = {
  chargers: (props) => (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M4.66669 4.12949C8.36065 2.64605 12.4847 2.64605 16.1787 4.12949V24.9831H4.66669V4.12949Z"
        stroke="currentColor"
        strokeWidth="1.63333"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1896 12.8668H17.2652C18.591 12.8668 19.6658 13.9392 19.6658 15.2622V19.1855C19.6658 20.5084 20.7406 21.5809 22.0664 21.5809C23.3922 21.5809 24.467 20.5084 24.467 19.1855V10.4306M23.1769 6.41014V4.7121M7.55359 6.70081H13.2918V10.371H7.55359V6.70081Z"
        stroke="currentColor"
        strokeWidth="1.63333"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.7806 6.43831V4.7121M26.6328 6.43831V8.2687C26.6328 9.46271 25.6649 10.4306 24.4709 10.4306H24.4628C23.2688 10.4306 22.3009 9.46271 22.3009 8.2687V6.43831H26.6328Z"
        stroke="currentColor"
        strokeWidth="1.63333"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  connectors: (props) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M5.97461 12.75C8.88262 12.75 11.25 15.1174 11.25 18.0254C11.2502 20.9309 13.613 23.2938 16.5186 23.2939C19.2386 23.2939 21.4829 21.2233 21.7588 18.5752H21.7646C21.4885 21.2258 19.2408 23.2998 16.5186 23.2998C13.6108 23.2997 11.2444 20.9332 11.2441 18.0254C11.2441 15.1196 8.88041 12.7559 5.97461 12.7559C3.069 12.7561 0.706055 15.1197 0.706055 18.0254V18.0264L0.704102 18.0283H0.702148L0.700195 18.0264V18.0254C0.700195 15.1175 3.06678 12.7502 5.97461 12.75ZM14.2607 0.700195L14.2627 0.702148V1.4541L14.793 1.58594L18.7793 2.58301C21.4416 3.249 23.2997 5.62917 23.2998 8.37305V15.7666L23.2979 15.7686H20.2832L20.2812 15.7666V12.7998L20.2744 12.6348C20.2427 12.2507 20.0999 11.8827 19.8613 11.5771C19.5887 11.2279 19.2063 10.9801 18.7764 10.873H18.7773L14.4102 9.78125L14.2627 10.4951C14.2629 10.4943 14.2623 10.4948 14.2607 10.4961V10.4971H14.2588C14.2588 10.4971 14.2576 10.4968 14.2568 10.4961L14.2559 10.4951V0.702148L14.2568 0.701172C14.2576 0.700457 14.2588 0.700199 14.2588 0.700195H14.2607ZM19.0293 3.9668C18.3362 3.62037 17.4931 3.90175 17.1465 4.59473L16.3936 6.10059C16.2866 6.31447 16.2363 6.55212 16.2471 6.79102C16.2578 7.02995 16.3293 7.26237 16.4551 7.46582C16.5807 7.66906 16.7562 7.8367 16.9648 7.95312C16.983 7.96327 17.0029 7.97117 17.0215 7.98047C16.911 8.57936 17.2024 9.20324 17.7744 9.48926C18.4662 9.83501 19.309 9.55607 19.6562 8.8623L20.4102 7.35547C20.517 7.14162 20.5674 6.90385 20.5566 6.66504C20.5459 6.42613 20.4744 6.19368 20.3486 5.99023C20.2229 5.78682 20.0467 5.61939 19.8379 5.50293C19.8193 5.49258 19.7992 5.48506 19.7803 5.47559C19.8908 4.87671 19.6013 4.25287 19.0293 3.9668ZM11.4502 1.87988V7.91113L9.74023 7.48438L9.73828 7.4834L9.7373 7.48145V1.45605L9.73828 1.4541C9.73959 1.45308 9.74117 1.45315 9.74121 1.45312L11.4502 1.87988Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  ),
  drivers: (props) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M6 6.93758C6 3.6239 8.6863 0.937596 12 0.937596C15.3137 0.937596 18 3.6239 18 6.93758C18 10.2513 15.3137 12.9376 12 12.9376C8.6863 12.9376 6 10.2513 6 6.93758Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.4775 23C12.3327 22.9307 12.1712 22.8906 12 22.8906C11.8288 22.8906 11.6673 22.9307 11.5225 23H12.4775Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 24C6 20.6863 8.6863 18 12 18C15.3137 18 18 20.6863 18 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="10"
      />
      <path
        d="M0.9375 24C0.9375 17.8904 5.89034 12.9375 12 12.9375C18.1096 12.9375 23.0624 17.8904 23.0624 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="10"
        strokeLinejoin="round"
      />
      <path d="M11.0156 23.0156L8.13281 20.1328" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
      <path d="M15.8672 20.1328L12.9375 23.0625" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" />
    </svg>
  ),
  sessions: (props) => (
    <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M23.9235 10.1195C24.1714 11.0596 24.2969 12.0278 24.2969 13C24.2969 19.2391 19.2391 24.2969 13 24.2969C6.76089 24.2969 1.70312 19.2391 1.70312 13C1.70312 6.76089 6.76089 1.70312 13 1.70312C14.6886 1.70312 16.3557 2.08164 17.8787 2.81087"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="22.9256"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.931 6.49218L22.2828 7.4219M22.7107 3.90459L24.0625 4.83431M13.6417 11.4924H16.8921L12.0212 20.0781L12.3583 14.5768H9.10797L13.9974 5.9219L13.6417 11.4924ZM22.875 3.33482L20.4577 6.84941L18.7004 5.64074C17.7339 4.97601 17.487 3.64129 18.1518 2.67477C18.8165 1.70826 20.1512 1.46137 21.1177 2.1261L22.875 3.33482Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="22.9256"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  energy: (props) => (
    <svg viewBox="0 0 26 28" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M1.89587 14C1.89587 16.9008 3.04821 19.6828 5.09939 21.734C7.15057 23.7852 9.93257 24.9375 12.8334 24.9375C15.7342 24.9375 18.5162 23.7852 20.5674 21.734C22.6185 19.6828 23.7709 16.9008 23.7709 14C23.7709 11.0992 22.6185 8.3172 20.5674 6.26602C18.5162 4.21484 15.7342 3.0625 12.8334 3.0625C9.93257 3.0625 7.15057 4.21484 5.09939 6.26602C3.04821 8.3172 1.89587 11.0992 1.89587 14Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.1884 7.4375H16.0281C16.1524 7.4375 16.2746 7.46926 16.3831 7.52975C16.4916 7.59024 16.5829 7.67747 16.6483 7.78314C16.7136 7.88882 16.7509 8.00944 16.7565 8.13356C16.7622 8.25769 16.736 8.38119 16.6805 8.49236L15.0209 11.8125H17.9376L10.6459 22.0208L11.3751 14.7292H9.43842C9.32473 14.7291 9.21262 14.7025 9.11104 14.6514C9.00947 14.6004 8.92125 14.5262 8.85342 14.435C8.7856 14.3437 8.74005 14.2379 8.72042 14.1259C8.70079 14.0139 8.70762 13.8989 8.74037 13.79L10.4904 7.95667C10.5354 7.80653 10.6276 7.67492 10.7533 7.58139C10.8791 7.48785 11.0317 7.43739 11.1884 7.4375Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  'blocked-sessions': (props) => (
    <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M23.9235 10.1195C24.1714 11.0596 24.2969 12.0278 24.2969 13C24.2969 19.2391 19.2391 24.2969 13 24.2969C6.76089 24.2969 1.70312 19.2391 1.70312 13C1.70312 6.76089 6.76089 1.70312 13 1.70312C14.6886 1.70312 16.3557 2.08164 17.8787 2.81087"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="22.9256"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.931 6.49218L22.2827 7.4219M22.7107 3.90459L24.0625 4.83431M22.875 3.33482L20.4577 6.84941L18.7004 5.64074C17.7339 4.97601 17.487 3.64129 18.1517 2.67477C18.8165 1.70826 20.1511 1.46137 21.1177 2.1261L22.875 3.33482Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="22.9256"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.1739 12.9986L17.7537 9.42703C18.0802 9.10058 18.0802 8.57129 17.7537 8.24484C17.4273 7.91839 16.898 7.91839 16.5715 8.24484L13 11.8247L9.42845 8.24484C9.102 7.91839 8.57271 7.91839 8.24626 8.24484C7.91981 8.57129 7.91981 9.10058 8.24626 9.42703L11.8261 12.9986L8.24626 16.5701C8.08865 16.7264 8 16.9392 8 17.1612C8 17.3832 8.08865 17.596 8.24626 17.7523C8.40258 17.9099 8.61537 17.9986 8.83736 17.9986C9.05934 17.9986 9.27213 17.9099 9.42845 17.7523L13 14.1724L16.5715 17.7523C16.7279 17.9099 16.9407 17.9986 17.1626 17.9986C17.3846 17.9986 17.5974 17.9099 17.7537 17.7523C17.9113 17.596 18 17.3832 18 17.1612C18 16.9392 17.9113 16.7264 17.7537 16.5701L14.1739 12.9986Z"
        fill="currentColor"
      />
    </svg>
  ),
}

const RevenueIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M21.875 16.7689V12.3939H17.5" stroke="currentColor" strokeWidth="1.45833" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21.875 12.3939L16.9653 17.3055C16.686 17.5847 16.3364 17.7832 15.9536 17.8799C15.5707 17.9766 15.1688 17.9679 14.7905 17.8548L9.23615 16.3693C8.86538 16.2703 8.4751 16.2706 8.10446 16.3701C7.73383 16.4696 7.39587 16.6648 7.12449 16.9361L1.45837 22.6061" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.6667 5.10611H9.69017C9.38725 5.10632 9.09385 5.21193 8.86028 5.40481C8.62672 5.59769 8.46754 5.86583 8.41006 6.16324C8.35258 6.46066 8.40037 6.7688 8.54524 7.03482C8.69011 7.30085 8.92304 7.50818 9.20405 7.62125L11.2107 8.42333C11.4924 8.536 11.726 8.74329 11.8713 9.00954C12.0167 9.2758 12.0647 9.58438 12.0072 9.88222C11.9496 10.1801 11.7901 10.4485 11.556 10.6415C11.3219 10.8344 11.028 10.9398 10.7246 10.9394H8.75003" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.2084 5.10612V4.37695" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.2084 11.6686V10.9395" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17.3561 9.46655C17.6145 8.18789 17.5251 6.86333 17.0973 5.63097C16.6695 4.39862 15.9189 3.30359 14.9238 2.46008C13.9287 1.61656 12.7256 1.05545 11.4398 0.835237C10.154 0.615026 8.83271 0.743784 7.61363 1.20809C6.39456 1.67239 5.32236 2.45523 4.50884 3.47499C3.69532 4.49475 3.17027 5.71408 2.98843 7.00585C2.80659 8.29761 2.97462 9.61451 3.47501 10.8192C3.97539 12.0239 4.7898 13.0724 5.83333 13.8552" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const REVENUE_CHART_SIZE = { width: 400, height: 140 }
const REVENUE_TARGET = 1_000_000

const ENERGY_DATASETS = [
  { key: 'dc', label: 'DC', className: 'dc' },
  { key: 'ac', label: 'AC', className: 'ac' },
]

const SUMMARY_PLACEHOLDERS = [
  {
    slug: 'chargers',
    title: 'Chargers',
    value: '--',
    valueUnit: '',
    detail: '',
    detailValue: '',
    breakdown: [
      { label: 'Public', value: '--' },
      { label: 'Semi-Public', value: '--' },
      { label: 'Private', value: '--' },
    ],
  },
  {
    slug: 'connectors',
    title: 'Connectors',
    value: '--',
    valueUnit: '',
    detail: '',
    detailValue: '',
    breakdown: [
      { label: 'DC', value: '--' },
      { label: 'AC', value: '--' },
    ],
  },
  {
    slug: 'drivers',
    title: 'Customers',
    value: '--',
    valueUnit: '',
    detail: '',
    detailValue: '',
    breakdown: [
      { label: 'Active', value: '--' },
      { label: 'Inactive', value: '--' },
      { label: 'New', value: '--' },
    ],
  },
  {
    slug: 'sessions',
    title: 'Sessions',
    value: '--',
    valueUnit: '',
    detail: 'Today',
    detailValue: '--',
    delta: '',
  },
  {
    slug: 'energy',
    title: 'Energy',
    value: '--',
    valueUnit: 'kWh',
    detail: 'Today',
    detailValue: '--',
    delta: '',
  },
  {
    slug: 'blocked-sessions',
    title: 'Today Invalid Billing Sessions',
    value: '--',
    valueUnit: '',
    detail: 'Total',
    detailValue: '--',
    delta: '',
  },
]

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const ENERGY_AXIS_STEPS = 5
const getNiceAxisStep = (maxValue, steps = ENERGY_AXIS_STEPS) => {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1
  }
  const roughStep = maxValue / steps
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  let niceNormalized = 10
  if (normalized <= 1) {
    niceNormalized = 1
  } else if (normalized <= 2) {
    niceNormalized = 2
  } else if (normalized <= 5) {
    niceNormalized = 5
  }
  return niceNormalized * magnitude
}

const CONNECTOR_COLORS = {
  available: {
    solid: 'var(--color-success)',
    tint: 'rgba(var(--color-success-rgb), 0.28)',
    border: 'var(--color-success)',
  },
  charging: {
    solid: '#006C9C',
    tint: 'rgba(0, 108, 156, 0.28)',
    border: '#006C9C',
  },
  preparing: {
    solid: '#DBAA2C',
    tint: 'rgba(219, 170, 44, 0.28)',
    border: '#DBAA2C',
  },
  faulted: {
    solid: '#B72800',
    tint: 'rgba(183, 40, 0, 0.36)',
    border: '#B72800',
  },
  unavailable: {
    solid: '#DA3A3A',
    tint: 'rgba(218, 58, 58, 0.28)',
    border: '#DA3A3A',
  },
}

const formatDisplayDate = (date) =>
  date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const formatRangeLabel = (start, end) => {
  if (!start || !end) return ''
  const options = { month: 'short', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString(
    'en-US',
    options
  )}`
}

const parseSummaryBreakdown = (labelText, valueText) => {
  if (!labelText || !valueText) return null
  const labels = String(labelText)
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)
  const values = String(valueText)
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean)
  if (labels.length <= 1 || labels.length !== values.length) {
    return null
  }
  return labels.map((label, index) => ({
    label,
    value: values[index],
  }))
}

const normalizeUnitLabel = (unit) => {
  if (unit === null || unit === undefined) return ''
  const text = String(unit).trim()
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower === 'kwh') return 'kWh'
  if (lower === 'kw') return 'kW'
  if (lower === 'wh') return 'Wh'
  return text
}

const formatCurrency = (value, currency = 'EGP') => {
  if (!Number.isFinite(value)) return `0 ${currency}`
  return `${Math.round(value).toLocaleString()} ${currency}`
}

const formatAverageValue = (value, currency = 'EGP') => {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(1)} ${currency}`
}

const formatDeltaRatio = (ratio) => {
  if (!Number.isFinite(ratio) || ratio === 0) return null
  const percent = Math.abs(ratio * 100)
  const sign = ratio > 0 ? '+' : '-'
  return `${sign}${percent.toFixed(1)}%`
}

const formatRevenueTrend = (ratio) => {
  if (!Number.isFinite(ratio)) {
    return { label: '↑ 0.0%', className: 'positive' }
  }
  const isNegative = ratio < 0
  const percent = Math.abs(ratio * 100)
  return {
    label: `${isNegative ? '↓' : '↑'} ${percent.toFixed(1)}%`,
    className: isNegative ? 'negative' : 'positive',
  }
}


const formatSummaryDelta = (card) => {
  const raw = typeof card?.delta === 'string' ? card.delta.trim() : ''
  const isSummaryTrend = card?.slug === 'sessions' || card?.slug === 'energy'
  if (!raw) {
    if (isSummaryTrend) {
      return { label: '↑ 0.0%', className: 'positive' }
    }
    return null
  }
  const numericValue = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''))
  const isNegative = Number.isFinite(numericValue)
    ? numericValue < 0
    : raw.startsWith('-')
  const cleaned = raw.replace(/^[+-]/, '')
  if (isSummaryTrend) {
    const displayValue = Number.isFinite(numericValue)
      ? Math.abs(numericValue).toFixed(1)
      : cleaned
    return {
      label: `${isNegative ? '↓' : '↑'} ${displayValue}%`,
      className: isNegative ? 'negative' : 'positive',
    }
  }
  return {
    label: raw,
    className: isNegative ? 'negative' : 'positive',
  }
}


const formatAlertTimestamp = (isoString) => {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString
  const datePart = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
  const timePart = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
  return `${datePart} · ${timePart}`
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

const cloneDate = (date) => new Date(date.getTime())

const isSameDay = (a, b) => a && b && a.getTime() === b.getTime()

const buildMonthCells = (monthDate) => {
  const cells = []
  const firstOfMonth = startOfMonth(monthDate)
  const startDay = firstOfMonth.getDay()
  const totalDays = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate()
  const prevMonthDays = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    0
  ).getDate()

  for (let i = 0; i < 42; i += 1) {
    let date
    let currentMonth = true

    if (i < startDay) {
      date = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() - 1,
        prevMonthDays - (startDay - i) + 1
      )
      currentMonth = false
    } else if (i >= startDay + totalDays) {
      date = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        i - (startDay + totalDays) + 1
      )
      currentMonth = false
    } else {
      date = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        i - startDay + 1
      )
    }

    cells.push({ date, currentMonth })
  }

  return cells
}

const findPathPointAtX = (path, targetX) => {
  if (!path) return null
  const totalLength = path.getTotalLength()
  let start = 0
  let end = totalLength
  let point = path.getPointAtLength(0)

  for (let i = 0; i < 24; i += 1) {
    const mid = (start + end) / 2
    point = path.getPointAtLength(mid)
    if (point.x < targetX) {
      start = mid
    } else {
      end = mid
    }
  }

  return point
}

function Overview() {
  const { showToast } = useToast()
  const outletContext = useOutletContext() || {}
  const navigate = useNavigate()
  const canViewRevenue = outletContext?.capabilities?.canViewRevenue ?? false
  const [serverNow, setServerNow] = useState(() => new Date())
  const serverNowRef = useRef(serverNow)

  useEffect(() => {
    serverNowRef.current = serverNow
  }, [serverNow])

  const defaultEnd = useMemo(() => endOfMonth(serverNow), [serverNow])
  const defaultStart = useMemo(
    () => startOfMonth(new Date(serverNow.getFullYear(), serverNow.getMonth() - 5, 1)),
    [serverNow]
  )
  const [energyRangeInitialized, setEnergyRangeInitialized] = useState(false)
  const [countries, setCountries] = useState([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('')

  const [summaryCards, setSummaryCards] = useState([])
  const [alerts, setAlerts] = useState([])
  const [acknowledgingAlerts, setAcknowledgingAlerts] = useState(() => new Set())
  const [connectorStatus, setConnectorStatus] = useState([])
  const [chargerCondition, setChargerCondition] = useState({
    available: 0,
    unavailable: 0,
    total: 0,
  })
  const [energySamples, setEnergySamples] = useState([])
  const [revenueTop, setRevenueTop] = useState([])
  const [revenueTrend, setRevenueTrend] = useState([])
  const [revenueCurrency, setRevenueCurrency] = useState('EGP')
  const [fetchError, setFetchError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredEnergy, setHoveredEnergy] = useState(null)
  const [hoveredRevenue, setHoveredRevenue] = useState(null)
  const [energyRange, setEnergyRange] = useState({
    start: defaultStart,
    end: defaultEnd,
  })
  const [energyTempRange, setEnergyTempRange] = useState({
    start: defaultStart,
    end: defaultEnd,
  })
  const [isEnergyPickerOpen, setIsEnergyPickerOpen] = useState(false)
  const [energyLeftMonth, setEnergyLeftMonth] = useState(startOfMonth(defaultStart))
  const [revenueRange, setRevenueRange] = useState({
    start: defaultStart,
    end: defaultEnd,
  })
  const [revenueTempRange, setRevenueTempRange] = useState({
    start: defaultStart,
    end: defaultEnd,
  })
  const [isRevenuePickerOpen, setIsRevenuePickerOpen] = useState(false)
  const [revenueLeftMonth, setRevenueLeftMonth] = useState(startOfMonth(defaultStart))
  const [revenueRangeInitialized, setRevenueRangeInitialized] = useState(false)

  useEffect(() => {
    if (fetchError) {
      showToast({ message: fetchError, variant: 'error' })
    }
  }, [fetchError, showToast])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadCountries = async () => {
      setCountriesLoading(true)
      try {
        const data = await fetchCountries({ signal: controller.signal })
        if (cancelled) return
        if (Array.isArray(data)) {
          const sorted = data.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          setCountries(sorted)
        } else {
          setCountries([])
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          console.error(error)
          showToast({
            title: 'Unable to load countries',
            message: error.message || 'Failed to load countries list.',
            variant: 'error',
          })
        }
      } finally {
        if (!cancelled) {
          setCountriesLoading(false)
        }
      }
    }

    loadCountries()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [showToast])

  useEffect(() => {
    setEnergyRangeInitialized(false)
  }, [selectedCountry])

  const handleAcknowledgeAlert = useCallback(
    async (alertId) => {
      if (!alertId || acknowledgingAlerts.has(alertId)) {
        return
      }
      setAcknowledgingAlerts((prev) => {
        const next = new Set(prev)
        next.add(alertId)
        return next
      })
      try {
        const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge/`, {
          method: 'POST',
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.detail || 'Unable to acknowledge alert.')
        }
        setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
        showToast({ message: 'Alert acknowledged.', variant: 'success' })
      } catch (error) {
        showToast({ message: error.message || 'Unable to acknowledge alert.', variant: 'error' })
      } finally {
        setAcknowledgingAlerts((prev) => {
          const next = new Set(prev)
          next.delete(alertId)
          return next
        })
      }
    },
    [acknowledgingAlerts, showToast]
  )

  const connectorsTotal = useMemo(
    () => connectorStatus.reduce((acc, item) => acc + item.value, 0),
    [connectorStatus]
  )
  const cardsToRender = summaryCards.length ? summaryCards : SUMMARY_PLACEHOLDERS

  const availableChargerCount = Number(chargerCondition.available) || 0
  const unavailableChargerCount = Number(chargerCondition.unavailable) || 0
  const chargerTotal = useMemo(() => {
    const total = Number(chargerCondition.total) || 0
    if (total) {
      return total
    }
    return availableChargerCount + unavailableChargerCount
  }, [availableChargerCount, chargerCondition.total, unavailableChargerCount])

  const availablePercent = useMemo(() => {
    if (!chargerTotal) {
      return 0
    }
    return Math.round((availableChargerCount / chargerTotal) * 100)
  }, [availableChargerCount, chargerTotal])

  const unavailablePercent = useMemo(() => {
    const remainder = 100 - availablePercent
    return remainder >= 0 ? remainder : 0
  }, [availablePercent])

  const availableDeg = useMemo(() => {
    if (!chargerTotal) {
      return 0
    }
    return (availableChargerCount / chargerTotal) * 360
  }, [availableChargerCount, chargerTotal])

  const energyDatasetRange = useMemo(() => {
    if (!energySamples.length) {
      return { start: null, end: null }
    }
    return {
      start: energySamples[0].rangeStart,
      end: energySamples[energySamples.length - 1].rangeEnd,
    }
  }, [energySamples])

  const revenueDatasetRange = useMemo(() => {
    if (!revenueTrend.length) {
      const base = serverNow
      const start = startOfMonth(base)
      const end = endOfMonth(base)
      return { start, end }
    }
    const base = serverNow
    const baseYear = base.getFullYear()
    const baseMonth = base.getMonth()
    const validDays = revenueTrend
      .map((point) => Number(point.day))
      .filter((day) => Number.isFinite(day) && day > 0)

    if (!validDays.length) {
      const start = startOfMonth(base)
      const end = endOfMonth(base)
      return { start, end }
    }

    const minDay = Math.max(1, Math.min(...validDays))
    const daysInMonth = new Date(baseYear, baseMonth + 1, 0).getDate()
    const maxDay = Math.min(daysInMonth, Math.max(...validDays))

    const start = new Date(baseYear, baseMonth, minDay)
    const end = new Date(baseYear, baseMonth, maxDay, 23, 59, 59, 999)

    return { start, end }
  }, [revenueTrend, serverNow])

  const clampToDataset = useCallback(
    (start, end) => {
      let nextStart = cloneDate(start)
      let nextEnd = cloneDate(end)

      if (energyDatasetRange.start && nextStart < energyDatasetRange.start) {
        nextStart = cloneDate(energyDatasetRange.start)
      }
      if (energyDatasetRange.end && nextEnd > energyDatasetRange.end) {
        nextEnd = cloneDate(energyDatasetRange.end)
      }
      if (nextStart > nextEnd) {
        nextStart = cloneDate(nextEnd)
      }
      return { start: nextStart, end: nextEnd }
    },
    [energyDatasetRange.end, energyDatasetRange.start]
  )

  const spansMultipleYears = useMemo(() => {
    if (!energySamples.length) {
      return false
    }
    const years = new Set(energySamples.map((point) => point.year))
    return years.size > 1
  }, [energySamples])

  const filteredEnergy = useMemo(() => {
    if (!energySamples.length || !energyRange.start || !energyRange.end) {
      return []
    }
    const start = energyRange.start
    const end = energyRange.end
    return energySamples.filter(
      (point) => point.rangeEnd >= start && point.rangeStart <= end
    )
  }, [energySamples, energyRange.start, energyRange.end])

  const energyYMax = useMemo(() => {
    const localMax = filteredEnergy.length
      ? filteredEnergy.reduce((m, p) => {
          const dc = Number.isFinite(p.dc) ? p.dc : 0
          const ac = Number.isFinite(p.ac) ? p.ac : 0
          return Math.max(m, dc, ac)
        }, 0)
      : 0
    if (!Number.isFinite(localMax) || localMax <= 0) return 1
    const step = getNiceAxisStep(localMax)
    return step * ENERGY_AXIS_STEPS
  }, [filteredEnergy])

  const energyAxisLevels = useMemo(() => {
    const stepValue = energyYMax / ENERGY_AXIS_STEPS
    return Array.from({ length: ENERGY_AXIS_STEPS + 1 }, (_, index) =>
      Math.round(energyYMax - stepValue * index)
    )
  }, [energyYMax])

  const energyChartRef = useRef(null)
  const revenueLineRef = useRef(null)
  const handleEnergyHover = useCallback((point, datasetKey, event) => {
    const chartRect = energyChartRef.current?.getBoundingClientRect()
    if (chartRect && typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
      const x = event.clientX - chartRect.left
      const y = event.clientY - chartRect.top
      setHoveredEnergy({ id: point.id, dataset: datasetKey, point, x, y })
      return
    }
    const targetRect = event?.currentTarget?.getBoundingClientRect()
    if (chartRect && targetRect) {
      const x = targetRect.left + targetRect.width / 2 - chartRect.left
      const y = targetRect.top + targetRect.height / 2 - chartRect.top
      setHoveredEnergy({ id: point.id, dataset: datasetKey, point, x, y })
      return
    }
    setHoveredEnergy({ id: point.id, dataset: datasetKey, point, x: 0, y: 0 })
  }, [])

  const handleEnergyClear = useCallback(() => {
    setHoveredEnergy(null)
  }, [])

  const revenueChart = useMemo(() => {
    if (!revenueTrend.length) {
      return {
        coords: [],
        linePath: '',
        areaPath: '',
        maxValue: 0,
        yTicks: [],
        xTicks: [],
        sampledPoints: [],
        sampledMap: new Map(),
        dayCount: 0,
        rangeStartDay: 0,
        rangeEndDay: 0,
      }
    }

    const { width, height } = REVENUE_CHART_SIZE
    const paddingX = 20
    const paddingY = 0
    const baseDate = revenueRange.end || revenueRange.start || serverNow
    const baseYear = baseDate.getFullYear()
    const baseMonth = baseDate.getMonth()
    const daysInMonth = new Date(baseYear, baseMonth + 1, 0).getDate()

    const startDayRaw = revenueRange.start ? revenueRange.start.getDate() : 1
    const endDayRaw = revenueRange.end ? revenueRange.end.getDate() : daysInMonth
    const rangeStartDay = Math.max(1, Math.min(startDayRaw, daysInMonth))
    const rangeEndDay = Math.max(rangeStartDay, Math.min(endDayRaw, daysInMonth))
    const dayCount = Math.max(rangeEndDay - rangeStartDay + 1, 1)

    const rawPointsAll = revenueTrend
      .map((point) => ({
        day: Number(point.day),
        value: Math.max(0, Number(point.value)),
        highlight: Boolean(point.highlight),
      }))
      .filter((point) => Number.isFinite(point.day) && Number.isFinite(point.value))
      .sort((a, b) => a.day - b.day)

    if (!rawPointsAll.length) {
      return {
        coords: [],
        linePath: '',
        areaPath: '',
        maxValue: 0,
        yTicks: [],
        xTicks: [],
        sampledPoints: [],
        sampledMap: new Map(),
        dayCount: 0,
        rangeStartDay,
        rangeEndDay,
      }
    }

    const sampleFromAll = (day) => {
      const exact = rawPointsAll.find((point) => point.day === day)
      if (exact) {
        return { ...exact }
      }
      const previous = rawPointsAll.filter((point) => point.day < day).pop()
      const next = rawPointsAll.find((point) => point.day > day)
      if (!previous && !next) {
        return null
      }
      if (!previous) {
        return { ...next, day }
      }
      if (!next) {
        return { ...previous, day }
      }
      const ratio = (day - previous.day) / (next.day - previous.day)
      return {
        day,
        value: previous.value + (next.value - previous.value) * ratio,
        highlight: previous.highlight || next.highlight,
      }
    }

    const extendedPoints = rawPointsAll.filter(
      (point) => point.day >= rangeStartDay && point.day <= rangeEndDay
    )

    if (!extendedPoints.length) {
      const fallback = sampleFromAll(rangeStartDay) || sampleFromAll(rangeEndDay)
      if (fallback) {
        extendedPoints.push(fallback)
      }
    }

    const ensurePoint = (day) => {
      if (!extendedPoints.some((point) => point.day === day)) {
        const sample = sampleFromAll(day)
        if (sample) {
          extendedPoints.push(sample)
        }
      }
    }

    ensurePoint(rangeStartDay)
    ensurePoint(rangeEndDay)

    extendedPoints.sort((a, b) => a.day - b.day)

    const rawMax =
      extendedPoints.reduce((max, point) => Math.max(max, point.value), 0) || 1
    const yTickCount = 5
    const niceStep = getNiceAxisStep(rawMax, yTickCount)
    const maxValue = Math.max(niceStep * yTickCount, rawMax)

    const buildCoord = (point) => {
      const xRatio = dayCount <= 1 ? 0 : (point.day - rangeStartDay) / (dayCount - 1)
      const x = paddingX + xRatio * (width - paddingX * 2)
      const y =
        height - paddingY - (point.value / maxValue) * (height - paddingY * 2)
      const date = new Date(baseYear, baseMonth, point.day)
      return {
        ...point,
        x,
        y,
        xPercent: (x / width) * 100,
        yPercent: (y / height) * 100,
        value: Math.round(point.value),
        dateLabel: formatDisplayDate(date),
      }
    }

    const buildLinePath = (points) => {
      if (points.length < 2) {
        const [{ x, y }] = points
        return `M ${x} ${y}`
      }

      return points
        .slice(1)
        .reduce((path, point) => `${path} L ${point.x} ${point.y}`, `M ${points[0].x} ${points[0].y}`)
    }

    const pointLookup = new Map(
      extendedPoints.map((entry) => [entry.day, buildCoord(entry)])
    )

    const getPointForDay = (day) => {
      if (pointLookup.has(day)) {
        return pointLookup.get(day)
      }
      const sample = sampleFromAll(day)
      if (!sample) {
        return null
      }
      return buildCoord(sample)
    }

    const sampledPoints = []
    const sampledMap = new Map()
    for (let day = rangeStartDay; day <= rangeEndDay; day += 1) {
      const point = getPointForDay(day)
      if (point) {
        sampledPoints.push(point)
        sampledMap.set(day, point)
      }
    }

    const coords = sampledPoints.length ? sampledPoints : extendedPoints.map(buildCoord)
    const linePath = coords.length ? buildLinePath(coords) : ''
    const areaPath = coords.length
      ? `${linePath} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`
      : ''

    const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) =>
      Math.round(maxValue - niceStep * index)
    )

    const dayStep = dayCount <= 10 ? 1 : dayCount <= 20 ? 2 : 5
    const xTicks = []
    for (let day = rangeStartDay; day <= rangeEndDay; day += dayStep) {
      xTicks.push({
        day,
        label: day,
        position: day - rangeStartDay + 1,
      })
    }
    if (!xTicks.some((tick) => tick.day === rangeEndDay)) {
      xTicks.push({
        day: rangeEndDay,
        label: rangeEndDay,
        position: rangeEndDay - rangeStartDay + 1,
      })
    }

    return {
      coords,
      linePath,
      areaPath,
      maxValue,
      yTicks,
      xTicks,
      sampledPoints,
      sampledMap,
      dayCount,
      rangeStartDay,
      rangeEndDay,
      width,
      height,
      paddingX,
      paddingY,
      baseYear,
      baseMonth,
    }
  }, [revenueTrend, revenueRange.start, revenueRange.end, serverNow])

  const revenueMetrics = useMemo(() => {
    if (!revenueChart.sampledPoints.length) {
      return {
        periodTotal: 0,
        todayValue: 0,
        deltaRatio: null,
        avgPerSession: null,
      }
    }
    const sortedPoints = revenueChart.sampledPoints
      .slice()
      .sort((a, b) => a.day - b.day)
    const lastPoint = sortedPoints[sortedPoints.length - 1]
    const prevPoint =
      sortedPoints.length > 1 ? sortedPoints[sortedPoints.length - 2] : null
    const deltaRatio =
      prevPoint && prevPoint.value
        ? (lastPoint.value - prevPoint.value) / prevPoint.value
        : null
    const periodTotal = sortedPoints.reduce((sum, point) => sum + point.value, 0)
    const sessionsCard = summaryCards.find((card) => card.slug === 'sessions')
    let avgPerSession = null
    if (sessionsCard) {
      const numeric = Number(String(sessionsCard.value).replace(/[^\d.-]/g, ''))
      if (Number.isFinite(numeric) && numeric > 0) {
        avgPerSession = periodTotal / numeric
      }
    }
    return {
      periodTotal,
      todayValue: lastPoint.value,
      deltaRatio,
      avgPerSession,
    }
  }, [revenueChart.sampledPoints, summaryCards])

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      if (!energyRange.start || !energyRange.end) {
        return
      }
      setIsLoading(true)
      setFetchError(null)
      const fallbackYear = serverNowRef.current.getFullYear()
      try {
        const params = new URLSearchParams()
        params.set('start_date', energyRange.start.toISOString())
        params.set('end_date', energyRange.end.toISOString())
        if (revenueRange.start) {
          params.set('revenue_start_date', revenueRange.start.toISOString())
        }
        if (revenueRange.end) {
          params.set('revenue_end_date', revenueRange.end.toISOString())
        }
        if (selectedCountry) {
          params.set('country', selectedCountry)
        }
        const response = await fetch(`${API_BASE}/overview/?${params.toString()}`, {
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error(`Overview request failed with status ${response.status}`)
        }
        const payload = await response.json()

        if (cancelled) {
          return
        }

        if (payload?.server_time) {
          const nextServer = new Date(payload.server_time)
          if (!Number.isNaN(nextServer.getTime())) {
            setServerNow(nextServer)
          }
        }

        const summaryJson = Array.isArray(payload?.summary) ? payload.summary : []
        const alertsJson = Array.isArray(payload?.alerts) ? payload.alerts : []
        const connectorsJson = Array.isArray(payload?.connectors) ? payload.connectors : []
        const energyJson = Array.isArray(payload?.energy) ? payload.energy : []
        const revenueJson = Array.isArray(payload?.revenueTop) ? payload.revenueTop : []
        const revenueTrendJson = Array.isArray(payload?.revenueTrend) ? payload.revenueTrend : []

        const sortedSummary = summaryJson
          .slice()
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((item) => ({
            slug: item.slug,
            title: item.title,
            value: item.value,
            valueUnit: normalizeUnitLabel(item.value_unit),
            detail: item.detail_label ?? '',
            detailValue: item.detail_value ?? '',
            breakdown: parseSummaryBreakdown(item.detail_label, item.detail_value),
            delta: item.delta ?? '',
            icon: item.icon || '',
          }))
        setSummaryCards(sortedSummary)

        const sortedAlerts = alertsJson
          .slice()
          .sort(
            (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
          )
          .map((alert) => ({
            id: alert.id,
            title: (() => {
              const detailParts = [alert.station_name, alert.charger_name].filter(Boolean)
              return detailParts.length ? `${alert.title} (${detailParts.join(' / ')})` : alert.title
            })(),
            timestamp: formatAlertTimestamp(alert.occurred_at),
            severity: alert.severity,
          }))
        setAlerts(sortedAlerts)

        setChargerCondition({
          available: Number(payload?.charger_condition?.available) || 0,
          unavailable: Number(payload?.charger_condition?.unavailable) || 0,
          total: Number(payload?.charger_condition?.total) || 0,
        })

        setConnectorStatus(
          connectorsJson
            .slice()
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map((item) => {
              const key = (item.label || '').toLowerCase().replace(/[^a-z]/g, '')
              const config = CONNECTOR_COLORS[key] || {}
              return {
                label: item.label,
                value: Number(item.value),
                color: config.solid || item.color,
                tint: config.tint || item.color,
                border: config.border || config.solid || item.color,
              }
            })
        )

        const energyMapped = energyJson
          .slice()
          .map((item) => {
            const monthIndex = Math.max(0, Math.min(11, (item.month || 1) - 1))
            const year = Number(item.year) || fallbackYear
            const monthDate = new Date(year, monthIndex, 1)
            const rangeStart = startOfMonth(monthDate)
            const rangeEnd = endOfMonth(monthDate)
            return {
              id: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
              year,
              month: monthIndex + 1,
              monthShort: MONTH_LABELS[monthIndex].slice(0, 3),
              dc: Number(item.dc_value) || 0,
              ac: Number(item.ac_value) || 0,
              dcCostEgp: Number(item.dc_cost_egp) || 0,
              dcCostJod: Number(item.dc_cost_jod) || 0,
              acCostEgp: Number(item.ac_cost_egp) || 0,
              acCostJod: Number(item.ac_cost_jod) || 0,
              dcCost: Number(item.dc_cost) || 0,
              acCost: Number(item.ac_cost) || 0,
              costCurrency: item.cost_currency || '',
              highlight: Boolean(item.highlight),
              rangeStart,
              rangeEnd,
            }
          })
          .sort((a, b) => a.rangeStart.getTime() - b.rangeStart.getTime())

        setEnergySamples(energyMapped)

        if (energyMapped.length && !energyRangeInitialized) {
          const startRange = cloneDate(energyMapped[0].rangeStart)
          const endRange = cloneDate(energyMapped[energyMapped.length - 1].rangeEnd)
          const matches =
            energyRange.start &&
            energyRange.end &&
            energyRange.start.getTime() === startRange.getTime() &&
            energyRange.end.getTime() === endRange.getTime()
          if (!matches) {
            setEnergyRange({ start: startRange, end: endRange })
          }
          setEnergyTempRange({ start: startRange, end: endRange })
          setEnergyLeftMonth(startOfMonth(startRange))
          setEnergyRangeInitialized(true)
        }

        const nextRevenueCurrency = payload?.revenueCurrency || revenueCurrency
        const topOwners = revenueJson
          .slice()
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((item) => ({
            owner: item.owner_name,
            amount: Number(item.revenue),
            currency: item.currency || nextRevenueCurrency,
            formatted: `${Number(item.revenue).toLocaleString()} ${item.currency || nextRevenueCurrency}`,
          }))
        setRevenueTop(topOwners)

        const trendPoints = revenueTrendJson
          .slice()
          .sort((a, b) => a.day - b.day)
          .map((item) => ({
            day: Number(item.day),
            value: Number(item.value),
            highlight: Boolean(item.highlight),
          }))

        setRevenueTrend(trendPoints)
        if (nextRevenueCurrency) {
          setRevenueCurrency(nextRevenueCurrency)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          setFetchError('Unable to load dashboard data.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [energyRange.end, energyRange.start, revenueRange.end, revenueRange.start, selectedCountry])

  useEffect(() => {
    setHoveredEnergy(null)
  }, [filteredEnergy])

  useEffect(() => {
    setHoveredRevenue(null)
  }, [revenueTrend])

  useEffect(() => {
    if (
      !revenueRangeInitialized &&
      revenueDatasetRange.start instanceof Date &&
      revenueDatasetRange.end instanceof Date
    ) {
      const startRange = cloneDate(revenueDatasetRange.start)
      const endRange = cloneDate(revenueDatasetRange.end)
      setRevenueRange({ start: startRange, end: endRange })
      setRevenueTempRange({ start: startRange, end: endRange })
      setRevenueLeftMonth(startOfMonth(startRange))
      setRevenueRangeInitialized(true)
    }
  }, [revenueDatasetRange, revenueRangeInitialized])

  const energyRangeLabel = useMemo(
    () => formatRangeLabel(energyRange.start, energyRange.end),
    [energyRange.start, energyRange.end]
  )

  const energyMonthsToRender = useMemo(() => {
    const first = startOfMonth(energyLeftMonth)
    const second = startOfMonth(
      new Date(energyLeftMonth.getFullYear(), energyLeftMonth.getMonth() + 1, 1)
    )
    return [first, second]
  }, [energyLeftMonth])

  const openEnergyDatePicker = () => {
    setEnergyTempRange({
      start: cloneDate(energyRange.start),
      end: cloneDate(energyRange.end),
    })
    setEnergyLeftMonth(startOfMonth(energyRange.start))
    setIsEnergyPickerOpen(true)
  }

  const handleEnergyDaySelect = (date, enabled) => {
    if (!enabled) return
    const pick = cloneDate(date)
    if (!energyTempRange.start || energyTempRange.end) {
      setEnergyTempRange({ start: pick, end: null })
      return
    }

    if (isSameDay(pick, energyTempRange.start)) {
      setEnergyTempRange({ start: pick, end: null })
      return
    }

    if (pick < energyTempRange.start) {
      setEnergyTempRange({ start: pick, end: cloneDate(energyTempRange.start) })
    } else {
      setEnergyTempRange({ start: cloneDate(energyTempRange.start), end: pick })
    }
  }

  const applyEnergyTempRange = () => {
    if (!energyTempRange.start) return
    let start = cloneDate(energyTempRange.start)
    let end = cloneDate(energyTempRange.end ?? energyTempRange.start)

    if (energyDatasetRange.start && start < energyDatasetRange.start) {
      start = cloneDate(energyDatasetRange.start)
    }
    if (energyDatasetRange.end && end > energyDatasetRange.end) {
      end = cloneDate(energyDatasetRange.end)
    }
    if (start > end) {
      const fallbackStart = energyDatasetRange.start ? cloneDate(energyDatasetRange.start) : start
      const fallbackEnd = energyDatasetRange.end ? cloneDate(energyDatasetRange.end) : start
      start = fallbackStart
      end = fallbackEnd
    }

    setEnergyRange({ start, end })
    setEnergyTempRange({ start, end })
    setIsEnergyPickerOpen(false)
  }

  const handleEnergyQuickRange = useCallback(
    (start, end) => {
      const { start: nextStart, end: nextEnd } = clampToDataset(start, end)
      setEnergyTempRange({
        start: nextStart,
        end: nextEnd,
      })
      setEnergyLeftMonth(startOfMonth(nextStart))
    },
    [clampToDataset]
  )

  const energyQuickRanges = useMemo(() => {
    const today = cloneDate(serverNow)

    return [
      {
        label: 'Today',
        action: () => {
          const end = cloneDate(today)
          handleEnergyQuickRange(end, end)
        },
      },
      {
        label: 'Last week',
        action: () => {
          const end = cloneDate(today)
          const start = cloneDate(today)
          start.setDate(start.getDate() - 6)
          handleEnergyQuickRange(start, end)
        },
      },
      {
        label: 'Last 30 days',
        action: () => {
          const end = cloneDate(today)
          const start = cloneDate(today)
          start.setDate(start.getDate() - 29)
          handleEnergyQuickRange(start, end)
        },
      },
      {
        label: 'Last 3 months',
        action: () => {
          const end = cloneDate(today)
          const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - 2, 1))
          handleEnergyQuickRange(start, end)
        },
      },
      {
        label: 'Last 6 months',
        action: () => {
          const end = cloneDate(today)
          const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - 5, 1))
          handleEnergyQuickRange(start, end)
        },
      },
      {
        label: 'Last year',
        action: () => {
          const end = cloneDate(today)
          const start = startOfMonth(new Date(end.getFullYear() - 1, end.getMonth(), 1))
          handleEnergyQuickRange(start, end)
        },
      },
    ]
  }, [handleEnergyQuickRange, serverNow])

  const revenueRangeLabel = useMemo(
    () => formatRangeLabel(revenueRange.start, revenueRange.end),
    [revenueRange.start, revenueRange.end]
  )

  const revenueMonthsToRender = useMemo(() => {
    const first = startOfMonth(revenueLeftMonth)
    const second = startOfMonth(
      new Date(revenueLeftMonth.getFullYear(), revenueLeftMonth.getMonth() + 1, 1)
    )
    return [first, second]
  }, [revenueLeftMonth])

  const clampRevenueRange = useCallback((start, end) => {
    let nextStart = cloneDate(start)
    let nextEnd = cloneDate(end)
    if (nextStart > nextEnd) {
      const temp = nextStart
      nextStart = nextEnd
      nextEnd = temp
    }
    return { start: nextStart, end: nextEnd }
  }, [])

  const openRevenueDatePicker = () => {
    const start = revenueRange.start
      ? cloneDate(revenueRange.start)
      : startOfMonth(serverNow)
    const end = revenueRange.end ? cloneDate(revenueRange.end) : cloneDate(start)
    setRevenueTempRange({
      start,
      end,
    })
    setRevenueLeftMonth(startOfMonth(start))
    setIsRevenuePickerOpen(true)
  }

  const handleRevenueDaySelect = (date, enabled) => {
    if (!enabled) return
    const pick = cloneDate(date)
    if (!revenueTempRange.start || revenueTempRange.end) {
      setRevenueTempRange({ start: pick, end: null })
      return
    }

    if (isSameDay(pick, revenueTempRange.start)) {
      setRevenueTempRange({ start: pick, end: null })
      return
    }

    if (pick < revenueTempRange.start) {
      setRevenueTempRange({ start: pick, end: cloneDate(revenueTempRange.start) })
    } else {
      setRevenueTempRange({ start: cloneDate(revenueTempRange.start), end: pick })
    }
  }

  const applyRevenueTempRange = () => {
    if (!revenueTempRange.start) return
    let start = cloneDate(revenueTempRange.start)
    let end = cloneDate(revenueTempRange.end ?? revenueTempRange.start)
    if (end < start) {
      const temp = start
      start = end
      end = temp
    }
    setRevenueRange({ start, end })
    setRevenueTempRange({ start, end })
    setIsRevenuePickerOpen(false)
  }

  const handleRevenueQuickRange = useCallback(
    (start, end) => {
      const { start: nextStart, end: nextEnd } = clampRevenueRange(start, end)
      setRevenueTempRange({
        start: nextStart,
        end: nextEnd,
      })
      setRevenueLeftMonth(startOfMonth(nextStart))
    },
    [clampRevenueRange]
  )

  const revenueQuickRanges = useMemo(() => {
    const today = cloneDate(serverNow)
    const startMonth = startOfMonth(today)
    const endMonth = endOfMonth(today)

    return [
      {
        label: 'Today',
        action: () => handleRevenueQuickRange(today, today),
      },
      {
        label: 'This month',
        action: () => handleRevenueQuickRange(startMonth, endMonth),
      },
      {
        label: 'Last 7 days',
        action: () => {
          const start = cloneDate(today)
          start.setDate(start.getDate() - 6)
          handleRevenueQuickRange(start, today)
        },
      },
      {
        label: 'Last 30 days',
        action: () => {
          const start = cloneDate(today)
          start.setDate(start.getDate() - 29)
          handleRevenueQuickRange(start, today)
        },
      },
    ]
  }, [handleRevenueQuickRange, serverNow])

  const handleRevenueMonthStep = (offset) => {
    setRevenueLeftMonth((prev) =>
      startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    )
  }

  const revenueTrendDisplay = formatRevenueTrend(revenueMetrics.deltaRatio)
  const avgRevenueLabel =
    revenueMetrics.avgPerSession !== null
      ? `${formatAverageValue(revenueMetrics.avgPerSession, revenueCurrency)} / Session`
      : '-- / Session'

  const handleEnergyMonthStep = (offset) => {
    setEnergyLeftMonth((prev) =>
      startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    )
  }

  return (
    <>
      <header className="dashboard-header">
        <div className="page-heading-left">
          <div>
            <h1>Overview</h1>
          <p>General summary · {energyRangeLabel}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="filter-field" style={{ minWidth: '180px' }}>
            <label htmlFor="overview-country-filter"></label>
            <select
              id="overview-country-filter"
              value={selectedCountry}
              onChange={(event) => setSelectedCountry(event.target.value)}
              disabled={countriesLoading}
            >
              <option value="">
                {countriesLoading ? 'Loading countries...' : 'All Countries'}
              </option>
              {countries.map((country) => (
                <option key={country.code || country.name} value={country.code || country.name}>
                  {country.name || country.code}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="ghost-button" onClick={openEnergyDatePicker}>
            <img
              src="/assets/Date.png"
              alt=""
              aria-hidden="true"
              className="action-icon"
            />
            Filter by date
          </button>
          <button type="button" className="primary-button">
            <img
              src="/assets/Download.png"
              alt=""
              aria-hidden="true"
              className="action-icon"
            />
            Download
          </button>
        </div>
      </header>

      {fetchError ? <div className="data-warning">{fetchError}</div> : null}

      <section className="summary-grid" aria-busy={isLoading} id="overview-section">
        {cardsToRender.map((card) => (
          <article key={card.title} className="summary-card">
            <header>
              <p>{card.title}</p>
              {(() => {
                const Icon = SUMMARY_ICON_MAP[card.slug]
                if (Icon) {
                  return (
                    <Icon
                      className={`summary-icon${
                        card.slug ? ` summary-icon--${card.slug}` : ''
                      }`}
                      aria-hidden="true"
                      focusable="false"
                    />
                  )
                }
                if (!card.icon) return null
                return (
                  <img
                    src={card.icon}
                    alt=""
                    aria-hidden="true"
                    className={`summary-icon${
                      card.slug ? ` summary-icon--${card.slug}` : ''
                    }`}
                  />
                )
              })()}
            </header>
            <div className="summary-value-row">
              <strong className="summary-value">{card.value}</strong>
              {card.valueUnit ? (
                <span className="summary-value-unit">{card.valueUnit}</span>
              ) : null}
              {(() => {
                const delta = formatSummaryDelta(card)
                if (!delta) return null
                const classes = [
                  'summary-delta',
                  card.slug === 'sessions' || card.slug === 'energy'
                    ? 'summary-delta--sessions'
                    : '',
                  delta.className,
                ]
                  .filter(Boolean)
                  .join(' ')
                return <span className={classes}>{delta.label}</span>
              })()}
            </div>
            {card.breakdown ? (
              <div className="summary-breakdown">
                {card.breakdown.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="summary-breakdown-item">
                    <span className="summary-breakdown-value">{item.value}</span>
                    <span className="summary-breakdown-label">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`summary-detail ${card.detailValue ? 'has-value' : ''}`}>
                <span className="summary-detail-label">{card.detail}</span>
                {card.detailValue ? (
                  <span className="summary-detail-value">{card.detailValue}</span>
                ) : null}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="dashboard-split">
        <article className="alerts-card">
          <header>
            <h2>Alerts</h2>
            <span className="tag critical">{alerts.length} Active</span>
          </header>
          <ul>
            {alerts.map((alert) => (
              <li key={alert.id}>
                <span className="alert-icon">
                  <img src="/assets/warning-triangle.png" alt="" aria-hidden="true" />
                </span>
                <div className="alert-content">
                  <p>{alert.title}</p>
                  <span>{alert.timestamp}</span>
                </div>
                <div className="alert-actions">
                  <button
                    type="button"
                    className="alert-ack-button"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    disabled={acknowledgingAlerts.has(alert.id)}
                  >
                    {acknowledgingAlerts.has(alert.id) ? 'Acknowledging...' : 'Acknowledge'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="connectors-card">
          <header>
            <h2>Connectors</h2>
          </header>
          <div className="connectors-bar" role="img" aria-label="Connector distribution">
            {connectorStatus.map((item) => (
              <span
                key={item.label}
                className="connectors-segment"
                style={{
                  backgroundColor: item.tint || item.color,
                  flexGrow: item.value || 0,
                  minWidth: item.value ? '12px' : 0,
                }}
                title={`${item.label}: ${item.value}`}
              />
            ))}
          </div>
          <ul className="connectors-list">
            {connectorStatus.map((item) => (
              <li key={item.label}>
                <div className="label">
                  <span
                    className="dot"
                    style={{
                      backgroundColor: item.tint || item.color,
                      borderColor: item.border || item.color,
                    }}
                  />
                  <span>{item.label}</span>
                </div>
                <strong>{item.value.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
          <footer className="connectors-total">
            <span>Total Connectors</span>
            <strong>{connectorsTotal.toLocaleString()}</strong>
          </footer>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="energy-card">
          <header>
            <h2>Energy</h2>
            <div className="legend">
              <span>
                <span className="legend-dot dc" /> DC
              </span>
              <span>
                <span className="legend-dot ac" /> AC
              </span>
            </div>
          </header>

          <div className="energy-body">
            <ul className="energy-axis">
              {energyAxisLevels.map((level, index) => (
                <li key={`${level}-${index}`}>
                  <span>{level.toLocaleString()} kWh</span>
                </li>
              ))}
            </ul>

            <div className="energy-chart" ref={energyChartRef}>
              {filteredEnergy.length ? (
                <>
                  <div
                    className="energy-chart-scroll"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(
                        filteredEnergy.length,
                        1
                      )}, minmax(0, 1fr))`,
                    }}
                  >
                    {filteredEnergy.map((point) => {
                      const monthActive = hoveredEnergy?.id === point.id

                      return (
                        <div
                          key={point.id}
                          className={`energy-month ${monthActive ? 'active' : ''}`}
                          onMouseLeave={handleEnergyClear}
                        >
                          <div className="energy-bars">
                            {ENERGY_DATASETS.map(({ key, className }) => {
                              const value = Number.isFinite(point[key]) ? point[key] : 0
                              const safeMax =
                                Number.isFinite(energyYMax) && energyYMax > 0 ? energyYMax : 1
                              const ratio = Math.min(1, value / safeMax)
                              const height = Math.max(6, ratio * 100)
                              const datasetActive =
                                monthActive && hoveredEnergy?.dataset === key

                              return (
                                <button
                                  type="button"
                                  key={key}
                                  className={`bar bar-${className} ${
                                    datasetActive ? 'hovered' : ''
                                  }`}
                                  onMouseEnter={(event) =>
                                    handleEnergyHover(point, key, event)
                                  }
                                  onMouseMove={(event) =>
                                    handleEnergyHover(point, key, event)
                                  }
                                  onFocus={(event) => handleEnergyHover(point, key, event)}
                                  onBlur={(event) => {
                                    const wrapper =
                                      event.currentTarget.closest('.energy-month')
                                    if (!wrapper?.contains(event.relatedTarget)) {
                                      handleEnergyClear()
                                    }
                                  }}
                                >
                                  <span
                                    className={`fill ${className}`}
                                    style={{ height: `${height}%` }}
                                  />
                                </button>
                              )
                            })}
                          </div>
                          <div className="month">
                            {spansMultipleYears
                              ? `${point.monthShort} '${String(point.year).slice(-2)}`
                              : point.monthShort}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {hoveredEnergy?.point ? (() => {
                    const point = hoveredEnergy.point
                    const datasetKey = hoveredEnergy.dataset
                    const value = Number(point?.[datasetKey]) || 0
                    const currencyCode = point?.costCurrency || revenueCurrency || 'EGP'
                    const hasSelectedCost =
                      point?.costCurrency && Number.isFinite(point?.[`${datasetKey}Cost`])
                    const costValue = hasSelectedCost
                      ? point?.[`${datasetKey}Cost`]
                      : currencyCode === 'JOD'
                      ? point?.[`${datasetKey}CostJod`]
                      : point?.[`${datasetKey}CostEgp`]
                    return (
                      <div
                        className="energy-tooltip-floating"
                        style={{ left: hoveredEnergy.x, top: hoveredEnergy.y }}
                      >
                        <div className="energy-tooltip">
                          <span className="energy-tooltip-date">
                            {formatDisplayDate(point.rangeStart)}
                          </span>
                          <span className="energy-tooltip-value">
                            {value.toLocaleString()} kWh
                          </span>
                          <span className="energy-tooltip-cost">
                            Equivalent cost {formatCurrency(costValue || 0, currencyCode)}
                          </span>
                        </div>
                        <span className="energy-tooltip-dot" aria-hidden="true">
                          <svg
                            width="30"
                            height="30"
                            viewBox="0 0 30 30"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <g filter="url(#energy-tooltip-shadow)">
                              <circle cx="15" cy="12" r="12" fill="white" />
                            </g>
                            <circle cx="15.0001" cy="12" r="6" fill="currentColor" />
                            <defs>
                              <filter
                                id="energy-tooltip-shadow"
                                x="0"
                                y="0"
                                width="30"
                                height="30"
                                filterUnits="userSpaceOnUse"
                                colorInterpolationFilters="sRGB"
                              >
                                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                <feColorMatrix
                                  in="SourceAlpha"
                                  type="matrix"
                                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                  result="hardAlpha"
                                />
                                <feOffset dy="3" />
                                <feGaussianBlur stdDeviation="1.5" />
                                <feComposite in2="hardAlpha" operator="out" />
                                <feColorMatrix
                                  type="matrix"
                                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                                />
                                <feBlend
                                  mode="normal"
                                  in2="BackgroundImageFix"
                                  result="effect1_dropShadow_616_22592"
                                />
                                <feBlend
                                  mode="normal"
                                  in="SourceGraphic"
                                  in2="effect1_dropShadow_616_22592"
                                  result="shape"
                                />
                              </filter>
                            </defs>
                          </svg>
                        </span>
                      </div>
                    )
                  })() : null}
                </>
              ) : (
                <p className="data-placeholder">No energy data for the selected range.</p>
              )}
            </div>
          </div>
        </article>

        <article className="conditions-card">
          <header>
            <h2>Chargers Condition</h2>
            <button
              type="button"
              className="link-button"
              onClick={() => navigate('/chargers')}
            >
              See All
            </button>
          </header>
          <div className="conditions-body">
            <div
              className="conditions-chart"
              style={{
                '--conditions-available-deg': `${availableDeg}deg`,
              }}
              aria-label={`Chargers condition: ${availablePercent}% available`}
            >
              <span className="conditions-label conditions-label-available">
                {availablePercent}%
              </span>
              <span className="conditions-label conditions-label-unavailable">
                {unavailablePercent}%
              </span>
              {/* <span className="conditions-value">{availablePercent}%</span> */}
            </div>
            <ul>
              <li>
                <span className="dot available" aria-hidden="true" />
                <span className="legend-title">Available</span>
                <strong>{availableChargerCount.toLocaleString()}</strong>
              </li>
              <li>
                <span className="dot unavailable" aria-hidden="true" />
                <span className="legend-title">Unavailable</span>
                <strong>{unavailableChargerCount.toLocaleString()}</strong>
              </li>
            </ul>
          </div>
        </article>
      </section>

      {canViewRevenue ? (
      <section className="revenue-section">
          <header className="revenue-section-header">
            <div>
              <h2>Revenue</h2>
              <p>{revenueRangeLabel ? `Summary · ${revenueRangeLabel}` : 'Summary'}</p>
            </div>
            <button type="button" className="ghost-button" onClick={openRevenueDatePicker}>
              <img src="/assets/Date.png" alt="" aria-hidden="true" className="action-icon" />
              Filter by date
            </button>
          </header>

          <div className="revenue-highlights">
            <article className="revenue-highlight-card">
              <header>
                <span className="label">Revenue</span>
                <RevenueIcon className="revenue-icon" aria-hidden="true" focusable="false" />
              </header>
              <div className="value-row">
                <strong>{formatCurrency(revenueMetrics.periodTotal, revenueCurrency)}</strong>
                <div className="revenue-trend-stack">
                  <span className={`revenue-trend ${revenueTrendDisplay.className}`}>
                    {revenueTrendDisplay.label}
                  </span>
                </div>
              </div>
              <p className="sub-label">
                <span className="sub-label-text">Today's Revenue</span>
                <strong className="sub-label-value">
                  {formatCurrency(revenueMetrics.todayValue, revenueCurrency)}
                </strong>
              </p>
            </article>

            <article className="revenue-highlight-card secondary">
              <header>
                <span className="label">Avg. Revenue / Session</span>
                <RevenueIcon className="revenue-icon" aria-hidden="true" focusable="false" />
              </header>
              <div className="value-row">
                <strong>{avgRevenueLabel}</strong>
              </div>
            </article>
          </div>

          <div className="revenue-content">
            <article className="top-revenue-card">
              <header>
                <h2>Top 5 Revenue By Owner</h2>
              </header>
              <ul className="revenue-top-list">
                {revenueTop.map((item, index) => {
                  const percent = Math.min(100, (item.amount / REVENUE_TARGET) * 100)
                  const remaining = Math.max(0, REVENUE_TARGET - item.amount)
                  return (
                    <li key={`${item.owner}-${index}`}>
                      <div className="revenue-top-row">
                        <span className="revenue-owner">{item.owner}</span>
                        <strong className="revenue-amount">{item.formatted}</strong>
                      </div>
                      <div className="revenue-progress" aria-hidden="true">
                        <div className="revenue-progress-bar" style={{ width: `${percent}%` }}>
                          <span className="revenue-progress-marker" />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>

            <article className="revenue-chart-card">
              <header>
                <h2>Revenue Trend</h2>
              </header>
              <div className="revenue-chart">
                {revenueChart.coords.length ? (
                  <div
                    className="revenue-chart-frame"
                    style={{
                      '--revenue-axis-steps': Math.max(revenueChart.yTicks.length - 1, 1),
                    }}
                  >
                    <ul className="revenue-axis-y">
                      {revenueChart.yTicks.map((tick, idx) => {
                        const maxValue = revenueChart.maxValue || 1
                        const ratio = maxValue ? tick / maxValue : 0
                        const topPercent = 100 - ratio * 100
                        const isTop = idx === 0
                        const isBottom = idx === revenueChart.yTicks.length - 1

                        return (
                          <li
                            key={`tick-${tick}-${idx}`}
                            style={{
                              top: `${topPercent}%`,
                              transform: isTop
                                ? 'translateY(0)'
                                : isBottom
                                ? 'translateY(-100%)'
                                : 'translateY(-50%)',
                            }}
                          >
                            {tick.toLocaleString()} {revenueCurrency}
                          </li>
                        )
                      })}
                    </ul>

                    <div
                      className="revenue-plot"
                      onMouseMove={(event) => {
                        if (!revenueChart.sampledPoints.length) return
                        const plotRect = event.currentTarget.getBoundingClientRect()
                        const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
                        const svgElement = revenueLineRef.current?.ownerSVGElement
                        const ctm = svgElement?.getScreenCTM()
                        if (!ctm) return

                        let pointerSvg = null
                        if (typeof DOMPoint === 'function') {
                          pointerSvg = new DOMPoint(event.clientX, event.clientY).matrixTransform(
                            ctm.inverse()
                          )
                        } else if (svgElement?.createSVGPoint) {
                          const svgPoint = svgElement.createSVGPoint()
                          svgPoint.x = event.clientX
                          svgPoint.y = event.clientY
                          pointerSvg = svgPoint.matrixTransform(ctm.inverse())
                        }

                        if (!pointerSvg) return

                        const svgX = clamp(pointerSvg.x, 0, revenueChart.width)
                        const pointOnPath = findPathPointAtX(revenueLineRef.current, svgX)
                        if (!pointOnPath) return

                        const xRatio = revenueChart.width - revenueChart.paddingX * 2
                          ? (pointOnPath.x - revenueChart.paddingX) /
                            (revenueChart.width - revenueChart.paddingX * 2)
                          : 0
                        const clampedXRatio = clamp(xRatio, 0, 1)
                        const dayFloat =
                          revenueChart.rangeStartDay +
                          clampedXRatio * (revenueChart.dayCount - 1)
                        const day = Math.round(dayFloat)
                        const date = new Date(revenueChart.baseYear, revenueChart.baseMonth, day)

                        const rangeHeight = revenueChart.height - revenueChart.paddingY * 2
                        const valueRatio = rangeHeight
                          ? (revenueChart.height - revenueChart.paddingY - pointOnPath.y) /
                            rangeHeight
                          : 0
                        const value = Math.max(0, Math.round(valueRatio * revenueChart.maxValue))

                        const pointOnScreen =
                          typeof DOMPoint === 'function'
                            ? new DOMPoint(pointOnPath.x, pointOnPath.y).matrixTransform(ctm)
                            : null
                        const fallbackX =
                          revenueChart.width
                            ? (pointOnPath.x / revenueChart.width) * plotRect.width
                            : 0
                        const fallbackY =
                          revenueChart.height
                            ? (pointOnPath.y / revenueChart.height) * plotRect.height
                            : 0

                        setHoveredRevenue({
                          x: pointOnScreen ? pointOnScreen.x - plotRect.left : fallbackX,
                          y: pointOnScreen ? pointOnScreen.y - plotRect.top : fallbackY,
                          value,
                          dateLabel: formatDisplayDate(date),
                        })
                      }}
                      onMouseLeave={() => setHoveredRevenue(null)}
                    >
                      <svg
                        viewBox={`0 0 ${REVENUE_CHART_SIZE.width} ${REVENUE_CHART_SIZE.height}`}
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient
                            id="revenueGradient"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="var(--theme-primary)" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="var(--theme-primary)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {revenueChart.areaPath ? (
                          <path d={revenueChart.areaPath} fill="url(#revenueGradient)" opacity="1" />
                        ) : null}
                        {revenueChart.linePath ? (
                          <path
                            d={revenueChart.linePath}
                            fill="none"
                            stroke="var(--theme-primary)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            ref={revenueLineRef}
                          />
                        ) : null}
                      </svg>

                      {hoveredRevenue ? (
                        <div
                          className="energy-tooltip-floating"
                          style={{ left: `${hoveredRevenue.x}px`, top: `${hoveredRevenue.y}px` }}
                        >
                          <div className="energy-tooltip">
                            <span className="energy-tooltip-date">{hoveredRevenue.dateLabel}</span>
                            <span className="energy-tooltip-value">
                              {hoveredRevenue.value.toLocaleString()} {revenueCurrency}
                            </span>
                          </div>
                          <span className="energy-tooltip-dot" aria-hidden="true">
                            <svg
                              width="30"
                              height="30"
                              viewBox="0 0 30 30"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <g filter="url(#revenue-tooltip-shadow)">
                                <circle cx="15" cy="12" r="12" fill="white" />
                              </g>
                              <circle cx="15.0001" cy="12" r="6" fill="currentColor" />
                              <defs>
                                <filter
                                  id="revenue-tooltip-shadow"
                                  x="0"
                                  y="0"
                                  width="30"
                                  height="30"
                                  filterUnits="userSpaceOnUse"
                                  colorInterpolationFilters="sRGB"
                                >
                                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                  <feColorMatrix
                                    in="SourceAlpha"
                                    type="matrix"
                                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                    result="hardAlpha"
                                  />
                                  <feOffset dy="3" />
                                  <feGaussianBlur stdDeviation="1.5" />
                                  <feComposite in2="hardAlpha" operator="out" />
                                  <feColorMatrix
                                    type="matrix"
                                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                                  />
                                  <feBlend
                                    mode="normal"
                                    in2="BackgroundImageFix"
                                    result="effect1_dropShadow_616_22592"
                                  />
                                  <feBlend
                                    mode="normal"
                                    in="SourceGraphic"
                                    in2="effect1_dropShadow_616_22592"
                                    result="shape"
                                  />
                                </filter>
                              </defs>
                            </svg>
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <ul
                      className="revenue-axis-x"
                      style={{ '--revenue-axis-days': revenueChart.dayCount || 1 }}
                    >
                      {revenueChart.xTicks.map((tick) => (
                        <li
                          key={`axis-x-${tick.day}`}
                          style={{ gridColumn: `${tick.position} / span 1` }}
                        >
                          {tick.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="data-placeholder">No revenue data for the selected range.</p>
                )}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {isRevenuePickerOpen ? (
        <div
          className="date-dialog-backdrop"
          role="presentation"
          onClick={() => setIsRevenuePickerOpen(false)}
        >
          <div
            className="date-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revenue-date-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="revenue-date-dialog-title">Select revenue date range</h2>
              <p className="date-summary">
                <span>
                  From: <strong>{revenueTempRange.start ? formatDisplayDate(revenueTempRange.start) : '--'}</strong>
                </span>
                <span className="arrow">→</span>
                <span>
                  To:{' '}
                  <strong>
                    {revenueTempRange.end
                      ? formatDisplayDate(revenueTempRange.end)
                      : revenueTempRange.start
                      ? formatDisplayDate(revenueTempRange.start)
                      : '--'}
                  </strong>
                </span>
              </p>
            </header>

            <div className="date-picker-body">
              <div className="date-calendar">
                {revenueMonthsToRender.map((monthDate, index) => {
                  const cells = buildMonthCells(monthDate)
                  return (
                    <div className="calendar-month" key={monthDate.toISOString()}>
                      <div className="month-header">
                        <button
                          type="button"
                          className="nav-button"
                          onClick={() => handleRevenueMonthStep(-1)}
                          disabled={index !== 0}
                          aria-label="Previous month"
                        >
                          ‹
                        </button>
                        <span>
                          {monthDate.toLocaleString('default', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <button
                          type="button"
                          className="nav-button"
                          onClick={() => handleRevenueMonthStep(1)}
                          disabled={index !== revenueMonthsToRender.length - 1}
                          aria-label="Next month"
                        >
                          ›
                        </button>
                      </div>
                      <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <span key={day} className="day-name">
                            {day}
                          </span>
                        ))}
                        {cells.map(({ date, currentMonth }) => {
                          const isSelectedStart =
                            revenueTempRange.start && isSameDay(date, revenueTempRange.start)
                          const isSelectedEnd =
                            revenueTempRange.end && isSameDay(date, revenueTempRange.end)
                          const isBetween =
                            revenueTempRange.start &&
                            revenueTempRange.end &&
                            date > revenueTempRange.start &&
                            date < revenueTempRange.end

                          return (
                            <button
                              key={date.toISOString()}
                              type="button"
                              className={`calendar-day ${
                                currentMonth ? '' : 'muted'
                              } ${isSelectedStart || isSelectedEnd ? 'selected' : ''} ${
                                isBetween ? 'between' : ''
                              }`}
                              onClick={() => handleRevenueDaySelect(date, currentMonth)}
                            >
                              {date.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <aside className="date-sidebar">
                <p>Quick selections</p>
                <ul>
                  {revenueQuickRanges.map((range) => (
                    <li key={range.label}>
                      <button type="button" onClick={range.action}>
                        {range.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <footer className="date-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsRevenuePickerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={applyRevenueTempRange}
              >
                Apply
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {isEnergyPickerOpen ? (
        <div
          className="date-dialog-backdrop"
          role="presentation"
          onClick={() => setIsEnergyPickerOpen(false)}
        >
          <div
            className="date-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="date-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="date-dialog-title">Select date range</h2>
              <p className="date-summary">
                <span>
                  From:{' '}
                  <strong>
                    {energyTempRange.start ? formatDisplayDate(energyTempRange.start) : '--'}
                  </strong>
                </span>
                <span className="arrow">→</span>
                <span>
                  To:{' '}
                  <strong>
                    {energyTempRange.end
                      ? formatDisplayDate(energyTempRange.end)
                      : energyTempRange.start
                      ? formatDisplayDate(energyTempRange.start)
                      : '--'}
                  </strong>
                </span>
              </p>
            </header>

            <div className="date-picker-body">
              <div className="date-calendar">
                {energyMonthsToRender.map((monthDate, index) => {
                  const cells = buildMonthCells(monthDate)
                  return (
                    <div className="calendar-month" key={monthDate.toISOString()}>
                      <div className="month-header">
                        <button
                          type="button"
                          className="nav-button"
                          onClick={() => handleEnergyMonthStep(-1)}
                          disabled={index !== 0}
                          aria-label="Previous month"
                        >
                          ‹
                        </button>
                        <span>
                          {monthDate.toLocaleString('default', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <button
                          type="button"
                          className="nav-button"
                          onClick={() => handleEnergyMonthStep(1)}
                          disabled={index !== energyMonthsToRender.length - 1}
                          aria-label="Next month"
                        >
                          ›
                        </button>
                      </div>
                      <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <span key={day} className="day-name">
                            {day}
                          </span>
                        ))}
                        {cells.map(({ date, currentMonth }) => {
                          const isSelectedStart =
                            energyTempRange.start && isSameDay(date, energyTempRange.start)
                          const isSelectedEnd =
                            energyTempRange.end && isSameDay(date, energyTempRange.end)
                          const isBetween =
                            energyTempRange.start &&
                            energyTempRange.end &&
                            date > energyTempRange.start &&
                            date < energyTempRange.end

                          return (
                            <button
                              key={date.toISOString()}
                              type="button"
                              className={`calendar-day ${
                                currentMonth ? '' : 'muted'
                              } ${isSelectedStart || isSelectedEnd ? 'selected' : ''} ${
                                isBetween ? 'between' : ''
                              }`}
                              onClick={() => handleEnergyDaySelect(date, currentMonth)}
                            >
                              {date.getDate()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <aside className="date-sidebar">
                <p>Quick selections</p>
                <ul>
                  {energyQuickRanges.map((range) => (
                    <li key={range.label}>
                      <button type="button" onClick={range.action}>
                        {range.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <footer className="date-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsEnergyPickerOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={applyEnergyTempRange}
              >
                Apply
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default Overview
