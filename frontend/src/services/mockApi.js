const GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Port Said',
  'Suez',
  'Luxor',
  'Aswan',
  'Red Sea',
  'Dakahlia',
  'Fayoum',
  'Ismailia',
  'Qalyubia',
  'Sharqia',
  'Beheira',
  'Beni Suef',
]

const STATION_NAMES = [
  'Nile View Plaza',
  'Smart Village Hub',
  'Mediterranean Gateway',
  'Delta Business Park',
  'Giza Innovation Center',
  'Luxor Heritage Station',
  'Red Sea Marina',
  'Aswan Riverside',
  'Port Said Promenade',
  'Alexandria Corniche',
  'Fayoum Oasis',
  'Ismailia Lakeside',
]

const STATION_OWNERS = [
  'IKARUS Electric',
  'VoltEdge Energy',
  'GreenWay Mobility',
  'Charge+ Partners',
  'NileGrid Infra',
  'SunVolt Renewables',
  'Vodafone',
  'PowerHub',
  'ElectroServ',
]

const SERVICE_PROVIDERS = [
  'IKARUS',
  'VoltEdge',
  'ChargeNet',
  'PowerHub',
  'Voltify',
]

const CHARGER_BRANDS = [
  'ABB Terra',
  'Delta Ultron',
  'Siemens Sicharge',
  'Schneider EVlink',
  'ChargePoint Express',
  'Tritium RTM',
]

const CHARGER_STATUSES = [
  'available',
  'preparing',
  'charging',
  'suspended_evse',
  'suspended_ev',
  'finishing',
  'reserved',
  'unavailable',
  'faulted',
]

const CONNECTOR_TYPES = ['CCS2', 'Type2', 'CHAdeMO', 'GB/T']

const VISIBILITY_OPTIONS = ['public', 'semi_public', 'private']

const ACCESS_TYPES = ['rfid', 'qr', 'ls118']

const randomBetween = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const randomFloatBetween = (min, max, precision = 2) => {
  const value = Math.random() * (max - min) + min
  const multiplier = 10 ** precision
  return Math.round(value * multiplier) / multiplier
}

const randomItem = (list) => list[randomBetween(0, list.length - 1)]

const randomId = (prefix, sequence) => `${prefix}-${sequence.toString().padStart(4, '0')}`

