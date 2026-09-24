const NAME_PATTERN = /^[\p{L}\p{N} .'-]+$/u
const PHONE_E164_PATTERN = /^\+?[1-9]\d{1,14}$/
const COUNTRY_PHONE_PREFIXES = {
  EG: /^\+20\d{8,12}$/,
  JO: /^\+962\d{8,12}$/,
  SA: /^\+966\d{8,12}$/,
  KW: /^\+965\d{7,11}$/,
}

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')

export const validateName = (value, { required = true, label = 'Name' } = {}) => {
  const text = normalizeText(value)
  if (!text) {
    return required ? `${label} is required.` : null
  }
  if (!NAME_PATTERN.test(text)) {
    return `${label} contains invalid characters.`
  }
  return null
}

export const validateEmail = (value, { required = false, label = 'Email' } = {}) => {
  const text = normalizeText(value).toLowerCase()
  if (!text) {
    return required ? `${label} is required.` : null
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(text)) {
    return `Invalid ${label.toLowerCase()}.`
  }
  return null
}

export const validatePhone = (value, { required = false, label = 'Phone', countryCode = '' } = {}) => {
  const text = normalizeText(value)
  if (!text) {
    return required ? `${label} is required.` : null
  }
  const cleaned = text.replace(/\s+/g, '')
  if (!PHONE_E164_PATTERN.test(cleaned)) {
    return 'Please enter a valid phone number.'
  }
  const normalizedCountry = normalizeText(countryCode).toUpperCase()
  if (normalizedCountry && COUNTRY_PHONE_PREFIXES[normalizedCountry] && !COUNTRY_PHONE_PREFIXES[normalizedCountry].test(cleaned)) {
    return 'Phone number does not match the selected country.'
  }
  return null
}

export const validateNonNegativeNumber = (value, { required = false, label = 'Value' } = {}) => {
  if (value === null || value === undefined || value === '') {
    return required ? `${label} is required.` : null
  }
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return `${label} must be a number.`
  }
  if (numberValue < 0) {
    return `${label} must be a non-negative number.`
  }
  return null
}

export const validatePositiveNumber = (value, { required = false, label = 'Value' } = {}) => {
  if (value === null || value === undefined || value === '') {
    return required ? `${label} is required.` : null
  }
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return `${label} must be a number.`
  }
  if (numberValue <= 0) {
    return `${label} must be a positive number.`
  }
  return null
}

export const validateNumber = (value, { required = false, label = 'Value' } = {}) => {
  if (value === null || value === undefined || value === '') {
    return required ? `${label} is required.` : null
  }
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return `${label} must be a number.`
  }
  return null
}
