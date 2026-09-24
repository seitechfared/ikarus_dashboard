export const CONNECTOR_STATUS_ORDER = ['charging', 'preparing', 'finishing', 'unavailable', 'faulted', 'available']

export const CONNECTOR_STATUS_LABELS = {
  charging: 'Charging',
  preparing: 'Preparing',
  finishing: 'Finishing',
  unavailable: 'Unavailable',
  faulted: 'Faulted',
  available: 'Available',
}

export const CONNECTOR_STATUS_COLORS = {
  charging: '#006C9C',
  preparing: '#DE8E15',
  finishing: '#3E4F44',
  unavailable: '#ED4A4A',
  faulted: '#B72800',
  available: '#2EA561',
}

export const CONNECTOR_STATUS_BACKGROUNDS = {
  charging: 'rgba(0, 108, 156, 0.12)',
  preparing: 'rgba(222, 142, 21, 0.12)',
  finishing: 'rgba(62, 79, 68, 0.12)',
  unavailable: 'rgba(237, 74, 74, 0.12)',
  faulted: '#F6E5E0',
  available: 'rgba(46, 164, 97, 0.12)',
}

export const normalizeConnectorStatus = (statusValue) => {
  if (!statusValue) {
    return 'unavailable'
  }
  const status = typeof statusValue === 'string' ? statusValue : statusValue.value || statusValue
  const statusLower = String(status).toLowerCase()

  if (statusLower === 'charging') {
    return 'charging'
  } else if (statusLower === 'preparing') {
    return 'preparing'
  } else if (statusLower === 'finishing') {
    return 'finishing'
  } else if (statusLower === 'faulted') {
    return 'faulted'
  } else if (statusLower === 'available') {
    return 'available'
  }

  return 'unavailable'
}

export const CHARGER_STATUS_LABELS = {
  available: 'Available',
  unavailable: 'Unavailable',
  planned: 'Planned',
}

export const CHARGER_STATUS_COLORS = {
  available: '#2EA561',
  unavailable: '#ED4A4A',
  planned: '#3E4F44',
}

export const normalizeChargerStatus = (statusValue) => {
  if (!statusValue) {
    return 'planned'
  }
  const status = typeof statusValue === 'string' ? statusValue : statusValue.value || statusValue
  const statusLower = String(status).toLowerCase()

  if (statusLower === 'available') {
    return 'available'
  } else if (statusLower === 'planned') {
    return 'planned'
  }

  return 'unavailable'
}