const randomDateInPastDays = (daysBack = 30) => {
  const now = new Date()
  const offset = randomBetween(0, daysBack * 24 * 60 * 60 * 1000)
  return new Date(now.getTime() - offset)
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const dataset = {
  stationSequence: 1,
  chargerSequence: 1,
  stations: [],
  chargers: [],
  energySamples: [],
  revenueTrend: [],
}

const delay = (min = 120, max = 320) =>
  new Promise((resolve) => setTimeout(resolve, randomBetween(min, max)))

const normalizeEmail = (value) => value.trim().toLowerCase()

const randomCityForGovernorate = (governorate) => {
  const cities = {
    Cairo: ['Heliopolis', 'Nasr City', 'Maadi', 'October City'],
    Giza: ['Dokki', 'Sheikh Zayed', 'Haram', '6th of October'],
    Alexandria: ['Sidi Gaber', 'Gleem', 'Stanley'],
    Luxor: ['El-Toud', 'Armant'],
    Aswan: ['Kom Ombo', 'Edfu'],
    Suez: ['Ain Sokhna'],
  }
  const list = cities[governorate] || ['Cairo']
  return randomItem(list)
}

const createStation = (name) => {
  const station = {
    id: randomId('ST', dataset.stationSequence),
    name,
    governorate: randomItem(GOVERNORATES),
    owner: randomItem(STATION_OWNERS),
    service_provider: randomItem(SERVICE_PROVIDERS),
    city: null,
    address: null,
    latitude: randomFloatBetween(25, 31),
    longitude: randomFloatBetween(29, 35),
    chargers: 0,
    visibility: randomItem(['public', 'semi_public', 'private']),
    status: randomItem(['operational', 'maintenance', 'planned']),
  }
  station.city = randomCityForGovernorate(station.governorate)
  station.address = `${randomId('LOC', randomBetween(100, 999))}, ${station.city}, ${station.governorate}`
  dataset.stationSequence += 1
  return station
}

const createConnectorSummary = () => {
  const available = randomBetween(1, 6)
  const charging = randomBetween(0, 4)
  const faulted = Math.random() > 0.75 ? randomBetween(1, 2) : 0
  const preparing = Math.random() > 0.6 ? randomBetween(0, 2) : 0
  const unavailable = Math.random() > 0.6 ? randomBetween(0, 2) : 0
  const total = available + charging + faulted + preparing + unavailable
  return {
    total,
    available,
    charging,
    faulted,
    preparing,
    unavailable,
  }
}

const createConnectorDetails = (chargerId, count) =>
  Array.from({ length: count }, (_, index) => {
    const status = randomItem(['available', 'charging', 'faulted', 'preparing'])
    return {
      id: `${chargerId}-${index + 1}`,
      status,
      type: randomItem(CONNECTOR_TYPES),
      format: status === 'charging' ? 'DC' : 'AC',
      max_power_kw: randomBetween(22, 300),
      serial_number: randomId('CN', randomBetween(1000, 9999)),
    }
  })

const createCharger = (station) => {
  const connectorsSummary = createConnectorSummary()
  const connectorCount = Math.max(2, Math.min(connectorsSummary.total, 6))
  const status = randomItem(CHARGER_STATUSES)
  const visibility = randomItem(VISIBILITY_OPTIONS)
  const charger = {
    id: randomId('CH', dataset.chargerSequence),
    identifier: randomId('IKR', randomBetween(1000, 9999)),
    name: `${randomItem(['Hyper', 'Pulse', 'Fusion', 'Nova', 'Vortex'])} ${randomItem([
      150,
      200,
      250,
    ])}`,
    status,
    visibility,
    governorate: station.governorate,
    brand: randomItem(CHARGER_BRANDS),
    brand_logo_url: null,
    last_heartbeat: randomDateInPastDays(7).toISOString(),
    station: {
      id: station.id,
      name: station.name,
      governorate: station.governorate,
    },
    connectors: connectorsSummary,
    connectors_detail: createConnectorDetails(
      dataset.chargerSequence,
      connectorCount
    ),
    configuration: {
      access_types: ACCESS_TYPES.filter(() => Math.random() > 0.4).map((type) =>
        type.toUpperCase()
      ),
      ocpp_transport: randomItem(['soap', 'json']),
      ocpp_version: randomItem(['OCPP 1.6', 'OCPP 2.0.1']),
      cost_display: randomItem(['on', 'off']),
    },
    validity: {
      status,
      subscription: randomItem(['monthly', 'quarterly', 'yearly']),
      valid_from: randomDateInPastDays(180).toISOString(),
      valid_to: randomDateInPastDays(-90).toISOString(),
    },
    owner: station.owner,
    max_power_kw: randomBetween(50, 300),
  }
  dataset.chargerSequence += 1
  return charger
}

const generateEnergySeries = () => {
  const now = new Date()
  const items = []
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const dcValue = randomBetween(70_000, 150_000)
    const acValue = randomBetween(40_000, 90_000)
    items.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      dc_value: dcValue,
      ac_value: acValue,
      highlight: Math.random() > 0.85,
    })
  }
  return items
}

const generateRevenueTrend = () => {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const points = []
  let cursor = randomBetween(15_000, 35_000)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cursor += randomBetween(-2_000, 3_500)
    if (cursor < 5_000) {
      cursor = randomBetween(8_000, 12_000)
    }
    points.push({
      day,
      value: Math.max(cursor, 1),
      highlight: Math.random() > 0.9,
    })
  }
  return points
}

