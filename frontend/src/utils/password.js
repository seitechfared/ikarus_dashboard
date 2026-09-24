const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()\-_=+\[\]{};:,.<>/?\\|]/

const trimPassword = (value) => (typeof value === 'string' ? value.trim() : '')

export const validatePassword = (value, { required = true } = {}) => {
  const password = trimPassword(value)

  if (!password) {
    return required ? 'Password is required' : null
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must include a lowercase letter'
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include an uppercase letter'
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include a number'
  }

  if (!SPECIAL_CHAR_PATTERN.test(password)) {
    return 'Password must include a special character'
  }

  return null
}
