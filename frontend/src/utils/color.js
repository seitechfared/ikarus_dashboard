export const hexToRgba = (hex, alpha = 1) => {
  if (!hex || typeof hex !== 'string') {
    return `rgba(0,0,0,${alpha})`
  }

  const normalized = hex.replace('#', '')
  const processed =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6)

  const bigint = Number.parseInt(processed, 16)
  if (Number.isNaN(bigint)) {
    return `rgba(0,0,0,${alpha})`
  }

  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
