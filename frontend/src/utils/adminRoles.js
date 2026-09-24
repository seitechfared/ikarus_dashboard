export const ADMIN_ROLE_LABELS = {
  super_admin: 'Super Admin',
  operation: 'Operation',
  site_owner: 'Site Owner',
  guest: 'Guest',
}

const ROLE_ALIAS_MAP = {
  super_admin: 'super_admin',
  'super-admin': 'super_admin',
  admin: 'operation',
  operation: 'operation',
  'operation-role': 'operation',
  site_owner: 'site_owner',
  'site-owner': 'site_owner',
  guest: 'guest',
  viewer: 'guest',
}

export const canonicalizeAdminRole = (value) => {
  if (!value) {
    return ''
  }
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  return ROLE_ALIAS_MAP[normalized] || normalized
}

export const formatAdminRoleLabel = (value) => {
  const canonical = canonicalizeAdminRole(value)
  if (!canonical) {
    return 'N/A'
  }
  return (
    ADMIN_ROLE_LABELS[canonical] ||
    canonical.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  )
}

export const ADMIN_ROLE_OPTIONS = [
  { value: 'super_admin', label: ADMIN_ROLE_LABELS.super_admin },
  { value: 'operation', label: ADMIN_ROLE_LABELS.operation },
  { value: 'site_owner', label: ADMIN_ROLE_LABELS.site_owner },
  { value: 'guest', label: ADMIN_ROLE_LABELS.guest },
]

export const deriveRoleCapabilities = (value) => {
  const role = canonicalizeAdminRole(value)
  const isSuperAdmin = role === 'super_admin'
  const isOperation = role === 'operation'
  const isSiteOwner = role === 'site_owner'
  const isGuest = role === 'guest'
  return {
    role,
    isSuperAdmin,
    isOperation,
    isSiteOwner,
    isGuest,
    canEdit: isSuperAdmin || isOperation,
    isReadOnly: isGuest || isSiteOwner,
    canViewRevenue: isSuperAdmin,
    canModifyPricing: isSuperAdmin,
    canAccessBilling: isSuperAdmin,
    canViewCustomerBalance: isSuperAdmin || isOperation,
  }
}
