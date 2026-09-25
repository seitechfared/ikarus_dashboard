import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { hexToRgba } from '@/utils/color'
import { getThemeColors } from '@/utils/theme'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal'
import PillDropdown from '@/components/PillDropdown'
import '@/styles/dashboard.css'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import { mapServerCustomPeriods, resolvePeriodLabels } from '../pricing/pricingHelpers'

const toTitle = (value) =>
  (value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const ACCESS_LABELS = {
  rfid: 'RFID',
  qr: 'QR Code',
  ls118: '1S1B',
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseLocalDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value
  const text = String(value)
  if (DATE_ONLY_PATTERN.test(text)) {
    const [y, m, d] = text.split('-').map((part) => Number(part))
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const formatLocalDate = (dateObj) => {
  if (!dateObj) return ''
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const buildMonthCells = (monthDate) => {
  const cells = []
  const firstOfMonth = startOfMonth(monthDate)
  const startDay = firstOfMonth.getDay()
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const prevMonthDays = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate()
  for (let i = 0; i < 42; i += 1) {
    let date
    let currentMonth = true
    if (i < startDay) {
      date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, prevMonthDays - (startDay - i) + 1)
      currentMonth = false
    } else if (i >= startDay + totalDays) {
      date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, i - (startDay + totalDays) + 1)
      currentMonth = false
    } else {
      date = new Date(monthDate.getFullYear(), monthDate.getMonth(), i - startDay + 1)
    }
    cells.push({ date, currentMonth })
  }
  return cells
}

const groupLogsByDay = (rows = []) => {
  const map = new Map()
  rows.forEach((row) => {
    const dayKey = row.occurred_at ? row.occurred_at.slice(0, 10) : '—'
    if (!map.has(dayKey)) {
      map.set(dayKey, [])
    }
    map.get(dayKey).push(row)
  })
  return Array.from(map.entries())
}

const formatNumber = (value, fractionDigits = 2) => {
  if (value === null || value === undefined) return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

const formatDurationText = (seconds) => {
  if (seconds === null || seconds === undefined) return '-'
  const totalSeconds = Number(seconds)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '-'
  const mins = Math.floor(totalSeconds / 60)
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  const secs = Math.floor(totalSeconds % 60)
  if (hrs) return `${hrs}h ${rem}m ${secs}s`
  if (mins) return `${mins}m ${secs}s`
  return `${secs}s`
}

const formatBillableMinutesText = (minutes) => {
  if (minutes === null || minutes === undefined) return '-'
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric) || numeric < 0) return '-'
  return `${numeric} min`
}

const renderBillingSummaryText = (totalAmount, chargingAmount, currency) => (
  <span className="billing-breakdown">
    <span className="billing-breakdown-primary">
      {totalAmount !== null && totalAmount !== undefined
        ? `${Number(totalAmount).toFixed(2)} ${currency || ''}`.trim()
        : '-'}
    </span>
    <span className="billing-breakdown-note">
      Charging: {chargingAmount !== null && chargingAmount !== undefined
        ? `${Number(chargingAmount).toFixed(2)} ${currency || ''}`.trim()
        : '-'}
    </span>
  </span>
)

const DownloadIcon = () => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20.3447 14.1624C20.171 14.1624 20.0043 14.2314 19.8814 14.3543C19.7585 14.4772 19.6895 14.6438 19.6895 14.8176V17.0553C19.6895 17.5828 19.48 18.0886 19.107 18.4616C18.734 18.8345 18.2282 19.044 17.7008 19.044H6.29924C5.7718 19.044 5.26596 18.8345 4.893 18.4616C4.52005 18.0886 4.31052 17.5828 4.31052 17.0553V14.8176C4.31052 14.6438 4.24148 14.4772 4.1186 14.3543C3.99571 14.2314 3.82905 14.1624 3.65526 14.1624C3.48147 14.1624 3.31481 14.2314 3.19192 14.3543C3.06904 14.4772 3 14.6438 3 14.8176V17.0553C3.00087 17.9301 3.34874 18.7687 3.96728 19.3873C4.58582 20.0058 5.42449 20.3537 6.29924 20.3546H17.7008C18.5755 20.3537 19.4142 20.0058 20.0327 19.3873C20.6513 18.7687 20.9991 17.9301 21 17.0553V14.8176C21 14.6438 20.931 14.4772 20.8081 14.3543C20.6852 14.2314 20.5185 14.1624 20.3447 14.1624Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
    <path
      d="M11.5348 16.0756C11.5957 16.137 11.6682 16.1857 11.748 16.219C11.8279 16.2522 11.9135 16.2694 12 16.2694C12.0865 16.2694 12.1722 16.2522 12.252 16.219C12.3319 16.1857 12.4043 16.137 12.4652 16.0756L16.1937 12.3471C16.2977 12.2219 16.3514 12.0625 16.3444 11.8999C16.3373 11.7373 16.27 11.5831 16.1555 11.4674C16.0411 11.3517 15.8876 11.2828 15.7251 11.274C15.5626 11.2652 15.4026 11.3172 15.2763 11.4199L12.6553 14.041V4.30052C12.6553 4.12674 12.5862 3.96007 12.4634 3.83718C12.3405 3.7143 12.1738 3.64526 12 3.64526C11.8262 3.64526 11.6596 3.7143 11.5367 3.83718C11.4138 3.96007 11.3448 4.12674 11.3448 4.30052V14.0311L8.72371 11.4101C8.60076 11.2871 8.434 11.2181 8.26012 11.2181C8.08623 11.2181 7.91947 11.2871 7.79652 11.4101C7.67357 11.5331 7.60449 11.6998 7.60449 11.8737C7.60449 12.0476 7.67357 12.2143 7.79652 12.3373L11.5348 16.0756Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
  </svg>
)

const DEFAULT_FEEDBACK_PAGE_SIZE = 10
const FEEDBACK_PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 30, label: '30 / page' },
  { value: 50, label: '50 / page' },
]

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
      fill="url(#paint0_linear_rating)"
    />
    <defs>
      <linearGradient id="paint0_linear_rating" x1="9.99998" y1="2.01737" x2="9.99998" y2="17.984" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE61C" />
        <stop offset="1" stopColor="#FFA929" />
      </linearGradient>
    </defs>
  </svg>
)

const renderStars = (rating) => {
  const stars = []
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  for (let i = 0; i < fullStars; i += 1) {
    stars.push(<StarIcon key={i} />)
  }
  if (hasHalfStar && fullStars < 5) {
    stars.push(
      <svg key="half" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="paint0_linear_half">
            <stop offset="0%" stopColor="#FFE61C" />
            <stop offset="50%" stopColor="#FFA929" />
            <stop offset="50%" stopColor="#E0E0E0" />
            <stop offset="100%" stopColor="#E0E0E0" />
          </linearGradient>
        </defs>
        <path
          d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
          fill="url(#paint0_linear_half)"
        />
      </svg>
    )
  }
  for (let i = stars.length; i < 5; i += 1) {
    stars.push(
      <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.99998 15.7957L6.09415 17.849C5.25249 18.2915 4.26915 17.5774 4.42915 16.6399L5.17499 12.2899L2.01499 9.2082C1.33332 8.54487 1.70915 7.3882 2.64999 7.24987L7.01832 6.61654L8.97082 2.6582C9.39165 1.80404 10.6075 1.80404 11.0292 2.6582L12.9817 6.61654L17.35 7.24987C18.2908 7.38737 18.6667 8.5432 17.9858 9.2082L14.825 12.2899L15.5708 16.6399C15.7308 17.5774 14.7475 18.2924 13.9058 17.849L9.99998 15.7957Z"
          fill="#E0E0E0"
        />
      </svg>
    )
  }
  return stars
}

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  const stringValue =
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : String(value)
  const needsQuotes = /[",\n]/.test(stringValue)
  const escaped = stringValue.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

const downloadCsv = ({ headers, rows, filename }) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  const csvLines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const stringifyPayload = (payload) => {
  if (payload === null || payload === undefined) {
    return ''
  }
  if (typeof payload === 'string') {
    return payload
  }
  try {
    return JSON.stringify(payload)
  } catch (err) {
    return String(payload)
  }
}

const formatDisplayValue = (value, fallback = '-') => {
  if (value === null || value === undefined) {
    return fallback
  }
  if (typeof value === 'string') {
    return value
  }
  const stringified = stringifyPayload(value)
  return stringified || fallback
}

const MEASURAND_LABELS = {
  voltage: 'Voltage',
  'current.import': 'Current Import',
  'power.active.import': 'Active Power',
  'energy.active.import.register': 'Energy Import',
  temperature: 'Temperature',
  soc: 'State of Charge',
}

const formatMeasurandLabel = (measurand) => {
  if (!measurand) {
    return 'Reading'
  }
  const normalized = String(measurand).trim().toLowerCase()
  if (MEASURAND_LABELS[normalized]) {
    return MEASURAND_LABELS[normalized]
  }
  return toTitle(String(measurand).replace(/\./g, '_'))
}

const extractMeterValues = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const meterValues = payload.payload?.meterValue || payload.payload?.meter_value || payload.meterValue || []
  if (!Array.isArray(meterValues)) {
    return []
  }
  const items = []
  meterValues.forEach((entry) => {
    const sampled = entry?.sampledValue || entry?.sampled_value || []
    if (!Array.isArray(sampled)) {
      return
    }
    sampled.forEach((sample) => {
      items.push({
        label: formatMeasurandLabel(sample?.measurand || sample?.metric || sample?.measured),
        value: sample?.value,
        unit: sample?.unit,
      })
    })
  })
  return items
}

const resolveStatusValue = (status) => {
  const rawValue = status?.value ?? status?.status ?? status?.label ?? status ?? ''
  if (typeof rawValue === 'string') {
    return rawValue.toLowerCase()
  }
  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return String(rawValue).toLowerCase()
  }
  return ''
}

const resolveStatusLabel = (status) => {
  const labelCandidate = status?.label ?? status?.value ?? status?.status ?? status ?? ''
  if (typeof labelCandidate === 'string') {
    return status?.label ? labelCandidate : toTitle(labelCandidate)
  }
  if (typeof labelCandidate === 'number' || typeof labelCandidate === 'boolean') {
    return String(labelCandidate)
  }
  return formatDisplayValue(labelCandidate, '-')
}

const extractPayloadRaw = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return ''
  }
  const rawValue = payload.raw ?? payload.raw_message ?? payload.raw_payload
  return stringifyPayload(rawValue)
}

const actionRequiresFieldValue = (field, value) => {
  if (!field.required) {
    return true
  }
  return value !== undefined && value !== null && String(value).trim() !== ''
}