const initializeDataset = () => {
  dataset.stationSequence = 1
  dataset.chargerSequence = 1
  dataset.stations = STATION_NAMES.map((name) => createStation(name))
  dataset.chargers = dataset.stations
    .flatMap((station) => {
      const chargerCount = randomBetween(1, 3)
      const chargersForStation = Array.from({ length: chargerCount }, () => createCharger(station))
      station.chargers = chargersForStation.length
      return chargersForStation
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  dataset.energySamples = generateEnergySeries()
  dataset.revenueTrend = generateRevenueTrend()
}

initializeDataset()

const computeConnectorTotals = () => {
  const totals = {
    available: 0,
    charging: 0,
    preparing: 0,
    faulted: 0,
    unavailable: 0,
  }
  dataset.chargers.forEach((charger) => {
    const connectors = charger.connectors || {}
    totals.available += connectors.available ?? 0
    totals.charging += connectors.charging ?? 0
    totals.preparing += connectors.preparing ?? 0
    totals.faulted += connectors.faulted ?? 0
    totals.unavailable += connectors.unavailable ?? 0
  })
  totals.total =
    totals.available + totals.charging + totals.preparing + totals.faulted + totals.unavailable
  return totals
}

const buildSummaryCards = () => {
  const connectorTotals = computeConnectorTotals()
  const chargersTotal = dataset.chargers.length
  const availableChargers = dataset.chargers.filter(
    (charger) => charger.status === 'available'
  ).length
  const chargingSessions = Math.round(connectorTotals.charging * 12.5)
  const energyTotal = dataset.energySamples.reduce(
    (acc, item) => acc + item.dc_value + item.ac_value,
    0
  )
  const invalidSessions = Math.round(chargingSessions * 0.04)

  return [
    {
      slug: 'chargers',
      title: 'Chargers',
      value: chargersTotal,
      value_unit: '',
      detail_label: 'Online',
      detail_value: `${availableChargers}/${chargersTotal}`,
      delta: `${availableChargers >= chargersTotal / 2 ? '+' : '-'}${randomBetween(2, 9)}%`,
      icon: '/assets/chargers.png',
      display_order: 1,
    },
    {
      slug: 'connectors',
      title: 'Connectors',
      value: connectorTotals.total,
      value_unit: '',
      detail_label: 'Active',
      detail_value: `${connectorTotals.available + connectorTotals.charging}`,
      delta: `+${randomBetween(1, 5)}%`,
      icon: '/assets/connecters.png',
      display_order: 2,
    },
    {
      slug: 'customers',
      title: 'Customers',
      value: randomBetween(1800, 2800),
      value_unit: '',
      detail_label: 'New this month',
      detail_value: `${randomBetween(45, 120)}`,
      delta: `+${randomBetween(3, 8)}%`,
      icon: '/assets/customers.png',
      display_order: 3,
    },
    {
      slug: 'sessions',
      title: 'Sessions',
      value: chargingSessions.toLocaleString(),
      value_unit: '',
      detail_label: 'Success rate',
      detail_value: `${(96 + Math.random() * 3).toFixed(1)}%`,
      delta: `+${randomBetween(5, 12)}%`,
      icon: '/assets/sessions.png',
      display_order: 4,
    },
    {
      slug: 'energy',
      title: 'Energy delivered',
      value: Math.round(energyTotal / 1000).toLocaleString(),
      value_unit: 'MWh',
      detail_label: 'Rolling 12 months',
      detail_value: '',
      delta: `+${randomBetween(1, 4)}%`,
      icon: '/assets/energy.png',
      display_order: 5,
    },
    {
      slug: 'invalid-billing-sessions',
      title: 'Invalid billing sessions',
      value: invalidSessions,
      value_unit: '',
      detail_label: 'Reconciled',
      detail_value: `${Math.max(0, invalidSessions - randomBetween(5, 25))}`,
      delta: `-${randomBetween(1, 3)}%`,
      icon: '/assets/invalid.png',
      display_order: 6,
    },
  ]
}

const buildAlerts = () => {
  const templates = [
    'Connector fault detected',
    'Low power throughput',
    'RFID authentication failure',
    'OCPP heartbeat missed',
    'Energy metering discrepancy',
  ]

  return Array.from({ length: 8 }, (_, index) => {
    const charger = randomItem(dataset.chargers)
    const occurredAt = randomDateInPastDays(5)
    return {
      id: index + 1,
      title: `${templates[index % templates.length]} at ${charger.station.name}`,
      occurred_at: occurredAt.toISOString(),
      severity: randomItem(['low', 'medium', 'high']),
    }
  }).sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  )
}

const buildConnectorStatus = () => {
  const totals = computeConnectorTotals()
  return [
    {
      label: 'Available',
      value: totals.available,
      color: '#2EA561',
      display_order: 1,
    },
    {
      label: 'Charging',
      value: totals.charging,
      color: '#006C9C',
      display_order: 2,
    },
    {
      label: 'Preparing',
      value: totals.preparing,
      color: '#DBAA2C',
      display_order: 3,
    },
    {
      label: 'Faulted',
      value: totals.faulted,
      color: '#B72800',
      display_order: 4,
    },
    {
      label: 'Unavailable',
      value: totals.unavailable,
      color: '#F58D8D',
      display_order: 5,
    },
  ]
}

const buildRevenueTop = () => {
  const owners = new Map()
  dataset.chargers.forEach((charger) => {
    const owner = charger.owner || charger.station?.name || 'IKARUS'
    const base = owners.get(owner) || { owner, revenue: 0, currency: 'EGP' }
    const delta = charger.connectors?.charging ?? 0
    base.revenue += randomBetween(150_000, 450_000) + delta * 35_000
    owners.set(owner, base)
  })

  return Array.from(owners.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((entry, index) => ({
      owner_name: entry.owner,
      revenue: Math.round(entry.revenue),
      currency: entry.currency,
      display_order: index + 1,
    }))
}

const filterChargers = (filters = {}) => {
  const {
    search = '',
    status = '',
    visibility = '',
    governorate = '',
    connectorStatus = '',
    stationId = '',
  } = filters

  const term = search.trim().toLowerCase()

  return dataset.chargers.filter((charger) => {
    if (status && charger.status !== status) {
      return false
    }
    if (visibility && charger.visibility !== visibility) {
      return false
    }
    if (governorate && (charger.governorate || '').toLowerCase() !== governorate.toLowerCase()) {
      return false
    }
    if (stationId && String(charger.station?.id) !== String(stationId)) {
      return false
    }
    if (connectorStatus) {
      const connectors = charger.connectors || {}
      if (!(connectors[connectorStatus] > 0)) {
        return false
      }
    }
    if (term) {
      const haystack = [
        charger.name,
        charger.identifier,
        charger.station?.name,
        charger.station?.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) {
        return false
      }
    }
    return true
  })
}

export const mockApi = {
  async login({ email, password }) {
    await delay()
    if (!email || !password) {
      throw new Error('Email and password are required.')
    }
    const normalized = normalizeEmail(email)
    let role = 'viewer'
    if (normalized.includes('admin')) {
      role = 'super_admin'
    } else if (normalized.includes('ops') || normalized.includes('operator')) {
      role = 'operator'
    } else if (normalized.includes('manager')) {
      role = 'manager'
    }
    return { email: normalized, role }
  },

  async getServerTime() {
    await delay(30, 90)
    return new Date()
  },

  async getDashboardData() {
    await delay()
    const summary = buildSummaryCards()
    const alerts = buildAlerts()
    const connectors = buildConnectorStatus()
    const energy = clone(dataset.energySamples)
    const revenueTop = buildRevenueTop()
    const revenueTrend = clone(dataset.revenueTrend)
    return { summary, alerts, connectors, energy, revenueTop, revenueTrend }
  },

  async listStations() {
    await delay()
    return clone(
      dataset.stations.map((station) => ({
        ...station,
        chargers: dataset.chargers.filter((charger) => charger.station?.id === station.id).length,
      }))
    )
  },

  async listChargers(filters = {}) {
    await delay()
    const page = Math.max(1, Number(filters.page) || 1)
    const pageSize = Math.max(1, Number(filters.pageSize) || 8)
    const filtered = filterChargers(filters)
    const count = filtered.length
    const totalPages = Math.max(1, Math.ceil(count / pageSize))
    const start = (page - 1) * pageSize
    const results = filtered.slice(start, start + pageSize).map((charger) => clone(charger))
    return {
      results,
      meta: {
        count,
        totalPages,
      },
    }
  },

  async getCharger(chargerId) {
    await delay()
    const match = dataset.chargers.find(
      (charger) => String(charger.id) === String(chargerId) || charger.identifier === chargerId
    )
    if (!match) {
      throw new Error('Charger not found.')
    }
    return clone(match)
  },

  async createCharger(payload) {
    await delay()
    if (!payload?.identifier || !payload?.name) {
      throw new Error('Identifier and name are required.')
    }

    let station = null
    if (payload.stationId) {
      station = dataset.stations.find(
        (item) => String(item.id) === String(payload.stationId)
      )
    }
    if (!station && payload.stationName) {
      station = createStation(payload.stationName.trim())
      dataset.stations.push(station)
    }
    if (!station) {
      station = randomItem(dataset.stations)
    }

    const connectorsSummary = {
      total: Number(payload.connectors_total ?? 4) || 4,
      available: Number(payload.connectors_available ?? 2) || 2,
      charging: Number(payload.connectors_charging ?? 1) || 1,
      faulted: Number(payload.connectors_faulted ?? 0) || 0,
      preparing: Number(payload.connectors_preparing ?? 0) || 0,
      unavailable: Number(payload.connectors_unavailable ?? 0) || 0,
    }

    connectorsSummary.total =
      connectorsSummary.available +
      connectorsSummary.charging +
      connectorsSummary.faulted +
      connectorsSummary.preparing +
      connectorsSummary.unavailable

    const newCharger = {
      id: randomId('CH', dataset.chargerSequence),
      identifier: payload.identifier.trim(),
      name: payload.name.trim(),
      status: payload.status || 'available',
      visibility: payload.visibility || 'public',
      governorate: payload.governorate || station.governorate,
      brand: payload.brand || randomItem(CHARGER_BRANDS),
      brand_logo_url: null,
      last_heartbeat: new Date().toISOString(),
      station: {
        id: station.id,
        name: station.name,
        governorate: station.governorate,
      },
      connectors: connectorsSummary,
      connectors_detail: createConnectorDetails(dataset.chargerSequence, connectorsSummary.total),
      configuration: {
        access_types: Array.from(payload.accessTypes ?? []),
        ocpp_transport: payload.ocppTransport || 'soap',
        ocpp_version: payload.ocppVersion || 'OCPP 1.6',
        cost_display: payload.costDisplay || 'on',
      },
      validity: {
        status: payload.status || 'available',
        subscription: payload.subscription || 'monthly',
        valid_from: payload.validFrom || new Date().toISOString(),
        valid_to:
          payload.validTo ||
          new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString(),
      },
      owner: payload.owner || station.owner,
      max_power_kw: Number(payload.maxPower) || randomBetween(50, 300),
    }

    dataset.chargerSequence += 1
    dataset.chargers.push(newCharger)
    return clone(newCharger)
  },

  async getStation(stationId) {
    await delay()
    const match = dataset.stations.find((station) => String(station.id) === String(stationId))
    if (!match) {
      throw new Error('Station not found.')
    }
    const chargers = dataset.chargers.filter((charger) => charger.station?.id === match.id)
    return clone({
      ...match,
      chargers,
    })
  },

  async updateStation(stationId, payload) {
    await delay()
    const target = dataset.stations.find((station) => String(station.id) === String(stationId))
    if (!target) {
      throw new Error('Station not found.')
    }
    const next = {
      ...target,
      ...payload,
    }
    next.city = payload.city || target.city || randomCityForGovernorate(next.governorate)
    next.address = payload.address || target.address
    Object.assign(target, next)
    return clone(target)
  },

  async createStation(payload) {
    await delay()
    if (!payload?.name) {
      throw new Error('Station name is required.')
    }
    const station = createStation(payload.name.trim())
    station.owner = payload.owner?.trim() || station.owner
    station.service_provider = payload.serviceProvider?.trim() || station.service_provider
    station.address = payload.address?.trim() || station.address
    station.governorate = payload.governorate || station.governorate
    station.city = payload.city?.trim() || station.city
    station.latitude = Number(payload.latitude) || station.latitude
    station.longitude = Number(payload.longitude) || station.longitude
    station.visibility = payload.visibility || station.visibility
    station.status = payload.status || station.status
    dataset.stations.push(station)
    return clone(station)
  },

  async listStationChargers(stationId) {
    await delay()
    const chargers = dataset.chargers.filter((charger) => String(charger.station?.id) === String(stationId))
    return clone(chargers)
  },
}

export default mockApi
