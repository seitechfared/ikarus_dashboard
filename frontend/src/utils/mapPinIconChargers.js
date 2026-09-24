import { MAP_PIN_ANCHOR, MAP_PIN_SIZE } from './mapPinIcon'
import {
  CONNECTOR_STATUS_COLORS,
  CONNECTOR_STATUS_ORDER,
  normalizeConnectorStatus,
} from './status'
import { getThemeColors } from './theme'

const PIN_OUTER_PATH =
  'M42.0474 22C42.0474 42.9499 21.0237 55 21.0237 55C21.0237 55 0 42.9499 0 22C0 16.1652 2.21499 10.5695 6.15769 6.44365C10.1004 2.31785 15.4479 0 21.0237 0C26.5995 0 31.947 2.31785 35.8897 6.44365C39.8324 10.5695 42.0474 16.1652 42.0474 22Z'

const PIN_INNER_CIRCLE = {
  cx: 21.0237,
  cy: 21.98,
  r: 19.2,
}

const polarToCartesian = (cx, cy, r, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  }
}

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(
    3
  )} ${end.y.toFixed(3)}`
}

const buildPieSegments = (summary, total) => {
  const { cx, cy, r } = PIN_INNER_CIRCLE
  const segments = []
  let startAngle = -90

  CONNECTOR_STATUS_ORDER.forEach((status) => {
    const count = Number(summary[status] || 0)
    if (count <= 0 || total <= 0) return
    const sweep = (count / total) * 360
    const endAngle = startAngle + sweep
    const path = describeArc(cx, cy, r, startAngle, endAngle)
    segments.push({ path, color: CONNECTOR_STATUS_COLORS[status] })
    startAngle = endAngle
  })

  return segments
}

export const createChargerMapPinIcon = (googleMaps, connectorStatus = {}) => {
  const themeColors = getThemeColors()
  const summaryRaw = connectorStatus.summary || {}
  const summary = CONNECTOR_STATUS_ORDER.reduce((acc, status) => ({ ...acc, [status]: 0 }), {})
  Object.entries(summaryRaw).forEach(([key, value]) => {
    const normalized = normalizeConnectorStatus(key)
    summary[normalized] = (summary[normalized] || 0) + Number(value || 0)
  })
  const totalFromSummary = Object.values(summary).reduce((sum, val) => sum + Number(val || 0), 0)
  const total = Number(connectorStatus.total ?? totalFromSummary)
  const safeTotal = total > 0 ? total : 0
  // Build SVG paths for each status slice
  const segments = safeTotal > 0 ? buildPieSegments(summary, safeTotal) : []
  const baseRing = `<circle cx="${PIN_INNER_CIRCLE.cx}" cy="${PIN_INNER_CIRCLE.cy}" r="${PIN_INNER_CIRCLE.r}" fill="white" />
    <circle cx="${PIN_INNER_CIRCLE.cx}" cy="${PIN_INNER_CIRCLE.cy}" r="${PIN_INNER_CIRCLE.r - 2}" fill="none" stroke="#E5E8E6" stroke-width="6" />`
  const pies = segments
    .map(
      (segment) =>
        `<path d="${segment.path}" fill="none" stroke="${segment.color}" stroke-width="6" stroke-linecap="round" />`
    )
    .join('')
  // If no connectors, show muted ring
  const fallbackRing =
    segments.length === 0
      ? `<circle cx="${PIN_INNER_CIRCLE.cx}" cy="${PIN_INNER_CIRCLE.cy}" r="${PIN_INNER_CIRCLE.r - 2}" fill="none" stroke="#d3dcd2" stroke-width="6" />`
      : ''

  const countLabel = `<text x="${PIN_INNER_CIRCLE.cx}" y="${PIN_INNER_CIRCLE.cy + 4}" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="14" font-weight="700" fill="${themeColors.secondary}">${safeTotal}</text>`

  const svg = `<svg width="${MAP_PIN_SIZE.width}" height="${MAP_PIN_SIZE.height}" viewBox="0 0 ${MAP_PIN_SIZE.width} ${MAP_PIN_SIZE.height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${PIN_OUTER_PATH}" fill="${themeColors.primary}" />
    ${baseRing}
    ${pies || fallbackRing}
    ${countLabel}
  </svg>`

  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

  if (!googleMaps) {
    return { url }
  }

  return {
    url,
    scaledSize: new googleMaps.Size(MAP_PIN_SIZE.width, MAP_PIN_SIZE.height),
    anchor: new googleMaps.Point(MAP_PIN_ANCHOR.x, MAP_PIN_ANCHOR.y),
  }
}

export { MAP_PIN_SIZE, MAP_PIN_ANCHOR }