// Chart component with hover interaction
const ChartWithHover = ({
  chartKey,
  chartTitle,
  path,
  area,
  yLabels,
  points,
  gridLines,
  periods,
  color,
  isEnergy,
  currency,
  statsRange,
  setStatsRange,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const chartRef = useRef(null)

  const handleMouseMove = (e) => {
    if (!chartRef.current || !points.length) return

    const svg = chartRef.current.querySelector('svg')
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const svgPoint = svg.createSVGPoint()
    svgPoint.x = e.clientX - rect.left
    svgPoint.y = e.clientY - rect.top

    // Convert to SVG coordinates (viewBox is 0 0 1000 220)
    const svgX = (svgPoint.x / rect.width) * 1000

    // Find the nearest point
    let nearestPoint = points[0]
    let minDistance = Math.abs(svgX - points[0].x)

    points.forEach((pt) => {
      const distance = Math.abs(svgX - pt.x)
      if (distance < minDistance) {
        minDistance = distance
        nearestPoint = pt
      }
    })

    setHoveredPoint(nearestPoint)
    setTooltipPosition({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  return (
    <div className="stats-chart-card fullwidth">
      <div className="stats-chart-header">
        <div>
          <h3>{chartTitle}</h3>
        </div>
        <div className="stats-range-toggle">
          {['daily', 'monthly'].map((range) => (
            <button
              key={range}
              type="button"
              className={statsRange === range ? 'active' : ''}
              onClick={() => setStatsRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-chart-frame">
        <ul className="stats-axis-y">
          {yLabels.map((label, idx) => (
            <li key={`${chartKey}-y-${idx}`}>
              {label.label} {isEnergy ? 'kWh' : currency}
            </li>
          ))}
        </ul>
        <div
          className="stats-plot"
          ref={chartRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className="chart-svg">
            <defs>
              <linearGradient id={`gradient-${chartKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {gridLines?.map((grid, idx) => (
              <line
                key={`grid-${idx}`}
                x1={grid.x1}
                y1={grid.y}
                x2={grid.x2}
                y2={grid.y}
                stroke="#E5E8E6"
                strokeWidth="1"
                strokeDasharray="2,2"
                opacity="0.6"
              />
            ))}
            {/* Area fill */}
            {area ? <path d={area} fill={`url(#gradient-${chartKey})`} opacity="1" /> : null}
            {/* Line */}
            {path ? (
              <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {/* Hover dot */}
            {hoveredPoint ? (
              <g className="hover-point">
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="6"
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            ) : null}
          </svg>
          {/* Tooltip */}
          {hoveredPoint ? (
            <div
              className="chart-tooltip"
              style={{
                position: 'fixed',
                left: `${tooltipPosition.x}px`,
                top: `${tooltipPosition.y - 60}px`,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            >
              <div className="chart-tooltip-date">{hoveredPoint.period}</div>
              <div className="chart-tooltip-value">
                {formatNumber(hoveredPoint.value, 0)} {isEnergy ? 'kWh' : currency}
              </div>
            </div>
          ) : null}
          <ul className="stats-axis-x" style={{ '--stats-axis-count': periods.length || 1 }}>
            {periods.map((p) => (
              <li key={`${chartKey}-x-${p}`}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

const buildLineGeometry = (series = [], key, width = 1000, height = 220) => {
  if (!series.length) return { path: '', area: '', points: [], yLabels: [], gridLines: [] }
  const padding = 20
  const values = series.map((pt) => Number(pt[key] || 0))
  const maxValue = Math.max(...values, 1)
  const usableHeight = height - padding * 2
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : width - padding * 2

  const points = series.map((pt, idx) => {
    const x = padding + idx * step
    const y = padding + (1 - Number(pt[key] || 0) / maxValue) * usableHeight
    return { x, y, value: Number(pt[key] || 0), period: pt.period }
  })

  // Build smooth path using quadratic curves
  const buildSmoothPath = (points) => {
    if (points.length < 2) {
      const [{ x, y }] = points
      return `M ${x} ${y}`
    }
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i += 1) {
      const current = points[i]
      const next = points[i + 1]
      const previous = points[i - 1] ?? current
      const nextNext = points[i + 2] ?? next
      const cp1x = current.x + (next.x - previous.x) / 6
      const cp1y = current.y + (next.y - previous.y) / 6
      const cp2x = next.x - (nextNext.x - current.x) / 6
      const cp2y = next.y - (nextNext.y - current.y) / 6
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`
    }
    return d
  }

  const path = buildSmoothPath(points)

  // Build smooth area path
  const first = points[0]
  const last = points[points.length - 1]
  const areaPath = buildSmoothPath(points)
  const area = `${areaPath} L ${last.x.toFixed(2)} ${height - padding} L ${first.x.toFixed(2)} ${height - padding} Z`

  // Generate Y-axis labels with proper formatting (0, 8,000, 16,000, etc.)
  const yLabelCount = 6
  const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
    const ratio = i / (yLabelCount - 1)
    const value = maxValue * (1 - ratio)
    return {
      label: formatNumber(value, 0),
      y: padding + ratio * usableHeight,
    }
  })

  // Generate grid lines
  const gridLines = yLabels.map((label) => ({
    y: label.y,
    x1: padding,
    x2: width - padding,
  }))

  return { path, area, points, yLabels, gridLines }
}

function DatePickerField({ value, onChange, id, placeholder, triggerLabel, className }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const date = parseLocalDate(value)
      if (date) return startOfMonth(date)
    }
    return startOfMonth(new Date())
  })
  const pickerRef = useRef(null)

  useEffect(() => {
    if (value) {
      const date = parseLocalDate(value)
      if (date) {
        setCurrentMonth(startOfMonth(date))
      }
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const cells = buildMonthCells(currentMonth)

  const handleDateSelect = (date, isCurrentMonth) => {
    if (!isCurrentMonth) return
    const dateStr = formatLocalDate(date)
    onChange({ target: { value: dateStr } })
    setIsOpen(false)
  }

  const handleMonthStep = (direction) => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return startOfMonth(newDate)
    })
  }

  const displayValue = value
    ? parseLocalDate(value)?.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : triggerLabel || placeholder || 'Filter by Date'

  return (
    <div className={`date-picker-field ${className || ''}`} ref={pickerRef}>
      <button
        type="button"
        id={id}
        className="date-picker-trigger logs-date-pill"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="logs-date-label">{displayValue}</span>
        <span className="logs-date-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_3003_16182)">
              <path
                d="M1.68896 2.8125H16.314C16.314 2.8125 17.439 2.8125 17.439 3.9375V16.3125C17.439 16.3125 17.439 17.4375 16.314 17.4375H1.68896C1.68896 17.4375 0.563965 17.4375 0.563965 16.3125V3.9375C0.563965 3.9375 0.563965 2.8125 1.68896 2.8125Z"
                stroke="#67716B"
                strokeWidth="1.125"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M0.563965 7.3125H17.439" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.06396 4.5V0.5625" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.939 4.5V0.5625" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <clipPath id="clip0_3003_16182">
                <rect width="18" height="18" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </span>
      </button>
      {isOpen ? (
        <div className="date-picker-dialog">
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav-button"
              onClick={() => handleMonthStep(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="date-picker-month">
              {currentMonth.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              className="date-picker-nav-button"
              onClick={() => handleMonthStep(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="date-picker-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day} className="date-picker-day-name">
                {day}
              </span>
            ))}
            {cells.map(({ date, currentMonth: isCurrentMonth }) => {
              const selectedDate = parseLocalDate(value)
              const isSelected = selectedDate && isSameDay(date, selectedDate)
              return (
                <button
                  key={formatLocalDate(date)}
                  type="button"
                  className={`date-picker-day ${!isCurrentMonth ? 'muted' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  onClick={() => handleDateSelect(date, isCurrentMonth)}
                  disabled={!isCurrentMonth}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const renderStatusBadge = (status) => {
  const value = resolveStatusValue(status)
  const label = resolveStatusLabel(status)
  const color = status?.color
  const themeColors = getThemeColors()

  let backgroundColor
  let textColor

  if (value === 'available') {
    backgroundColor = 'rgba(46, 165, 98, 0.12)'
    textColor = '#2EA561'
  } else if (value === 'unavailable' || value === 'faulted' || value === 'fault') {
    backgroundColor = 'rgba(237, 74, 74, 0.12)'
    textColor = '#ED4A4A'
  } else if (value === 'planned') {
    backgroundColor = 'rgba(62, 79, 68, 0.12)'
    textColor = '#3E4F44'
  } else if (value === 'finishing' || value === 'cancelled' || value === 'canceled') {
    backgroundColor = 'rgba(62, 79, 68, 0.12)'
    textColor = '#3E4F44'
  } else if (color) {
    backgroundColor = hexToRgba(color, 0.15) || hexToRgba(themeColors.secondary, 0.15)
    textColor = color
  } else {
    backgroundColor = hexToRgba(themeColors.secondary, 0.15) || 'rgba(18, 77, 94, 0.15)'
    textColor = themeColors.secondary
  }

  return (
    <span className="status-badge charger-status-badge" style={{ backgroundColor, color: textColor }}>
      {label || '-'}
    </span>
  )
}

const renderOnOffBadge = (isOn) => {
  const on = Boolean(isOn)
  const backgroundColor = on ? 'rgba(46, 165, 98, 0.12)' : 'rgba(237, 74, 74, 0.12)'
  const textColor = on ? '#2EA561' : '#ED4A4A'
  return (
    <span className="status-badge charger-status-badge" style={{ backgroundColor, color: textColor }}>
      {on ? 'On' : 'Off'}
    </span>
  )
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

const statusClass = (status) => {
  if (!status) return ''
  if (status.startsWith('available')) return 'available'
  if (status.startsWith('charge')) return 'charging'
  if (status.startsWith('fault')) return 'faulted'
  return status.replace(/[^a-z-]/gi, '').toLowerCase()
}

const firstValue = (...values) => values.find((v) => v !== undefined && v !== null && v !== '')

function ChargerDetails() {
  const { chargerId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canViewRevenue = roleCapabilities.canViewRevenue
  const canAccessBilling = roleCapabilities.canAccessBilling
  const [charger, setCharger] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  )
  const [error, setError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [logsError, setLogsError] = useState('')
  const [sessions, setSessions] = useState({ rows: [], pagination: null })
  const [sessionsPage, setSessionsPage] = useState(1)
  const [logs, setLogs] = useState({ rows: [], pagination: null })
  const [logsPage, setLogsPage] = useState(1)
  const [logsDateStart, setLogsDateStart] = useState('')
  const [logsDateEnd, setLogsDateEnd] = useState('')
  const logsDatesInitialized = useRef(false)
  const [logsRowsPerPage, setLogsRowsPerPage] = useState(10)
  const [logsDayPage, setLogsDayPage] = useState({})
  const [events, setEvents] = useState({ rows: [], pagination: null })
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState('')
  const [feedbacks, setFeedbacks] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackPage, setFeedbackPage] = useState(1)
  const [feedbackPageSize, setFeedbackPageSize] = useState(DEFAULT_FEEDBACK_PAGE_SIZE)
  const [actions, setActions] = useState({ rows: [], pagination: null })
  const [actionsPage, setActionsPage] = useState(1)
  const [actionsLoading, setActionsLoading] = useState(false)
  const [actionsError, setActionsError] = useState('')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const statsChartKeys = canViewRevenue ? ['energy', 'revenue'] : ['energy']
  const [statsError, setStatsError] = useState('')
  const [statsRange, setStatsRange] = useState('daily')
  const [statsDateRange, setStatsDateRange] = useState({ start: '', end: '' })
  const [activeTab, setActiveTab] = useState(location.state?.focusTab || 'info')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })
  const [isRemoteActionsOpen, setIsRemoteActionsOpen] = useState(false)
  const [remoteActionsContext, setRemoteActionsContext] = useState(null)
  const [remoteActionsLoading, setRemoteActionsLoading] = useState(false)
  const [remoteActionsError, setRemoteActionsError] = useState('')
  const [remoteCustomerSearch, setRemoteCustomerSearch] = useState('')
  const [remoteCustomerLoading, setRemoteCustomerLoading] = useState(false)
  const [selectedRemoteAction, setSelectedRemoteAction] = useState('')
  const [remoteFieldValues, setRemoteFieldValues] = useState({})
  const [isRemoteActionSubmitting, setIsRemoteActionSubmitting] = useState(false)
  const [remoteActionBanner, setRemoteActionBanner] = useState(null)
  const [remoteSubmitError, setRemoteSubmitError] = useState('')
  const remoteBannerTimeoutRef = useRef(null)
  const remoteCustomerSearchAbortRef = useRef(null)
  const { showToast } = useInlineToast('chargers')

  useEffect(() => {
    if (error) {
      showToast({ message: error, variant: 'error' })
    }
  }, [error, showToast])

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (location.state?.openRemoteActions) {
      setIsRemoteActionsOpen(true)
    }
    return () => {
      if (remoteBannerTimeoutRef.current) {
        clearTimeout(remoteBannerTimeoutRef.current)
      }
    }
  }, [location.state])

  useEffect(() => {
    if (!canAccessBilling && activeTab === 'pricing') {
      setActiveTab('info')
    }
  }, [activeTab, canAccessBilling])

  const fetchChargerDetails = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const detailQuery = new URLSearchParams({
          customer_limit: '1',
          customer_offset: '0',
        })
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/?${detailQuery.toString()}`, {
          signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load charger details.')
        }
        const data = await response.json()
        const payload = data.charger || data
        const infoConnectors = data.info?.connectors?.rows
        const enhancedCharger = {
          ...payload,
          info: data.info,
          connectors_detail: payload.connectors_detail || payload.connectors_detail || undefined,
          connectors_rows: infoConnectors,
        }
        setCharger(enhancedCharger)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          if (!silent) {
            setError(err.message || 'Unable to load charger details.')
          }
        }
      } finally {
        if (!silent && !(signal && signal.aborted)) {
          setLoading(false)
        }
      }
    },
    [chargerId]
  )

  useEffect(() => {
    const controller = new AbortController()
    let pollController = null

    fetchChargerDetails({ signal: controller.signal })

    const intervalId = setInterval(() => {
      if (!isTabVisible) {
        return
      }
      if (pollController) {
        pollController.abort()
      }
      pollController = new AbortController()
      fetchChargerDetails({ signal: pollController.signal, silent: true })
    }, 20000)

    return () => {
      controller.abort()
      if (pollController) {
        pollController.abort()
      }
      clearInterval(intervalId)
    }
  }, [chargerId, fetchChargerDetails, isTabVisible])

  useEffect(() => {
    if (activeTab !== 'sessions') return
    setSessionsPage(1)
  }, [activeTab, chargerId])

  const fetchRemoteActionsContext = useCallback(
    async ({ signal, customerQuery = '', silent = false } = {}) => {
      if (!silent) {
        setRemoteActionsLoading(true)
        setRemoteActionsError('')
      } else {
        setRemoteCustomerLoading(true)
      }
      try {
        const query = new URLSearchParams({
          customer_limit: '200',
          customer_offset: '0',
        })
        const normalizedCustomerQuery = customerQuery.trim()
        if (normalizedCustomerQuery) {
          query.set('customer_query', normalizedCustomerQuery)
        }
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/remote-actions/?${query.toString()}`, {
          signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load remote actions.')
        }
        const data = await response.json()
        if (signal?.aborted) {
          return
        }
        setRemoteActionsContext(data)
        const availableActions = data.actions || []
        setSelectedRemoteAction((current) => {
          if (current && availableActions.some((action) => action.key === current)) {
            return current
          }
          return availableActions[0]?.key || ''
        })
      } catch (remoteError) {
        if (signal?.aborted) {
          return
        }
        console.error(remoteError)
        if (!silent) {
          setRemoteActionsError(remoteError.message || 'Unable to load remote actions.')
        }
      } finally {
        if (signal?.aborted) {
          return
        }
        if (!silent) {
          setRemoteActionsLoading(false)
        } else {
          setRemoteCustomerLoading(false)
        }
      }
    },
    [chargerId]
  )

  useEffect(() => {
    if (!isRemoteActionsOpen) {
      if (remoteCustomerSearchAbortRef.current) {
        remoteCustomerSearchAbortRef.current.abort()
        remoteCustomerSearchAbortRef.current = null
      }
      setRemoteActionsContext(null)
      setRemoteActionsError('')
      setRemoteCustomerSearch('')
      setRemoteCustomerLoading(false)
      setSelectedRemoteAction('')
      setRemoteFieldValues({})
      return
    }

    const controller = new AbortController()
    fetchRemoteActionsContext({ signal: controller.signal, customerQuery: '' })
    return () => controller.abort()
  }, [fetchRemoteActionsContext, isRemoteActionsOpen])

  useEffect(() => {
    if (!isRemoteActionsOpen || !remoteActionsContext) {
      return
    }
    const currentQuery = String(remoteActionsContext?.customer_options?.query || '').trim()
    const nextQuery = String(remoteCustomerSearch || '').trim()
    if (nextQuery === currentQuery) {
      return
    }
    if (remoteCustomerSearchAbortRef.current) {
      remoteCustomerSearchAbortRef.current.abort()
      remoteCustomerSearchAbortRef.current = null
    }
    const debounceId = setTimeout(() => {
      const controller = new AbortController()
      remoteCustomerSearchAbortRef.current = controller
      fetchRemoteActionsContext({
        signal: controller.signal,
        customerQuery: nextQuery,
        silent: true,
      })
    }, 300)
    return () => {
      clearTimeout(debounceId)
      if (remoteCustomerSearchAbortRef.current) {
        remoteCustomerSearchAbortRef.current.abort()
        remoteCustomerSearchAbortRef.current = null
      }
    }
  }, [fetchRemoteActionsContext, isRemoteActionsOpen, remoteActionsContext, remoteCustomerSearch])

  useEffect(() => {
    if (activeTab !== 'sessions') return
    const controller = new AbortController()
    const loadPage = async () => {
      setSessionsLoading(true)
      setSessionsError('')
      try {
        const response = await fetch(
          `${API_BASE}/chargers/${chargerId}/sessions/?page=${sessionsPage}`,
          {
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          }
        )
        if (!response.ok) {
          throw new Error('Unable to load sessions.')
        }
        const data = await response.json()
        setSessions({
          rows: Array.isArray(data.rows) ? data.rows : [],
          pagination: data.pagination || null,
        })
      } catch (sessionError) {
        if (sessionError.name !== 'AbortError') {
          console.error(sessionError)
          setSessionsError(sessionError.message || 'Unable to load sessions.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setSessionsLoading(false)
        }
      }
    }
    loadPage()
    return () => controller.abort()
  }, [activeTab, chargerId, sessionsPage])

  useEffect(() => {
    if (activeTab !== 'logs') return
    const controller = new AbortController()
    const fetchLogs = async () => {
      // On first open: probe for the latest log date, then set a 7-day window.
      // The state update re-triggers this effect with the resolved dates.
      if (!logsDatesInitialized.current) {
        try {
          const probe = await fetch(
            `${API_BASE}/chargers/${chargerId}/logs/?page=1&page_size=1`,
            { signal: controller.signal, credentials: 'include', headers: appendAuthHeader() }
          )
          if (controller.signal.aborted) return
          if (probe.ok) {
            const probeData = await probe.json()
            const latestRow = Array.isArray(probeData.rows) ? probeData.rows[0] : null
            const latestDate = latestRow?.occurred_at
              ? latestRow.occurred_at.slice(0, 10)
              : new Date().toISOString().slice(0, 10)
            const startDate = new Date(latestDate)
            startDate.setDate(startDate.getDate() - 7)
            logsDatesInitialized.current = true
            setLogsDateEnd(latestDate)
            setLogsDateStart(startDate.toISOString().slice(0, 10))
            // state change will re-trigger the effect with resolved dates
            return
          }
        } catch (probeError) {
          if (probeError.name === 'AbortError') return
        }
        // fallback: proceed without date filter
        logsDatesInitialized.current = true
      }

      setLogsLoading(true)
      setLogsError('')
      try {
        const dateQueryParts = []
        if (logsDateStart) dateQueryParts.push(`start_date=${logsDateStart}`)
        if (logsDateEnd) dateQueryParts.push(`end_date=${logsDateEnd}`)
        const dateQuery = dateQueryParts.length ? `&${dateQueryParts.join('&')}` : ''
        const pageSize = 100
        let page = 1
        let totalPages = 1
        const allRows = []

        while (page <= totalPages) {
          const response = await fetch(
            `${API_BASE}/chargers/${chargerId}/logs/?page=${page}&page_size=${pageSize}${dateQuery}`,
            {
              signal: controller.signal,
              credentials: 'include',
              headers: appendAuthHeader(),
            }
          )
          if (!response.ok) {
            throw new Error('Unable to load logs.')
          }
          const data = await response.json()
          const rows = Array.isArray(data.rows) ? data.rows : []
          allRows.push(...rows)
          const pagination = data.pagination || {}
          if (pagination.total_pages) {
            totalPages = pagination.total_pages
          } else if (rows.length < pageSize) {
            break
          }
          if (controller.signal.aborted) {
            return
          }
          page += 1
        }
        setLogs({
          rows: allRows,
          pagination: null,
        })
        setLogsPage(1)
      } catch (logError) {
        if (logError.name !== 'AbortError') {
          console.error(logError)
          setLogsError(logError.message || 'Unable to load logs.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLogsLoading(false)
        }
      }
    }

    fetchLogs()
    return () => controller.abort()
  }, [activeTab, chargerId, logsPage, logsDateStart, logsDateEnd])

  useEffect(() => {
    setLogsDayPage({})
  }, [logs])

  useEffect(() => {
    if (activeTab !== 'events') return
    setEventsPage(1)
  }, [activeTab, chargerId])

  useEffect(() => {
    if (activeTab !== 'feedback') return
    setFeedbackPage(1)
  }, [activeTab, chargerId])

  useEffect(() => {
    if (activeTab !== 'events') return
    const controller = new AbortController()
    const loadEvents = async () => {
      setEventsLoading(true)
      setEventsError('')
      try {
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/live-events/?limit=1000`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load events.')
        }
        const data = await response.json()
        const rows =
          Array.isArray(data.events) ? data.events : Array.isArray(data.rows) ? data.rows : Array.isArray(data.results) ? data.results : []
        setEvents({
          rows,
          pagination: {
            page: 1,
            page_size: rows.length,
            total_pages: 1,
            total_items: rows.length,
          },
        })
        setEventsPage(1)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          setEventsError(err.message || 'Unable to load events.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setEventsLoading(false)
        }
      }
    }
    loadEvents()
    return () => controller.abort()
  }, [activeTab, chargerId, eventsPage])

  useEffect(() => {
    if (activeTab !== 'feedback') return
    const controller = new AbortController()
    const loadFeedback = async () => {
      setFeedbackLoading(true)
      setFeedbackError('')
      try {
        const params = new URLSearchParams()
        if (chargerId) {
          params.set('charger_id', chargerId)
        }
        const response = await fetch(`${API_BASE}/feedback/?${params.toString()}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load charger feedback.')
        }
        const data = await response.json()
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data.rows)
            ? data.rows
            : []
        const normalized = rows.map((feedback) => ({
          id: feedback.id,
          email: feedback.email,
          rating: feedback.rating,
          comment: feedback.comment,
          submitted_at: feedback.submitted_at || feedback.created_at || feedback.timestamp,
        }))
        setFeedbacks(normalized)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          setFeedbacks([])
          setFeedbackError(err.message || 'Unable to load charger feedback.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setFeedbackLoading(false)
        }
      }
    }
    loadFeedback()
    return () => controller.abort()
  }, [activeTab, chargerId])

  useEffect(() => {
    if (activeTab !== 'actions') return
    const controller = new AbortController()
    const loadActions = async (page = 1) => {
      setActionsLoading(true)
      setActionsError('')
      try {
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/actions/?page=${page}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load actions history.')
        }
        const data = await response.json()
        const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data.results) ? data.results : []
        setActions({
          rows,
          pagination: data.pagination || data.meta || null,
        })
        setActionsPage(page)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          setActionsError(err.message || 'Unable to load actions history.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setActionsLoading(false)
        }
      }
    }
    loadActions()
    return () => controller.abort()
  }, [activeTab, chargerId, actionsPage])

  useEffect(() => {
    if (activeTab !== 'statistics') return
    const controller = new AbortController()
    const loadStats = async () => {
      setStatsLoading(true)
      setStatsError('')
      try {
        const rangeQuery =
          statsDateRange.start && statsDateRange.end
            ? `?start_date=${statsDateRange.start}&end_date=${statsDateRange.end}`
            : ''
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/statistics/${rangeQuery}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load statistics.')
        }
        const data = await response.json()
        setStats(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err)
          setStatsError(err.message || 'Unable to load statistics.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setStatsLoading(false)
        }
      }
    }
    loadStats()
    return () => controller.abort()
  }, [activeTab, chargerId, statsDateRange])

  const handleDeleteChargerClick = () => {
    if (!charger) {
      return
    }
    setDeleteModalState({ isOpen: true })
  }

  const handleDeleteCharger = async () => {
    if (!charger) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/chargers/${chargerId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete charger.')
      }
      showToast({
        title: 'Charger deleted',
        message: `${charger.name || charger.identifier || 'Charger'} was removed successfully.`,
        variant: 'success',
      })
      navigate('/chargers', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete charger.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }

  const handleDownloadLogs = useCallback(async () => {
    try {
      const dateQueryParts = []
      if (logsDateStart) dateQueryParts.push(`start_date=${logsDateStart}`)
      if (logsDateEnd) dateQueryParts.push(`end_date=${logsDateEnd}`)
      const dateQuery = dateQueryParts.length ? `&${dateQueryParts.join('&')}` : ''
      const pageSize = 100
      let page = 1
      let totalPages = 1
      const allRows = []

      while (page <= totalPages) {
        const response = await fetch(
          `${API_BASE}/chargers/${chargerId}/logs/?page=${page}&page_size=${pageSize}${dateQuery}`,
          {
            credentials: 'include',
            headers: appendAuthHeader(),
          }
        )
        if (!response.ok) {
          throw new Error('Unable to load logs for download.')
        }
        const data = await response.json()
        const rows = Array.isArray(data.rows) ? data.rows : []
        allRows.push(...rows)
        const pagination = data.pagination || {}
        if (pagination.total_pages) {
          totalPages = pagination.total_pages
        } else if (rows.length < pageSize) {
          break
        }
        page += 1
      }

      if (!allRows.length) {
        showToast({
          title: 'No logs',
          message: 'No logs to download for this charger.',
          variant: 'info',
        })
        return
      }
      const headers = ['No', 'Message Type', 'Direction', 'Connector', 'Severity', 'Timestamp', 'Payload', 'Raw']
      const rows = allRows.map((log, index) => ({
        No: index + 1,
        'Message Type': log.message_type || '',
        Direction: log.direction || '',
        Connector: log.connector?.label || log.connector?.number || log.connector?.id || '',
        Severity: log.severity || '',
        Timestamp: log.occurred_at || '',
        Payload: stringifyPayload(log.payload),
        Raw: extractPayloadRaw(log.payload),
      }))
      downloadCsv({
        headers,
        rows,
        filename: `charger_${chargerId}_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      })
    } catch (error) {
      console.error(error)
      showToast({
        title: 'Download failed',
        message: error.message || 'Unable to download logs.',
        variant: 'error',
      })
    }
  }, [chargerId, logsDateEnd, logsDateStart, showToast])

  const handleDownloadEvents = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/chargers/${chargerId}/live-events/?limit=1000`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error('Unable to load live events for download.')
      }
      const data = await response.json()
      const eventRows = Array.isArray(data.events)
        ? data.events
        : Array.isArray(data.rows)
          ? data.rows
          : Array.isArray(data.results)
            ? data.results
            : []
      if (!eventRows.length) {
        showToast({
          title: 'No events',
          message: 'No live events to download for this charger.',
          variant: 'info',
        })
        return
      }
      const headers = ['No', 'Event Type', 'Status', 'Connector', 'Timestamp', 'Payload', 'Raw']
      const rows = eventRows.map((event, index) => ({
        No: index + 1,
        'Event Type': event.event_type || event.type || event.name || '',
        Status: event.status?.label || event.status?.value || event.status || '',
        Connector: event.connector?.label || event.connector?.number || event.connector?.id || '',
        Timestamp: event.occurred_at || event.created_at || event.timestamp || '',
        Payload: stringifyPayload(event.payload),
        Raw: extractPayloadRaw(event.payload),
      }))
      downloadCsv({
        headers,
        rows,
        filename: `charger_${chargerId}_events_${new Date().toISOString().slice(0, 10)}.csv`,
      })
    } catch (error) {
      console.error(error)
      showToast({
        title: 'Download failed',
        message: error.message || 'Unable to download live events.',
        variant: 'error',
      })
    }
  }, [chargerId, showToast])

  const feedbackTotal = feedbacks.length
  const feedbackAverage = useMemo(() => {
    if (!feedbackTotal) return 0
    const sum = feedbacks.reduce((acc, entry) => acc + (Number(entry.rating) || 0), 0)
    return sum / feedbackTotal
  }, [feedbacks, feedbackTotal])
  const feedbackPositiveCount = useMemo(
    () => feedbacks.filter((entry) => (Number(entry.rating) || 0) >= 4).length,
    [feedbacks]
  )
  const feedbackTotalPages = useMemo(
    () => Math.max(1, Math.ceil(feedbackTotal / feedbackPageSize)),
    [feedbackTotal, feedbackPageSize]
  )
  const paginatedFeedbacks = useMemo(() => {
    const start = (feedbackPage - 1) * feedbackPageSize
    const end = start + feedbackPageSize
    return feedbacks.slice(start, end)
  }, [feedbacks, feedbackPage, feedbackPageSize])
  const handleFeedbackPageChange = (nextPage) => {
    setFeedbackPage(Math.min(Math.max(1, nextPage), feedbackTotalPages))
  }
  const handleFeedbackPageSizeChange = (event) => {
    const size = Number(event.target.value) || DEFAULT_FEEDBACK_PAGE_SIZE
    setFeedbackPageSize(size)
    setFeedbackPage(1)
  }

  const connectors = useMemo(() => {
    const directList =
      charger?.connectors_detail ||
      charger?.connectors_details ||
      charger?.connectors ||
      charger?.connectors_data ||
      charger?.connectors_list ||
      charger?.connectors_rows ||
      charger?.info?.connectors?.rows ||
      charger?.connectors_table?.rows ||
      []

    if (Array.isArray(directList)) {
      return directList
    }

    const tableRows =
      charger?.connectors?.rows ||
      charger?.connectors_rows ||
      []

    return Array.isArray(tableRows) ? tableRows : []
  }, [charger])

  const connectorsCount =
    charger?.connectors_total ??
    (Array.isArray(charger?.connectors?.rows) ? charger.connectors.rows.length : undefined) ??
    (Array.isArray(charger?.connectors_rows) ? charger.connectors_rows.length : undefined) ??
    (Array.isArray(charger?.info?.connectors?.rows) ? charger.info.connectors.rows.length : undefined) ??
    connectors.length
  const remoteActions = remoteActionsContext?.actions || []
  const selectedRemoteActionDefinition = useMemo(
    () => remoteActions.find((action) => action.key === selectedRemoteAction),
    [remoteActions, selectedRemoteAction]
  )
  const remoteCustomerOptionsMeta = remoteActionsContext?.customer_options || {}
  const remoteActionsCtaLabel = remoteActionsContext?.cta_label || 'Take Action'
  const remoteActionsNotes = remoteActionsContext?.refresh_notes
  const isRemoteActionReady = useMemo(() => {
    if (!selectedRemoteActionDefinition) {
      return false
    }
    return selectedRemoteActionDefinition.fields.every((field) =>
      actionRequiresFieldValue(field, remoteFieldValues[field.name])
    )
  }, [remoteFieldValues, selectedRemoteActionDefinition])
  const chargerDisplayId = firstValue(
    charger?.ocpp_identifier,
    charger?.identifier,
    charger?.id,
    charger?.name,
    charger?.serial_number,
    charger?.serialNumber,
    chargerId
  )
  const handleRemoteActionChange = (value) => {
    setSelectedRemoteAction(value)
    setRemoteSubmitError('')
  }

  useEffect(() => {
    if (!selectedRemoteActionDefinition) {
      setRemoteFieldValues({})
      return
    }
    setRemoteFieldValues((previous) => {
      const next = {}
      selectedRemoteActionDefinition.fields.forEach((field) => {
        if (previous[field.name] !== undefined) {
          next[field.name] = previous[field.name]
          return
        }
        if (Array.isArray(field.options) && field.options.length > 0) {
          if (field.searchable) {
            next[field.name] = ''
          } else {
            next[field.name] = field.options[0].value ?? ''
          }
          return
        }
        next[field.name] = ''
      })
      return next
    })
  }, [selectedRemoteActionDefinition])
  const dismissRemoteBanner = () => {
    if (remoteBannerTimeoutRef.current) {
      clearTimeout(remoteBannerTimeoutRef.current)
      remoteBannerTimeoutRef.current = null
    }
    setRemoteActionBanner(null)
  }
  const handleRemoteFieldChange = (name, value) => {
    setRemoteSubmitError('')
    setRemoteFieldValues((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleRemoteActionSubmit = async () => {
    if (!isRemoteActionReady || !selectedRemoteAction) return
    setIsRemoteActionSubmitting(true)
    setRemoteSubmitError('')
    try {
      const response = await fetch(`${API_BASE}/chargers/${chargerId}/remote-actions/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          action: selectedRemoteAction,
          ...remoteFieldValues,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.detail || 'Unable to execute remote action.')
      }
      if (remoteBannerTimeoutRef.current) {
        clearTimeout(remoteBannerTimeoutRef.current)
      }
      setRemoteActionBanner({
        variant: 'success',
        title: 'Success',
        message: payload?.message || 'Remote action executed.',
        id: Date.now(),
      })
      remoteBannerTimeoutRef.current = setTimeout(() => {
        dismissRemoteBanner()
      }, 12000)
      setIsRemoteActionsOpen(false)
      fetchChargerDetails({ silent: true })
    } catch (remoteError) {
      // Show the error inside the modal (where the user is), not as a
      // top-of-page banner that would be hidden behind the modal overlay.
      setRemoteSubmitError(remoteError.message || 'Unable to execute remote action.')
    } finally {
      setIsRemoteActionSubmitting(false)
    }
  }
  const configuration = charger?.configuration ?? {}
  const validity = charger?.validity ?? {}
  const pricingData =
    charger?.pricing ||
    charger?.pricing_data ||
    charger?.pricingInfo ||
    charger?.info?.pricing ||
    charger?.info?.pricing_data ||
    charger?.configuration?.pricing ||
    charger?.configuration?.pricing_data ||
    charger?.info?.configuration?.pricing ||
    {}
  // Prefer showing a gap over inventing a currency (e.g. EGP on a SAR charger).
  // Missing currency means pricing was never saved correctly and should be fixed in edit.
  const pricingCurrency =
    pricingData.currency ||
    pricingData.currency_code ||
    charger?.currency ||
    '-'
  const customPricingList = useMemo(() => {
    const raw =
      charger?.custom_pricing ||
      charger?.customPricing ||
      charger?.info?.custom_pricing ||
      charger?.info?.customPricing ||
      pricingData.custom_pricing ||
      pricingData.custom_periods ||
      pricingData.customPricing ||
      pricingData.custom_hours ||
      pricingData.customHours ||
      pricingData.hours ||
      charger?.pricing_periods ||
      charger?.pricingPeriods ||
      []
    return mapServerCustomPeriods(Array.isArray(raw) ? raw : [])
  }, [charger, pricingData])

  const headerTitle = charger?.name || charger?.identifier || 'Charger'
  const chargerDetails = useMemo(() => {
    const raw = charger?.charger_details || charger?.chargerDetails || {}
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch (error) {
        return {}
      }
    }
    return raw && typeof raw === 'object' ? raw : {}
  }, [charger])

  const summary = useMemo(
    () => [
      {
        label: 'Station',
        value:
          charger?.station?.name ||
          charger?.station?.title ||
          charger?.station_name ||
          '-',
      },
      {
        label: 'Site Owner',
        value:
          charger?.site_owner_name ||
          charger?.station?.site_owner ||
          charger?.station?.site_owner_name ||
          charger?.site_owner ||
          '-',
      },
      {
        label: 'Governorate',
        value:
          charger?.governorate ||
          charger?.station?.governorate ||
          charger?.station?.region ||
          '-',
      },
      { label: 'Connectors', value: connectorsCount ?? 0 },
      { label: 'Financing Type', value: toTitle(charger?.financing_type) || '-' },
      {
        label: 'Privacy Type',
        value: toTitle(charger?.visibility?.value || charger?.visibility) || '-',
      },
      {
        label: 'Charger Box Id',
        value: charger?.box_id || charger?.identifier || charger?.ocpp_identifier || '-',
      },
    ],
    [charger, connectorsCount]
  )

  const chargerDetailsItems = useMemo(
    () => [
      { label: 'Vendor', value: chargerDetails.vendor || '-' },
      { label: 'Model', value: chargerDetails.model || '-' },
      { label: 'Serial Number', value: chargerDetails.serial_number || '-' },
      { label: 'Firmware Version', value: chargerDetails.firmware_version || '-' },
    ],
    [chargerDetails]
  )


  const validityItems = [
    {
      label: 'Status' + (charger?.availability_override ? ' (Manual)' : ' (Auto)'),
      value: toTitle(
        validity.status?.value ||
          validity.status ||
          charger?.status?.value ||
          charger?.status
      ),
      badge: true,
    },
    {
      label: 'Subscription',
      value:
        toTitle(validity.subscription || validity.subscription_type || charger?.subscription_type) || '-',
    },
    {
      label: 'Valid from',
      value:
        validity.valid_from || charger?.valid_from
          ? parseLocalDate(validity.valid_from || charger?.valid_from)?.toLocaleDateString() || '-'
          : '-',
    },
    {
      label: 'Valid to',
      value:
        validity.valid_to || charger?.valid_to
          ? parseLocalDate(validity.valid_to || charger?.valid_to)?.toLocaleDateString() || '-'
          : '-',
    },
  ]

  const accessTypes = useMemo(() => {
    const types = configuration.access_types || charger?.access_methods || []
    if (Array.isArray(types)) {
      const labels = types
        .filter(Boolean)
        .map((type) => ACCESS_LABELS[type] || toTitle(type))
      return labels.length ? labels.join(', ') : '-'
    }
    return types ? ACCESS_LABELS[types] || toTitle(types) : '-'
  }, [charger, configuration])

  const costDisplayRaw = configuration.cost_display ?? charger?.access_cost_display
  const costDisplayOn =
    costDisplayRaw === undefined || costDisplayRaw === null
      ? true
      : typeof costDisplayRaw === 'boolean'
      ? costDisplayRaw
      : String(costDisplayRaw).toLowerCase() !== 'off'

  const showInMobileValue = normalizeBoolean(
    firstValue(
      configuration.show_in_mobile,
      configuration.showInMobile,
      charger?.show_in_mobile,
      charger?.showInMobile
    )
  )

  const configurationItems = [
    {
      label: 'Charger Type',
      value: (() => {
        const typeValue =
          configuration.charger_type ||
          configuration.station_type ||
          charger?.charger_type ||
          charger?.station?.type ||
          charger?.station_type ||
          ''
        if (!typeValue) return '-'
        const lower = String(typeValue).toLowerCase()
        if (lower === 'ac') return 'AC'
        if (lower === 'dc') return 'DC'
        return toTitle(typeValue)
      })(),
    },
    {
      label: 'Meter Mode',
      value: (() => {
        const meterModeValue =
          configuration.meter_mode ||
          configuration.meterMode ||
          charger?.meter_mode ||
          charger?.meterMode ||
          ''
        if (!meterModeValue) return '-'
        return toTitle(String(meterModeValue).toLowerCase())
      })(),
    },
    {
      label: 'Charger Access Type',
      value: accessTypes || '-',
    },
    {
      label: 'OCPP Transport',
      value: configuration.ocpp_transport || charger?.ocpp_transport || '-',
    },
    {
      label: 'OCPP Version',
      value: configuration.ocpp_version || charger?.ocpp_version || '-',
    },
    {
      label: 'Cost Display',
      value: costDisplayOn,
      badgeType: 'cost',
    },
    {
      label: 'Show in Mobile',
      value: showInMobileValue,
      badgeType: 'toggle',
    },
  ]

  return (
    <div className="charger-details-page">
      {isRemoteActionsOpen ? (
        <div
          className="remote-actions-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Remote Actions"
          onClick={() => {
            setIsRemoteActionsOpen(false)
            setRemoteSubmitError('')
          }}
        >
          <div
            className="remote-actions-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="remote-actions-header">
              <div className="remote-actions-heading">
                <p className="remote-actions-title">Remote Actions</p>
              </div>
              <button
                type="button"
                className="remote-actions-close"
                onClick={() => {
                  setIsRemoteActionsOpen(false)
                  setRemoteSubmitError('')
                }}
                aria-label="Close remote actions"
              >
                &times;
              </button>
            </div>

            <div className="remote-actions-body">
              {remoteActionsLoading ? (
                <p className="remote-actions-loading">Loading remote actions...</p>
              ) : remoteActionsError ? (
                <p className="remote-actions-loading">{remoteActionsError}</p>
              ) : remoteActions.length === 0 ? (
                <p className="remote-actions-loading">No remote actions available.</p>
              ) : (
                <>
                  <div className="remote-actions-field">
                    <label className="remote-actions-label">Charger ID</label>
                    <p style={{ fontWeight: '600', margin: '4px 0 0' }}>{chargerDisplayId || '-'}</p>
                  </div>
                  <div className="remote-actions-field">
                    <label className="remote-actions-label" htmlFor="remote-action-select">
                      Select Action
                    </label>
                    <div className="remote-actions-control">
                      <select
                        id="remote-action-select"
                        value={selectedRemoteAction}
                        onChange={(event) => handleRemoteActionChange(event.target.value)}
                      >
                        {remoteActions.map((action) => (
                          <option key={action.key} value={action.key}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedRemoteActionDefinition?.fields?.map((field) => {
                    const value = remoteFieldValues[field.name] ?? ''
                    const options = Array.isArray(field.options) ? field.options : []
                    const isSearchable = Boolean(field.searchable)
                    const isCustomerSource = field.source === 'customers'
                    if (field.type === 'select') {
                      const placeholder = {
                        value: '',
                        label: `Select ${field.label || 'option'}`,
                      }
                      const dropdownOptions =
                        options.length && (options[0]?.value === '' || options[0]?.value === null)
                          ? options
                          : [placeholder, ...options]
                      return (
                        <div className="remote-actions-field" key={field.name}>
                          <label className="remote-actions-label" htmlFor={`field-${field.name}`}>
                            {field.label}
                          </label>
                          <div className="remote-actions-control">
                            {isSearchable ? (
                              <PillDropdown
                                id={`field-${field.name}`}
                                value={value}
                                onChange={(event) => handleRemoteFieldChange(field.name, event.target.value)}
                                options={dropdownOptions}
                                searchable
                                searchPlaceholder={field.search_placeholder || `Search ${field.label || 'options'}`}
                                searchTerm={isCustomerSource ? remoteCustomerSearch : undefined}
                                onSearchTermChange={isCustomerSource ? setRemoteCustomerSearch : undefined}
                                isLoading={isCustomerSource && remoteCustomerLoading}
                              />
                            ) : (
                              <select
                                id={`field-${field.name}`}
                                value={value}
                                onChange={(event) => handleRemoteFieldChange(field.name, event.target.value)}
                                required={field.required}
                              >
                                {options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      )
                    }

                    const inputType = field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
                    const datalistId =
                      field.suggestions && field.suggestions.length
                        ? `suggestions-${field.name}`
                        : undefined
                    return (
                      <div className="remote-actions-field" key={field.name}>
                        <label className="remote-actions-label" htmlFor={`field-${field.name}`}>
                          {field.label}
                        </label>
                        <div className="remote-actions-control">
                          <input
                            id={`field-${field.name}`}
                            type={inputType}
                            list={datalistId}
                            value={value}
                            onChange={(event) => handleRemoteFieldChange(field.name, event.target.value)}
                            placeholder={field.label}
                            required={field.required}
                          />
                          {datalistId ? (
                            <datalist id={datalistId}>
                              {field.suggestions?.map((option) => (
                                <option key={option.email || option.label} value={option.email || option.label} />
                              ))}
                            </datalist>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}

                  {Boolean(remoteCustomerOptionsMeta?.has_more) ? (
                    <p className="remote-actions-notes">Keep typing to narrow down customer results.</p>
                  ) : null}

                  {remoteActionsNotes ? (
                    <p className="remote-actions-notes">{remoteActionsNotes}</p>
                  ) : null}
                </>
              )}
            </div>

            {remoteSubmitError ? (
              <p className="remote-actions-error" role="alert">
                {remoteSubmitError}
              </p>
            ) : null}

            <div className="remote-actions-footer">
              <button
                type="button"
                className="remote-actions-submit"
                onClick={handleRemoteActionSubmit}
                disabled={!isRemoteActionReady || isRemoteActionSubmitting}
              >
                {isRemoteActionSubmitting ? 'Submitting...' : remoteActionsCtaLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="details-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Chargers', to: '/chargers' },
                { label: headerTitle },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/chargers" ariaLabel="Back to chargers" />
              <h1>{headerTitle}</h1>
            </div>
          </div>
        </div>
        <div className="details-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsRemoteActionsOpen(true)}
          >
            Remote Actions
          </button>
          <button
            type="button"
            className="ghost-button danger"
            onClick={handleDeleteChargerClick}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/chargers/${chargerId}/edit`)}
            style={{
              width: '140px',
              minWidth: '140px',
              paddingLeft: '22px',
              paddingRight: '22px',
              paddingTop: '11px',
              paddingBottom: '11px',
              background: 'var(--theme-primary)',
              borderRadius: '12px',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              display: 'inline-flex',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                color: 'white',
                fontSize: '14px',
                fontFamily: 'Montserrat',
                fontWeight: 600,
                lineHeight: '26px',
                wordWrap: 'break-word',
              }}
            >
              Edit
            </span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="chargers" />

      {remoteActionBanner ? (
        <div className={`remote-action-banner ${remoteActionBanner.variant || 'info'}`} role="status">
          <div className="remote-action-banner-body">
            <div className="remote-action-banner-icon" aria-hidden="true">
              {remoteActionBanner.variant === 'error' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 9.75V13.5M12 16.5H12.0075M10.2127 4.12704L2.79807 17.25C2.47851 17.8216 2.31873 18.1074 2.34154 18.3404C2.36126 18.5442 2.45629 18.7332 2.60686 18.8659C2.77888 19.0187 3.08908 19.0187 3.7095 19.0187H20.2905C20.9109 19.0187 21.2211 19.0191 21.3931 18.8663C21.5437 18.7336 21.6387 18.5447 21.6585 18.3409C21.6813 18.1079 21.5215 17.8221 21.2019 17.2505L13.7873 4.12743C13.4651 3.55253 13.3039 3.26508 13.0864 3.15565C12.8957 3.06176 12.6795 3.06176 12.4889 3.15565C12.2713 3.26508 12.1101 3.55214 11.7879 4.12665L10.2127 4.12704Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="16" fill="currentColor" opacity="0.18" />
                  <path
                    d="M13.6 19.8L10.75 16.95L9.35 18.35L13.6 22.6L22.65 13.55L21.25 12.15L13.6 19.8Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </div>
            <div className="remote-action-banner-text">
              <strong>{remoteActionBanner.title || 'Notice'}</strong>
              <p>{remoteActionBanner.message}</p>
            </div>
          </div>
          <button
            type="button"
            className="remote-action-banner-close"
            aria-label="Dismiss action banner"
            onClick={dismissRemoteBanner}
          >
            &times;
          </button>
        </div>
      ) : null}

      <nav className="details-tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Charger Info
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Live Events
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Ratings & Feedback
        </button>
        {canAccessBilling ? (
          <button
            type="button"
            className={`tab ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('pricing')}
          >
            Pricing
          </button>
        ) : null}
        <button
          type="button"
          className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          Statistics
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Actions History
        </button>
      </nav>

      {loading ? <p className="data-placeholder">Loading charger details...</p> : null}
      {error ? <div className="data-warning">{error}</div> : null}

      {activeTab === 'sessions' ? (
        <div className="details-content">
          <section className="detail-section">
            {sessionsLoading ? <p className="data-placeholder">Loading sessions...</p> : null}
            {sessionsError ? <div className="data-warning">{sessionsError}</div> : null}

            {!sessionsLoading ? (
              <div className="sessions-table">
                <div className="sessions-header">
                  <span>No</span>
                  <span>User</span>
                  <span>TID</span>
                  <span>Connector</span>
                  <span>Start</span>
                  <span>End</span>
                  <span>Duration</span>
                  <span>
                    Energy (<span className="unit-label">kWh</span>)
                  </span>
                  <span>{canViewRevenue ? 'Total Amount' : 'Total Amount (Restricted)'}</span>
                  <span>{canViewRevenue ? 'Idle Fee' : 'Idle Fee (Restricted)'}</span>
                  <span>Idle Time</span>
                  <span>Billable Idle</span>
                  <span>Status</span>
                </div>
                {sessions.rows.map((session, index) => {
                  const pagination = sessions.pagination || {}
                  const baseIndex =
                    ((pagination.page || 1) - 1) * (pagination.page_size || sessions.rows.length || 10)
                  const rowNumber = baseIndex + index + 1
                  const customerLabel = session.customer?.email || '-'
                  const transactionLabel = session.ocpp_transaction_id ?? '-'
                  const connectorLabel =
                    session.connector?.number ||
                    session.connector?.label ||
                    session.connector?.id ||
                    '-'
                  const startDate = session.start_time ? new Date(session.start_time) : null
                  const endDate = session.end_time ? new Date(session.end_time) : null
                  const startText = startDate
                    ? `${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '-'
                  const endText = endDate
                    ? `${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '-'
                  const durationText = formatDurationText(session.duration_seconds)
                  const idleTimeText = formatDurationText(session.idle_time_seconds ?? session.idle_time)
                  const idleBillableText = formatBillableMinutesText(session.idle_billable_minutes)
                  const energyText =
                    session.energy_kwh !== null && session.energy_kwh !== undefined
                      ? Number(session.energy_kwh).toFixed(2)
                      : '-'
                  const revenueText = canViewRevenue
                    ? renderBillingSummaryText(
                        session.total_amount ?? session.amount,
                        session.charging_amount,
                        session.currency
                      )
                    : 'Restricted'
                  const idleFeeText = canViewRevenue
                    ? session.idle_fee !== null && session.idle_fee !== undefined
                      ? `${Number(session.idle_fee).toFixed(2)} ${session.currency || ''}`.trim()
                      : '-'
                    : 'Restricted'

                  return (
                    <div key={session.id || rowNumber} className="sessions-row">
                      <span>{rowNumber}</span>
                      <span className="sessions-user">{customerLabel}</span>
                      <span>{transactionLabel}</span>
                      <span>{connectorLabel}</span>
                      <span>{startText}</span>
                      <span>{endText}</span>
                      <span>{durationText}</span>
                      <span>{energyText}</span>
                      <span>{revenueText}</span>
                      <span>{idleFeeText}</span>
                      <span>{idleTimeText}</span>
                      <span>{idleBillableText}</span>
                      <span>{renderStatusBadge(session.status)}</span>
                    </div>
                  )
                })}
                {!sessions.rows.length && !sessionsLoading ? (
                  <p className="data-placeholder">No sessions available for this charger.</p>
                ) : null}
              </div>
            ) : null}

            {sessions.pagination ? (
              <div className="sessions-pagination">
                <div className="sessions-page-size">
                  <span className="rows-label">Rows in page</span>
                  <div className="rows-select">
                    <span className="rows-value">{sessions.pagination.page_size || 10}</span>
                  </div>
                </div>
                <div className="sessions-page-nav">
                  <span className="page-info">
                    {sessions.pagination.page} of {sessions.pagination.total_pages || 1}
                  </span>
                  <div className="page-buttons">
                    <button
                      type="button"
                      className="page-button"
                      disabled={sessions.pagination.page <= 1 || sessionsLoading}
                      onClick={() => setSessionsPage((prev) => Math.max(1, prev - 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="page-button"
                      disabled={
                        sessions.pagination.total_pages
                          ? sessions.pagination.page >= sessions.pagination.total_pages || sessionsLoading
                          : false
                      }
                      onClick={() =>
                        setSessionsPage((prev) =>
                          sessions.pagination.total_pages
                            ? Math.min(sessions.pagination.total_pages, prev + 1)
                            : prev + 1
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : activeTab === 'logs' ? (
        <div className="details-content">
          <section className="detail-section">
            {logsLoading ? <p className="data-placeholder">Loading logs...</p> : null}
            {logsError ? <div className="data-warning">{logsError}</div> : null}

            {!logsLoading ? (() => {
              const dayGroups = groupLogsByDay(logs.rows)
              if (!dayGroups.length) {
                return (
                  <div className="logs-day-block">
                    <div className="logs-day-header">
                      <div className="logs-day-title">No logs</div>
                      <div className="logs-filter">
                        <div className="logs-filter-range">
                          <DatePickerField
                            value={logsDateStart}
                            onChange={(e) => {
                              setLogsDateStart(e.target.value)
                              setLogsPage(1)
                              setLogsDayPage({})
                            }}
                            placeholder="From Date"
                          />
                          <span className="logs-filter-sep">to</span>
                          <DatePickerField
                            value={logsDateEnd}
                            onChange={(e) => {
                              setLogsDateEnd(e.target.value)
                              setLogsPage(1)
                              setLogsDayPage({})
                            }}
                            placeholder="To Date"
                          />
                        </div>
                        <button type="button" className="download-button" onClick={handleDownloadLogs}>
                          <DownloadIcon />
                          <span className="download-button__label">Download</span>
                        </button>
                      </div>
                    </div>
                    <p className="data-placeholder">No logs available for this charger.</p>
                  </div>
                )
              }

              return dayGroups.map(([dayKey, dayRows], idx) => {
                const currentPage = logsDayPage[dayKey] || 1
                const totalPages = Math.max(1, Math.ceil(dayRows.length / logsRowsPerPage))
                const startIndex = (currentPage - 1) * logsRowsPerPage
                const visibleRows = dayRows.slice(startIndex, startIndex + logsRowsPerPage)
                const dayDate = dayKey && dayKey !== '—' ? parseLocalDate(dayKey) : null
                const dayLabel = dayDate
                  ? dayDate.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'

                return (
                  <div key={dayKey || idx} className="logs-day-block">
                    <div className="logs-day-header">
                      <div className="logs-day-title">{dayLabel}</div>
                      {idx === 0 ? (
                        <div className="logs-filter">
                          <div className="logs-filter-range">
                            <DatePickerField
                              value={logsDateStart}
                              onChange={(e) => {
                                setLogsDateStart(e.target.value)
                                setLogsPage(1)
                                setLogsDayPage({})
                              }}
                              placeholder="From Date"
                            />
                            <span className="logs-filter-sep">to</span>
                            <DatePickerField
                              value={logsDateEnd}
                              onChange={(e) => {
                                setLogsDateEnd(e.target.value)
                                setLogsPage(1)
                                setLogsDayPage({})
                              }}
                              placeholder="To Date"
                            />
                          </div>
                          <button type="button" className="download-button" onClick={handleDownloadLogs}>
                            <DownloadIcon />
                            <span className="download-button__label">Download</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="logs-table">
                      <div className="logs-header">
                        <span>No</span>
                        <span>Message Type</span>
                        <span>Direction</span>
                        <span>Connector</span>
                        <span>Message</span>
                        <span>Severity</span>
                        <span>Timestamp</span>
                      </div>
                      {visibleRows.map((log, index) => {
                        const rowNumber = startIndex + index + 1
                        const connectorLabel =
                          log.connector?.number ||
                          log.connector?.label ||
                          log.connector?.id ||
                          '-'
                        const timestamp = log.occurred_at
                          ? new Date(log.occurred_at).toLocaleString()
                          : '-'
                        const rawPayload = log.payload?.raw ?? log.payload?.message ?? log.payload
                        let payloadParsed = null
                        if (rawPayload) {
                          if (typeof rawPayload === 'object') {
                            payloadParsed = rawPayload
                          } else if (typeof rawPayload === 'string') {
                            try { payloadParsed = JSON.parse(rawPayload) } catch { /* not JSON */ }
                          }
                        }

                        const renderLogPayload = () => {
                          if (!rawPayload) return <span className="logs-message-empty">—</span>
                          if (payloadParsed && typeof payloadParsed === 'object' && !Array.isArray(payloadParsed)) {
                            const entries = Object.entries(payloadParsed)
                            if (!entries.length) return <span className="logs-message-empty">—</span>
                            return (
                              <dl className="logs-message-list">
                                {entries.map(([k, v]) => (
                                  <div key={k} className="logs-message-entry">
                                    <dt>{k.replace(/_/g, ' ')}</dt>
                                    <dd>{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                                  </div>
                                ))}
                              </dl>
                            )
                          }
                          const text = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload)
                          return <span className="logs-message-text">{text}</span>
                        }

                        const messageType = formatDisplayValue(log.message_type, '-')
                        const directionLabel =
                          typeof log.direction === 'string'
                            ? toTitle(log.direction)
                            : formatDisplayValue(log.direction, '-')
                        const severityValue =
                          log.severity?.value ?? log.severity?.status ?? log.severity?.label ?? log.severity
                        const severityLabel = formatDisplayValue(severityValue, '-')

                        return (
                          <div key={log.id || rowNumber} className="logs-row">
                            <span>{rowNumber}</span>
                            <span>{messageType}</span>
                            <span>{directionLabel}</span>
                            <span>{connectorLabel}</span>
                            <div className="logs-message">{renderLogPayload()}</div>
                            <span>{renderStatusBadge({ label: severityLabel, value: severityValue })}</span>
                            <span>{timestamp}</span>
                          </div>
                        )
                      })}
                      {!visibleRows.length ? (
                        <p className="data-placeholder">No logs available for this day.</p>
                      ) : null}

                      <div className="logs-pagination">
                        <div className="logs-page-size">
                          <span className="rows-label">Rows in page</span>
                          <div className="rows-select">
                            <select
                              className="rows-value"
                              value={logsRowsPerPage}
                              onChange={(e) => {
                                setLogsRowsPerPage(Number(e.target.value))
                                setLogsDayPage({})
                              }}
                            >
                              {[10, 25, 50, 100].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="logs-page-nav">
                          <span className="page-info">
                            {currentPage} of {totalPages}
                          </span>
                          <div className="page-buttons">
                            <button
                              type="button"
                              className="page-button"
                              disabled={currentPage <= 1}
                              onClick={() =>
                                setLogsDayPage((prev) => ({
                                  ...prev,
                                  [dayKey]: Math.max(1, currentPage - 1),
                                }))
                              }
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="page-button"
                              disabled={currentPage >= totalPages}
                              onClick={() =>
                                setLogsDayPage((prev) => ({
                                  ...prev,
                                  [dayKey]: Math.min(totalPages, currentPage + 1),
                                }))
                              }
                            >
                              ›
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            })() : null}
          </section>
        </div>
      ) : activeTab === 'events' ? (
        <div className="details-content">
          <section className="detail-section">
            <header className="detail-section-header">
              <h2>Live Events</h2>
              <button type="button" className="download-button" onClick={handleDownloadEvents}>
                <DownloadIcon />
                <span className="download-button__label">Download</span>
              </button>
            </header>
            {eventsLoading ? <p className="data-placeholder">Loading events...</p> : null}
            {eventsError ? <div className="data-warning">{eventsError}</div> : null}

            {!eventsLoading ? (
              <div className="events-list">
                {events.rows.map((event, index) => {
                  const pagination = events.pagination || {}
                  const baseIndex =
                    ((pagination.page || eventsPage || 1) - 1) * (pagination.page_size || events.rows.length || 10)
                  const rowNumber = baseIndex + index + 1
                  const severityValue =
                    event.status?.value ||
                    event.status?.status ||
                    event.severity ||
                    event.level ||
                    event.status ||
                    null
                  const severityLabel = formatDisplayValue(
                    event.status?.label ?? event.severity ?? event.level ?? event.status ?? severityValue,
                    '-'
                  )
                  const severityColor = event.status?.color
                  const typeLabel = formatDisplayValue(event.type ?? event.event_type ?? event.name, '-')
                  const connectorLabel = formatDisplayValue(
                    event.connector?.label ?? event.connector?.number ?? event.connector?.id ?? event.connector,
                    '-'
                  )
                  const payload = event.payload || {}
                  const isMeterValues = payload?.action === 'MeterValues'
                  const meterValues = isMeterValues ? extractMeterValues(payload) : []
                  const meterTimestamp = payload?.payload?.meterValue?.[0]?.timestamp
                  const meterTimestampText = meterTimestamp ? new Date(meterTimestamp).toLocaleString() : null
                  const descriptionSource =
                    event.message ??
                    event.description ??
                    payload.message ??
                    payload.description ??
                    payload.raw ??
                    (payload && Object.keys(payload).length ? payload : null)
                  const description = isMeterValues
                    ? meterTimestampText
                      ? `Meter values at ${meterTimestampText}`
                      : `Meter values received (${meterValues.length || 0}).`
                    : formatDisplayValue(descriptionSource, '-')
                  const timestamp = event.occurred_at || event.created_at || event.timestamp
                  const timestampText = timestamp ? new Date(timestamp).toLocaleString() : '-'
                  const measured = formatDisplayValue(payload.measured ?? payload.metric ?? payload.measured_type, '-')
                  const value = formatDisplayValue(payload.value ?? payload.measured_value ?? payload.reading, '-')
                  const context = formatDisplayValue(payload.context, '-')
                  const location = formatDisplayValue(payload.location, '-')
                  const formatField = formatDisplayValue(payload.format, '-')

                  const chargerLabel = formatDisplayValue(charger?.identifier ?? charger?.box_id, '-')

                  return (
                    <div key={event.id || rowNumber} className="event-card">
                      <div className="event-card-header">
                        <div className="event-type-chip">{typeLabel}</div>
                        <div className="event-meta-right">
                          <span className="event-timestamp">{timestampText}</span>
                          {renderStatusBadge({ label: severityLabel, value: severityValue, color: severityColor })}
                        </div>
                      </div>
                      <div className="event-meta-line">
                        <span className="event-label">Charger ID:</span>
                        <span className="event-value">{chargerLabel}</span>
                        <span className="event-sep">|</span>
                        <span className="event-label">Connector:</span>
                        <span className="event-value">{connectorLabel}</span>
                      </div>
                      {isMeterValues ? (
                        meterValues.length ? (
                          <>
                            {meterTimestampText ? (
                              <div className="event-meta-line">
                                <span className="event-label">Timestamp:</span>
                                <span className="event-value">{meterTimestampText}</span>
                              </div>
                            ) : null}
                            {meterValues.map((item, itemIndex) => (
                              <div key={`${item.label}-${itemIndex}`} className="event-meta-line">
                                <span className="event-label">{item.label}:</span>
                                <span className="event-value">
                                  {formatDisplayValue(item.value, '-')}
                                  {item.unit ? ` ${item.unit}` : ''}
                                </span>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="event-meta-line">
                            <span className="event-label">Meter values:</span>
                            <span className="event-value">-</span>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="event-meta-line">
                            <span className="event-label">Measured:</span>
                            <span className="event-value">{measured || '-'}</span>
                            <span className="event-sep">|</span>
                            <span className="event-label">Value:</span>
                            <span className="event-value">{value || '-'}</span>
                          </div>
                          <div className="event-meta-line">
                            <span className="event-label">Context:</span>
                            <span className="event-value">{context || '-'}</span>
                            <span className="event-sep">|</span>
                            <span className="event-label">Location:</span>
                            <span className="event-value">{location || '-'}</span>
                            <span className="event-sep">|</span>
                            <span className="event-label">Format:</span>
                            <span className="event-value">{formatField || '-'}</span>
                          </div>
                        </>
                      )}
                      <div className="event-description">{description}</div>
                    </div>
                  )
                })}
                {!events.rows.length && !eventsLoading ? (
                  <p className="data-placeholder">No events available for this charger.</p>
                ) : null}
              </div>
            ) : null}

            {events.pagination ? (
              <div className="sessions-pagination">
                <div className="sessions-page-size">
                  <span className="rows-label">Rows in page</span>
                  <div className="rows-select">
                    <span className="rows-value">{events.pagination.page_size || 10}</span>
                  </div>
                </div>
                <div className="sessions-page-nav">
                  <span className="page-info">
                    {events.pagination.page || 1} of {events.pagination.total_pages || 1}
                  </span>
                  <div className="page-buttons">
                    <button
                      type="button"
                      className="page-button"
                      disabled={(events.pagination.page || 1) <= 1 || eventsLoading}
                      onClick={() => setEventsPage((prev) => Math.max(1, prev - 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="page-button"
                      disabled={
                        events.pagination.total_pages
                          ? (events.pagination.page || 1) >= events.pagination.total_pages || eventsLoading
                          : false
                      }
                      onClick={() =>
                        setEventsPage((prev) =>
                          events.pagination.total_pages
                            ? Math.min(events.pagination.total_pages, prev + 1)
                            : prev + 1
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : activeTab === 'feedback' ? (
        <div className="details-content">
          <section className="detail-section">
            <h2>Ratings & Feedback</h2>
            {feedbackLoading ? <p className="data-placeholder">Loading feedback...</p> : null}
            {feedbackError ? <div className="data-warning">{feedbackError}</div> : null}

            {!feedbackLoading && !feedbackError && feedbackTotal > 0 ? (
              <div className="rating-overview-card" style={{ marginBottom: '24px' }}>
                <div className="rating-overview-header">
                  <span className="rating-overview-title">Rating Average</span>
                  <div className="rating-overview-icon">
                    <StarIcon />
                  </div>
                </div>
                <div className="rating-overview-body">
                  <div className="rating-overview-score">
                    <span className="rating-overview-value">{feedbackAverage.toFixed(1)}</span>
                    <div className="rating-overview-score-star">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path
                          d="M12 18.9556L7.31298 21.4196C6.30298 21.9506 5.12298 21.0936 5.31498 19.9686L6.20998 14.7486L2.41798 11.0506C1.59998 10.2546 2.05098 8.86663 3.17998 8.70063L8.42198 7.94063L10.765 3.19062C11.27 2.16562 12.729 2.16562 13.235 3.19062L15.578 7.94063L20.82 8.70063C21.949 8.86563 22.4 10.2526 21.583 11.0506L17.79 14.7486L18.685 19.9686C18.877 21.0936 17.697 21.9516 16.687 21.4196L12 18.9556Z"
                          fill="url(#ratingCardStarCharger)"
                        />
                        <defs>
                          <linearGradient id="ratingCardStarCharger" x1="12" y1="2.42163" x2="12" y2="21.5816" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFE61C" />
                            <stop offset="1" stopColor="#FFA929" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                  <div className="rating-overview-meta">
                    <div className="rating-overview-meta-item">
                      <span className="rating-overview-meta-value">{feedbackPositiveCount}</span>
                      <span className="rating-overview-meta-label">Positive</span>
                    </div>
                    <div className="rating-overview-meta-item">
                      <span className="rating-overview-meta-value">
                        {Math.max(feedbackTotal - feedbackPositiveCount, 0)}
                      </span>
                      <span className="rating-overview-meta-label">Other</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!feedbackLoading && !feedbackError && paginatedFeedbacks.length > 0 ? (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <div className="chargers-table" style={{ width: '100%', minWidth: '100%' }}>
                  <div
                    className="chargers-table-header"
                    style={{ gridTemplateColumns: 'minmax(40px, 0.5fr) 1.2fr 1.5fr 1fr 2fr' }}
                  >
                    <div className="charger-cell order">No</div>
                    <div className="charger-cell">Date</div>
                    <div className="charger-cell">Email</div>
                    <div className="charger-cell">Rating</div>
                    <div className="charger-cell">Comment</div>
                  </div>
                  {paginatedFeedbacks.map((feedback, index) => {
                    const rowNumber = (feedbackPage - 1) * feedbackPageSize + index + 1
                    const submittedAt = feedback.submitted_at
                      ? new Date(feedback.submitted_at).toLocaleString()
                      : '-'
                    const ratingValue = Number(feedback.rating) || 0
                    return (
                      <article
                        key={feedback.id || rowNumber}
                        className="charger-row"
                        style={{ gridTemplateColumns: 'minmax(40px, 0.5fr) 1.2fr 1.5fr 1fr 2fr' }}
                      >
                        <div className="charger-cell order">{rowNumber}</div>
                        <div className="charger-cell">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {submittedAt}
                          </span>
                        </div>
                        <div className="charger-cell">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {feedback.email || '-'}
                          </span>
                        </div>
                        <div className="charger-cell">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ratingValue || '-'}
                            </span>
                            {ratingValue ? renderStars(ratingValue) : null}
                          </div>
                        </div>
                        <div className="charger-cell">
                          <span
                            title={feedback.comment || ''}
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          >
                            {feedback.comment || '-'}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>
                <footer className="chargers-footer">
                  <div className="pagination-info">
                    {feedbackTotal
                      ? `Showing ${paginatedFeedbacks.length ? (feedbackPage - 1) * feedbackPageSize + 1 : 0}-${Math.min(
                          feedbackPage * feedbackPageSize,
                          feedbackTotal
                        )} of ${feedbackTotal} feedback entries`
                      : 'No feedback to display'}
                  </div>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleFeedbackPageChange(feedbackPage - 1)}
                      disabled={feedbackPage <= 1 || feedbackLoading}
                    >
                      Previous
                    </button>
                    <span className="pagination-status">
                      Page {feedbackPage} of {feedbackTotalPages}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleFeedbackPageChange(feedbackPage + 1)}
                      disabled={feedbackPage >= feedbackTotalPages || feedbackLoading}
                    >
                      Next
                    </button>
                  </div>
                  <div className="page-size-picker">
                    <label htmlFor="charger-feedback-page-size">Rows per page</label>
                    <select
                      id="charger-feedback-page-size"
                      value={feedbackPageSize}
                      onChange={handleFeedbackPageSizeChange}
                      disabled={feedbackLoading}
                    >
                      {FEEDBACK_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </footer>
              </div>
            ) : null}

            {!feedbackLoading && !feedbackError && feedbackTotal === 0 ? (
              <div className="data-placeholder">No feedback found for this charger.</div>
            ) : null}
          </section>
        </div>
      ) : activeTab === 'actions' ? (
        <div className="details-content">
          <section className="detail-section">
            <h2>Actions History</h2>
            {actionsLoading ? <p className="data-placeholder">Loading actions...</p> : null}
            {actionsError ? <div className="data-warning">{actionsError}</div> : null}

            {!actionsLoading ? (
              <div className="actions-table">
                <div className="actions-header">
                  <span>No</span>
                  <span>Action</span>
                  <span>Result</span>
                  <span>Connector</span>
                  <span>Admin</span>
                  <span>Requested At</span>
                  <span>Completed At</span>
                  <span>Details</span>
                </div>
                {actions.rows.map((action, index) => {
                  const pagination = actions.pagination || {}
                  const baseIndex =
                    ((pagination.page || actionsPage || 1) - 1) * (pagination.page_size || actions.rows.length || 10)
                  const rowNumber = baseIndex + index + 1
                  const actionType = toTitle(action.action_type) || 'Action'
                  const resultValue =
                    action.result_status?.value ||
                    action.result_status?.status ||
                    action.result_status ||
                    null
                  const resultLabel = action.result_status?.label || toTitle(resultValue) || '-'
                  const connectorLabel =
                    action.connector?.label ||
                    action.connector?.number ||
                    action.connector?.id ||
                    action.connector ||
                    '-'
                  const userLabel =
                    action.initiated_by?.email ||
                    action.initiated_by?.name ||
                    action.initiated_by?.id ||
                    '-'
                  const requestedAt = action.requested_at || action.created_at || action.timestamp
                  const completedAt = action.completed_at
                  const requestedText = requestedAt ? new Date(requestedAt).toLocaleString() : '-'
                  const completedText = completedAt ? new Date(completedAt).toLocaleString() : '-'
                  const resultColor =
                    resultValue === 'success'
                      ? '#2EA561'
                      : resultValue === 'failure'
                      ? '#ED4A4A'
                      : undefined
                  let metadataParsed = null
                  if (action.metadata) {
                    if (typeof action.metadata === 'object') {
                      metadataParsed = action.metadata
                    } else if (typeof action.metadata === 'string') {
                      try { metadataParsed = JSON.parse(action.metadata) } catch { /* not JSON */ }
                    }
                  }

                  const renderMetadata = () => {
                    if (!action.metadata) return <span className="actions-details-empty">—</span>
                    if (metadataParsed && typeof metadataParsed === 'object' && !Array.isArray(metadataParsed)) {
                      const entries = Object.entries(metadataParsed)
                      if (!entries.length) return <span className="actions-details-empty">—</span>
                      return (
                        <dl className="actions-details-list">
                          {entries.map(([k, v]) => (
                            <div key={k} className="actions-details-entry">
                              <dt>{k.replace(/_/g, ' ')}</dt>
                              <dd>{v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                            </div>
                          ))}
                        </dl>
                      )
                    }
                    const text = typeof action.metadata === 'string' ? action.metadata : JSON.stringify(action.metadata)
                    return <span className="actions-details-text">{text}</span>
                  }

                  return (
                    <div key={action.id || rowNumber} className="actions-row">
                      <span>{rowNumber}</span>
                      <span>{actionType}</span>
                      <span>{renderStatusBadge({ label: resultLabel, value: resultValue, color: resultColor })}</span>
                      <span>{connectorLabel}</span>
                      <span>{userLabel}</span>
                      <span>{requestedText}</span>
                      <span>{completedText}</span>
                      <div className="actions-details">{renderMetadata()}</div>
                    </div>
                  )
                })}
                {!actions.rows.length && !actionsLoading ? (
                  <p className="data-placeholder">No actions history for this charger.</p>
                ) : null}
              </div>
            ) : null}

            {actions.pagination ? (
              <div className="sessions-pagination">
                <div className="sessions-page-size">
                  <span className="rows-label">Rows in page</span>
                  <div className="rows-select">
                    <span className="rows-value">{actions.pagination.page_size || 10}</span>
                  </div>
                </div>
                <div className="sessions-page-nav">
                  <span className="page-info">
                    {actions.pagination.page || 1} of {actions.pagination.total_pages || 1}
                  </span>
                  <div className="page-buttons">
                    <button
                      type="button"
                      className="page-button"
                      disabled={(actions.pagination.page || 1) <= 1 || actionsLoading}
                      onClick={() => setActionsPage((prev) => Math.max(1, prev - 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="page-button"
                      disabled={
                        actions.pagination.total_pages
                          ? (actions.pagination.page || 1) >= actions.pagination.total_pages || actionsLoading
                          : false
                      }
                      onClick={() =>
                        setActionsPage((prev) =>
                          actions.pagination.total_pages
                            ? Math.min(actions.pagination.total_pages, prev + 1)
                            : prev + 1
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : activeTab === 'statistics' ? (
        <div className="details-content">
          <section className="detail-section">
            {statsLoading ? <p className="data-placeholder">Loading statistics...</p> : null}
            {statsError ? <div className="data-warning">{statsError}</div> : null}
            <div className="stats-filter-row">
              <DatePickerField
                value={statsDateRange.start}
                onChange={(e) => setStatsDateRange((prev) => ({ ...prev, start: e.target.value }))}
                placeholder="From"
                className="stats-filter-pill"
              />
              <span className="stats-filter-sep-label">to</span>
              <DatePickerField
                value={statsDateRange.end}
                onChange={(e) => setStatsDateRange((prev) => ({ ...prev, end: e.target.value }))}
                placeholder="To"
                className="stats-filter-pill"
              />
            </div>
            {stats ? (
              <div className="stats-chart-single">
                {statsChartKeys.map((chartKey) => {
                  const isEnergy = chartKey === 'energy'
                  const chartTitle = isEnergy ? 'Energy' : 'Revenue'
                  const series =
                    statsRange === 'monthly'
                      ? stats[chartKey]?.monthly_breakdown || []
                      : stats[chartKey]?.daily_breakdown || []
                  const normalizedSeries = isEnergy
                    ? series
                    : series.map((r) => ({ ...r, energy_kwh: r.revenue }))
                  const { path, area, yLabels, points, gridLines } = buildLineGeometry(normalizedSeries, 'energy_kwh', 1000, 200)
                  const periods = series.map((p) => p.period)
                  const color = isEnergy ? 'var(--theme-primary)' : 'var(--theme-secondary)'
                  
                  return (
                    <ChartWithHover
                      key={chartKey}
                      chartKey={chartKey}
                      chartTitle={chartTitle}
                      path={path}
                      area={area}
                      yLabels={yLabels}
                      points={points}
                      gridLines={gridLines}
                      periods={periods}
                      color={color}
                      isEnergy={isEnergy}
                      currency={canViewRevenue ? charger?.currency || 'EGP' : ''}
                      statsRange={statsRange}
                      setStatsRange={setStatsRange}
                    />
                  )
                })}
              </div>
            ) : null}
          </section>
        </div>
      ) : canAccessBilling && activeTab === 'pricing' ? (
        <div className="details-content">
          <section className="detail-section">

            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Pricing</h3>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">DC</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(
                        pricingData.dc,
                        pricingData.dc_price,
                        pricingData.dcPrice,
                        pricingData.price_dc,
                        pricingData.dc_tariff,
                        pricingData.tariff_dc,
                        pricingData.price_per_kwh_dc,
                        pricingData.pricePerKwhDc,
                        pricingData.kwh_dc,
                        pricingData.kwhDc,
                        pricingData.dc_rate_per_kwh,
                        charger?.dc_price,
                        charger?.price_dc,
                        charger?.pricing_dc,
                        charger?.dcTariff,
                        charger?.pricing?.dc,
                        charger?.info?.pricing?.dc
                      ) ?? '-'}
                    </span>
                  </div>
                </div>
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">AC</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(
                        pricingData.ac,
                        pricingData.ac_price,
                        pricingData.acPrice,
                        pricingData.price_ac,
                        pricingData.ac_tariff,
                        pricingData.tariff_ac,
                        pricingData.price_per_kwh_ac,
                        pricingData.pricePerKwhAc,
                        pricingData.kwh_ac,
                        pricingData.kwhAc,
                        pricingData.ac_rate_per_kwh,
                        charger?.ac_price,
                        charger?.price_ac,
                        charger?.pricing_ac,
                        charger?.acTariff,
                        charger?.pricing?.ac,
                        charger?.info?.pricing?.ac
                      ) ?? '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Idle Fees (DC)</h3>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Idle After</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.dc_idle_after_minutes) ?? '-'}
                    </span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Fees</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.dc_idle_fee_amount) ?? '-'}
                    </span>
                    <span className="add-charger-egp-suffix">{pricingCurrency}</span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">For each</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.dc_idle_interval_minutes) ?? '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Idle Fees (AC)</h3>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Idle After</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.ac_idle_after_minutes) ?? '-'}
                    </span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Fees</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.ac_idle_fee_amount) ?? '-'}
                    </span>
                    <span className="add-charger-egp-suffix">{pricingCurrency}</span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">For each</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <span className="add-charger-readonly-value">
                      {firstValue(pricingData.ac_idle_interval_minutes) ?? '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {customPricingList.length ? (
              <div className="add-charger-section-card">
                <div className="add-charger-connector-header">
                  <h3 className="add-charger-connector-title">Custom Hours Pricing</h3>
                </div>
                <div className="add-charger-custom-pricing-content">
                  {customPricingList.map((period, index) => {
                    const labels = resolvePeriodLabels(period, index)
                    const fromValue = firstValue(
                      period.from,
                      period.starts_at,
                      period.startsAt,
                      period.start_time,
                      period.startTime,
                      period.from_time,
                      period.start,
                      period.start_hour,
                      period.startHour,
                      period.time_from,
                      period.fromTime
                    ) || '-'
                    const toValue = firstValue(
                      period.to,
                      period.ends_at,
                      period.endsAt,
                      period.end_time,
                      period.endTime,
                      period.to_time,
                      period.end,
                      period.end_hour,
                      period.endHour,
                      period.time_to,
                      period.toTime
                    ) || '-'
                    const dcValue =
                      firstValue(
                        period.dc,
                        period.dc_price,
                        period.dcPrice,
                        period.price_dc,
                        period.dc_rate_per_kwh,
                        period.rate_per_kwh
                      ) ?? '-'
                    const acValue =
                      firstValue(
                        period.ac,
                        period.ac_price,
                        period.acPrice,
                        period.price_ac,
                        period.ac_rate_per_kwh,
                        period.rate_per_kwh
                      ) ?? '-'
                    const enabled = period.enabled !== false
                    return (
                      <div key={period.id || labels.english || index} className="add-charger-pricing-period">
                        <div className="add-charger-period-header">
                          <div>
                            <h4 className="add-charger-period-title">{labels.english}</h4>
                            <span className="station-secondary-text">{labels.arabic}</span>
                          </div>
                          <span
                            className="status-badge charger-status-badge"
                            style={{
                              backgroundColor: enabled ? 'rgba(46, 165, 98, 0.12)' : 'rgba(62, 79, 68, 0.12)',
                              color: enabled ? '#2EA561' : '#3E4F44',
                            }}
                          >
                            {enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="add-charger-period-content">
                          <div className="add-charger-input-row">
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">From</span>
                                <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <span className="add-charger-readonly-value">{fromValue}</span>
                              </div>
                            </div>
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">To</span>
                                <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <span className="add-charger-readonly-value">{toValue}</span>
                              </div>
                            </div>
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">DC</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <span className="add-charger-readonly-value">{dcValue}</span>
                              </div>
                            </div>
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">AC</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <span className="add-charger-readonly-value">{acValue}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="add-charger-section-card">
                <div className="add-charger-connector-header">
                  <h3 className="add-charger-connector-title">Custom Hours Pricing</h3>
                </div>
                <p className="data-placeholder" style={{ margin: '8px 0 0 0' }}>
                  No custom pricing configured.
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {loading ? <p className="data-placeholder">Loading charger details...</p> : null}
          {error ? <div className="data-warning">{error}</div> : null}

          {charger ? (
            <div className="details-content">
              <section className="detail-section">
                <h2>Charger Product</h2>
                <div className="detail-grid">
                  {summary.map((item) => (
                    <div key={item.label} className="detail-item">
                      <span className="label">{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <h2>Charger Details</h2>
                <div className="detail-grid">
                  {chargerDetailsItems.map((item) => (
                    <div key={item.label} className="detail-item">
                      <span className="label">{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <h2>Charger Validity</h2>
                <div className="detail-grid">
                  {validityItems.map((item) => (
                    <div key={item.label} className="detail-item">
                      <span className="label">{item.label}</span>
                      {item.badge ? (
                        renderStatusBadge(item.value)
                      ) : (
                        <strong>{item.value}</strong>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <h2>Charger Station Configuration</h2>
                <div className="detail-grid">
                  {configurationItems.map((item) => (
                    <div key={item.label} className="detail-item">
                      <span className="label">{item.label}</span>
                      {item.badgeType === 'cost'
                        ? renderOnOffBadge(item.value)
                        : item.badgeType === 'toggle'
                        ? renderToggleIndicator(item.value, item.label)
                        : (
                          <strong>{item.value}</strong>
                        )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <header className="detail-section-header">
                  <h2>Connectors</h2>
                  <span>Total {connectorsCount}</span>
                </header>

                <div className="connectors-table">
                  <div className="connectors-header">
                    <span>No</span>
                    <span>Connector ID</span>
                    <span>Power type</span>
                    <span>Format</span>
                    <span>Plug</span>
                    <span>Power (kW)</span>
                    <span>Voltage</span>
                    <span>Amperage (A)</span>
                    <span>Status</span>
                  </div>
                  {connectors.map((connector, index) => {
                    const statusValue =
                      connector.status?.label ||
                      connector.status?.value ||
                      connector.status ||
                      connector.state
                    const connectorNumber =
                      connector.number ??
                      connector.connector_number ??
                      connector.id ??
                      index + 1
                    const connectorId =
                      connector.connector_id ||
                      connector.id ||
                      connector.ocpp_id ||
                      connector.label ||
                      '-'
                    return (
                    <div
                      key={connector.connector_id || connector.id || connector.number || index}
                      className="connectors-row"
                    >
                      <span>{connectorNumber}</span>
                      <span>{connectorId}</span>
                      <span>
                        {toTitle(
                          connector.power_type ||
                            connector.current_type ||
                            connector.energy_type
                        ) || '-'}
                      </span>
                      <span>
                        {(connector.format || connector.connector_format || '-')
                          .toString()
                          .toUpperCase()}
                      </span>
                      <span>{connector.plug || connector.plug_type || connector.connector_type || '-'}</span>
                      <span>{connector.power_kw ?? connector.power ?? '-'}</span>
                      <span>{connector.voltage ?? '-'}</span>
                      <span>{connector.amperage ?? connector.current ?? '-'}</span>
                      <span>
                        {renderStatusBadge(connectors[index]?.status || statusValue)}
                      </span>
                    </div>
                    )
                  })}
                  {!connectors.length ? (
                    <p className="data-placeholder">No connectors available for this charger.</p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDeleteCharger}
        title="Delete Charger"
        itemName={charger?.name || charger?.identifier || 'this charger'}
        confirmationMessage={
          charger
            ? `Are you sure you want to delete "${charger.name || charger.identifier || 'this charger'}"?`
            : undefined
        }
      />
    </div>
  )
}

export default ChargerDetails
