import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import PillDropdown from '@/components/PillDropdown'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchAllPages } from '@/utils/fetchAllPages'
import {
  validateName,
  validateNonNegativeNumber,
  validatePositiveNumber,
} from '@/utils/validation'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import { fetchCountries } from '@/services/referenceApi'
import {
  buildPricingPayload,
  buildCustomPeriodsPayload,
  mapServerCustomPeriods,
  getPeriodLabel,
  getArabicPeriodLabel,
  validateCustomPeriodLabels,
  resolvePeriodLabels,
  MAX_CUSTOM_PERIODS,
} from '../pricing/pricingHelpers'
import '@/styles/dashboard.css'

const DEFAULT_CURRENCY = 'EGP'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'semi_public', label: 'Semi Public' },
  { value: 'private', label: 'Private' },
]

const POWER_TYPE_OPTIONS = [
  { value: 'dc', label: 'DC' },
  { value: 'ac', label: 'AC' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'planned', label: 'Planned' },
]

const SUBSCRIPTION_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const FINANCING_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'subsidised', label: 'Subsidised' },
]

const OCPP_TRANSPORT = [
  { value: 'soap', label: 'SOAP' },
  { value: 'json', label: 'JSON-1' },
]

const ACCESS_TYPES = [
  { value: 'rfid', label: 'RFID' },
  { value: 'qr', label: 'QR Code' },
  { value: 'ls118', label: '1S1B' },
]

const COST_DISPLAY = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const PROCESS_STEPS = ['Charger info', 'Configuration', 'Documents']
const TOTAL_STAGES = 3

const valueOrEmptyString = (value) =>
  value === null || value === undefined || Number.isNaN(value) ? '' : String(value)

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).replace(/,/g, '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const toMinutesOrNull = (value) => {
  if (value === null || value === undefined) return null
  const match = String(value).match(/-?\d+/)
  if (!match) return null
  const minutes = Number(match[0])
  return Number.isFinite(minutes) ? minutes : null
}

const normalizeTimeValue = (value) => {
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

const ACCESS_VALUE_BY_LABEL = new Map(ACCESS_TYPES.map((item) => [item.label.toLowerCase(), item.value]))
const CHARGER_TYPES = [
  { value: 'ac', label: 'AC' },
  { value: 'dc', label: 'DC' },
]
const CONNECTOR_FORMAT_OPTIONS = [
  { value: 'cable', label: 'Cable' },
  { value: 'socket', label: 'Socket' },
]
const CONNECTOR_PLUG_TYPE_OPTIONS = [
  { value: 'Type 2', label: 'Type 2' },
  { value: 'CCS 2', label: 'CCS 2' },
  { value: 'CHAdeMO', label: 'CHAdeMO' },
  { value: 'GB/T DC', label: 'GB/T DC' },
  { value: 'Type 1', label: 'Type 1' },
  { value: 'CCS 1', label: 'CCS 1' },
  { value: 'GB/AC', label: 'GB/AC' },
  { value: 'Tesla', label: 'Tesla' },
]
const METER_MODE_OPTIONS = [
  { value: 'cumulative', label: 'Cumulative' },
  { value: 'per_session', label: 'Per Session' },
]

const createInitialForm = () => ({
  name: '',
  identifier: '',
  ocppIdentifier: '',
  owner: '',
  financingType: 'sales',
  visibility: 'public',
  chargerType: 'ac',
  meterMode: 'cumulative',
  authorizedCustomers: new Set(),
  stationId: '',
  stationName: '',
  ocppTransport: 'soap',
  accessTypes: new Set(),
  costDisplay: 'on',
  showInMobile: true,
  ocppVersion: '',
  status: 'planned',
  availabilityOverride: false,
  subscription: 'monthly',
  validFrom: '',
  validTo: '',
  chargerUrl: '',
  chargerBoxId: '',
  maxPower: '44',
  governorate: '',
  brand: '',
  brandLogo: null,
  connectors: [
    {
      id: 1,
      backendId: null,
      connectorId: '1',
      powerType: 'dc',
      format: '',
      plug: '',
      powerKw: '',
      voltage: '',
      amperage: '',
    },
  ],
  pricing: {
    dc: '',
    ac: '',
  },
  idleFees: {
    idleAfter: '',
    fees: '',
    forEach: '',
    dcIdleAfter: '',
    dcFees: '',
    dcForEach: '',
    acIdleAfter: '',
    acFees: '',
    acForEach: '',
  },
  customPricing: [],
})

const ACCESS_LABELS = new Map(ACCESS_TYPES.map((item) => [item.value, item.label]))
const OCPP_LABELS = new Map(OCPP_TRANSPORT.map((item) => [item.value, item.label]))

// Date utility functions
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const cloneDate = (date) => new Date(date.getTime())
const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseLocalDate = (value) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const text = String(value)
  if (DATE_ONLY_PATTERN.test(text)) {
    const [year, month, day] = text.split('-').map((part) => Number(part))
    if (!year || !month || !day) {
      return null
    }
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

const formatLocalDate = (date) => {
  if (!date) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

// Authorized Customers Field Component
function AuthorizedCustomersField({ selectedCustomers, onCustomersChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const dropdownRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    const loadCustomers = async () => {
      try {
        const response = await fetch(`${API_BASE}/customers/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (response.ok) {
          const data = await response.json()
          const customersList = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : [])
          // Map customers to have id and email
          const mappedCustomers = customersList.map((customer) => ({
            id: customer.id || customer.user_id || String(customer.customer_id || ''),
            email: customer.email || customer.user_email || customer.user?.email || '',
          })).filter((customer) => customer.email) // Only include customers with email
          setCustomers(mappedCustomers)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load customers:', error)
        }
      }
    }

    loadCustomers()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers
    return customers.filter((customer) =>
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [customers, searchQuery])

  const handleToggleCustomer = (customerId) => {
    const newSet = new Set(selectedCustomers)
    if (newSet.has(customerId)) {
      newSet.delete(customerId)
    } else {
      newSet.add(customerId)
    }
    onCustomersChange(newSet)
  }

  const selectedCount = selectedCustomers.size
  const displayText = selectedCount > 0 ? `${selectedCount} customer${selectedCount > 1 ? 's' : ''} selected` : 'Select Customers'

  return (
    <div className="authorized-customers-field" ref={dropdownRef}>
      <div
        className="add-charger-input-field-status authorized-customers-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ flex: 1, color: selectedCount > 0 ? '#011309' : '#67716B' }}>
          {displayText}
        </span>
        <div className="chevron-down">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 10L12 15L7 10" stroke="#797D79" strokeWidth="1.42857" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {isOpen && (
        <div className="authorized-customers-menu">
          <div className="authorized-customers-search">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M16.423 15.2476L19.2564 18.0726C19.4141 18.229 19.5029 18.442 19.5029 18.6642C19.5029 18.8864 19.4141 19.0994 19.2564 19.2559C19.0999 19.4137 18.8869 19.5024 18.6647 19.5024C18.4425 19.5024 18.2295 19.4137 18.073 19.2559L15.248 16.4226C14.0834 17.3367 12.6453 17.8327 11.1647 17.8309C7.48282 17.8309 4.49805 14.8461 4.49805 11.1642C4.49805 7.48233 7.48282 4.49756 11.1647 4.49756C14.8466 4.49756 17.8314 7.48233 17.8314 11.1642C17.8332 12.6448 17.3372 14.0829 16.423 15.2476ZM11.1647 6.16423C8.40329 6.16423 6.16471 8.4028 6.16471 11.1642C6.16471 13.9256 8.40329 16.1642 11.1647 16.1642C13.9261 16.1642 16.1647 13.9256 16.1647 11.1642C16.1647 8.4028 13.9261 6.16423 11.1647 6.16423Z" fill="#67716B"/>
            </svg>
            <input
              type="text"
              placeholder="Search by email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="authorized-customers-search-input"
            />
          </div>
          <div className="authorized-customers-list">
            {filteredCustomers.map((customer) => {
              const isSelected = selectedCustomers.has(customer.id)
              return (
                <div
                  key={customer.id}
                  className="authorized-customers-menu-item"
                  onClick={() => handleToggleCustomer(customer.id)}
                >
                  <div className="authorized-customers-checkbox">
                    {isSelected ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="18" height="18" rx="4" fill="var(--theme-primary)"/>
                        <path d="M13.7273 6L7.72727 12L5 9.27273" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="#99A19D" strokeWidth="1.5"/>
                        <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D"/>
                      </svg>
                    )}
                  </div>
                  <span className="authorized-customers-email">{customer.email}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Date Picker Component
function DatePickerField({ value, onChange, id, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initialDate = parseLocalDate(value) || new Date()
    return startOfMonth(initialDate)
  })
  const pickerRef = useRef(null)

  // Update current month when value changes externally
  useEffect(() => {
    const date = parseLocalDate(value)
    if (date) {
      setCurrentMonth(startOfMonth(date))
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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const cells = buildMonthCells(currentMonth)

  const handleDateSelect = (date, currentMonth) => {
    if (!currentMonth) return
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
    : placeholder || 'Choose date'

  return (
    <div className="date-picker-field" ref={pickerRef}>
      <input
        type="text"
        id={id}
        value={displayValue}
        readOnly
        onClick={() => setIsOpen(!isOpen)}
        className="add-charger-date-input date-picker-input"
        placeholder={placeholder || 'Choose date'}
      />
      {isOpen && (
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
      )}
    </div>
  )
}

function AddCharger() {
  const navigate = useNavigate()
  const { chargerId } = useParams()
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canAccessBilling = roleCapabilities.canAccessBilling
  const isEditMode = !!chargerId
  const { showToast } = useInlineToast('chargers')
  const totalStages = canAccessBilling ? TOTAL_STAGES : 2

  const [currentStage, setCurrentStage] = useState(1)
  const [activeTab, setActiveTab] = useState('info') // For edit mode: 'info', 'connectors', 'pricing'
  const [stations, setStations] = useState([])
  const [siteOwners, setSiteOwners] = useState([])
  const [form, setForm] = useState(createInitialForm)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingCharger, setIsLoadingCharger] = useState(false)
  const [pricingTouched, setPricingTouched] = useState(false)
  const [removedConnectorIds, setRemovedConnectorIds] = useState(() => new Set())
  const [brandLogoStatus, setBrandLogoStatus] = useState('')
  const [brandLogoPreview, setBrandLogoPreview] = useState(null)
  const [defaultPrices, setDefaultPrices] = useState(null);
  const [countries, setCountries] = useState([])
  // StationId, which is needed to get the country code
  const [stationId, setStationId] = useState(null);
  // Country code of the selected station (add + edit).
  const [countryCode, setCountryCode] = useState(undefined);

  const brandLogoPreviewUrlRef = useRef(null)

  // Currency must match the station's country. The countries reference is the
  // canonical country -> currency mapping; general pricing may be missing or
  // omit currency, so it is only a fallback.
  const stationCurrency = useMemo(() => {
    if (countryCode) {
      const match = countries.find(
        (country) => String(country.code || '').toUpperCase() === String(countryCode).toUpperCase()
      )
      if (match?.currency_code) {
        return String(match.currency_code).toUpperCase()
      }
    }
    const fromPricing = defaultPrices?.currency || defaultPrices?.currency_code
    return fromPricing ? String(fromPricing).toUpperCase() : DEFAULT_CURRENCY
  }, [countries, countryCode, defaultPrices])

  useEffect(() => {
    if (!canAccessBilling) {
      if (isEditMode && activeTab === 'pricing') {
        setActiveTab('info')
      }
      if (!isEditMode && currentStage > totalStages) {
        setCurrentStage(totalStages)
      }
    }
  }, [activeTab, canAccessBilling, currentStage, isEditMode, totalStages])

  useEffect(() => {
    const controller = new AbortController()
    const loadData = async () => {
      try {
        const [stationsData, siteOwnersData, countriesData] = await Promise.all([
          fetchAllPages(`${API_BASE}/stations/`, {
            pageSize: 200,
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          }),
          fetchAllPages(`${API_BASE}/site-owners/`, {
            pageSize: 200,
            signal: controller.signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          }),
          fetchCountries({ signal: controller.signal }).catch(() => []),
        ])

        if (!controller.signal.aborted) {
          setStations(Array.isArray(stationsData) ? stationsData : [])
          setSiteOwners(Array.isArray(siteOwnersData) ? siteOwnersData : [])
          setCountries(Array.isArray(countriesData) ? countriesData : [])
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
        }
      }
    }

    loadData()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => {
      if (brandLogoPreviewUrlRef.current) {
        URL.revokeObjectURL(brandLogoPreviewUrlRef.current)
        brandLogoPreviewUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!canAccessBilling || isEditMode || pricingTouched) {
      return undefined
    }
    const controller = new AbortController()
    const loadGeneralPricing = async () => {
      try {
        const response = await fetch(`${API_BASE}/chargers/pricing-summary/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          return
        }
        const data = await response.json().catch(() => ({}))
        const pricing = data?.general_pricing
        if (!pricing || pricingTouched) {
          return
        }
        setForm((prev) => ({
          ...prev,
          pricing: {
            dc: valueOrEmptyString(
              pricing.dc ?? pricing.dc_rate_per_kwh ?? defaultPrices?.dc ?? defaultPrices?.dc_rate_per_kwh ?? prev.pricing.dc
            ),
            ac: valueOrEmptyString(
              pricing.ac ?? pricing.ac_rate_per_kwh ?? defaultPrices?.ac ?? defaultPrices?.ac_rate_per_kwh ?? prev.pricing.ac
            ),
          },
          // Idle fees are intentionally left empty for new chargers so they fall
          // back to general pricing at billing time. The general values are shown
          // only as placeholders, never stored as the charger's own values.
        }))
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
        }
      }
    }
    loadGeneralPricing()
    return () => controller.abort()
  }, [canAccessBilling, isEditMode, pricingTouched])

  // Load charger data when in edit mode
  useEffect(() => {
    if (!isEditMode || !chargerId) {
      if (!isEditMode) {
        if (brandLogoPreviewUrlRef.current) {
          URL.revokeObjectURL(brandLogoPreviewUrlRef.current)
          brandLogoPreviewUrlRef.current = null
        }
        setBrandLogoPreview(null)
        setBrandLogoStatus('')
      }
      return
    }

    const controller = new AbortController()
    const loadCharger = async () => {
      setIsLoadingCharger(true)
      try {
        const response = await fetch(`${API_BASE}/chargers/${chargerId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Unable to load charger details.')
        }
        const data = await response.json()
        const charger = data.charger || data
        setStationId(charger?.station?.id || null);

        // Map API response to form structure
        const accessMethodsRaw = charger.access_methods || charger.configuration?.access_types || []
        let accessMethods = []
        if (Array.isArray(accessMethodsRaw)) {
          accessMethods = accessMethodsRaw
        } else if (typeof accessMethodsRaw === 'string') {
          accessMethods = accessMethodsRaw
            .split(',')
            .map((item) => {
              const trimmed = item.trim()
              const lowered = trimmed.toLowerCase()
              return ACCESS_VALUE_BY_LABEL.get(lowered) || lowered || null
            })
            .filter(Boolean)
        }
        const pricingSnapshot =
          charger.pricing ||
          data.pricing?.pricing ||
          charger.pricing_data ||
          {}
        const serverCustomPeriods =
          charger.custom_pricing ||
          pricingSnapshot.custom_periods ||
          data.pricing?.custom_periods ||
          []
        const normalizedCustomPricing = mapServerCustomPeriods(serverCustomPeriods)
        const connectorsRows = Array.isArray(data.info?.connectors?.rows)
          ? data.info.connectors.rows
          : []
        const connectorsFromInfo = connectorsRows.map((connector, index) => {
          const connectorNumber =
            connector.connector_number ??
            connector.connectorId ??
            connector.connector_id ??
            connector.label
          const derivedPowerType =
            (typeof connector.power_type === 'string' && connector.power_type) ||
            (typeof connector.energy_type === 'string' && connector.energy_type) ||
            ''
          const formatValue =
            connector.format ??
            connector.connector_format ??
            ''
          const plugValue =
            connector.plug_type ??
            connector.connector_type ??
            ''
          return {
            id: index + 1,
            backendId: connector.id || connector.connector_id || null,
            connectorId: connectorNumber ? String(connectorNumber) : String(index + 1),
            powerType: derivedPowerType ? derivedPowerType.toLowerCase() : 'dc',
            format: valueOrEmptyString(formatValue),
            plug: valueOrEmptyString(plugValue),
            powerKw: valueOrEmptyString(connector.power_kw),
            voltage: valueOrEmptyString(connector.voltage),
            amperage: valueOrEmptyString(connector.amperage),
          }
        })

        setForm((prev) => ({
          ...prev,
          name: charger.name || '',
          identifier: charger.identifier || charger.box_id || charger.ocpp_identifier || '',
          ocppIdentifier: charger.ocpp_identifier || charger.identifier || charger.box_id || '',
          brand: charger.brand || '',
          governorate: charger.governorate || charger.station?.governorate || '',
          chargerType:
            charger.charger_type ||
            charger.configuration?.charger_type ||
            charger.configuration?.station_type ||
            charger.station?.type ||
            'ac',
          meterMode:
            charger.meter_mode ||
            charger.configuration?.meter_mode ||
            'cumulative',
          status: charger.status?.value || charger.status || 'planned',
          availabilityOverride: charger.availability_override || false,
          visibility: charger.visibility?.value || charger.visibility || 'public',
          stationId: charger.station?.id || '',
          stationName: charger.station?.name || '',
          chargerBoxId: charger.box_id || charger.identifier || '',
          owner: charger.site_owner_id || '',
          financingType: charger.financing_type || 'sales',
          subscription: charger.subscription_type || 'monthly',
          ocppTransport: charger.ocpp_transport || 'soap',
          ocppVersion: charger.ocpp_version || '',
          maxPower: charger.kwh_limit?.toString() || '44',
          validFrom: charger.valid_from || '',
          validTo: charger.valid_to || '',
          costDisplay: charger.access_cost_display !== false ? 'on' : 'off',
          showInMobile: charger.show_in_mobile !== false,
          accessTypes: new Set(Array.isArray(accessMethods) ? accessMethods : []),
          pricing: {
            dc: valueOrEmptyString(
              pricingSnapshot.dc ?? pricingSnapshot.dc_rate_per_kwh ?? prev.pricing.dc
            ),
            ac: valueOrEmptyString(
              pricingSnapshot.ac ?? pricingSnapshot.ac_rate_per_kwh ?? prev.pricing.ac
            ),
          },
          idleFees: {
            idleAfter: valueOrEmptyString(
              pricingSnapshot.idle_after ??
                pricingSnapshot.idle_after_minutes ??
                prev.idleFees.idleAfter
            ),
            fees: valueOrEmptyString(
              pricingSnapshot.idle_fees ??
                pricingSnapshot.idle_fee_amount ??
                prev.idleFees.fees
            ),
            forEach: valueOrEmptyString(
              pricingSnapshot.idle_for_each ??
                pricingSnapshot.idle_interval_minutes ??
                prev.idleFees.forEach
            ),
            dcIdleAfter: valueOrEmptyString(
              pricingSnapshot.dc_idle_after_minutes ?? prev.idleFees.dcIdleAfter
            ),
            dcFees: valueOrEmptyString(
              pricingSnapshot.dc_idle_fee_amount ?? prev.idleFees.dcFees
            ),
            dcForEach: valueOrEmptyString(
              pricingSnapshot.dc_idle_interval_minutes ?? prev.idleFees.dcForEach
            ),
            acIdleAfter: valueOrEmptyString(
              pricingSnapshot.ac_idle_after_minutes ?? prev.idleFees.acIdleAfter
            ),
            acFees: valueOrEmptyString(
              pricingSnapshot.ac_idle_fee_amount ?? prev.idleFees.acFees
            ),
            acForEach: valueOrEmptyString(
              pricingSnapshot.ac_idle_interval_minutes ?? prev.idleFees.acForEach
            ),
          },
          customPricing: normalizedCustomPricing,
          // Load authorized customers if available
          authorizedCustomers: charger.allowed_customer_ids
            ? new Set(charger.allowed_customer_ids.map((id) => String(id)))
            : new Set(),
          connectors:
            connectorsFromInfo.length > 0 ? connectorsFromInfo : prev.connectors,
        }))
        setRemovedConnectorIds(new Set())
        const existingLogo = charger.brand_logo || charger.brand?.logo
        if (brandLogoPreviewUrlRef.current) {
          URL.revokeObjectURL(brandLogoPreviewUrlRef.current)
          brandLogoPreviewUrlRef.current = null
        }
        setBrandLogoPreview(existingLogo ? buildMediaUrl(existingLogo) : null)
        setBrandLogoStatus(existingLogo ? 'Existing logo on file' : '')
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
          setErrors({ form: error.message || 'Unable to load charger details.' })
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCharger(false)
        }
      }
    }

    loadCharger()
    return () => controller.abort()
  }, [chargerId, isEditMode])

  // Fetch the station to get the country code
  useEffect(() => {
    if (!stationId) {
      setCountryCode(undefined);
      setDefaultPrices(null);
      return
    }
    const controller = new AbortController();
    const loadStation = async () => {
      try {
        const response = await fetch(`${API_BASE}/stations/${stationId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          return
        }
        const data = await response.json().catch(() => ({}))
        setCountryCode(data?.country_code || null);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
        }
      }
    }
    loadStation()
    return () => controller.abort()
  }, [stationId])

  // Fetch general pricing on mount to pre-fill pricing fields in edit mode with default prices
  useEffect(() => {
    if (countryCode === undefined) {
      return
    }
    const controller = new AbortController();
    const loadGeneralPricing = async () => {
      try {
        const response = await fetch(`${API_BASE}/pricing/general/${countryCode === null ? '' : "?country=" + countryCode}`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          return
        }
        const data = await response.json().catch(() => ({}))
        setDefaultPrices(data?.pricing || null);
        if (!isEditMode) {
          setPricingTouched(true)
          setForm((prev) => ({
            ...prev,
            pricing: {
              dc: valueOrEmptyString(
                data?.pricing?.dc ?? data?.pricing?.dc_rate_per_kwh ?? prev.pricing.dc
              ),
              ac: valueOrEmptyString(
                data?.pricing?.ac ?? data?.pricing?.ac_rate_per_kwh ?? prev.pricing.ac
              ),
            },
            // Idle fees are intentionally left empty for new chargers so they fall
            // back to general pricing at billing time. The general values are shown
            // only as placeholders, never stored as the charger's own values.
          }))
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error)
        }
      }
    }
    loadGeneralPricing();
    return () => controller.abort()
  }, [countryCode])

  const stationOptions = useMemo(
    () =>
      stations
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stations]
  )

  const updateField = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value }
      // Auto-generate identifier from name if name is being updated
      if (field === 'name' && value.trim()) {
        updated.identifier = value.trim().toLowerCase().replace(/\s+/g, '-')
      }
      if (field === 'visibility' && value !== 'private' && prev.visibility === 'private') {
        updated.authorizedCustomers = new Set()
      }
      return updated
    })
    setErrors((prev) => {
      const next = { ...prev }
      if (next[field]) {
        delete next[field]
      }
      if (field === 'stationId' || field === 'stationName') {
        delete next.station
      }
      delete next.form
      return next
    })
  }

  const toggleAccessType = (value) => {
    setForm((prev) => {
      const next = new Set(prev.accessTypes)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return { ...prev, accessTypes: next }
    })
  }

  const addConnector = () => {
    setForm((prev) => {
      const currentMaxId = prev.connectors.reduce((max, c) => {
        const idNumber = Number(c.id)
        return Number.isFinite(idNumber) ? Math.max(max, idNumber) : max
      }, 0)
      const newId = currentMaxId + 1
      return {
        ...prev,
        connectors: [
          ...prev.connectors,
          {
            id: newId,
            backendId: null,
            connectorId: String(newId),
            powerType: 'dc',
            format: '',
            plug: '',
            powerKw: '',
            voltage: '',
            amperage: '',
          }
        ]
      }
    })
  }

  const updateConnector = (connectorId, field, value) => {
    setForm((prev) => ({
      ...prev,
      connectors: prev.connectors.map((connector) =>
        connector.id === connectorId ? { ...connector, [field]: value } : connector
      )
    }))
    if (errors.connectors) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.connectors
        return next
      })
    }
  }

  const removeConnector = (connectorId) => {
    setForm((prev) => {
      const connector = prev.connectors.find((item) => item.id === connectorId)
      if (connector?.backendId) {
        setRemovedConnectorIds((previous) => new Set(previous).add(connector.backendId))
      }
      return {
        ...prev,
        connectors: prev.connectors.filter((item) => item.id !== connectorId),
      }
    })
  }

  const buildConnectorPayload = (connector, index) => {
    const connectorNumber = Number(connector.connectorId)
    return {
      id: connector.backendId || undefined,
      connector_number: Number.isFinite(connectorNumber) ? connectorNumber : index + 1,
      energy_type: (connector.powerType || 'dc').toLowerCase(),
      format: connector.format?.trim() || null,
      plug_type: connector.plug?.trim() || null,
      power_kw: toNumberOrNull(connector.powerKw),
      voltage: toNumberOrNull(connector.voltage),
      amperage: toNumberOrNull(connector.amperage),
    }
  }

  const syncConnectorsWithBackend = async (chargerRecordId) => {
    if (!chargerRecordId) {
      return
    }
    const connectorsPayload = (form.connectors || []).map((connector, index) =>
      buildConnectorPayload(connector, index)
    )
    if (!connectorsPayload.length) {
      throw new Error('Please add at least one connector before saving.')
    }
    const response = await fetch(`${API_BASE}/chargers/${chargerRecordId}/connectors/setup/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...appendAuthHeader(),
      },
      body: JSON.stringify({
        connectors: connectorsPayload,
        remove_connector_ids: Array.from(removedConnectorIds),
      }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.detail || 'Unable to sync connectors.')
    }
    setRemovedConnectorIds(new Set())
  }

  const updatePricing = (field, value) => {
    setPricingTouched(true)
    setForm((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, [field]: value }
    }))
    if (errors.pricing) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.pricing
        return next
      })
    }
  }

  const updateIdleFees = (field, value) => {
    setPricingTouched(true)
    setForm((prev) => ({
      ...prev,
      idleFees: { ...prev.idleFees, [field]: value }
    }))
    if (errors.idleFees) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.idleFees
        return next
      })
    }
  }

  const addCustomPricing = () => {
    setPricingTouched(true)
    setForm((prev) => {
      if (prev.customPricing.length >= MAX_CUSTOM_PERIODS) {
        return prev
      }
      const maxId = prev.customPricing.reduce(
        (largest, period) => Math.max(largest, Number(period.id) || 0),
        0
      )
      const nextIndex = prev.customPricing.length
      const newPeriod = {
        id: maxId + 1,
        backendId: null,
        enabled: true,
        from: '',
        to: '',
        dc: '',
        ac: '',
        englishPeriodLabel: getPeriodLabel(nextIndex),
        arabicPeriodLabel: getArabicPeriodLabel(nextIndex),
      }
      return {
        ...prev,
        customPricing: [...prev.customPricing, newPeriod],
      }
    })
  }

  const removeCustomPricing = (pricingId) => {
    setPricingTouched(true)
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.filter((p) => p.id !== pricingId)
    }))
  }

  const updateCustomPricing = (pricingId, field, value) => {
    setPricingTouched(true)
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.map((p) =>
        p.id === pricingId ? { ...p, [field]: value } : p
      )
    }))
    if (errors.customPricing || errors.customPricingPeriods) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.customPricing
        if (next.customPricingPeriods?.[pricingId]?.[field]) {
          const periodErrors = { ...next.customPricingPeriods[pricingId] }
          delete periodErrors[field]
          const customPricingPeriods = { ...next.customPricingPeriods }
          if (Object.keys(periodErrors).length === 0) {
            delete customPricingPeriods[pricingId]
          } else {
            customPricingPeriods[pricingId] = periodErrors
          }
          if (Object.keys(customPricingPeriods).length === 0) {
            delete next.customPricingPeriods
          } else {
            next.customPricingPeriods = customPricingPeriods
          }
        }
        return next
      })
    }
  }

  const toggleCustomPricing = (pricingId) => {
    setPricingTouched(true)
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.map((p) =>
        p.id === pricingId ? { ...p, enabled: !p.enabled } : p
      )
    }))
  }

  const validatePricingPayload = (payload, customPricingForm = []) => {
    const pricingErrors = {}
    const pricing = payload.pricing || {}

    const dcError = validateNonNegativeNumber(pricing.dc_rate_per_kwh, {
      required: false,
      label: 'DC rate',
    })
    if (dcError) {
      pricingErrors.pricing = dcError
    }
    const acError = validateNonNegativeNumber(pricing.ac_rate_per_kwh, {
      required: false,
      label: 'AC rate',
    })
    if (acError && !pricingErrors.pricing) {
      pricingErrors.pricing = acError
    }

    const idleAfterError = validateNonNegativeNumber(pricing.idle_after_minutes, {
      required: false,
      label: 'Idle after',
    })
    if (idleAfterError) {
      pricingErrors.idleFees = idleAfterError
    }

    const idleFeeError = validateNonNegativeNumber(pricing.idle_fee_amount, {
      required: false,
      label: 'Idle fee',
    })
    if (idleFeeError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = idleFeeError
    }

    const idleIntervalError = validatePositiveNumber(pricing.idle_interval_minutes, {
      required: false,
      label: 'Idle interval',
    })
    if (idleIntervalError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = idleIntervalError
    }

    const dcIdleAfterError = validateNonNegativeNumber(pricing.dc_idle_after_minutes, { required: false, label: 'DC idle after' })
    if (dcIdleAfterError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = dcIdleAfterError
    }
    const dcIdleFeeError = validateNonNegativeNumber(pricing.dc_idle_fee_amount, { required: false, label: 'DC idle fee' })
    if (dcIdleFeeError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = dcIdleFeeError
    }
    const dcIdleIntervalError = validatePositiveNumber(pricing.dc_idle_interval_minutes, { required: false, label: 'DC idle interval' })
    if (dcIdleIntervalError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = dcIdleIntervalError
    }

    const acIdleAfterError = validateNonNegativeNumber(pricing.ac_idle_after_minutes, { required: false, label: 'AC idle after' })
    if (acIdleAfterError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = acIdleAfterError
    }
    const acIdleFeeError = validateNonNegativeNumber(pricing.ac_idle_fee_amount, { required: false, label: 'AC idle fee' })
    if (acIdleFeeError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = acIdleFeeError
    }
    const acIdleIntervalError = validatePositiveNumber(pricing.ac_idle_interval_minutes, { required: false, label: 'AC idle interval' })
    if (acIdleIntervalError && !pricingErrors.idleFees) {
      pricingErrors.idleFees = acIdleIntervalError
    }

    const customPricingPeriods = {}
    customPricingForm.forEach((period, index) => {
      const labelErrors = validateCustomPeriodLabels(period, index)
      const periodErrors = {}
      if (labelErrors.englishPeriodLabel) {
        periodErrors.englishPeriodLabel = labelErrors.englishPeriodLabel
      }
      if (labelErrors.arabicPeriodLabel) {
        periodErrors.arabicPeriodLabel = labelErrors.arabicPeriodLabel
      }
      if (Object.keys(periodErrors).length) {
        customPricingPeriods[period.id] = periodErrors
      }
    })
    if (Object.keys(customPricingPeriods).length) {
      pricingErrors.customPricingPeriods = customPricingPeriods
    }

    const customPeriods = payload.custom_periods || []
    customPeriods.forEach((period, index) => {
      if (period.enabled === false) {
        return
      }
      const periodLabel = resolvePeriodLabels(customPricingForm[index] ?? period, index).english
      const periodDcError = validateNonNegativeNumber(period.dc_rate_per_kwh, {
        required: true,
        label: `${periodLabel} DC rate`,
      })
      if (periodDcError && !pricingErrors.customPricing) {
        pricingErrors.customPricing = periodDcError
      }
      const periodAcError = validateNonNegativeNumber(period.ac_rate_per_kwh, {
        required: true,
        label: `${periodLabel} AC rate`,
      })
      if (periodAcError && !pricingErrors.customPricing) {
        pricingErrors.customPricing = periodAcError
      }
    })

    return pricingErrors
  }

  const saveChargerPricing = async (targetChargerId) => {
    if (!targetChargerId) {
      return
    }

    const payload = {
      pricing: buildPricingPayload(form.pricing, form.idleFees, stationCurrency, null, defaultPrices),
      custom_periods: buildCustomPeriodsPayload(form.customPricing, defaultPrices),
    }

    const pricingErrors = validatePricingPayload(payload, form.customPricing)
    if (Object.keys(pricingErrors).length) {
      setErrors((prev) => ({ ...prev, ...pricingErrors }))
      const firstPeriodError = Object.values(pricingErrors.customPricingPeriods || {}).find(
        (periodErrors) => periodErrors.englishPeriodLabel || periodErrors.arabicPeriodLabel
      )
      throw new Error(
        pricingErrors.customPricing ||
          firstPeriodError?.englishPeriodLabel ||
          firstPeriodError?.arabicPeriodLabel ||
          pricingErrors.pricing ||
          pricingErrors.idleFees ||
          'Invalid pricing.'
      )
    }

    const response = await fetch(`${API_BASE}/chargers/${targetChargerId}/pricing/`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...appendAuthHeader(),
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.detail || 'Unable to save pricing.')
    }
  }

  const setBrandLogoPreviewFromFile = (file) => {
    if (brandLogoPreviewUrlRef.current) {
      URL.revokeObjectURL(brandLogoPreviewUrlRef.current)
      brandLogoPreviewUrlRef.current = null
    }
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      brandLogoPreviewUrlRef.current = previewUrl
      setBrandLogoPreview(previewUrl)
    } else {
      setBrandLogoPreview(null)
    }
  }

  const handleFileChange = (field, files) => {
    if (field === 'brandLogo') {
      const file = files?.[0]
      if (!file) {
        return
      }
      updateField('brandLogo', file)
      setBrandLogoStatus(`Selected: ${file.name}`)
      setBrandLogoPreviewFromFile(file)
    }
  }

  const validateStage = (stage) => {
    const validationErrors = {}
    if (stage === 1) {
      if (!form.identifier.trim()) {
        validationErrors.identifier = 'Identifier is required.'
      }
      const nameError = validateName(form.name, { required: true, label: 'Charger name' })
      if (nameError) {
        validationErrors.name = nameError
      }
      if (!form.stationId && !form.stationName.trim()) {
        validationErrors.station = 'Select an existing station or enter a new station name.'
      }
      if (!form.chargerBoxId?.trim()) {
        validationErrors.chargerBoxId = 'Charger box ID is required.'
      }
      if (!form.ocppVersion?.trim()) {
        validationErrors.ocppVersion = 'OCPP version is required.'
      }
    }
    if (stage === 2) {
      // Add validation for stage 2 if needed
    }
    if (stage === 3) {
      // Add validation for stage 3 if needed
    }
    return validationErrors
  }

  const validate = () => {
    const validationErrors = {}
    if (!form.identifier.trim()) {
      validationErrors.identifier = 'Identifier is required.'
    }
    const nameError = validateName(form.name, { required: true, label: 'Charger name' })
    if (nameError) {
      validationErrors.name = nameError
    }
    if (!form.stationId && !form.stationName.trim()) {
      validationErrors.station = 'Select an existing station or enter a new station name.'
    }
    if (!form.chargerBoxId?.trim()) {
      validationErrors.chargerBoxId = 'Charger box ID is required.'
    }
    if (!form.ocppVersion?.trim()) {
      validationErrors.ocppVersion = 'OCPP version is required.'
    }
    const brandError = validateName(form.brand, { required: false, label: 'Brand' })
    if (brandError) {
      validationErrors.brand = brandError
    }
    const maxPowerError = validateNonNegativeNumber(form.maxPower, {
      required: false,
      label: 'Power output',
    })
    if (maxPowerError) {
      validationErrors.maxPower = maxPowerError
    }

    form.connectors.forEach((connector, index) => {
      const connectorLabel = `Connector ${index + 1}`
      const connectorIdError = validatePositiveNumber(connector.connectorId, {
        required: true,
        label: `${connectorLabel} number`,
      })
      if (connectorIdError && !validationErrors.connectors) {
        validationErrors.connectors = connectorIdError
      }
      const powerError = validateNonNegativeNumber(connector.powerKw, {
        required: false,
        label: `${connectorLabel} power`,
      })
      if (powerError && !validationErrors.connectors) {
        validationErrors.connectors = powerError
      }
      const voltageError = validateNonNegativeNumber(connector.voltage, {
        required: false,
        label: `${connectorLabel} voltage`,
      })
      if (voltageError && !validationErrors.connectors) {
        validationErrors.connectors = voltageError
      }
      const amperageError = validateNonNegativeNumber(connector.amperage, {
        required: false,
        label: `${connectorLabel} amperage`,
      })
      if (amperageError && !validationErrors.connectors) {
        validationErrors.connectors = amperageError
      }
    })

    if (canAccessBilling) {
      const dcError = validateNonNegativeNumber(form.pricing.dc, { required: false, label: 'DC rate' })
      if (dcError) {
        validationErrors.pricing = dcError
      }
      const acError = validateNonNegativeNumber(form.pricing.ac, { required: false, label: 'AC rate' })
      if (acError && !validationErrors.pricing) {
        validationErrors.pricing = acError
      }
      const idleAfterMinutes = toMinutesOrNull(form.idleFees.idleAfter)
      if (form.idleFees.idleAfter && (idleAfterMinutes === null || idleAfterMinutes < 0)) {
        validationErrors.idleFees = 'Idle after must be a non-negative number of minutes.'
      }
      const idleFeesError = validateNonNegativeNumber(form.idleFees.fees, { required: false, label: 'Idle fee' })
      if (idleFeesError && !validationErrors.idleFees) {
        validationErrors.idleFees = idleFeesError
      }
      const idleIntervalMinutes = toMinutesOrNull(form.idleFees.forEach)
      if (form.idleFees.forEach && (idleIntervalMinutes === null || idleIntervalMinutes < 0)) {
        validationErrors.idleFees = 'Idle interval must be a non-negative number of minutes.'
      }

      const dcIdleAfterMinutes = toMinutesOrNull(form.idleFees.dcIdleAfter)
      if (form.idleFees.dcIdleAfter && (dcIdleAfterMinutes === null || dcIdleAfterMinutes < 0) && !validationErrors.idleFees) {
        validationErrors.idleFees = 'DC idle after must be a non-negative number of minutes.'
      }
      const dcIdleFeesError = validateNonNegativeNumber(form.idleFees.dcFees, { required: false, label: 'DC idle fee' })
      if (dcIdleFeesError && !validationErrors.idleFees) {
        validationErrors.idleFees = dcIdleFeesError
      }
      const dcIdleIntervalMinutes = toMinutesOrNull(form.idleFees.dcForEach)
      if (form.idleFees.dcForEach && (dcIdleIntervalMinutes === null || dcIdleIntervalMinutes < 0) && !validationErrors.idleFees) {
        validationErrors.idleFees = 'DC idle interval must be a non-negative number of minutes.'
      }

      const acIdleAfterMinutes = toMinutesOrNull(form.idleFees.acIdleAfter)
      if (form.idleFees.acIdleAfter && (acIdleAfterMinutes === null || acIdleAfterMinutes < 0) && !validationErrors.idleFees) {
        validationErrors.idleFees = 'AC idle after must be a non-negative number of minutes.'
      }
      const acIdleFeesError = validateNonNegativeNumber(form.idleFees.acFees, { required: false, label: 'AC idle fee' })
      if (acIdleFeesError && !validationErrors.idleFees) {
        validationErrors.idleFees = acIdleFeesError
      }
      const acIdleIntervalMinutes = toMinutesOrNull(form.idleFees.acForEach)
      if (form.idleFees.acForEach && (acIdleIntervalMinutes === null || acIdleIntervalMinutes < 0) && !validationErrors.idleFees) {
        validationErrors.idleFees = 'AC idle interval must be a non-negative number of minutes.'
      }

      const customPricingPeriods = {}
      form.customPricing.forEach((period, index) => {
        const labelErrors = validateCustomPeriodLabels(period, index)
        const periodErrors = {}
        if (labelErrors.englishPeriodLabel) {
          periodErrors.englishPeriodLabel = labelErrors.englishPeriodLabel
        }
        if (labelErrors.arabicPeriodLabel) {
          periodErrors.arabicPeriodLabel = labelErrors.arabicPeriodLabel
        }
        if (Object.keys(periodErrors).length) {
          customPricingPeriods[period.id] = periodErrors
        }

        const periodLabel = resolvePeriodLabels(period, index).english
        if (period.enabled !== false) {
          const periodDcError = validateNonNegativeNumber(period.dc, {
            required: true,
            label: `${periodLabel} DC rate`,
          })
          if (periodDcError && !validationErrors.customPricing) {
            validationErrors.customPricing = periodDcError
          }
          const periodAcError = validateNonNegativeNumber(period.ac, {
            required: true,
            label: `${periodLabel} AC rate`,
          })
          if (periodAcError && !validationErrors.customPricing) {
            validationErrors.customPricing = periodAcError
          }
        }
      })
      if (Object.keys(customPricingPeriods).length) {
        validationErrors.customPricingPeriods = customPricingPeriods
      }
    }

    return validationErrors
  }

  const handleNext = () => {
    const stageErrors = validateStage(currentStage)
    setErrors(stageErrors)
    if (Object.keys(stageErrors).length === 0) {
      if (currentStage < totalStages) {
        setCurrentStage(currentStage + 1)
      }
    }
  }

  const handleBack = () => {
    if (currentStage > 1) {
      setCurrentStage(currentStage - 1)
    } else {
      navigate('/chargers')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      return
    }

    const formData = new FormData()
    
    // Required fields
    formData.append('name', form.name.trim())
    if (isEditMode) {
      // For edit, send ocpp_identifier if it exists, otherwise use identifier
      const ocppId = form.ocppIdentifier || form.identifier || form.chargerBoxId || form.name.trim().toLowerCase().replace(/\s+/g, '-')
      formData.append('ocpp_identifier', ocppId.trim())
    } else {
      // For create, ocpp_identifier is required - use identifier or generate from name
      const ocppId = form.identifier.trim() || form.name.trim().toLowerCase().replace(/\s+/g, '-')
      formData.append('ocpp_identifier', ocppId)
    }
    
    // Station is required
    if (form.stationId) {
      formData.append('station_id', String(form.stationId))
    } else {
      // If no station_id, we need to create or find station first
      // For now, return error if station is not selected
      setErrors({ station: 'Please select an existing station.' })
      setIsSubmitting(false)
      return
    }
    
    // Optional fields - send all fields that have values
    if (form.visibility) {
      formData.append('visibility', form.visibility)
    }
    if (form.status) {
      formData.append('status', form.status)
    }
    if (form.brand?.trim()) {
      formData.append('brand', form.brand.trim())
    }
    formData.append('box_id', form.chargerBoxId.trim())
    if (form.financingType) {
      formData.append('financing_type', form.financingType)
    }
    if (form.subscription) {
      formData.append('subscription_type', form.subscription)
    }
    if (form.chargerType) {
      formData.append('charger_type', form.chargerType)
    }
    if (form.meterMode) {
      formData.append('meter_mode', form.meterMode)
    }
    if (form.ocppTransport) {
      formData.append('ocpp_transport', form.ocppTransport)
    }
    formData.append('ocpp_version', form.ocppVersion.trim())
    if (form.maxPower?.trim()) {
      const maxPowerNum = parseFloat(form.maxPower)
      if (!isNaN(maxPowerNum)) {
        formData.append('kwh_limit', String(maxPowerNum))
      }
    }
    if (form.validFrom) {
      formData.append('valid_from', form.validFrom)
    }
    if (form.validTo) {
      formData.append('valid_to', form.validTo)
    }
    if (form.costDisplay) {
      formData.append('access_cost_display', form.costDisplay === 'on' ? 'true' : 'false')
    }
    formData.append('show_in_mobile', form.showInMobile ? 'true' : 'false')
    formData.append('availability_override', form.availabilityOverride ? 'true' : 'false')
    
    if (form.brandLogo) {
      formData.append('brand_logo', form.brandLogo)
    }
    
    // Site owner - send if set, or send empty string in edit mode to allow clearing
    if (form.owner) {
      formData.append('site_owner_id', String(form.owner))
    } else if (isEditMode) {
      // In edit mode, send empty string to allow clearing the site owner
      formData.append('site_owner_id', '')
    }
    
    // Access methods - send as array
    if (form.accessTypes && form.accessTypes.size > 0) {
      const accessMethods = Array.from(form.accessTypes)
      accessMethods.forEach(method => {
        formData.append('access_methods', method)
      })
    } else if (isEditMode) {
      // In edit mode, send empty string to clear access methods if none selected
      formData.append('access_methods', '')
    }
    
    // Allowed customers (for private chargers)
    if (form.authorizedCustomers && form.authorizedCustomers.size > 0) {
      const customerIds = Array.from(form.authorizedCustomers)
      customerIds.forEach(id => {
        formData.append('allowed_customer_ids', id)
      })
    } else if (isEditMode && form.visibility !== 'private') {
      // In edit mode, if visibility is not private, clear allowed customers
      formData.append('allowed_customer_ids', '')
    }

    setIsSubmitting(true)
    try {
      const url = isEditMode 
        ? `${API_BASE}/chargers/${chargerId}/`
        : `${API_BASE}/chargers/`
      
      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        credentials: 'include',
        headers: appendAuthHeader(),
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data?.detail) {
          throw new Error(data.detail)
        }
        if (data && typeof data === 'object') {
          const firstError = Object.values(data)
            .flat()
            .find((message) => typeof message === 'string')
          if (firstError) {
            throw new Error(firstError)
          }
        }
        throw new Error(`Unable to ${isEditMode ? 'update' : 'save'} charger.`)
      }

      // Get charger ID from response
      const savedCharger = data.charger || data
      const savedChargerId = savedCharger?.id || chargerId
      if (!savedChargerId) {
        throw new Error('Unable to determine charger ID after save.')
      }

      if (canAccessBilling && (isEditMode || pricingTouched)) {
        await saveChargerPricing(savedChargerId)
      }

      await syncConnectorsWithBackend(savedChargerId)

      showToast({
        title: `Charger ${isEditMode ? 'updated' : 'created'}`,
        message: `${form.name?.trim() || 'Charger'} was ${isEditMode ? 'updated' : 'created'} successfully.`,
        variant: 'success',
      })

      if (savedChargerId) {
        navigate(`/chargers/${savedChargerId}`, {
          replace: true,
          state: { notice: `Charger ${isEditMode ? 'updated' : 'added'} successfully.` },
        })
      } else {
        // Fallback to list if ID not available
        navigate('/chargers', {
          replace: true,
          state: { notice: `Charger ${isEditMode ? 'updated' : 'added'} successfully.` },
        })
      }
    } catch (error) {
      console.error(error)
      setErrors((prev) => ({
        ...prev,
        form: error.message || 'Unable to save charger. Please try again.',
      }))
      showToast({
        title: 'Save failed',
        message: error.message || 'Unable to save charger. Please try again.',
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingCharger) {
    return (
      <div className="add-charger-page">
        <div className="add-charger-header-container">
          <div className="add-charger-header">
            <div className="page-heading-left">
              <div className="page-heading-titles">
                <Breadcrumbs
                  items={[
                    { label: 'Home', to: '/overview' },
                    { label: 'Chargers', to: '/chargers' },
                    { label: 'Edit Charger' },
                  ]}
                />
                <div className="page-heading-title-row">
                  <BackButton fallbackTo="/chargers" ariaLabel="Back to chargers" />
                  <h1 className="add-charger-title">Edit Charger</h1>
                </div>
              </div>
            </div>
          </div>
        </div>
        <InlineToastRegion region="chargers" />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading charger data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="add-charger-page">
      <div className="add-charger-header-container">
        <div className="add-charger-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs
                items={[
                  { label: 'Home', to: '/overview' },
                  { label: 'Chargers', to: '/chargers' },
                  { label: isEditMode ? 'Edit Charger' : 'Add Charger' },
                ]}
              />
              <div className="page-heading-title-row">
                {!isEditMode && <BackButton fallbackTo="/chargers" ariaLabel="Back to chargers" />}
                <h1 className="add-charger-title">{isEditMode ? 'Edit Charger' : 'Add Charger'}</h1>
              </div>
            </div>
          </div>
          <div className="add-charger-header-right">
            {isEditMode ? (
              <button
                type="button"
                className="add-charger-next-button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
              </button>
            ) : (
              <>
                {currentStage > 1 && (
                  <button
                    type="button"
                    className="add-charger-back-button-outlined"
                    onClick={handleBack}
                  >
                    <span>Back</span>
                  </button>
                )}
                {currentStage < totalStages ? (
                  <button
                    type="button"
                    className="add-charger-next-button"
                    onClick={handleNext}
                  >
                    <span>Next</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="add-charger-next-button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <InlineToastRegion region="chargers" />
        {isEditMode ? (
          <div style={{
            alignSelf: 'stretch',
            borderBottom: '1px #CCD0CE solid',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'inline-flex',
          }}>
            <div
              onClick={() => setActiveTab('info')}
              style={{
                height: '48px',
                padding: '12px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                borderBottom: activeTab === 'info' ? '3px var(--theme-primary) solid' : 'none',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'inline-flex',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: '48px', height: '1px' }} />
              <div style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                display: 'inline-flex',
              }}>
                <div style={{
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'flex',
                }}>
                  <span style={{
                    color: '#011309',
                    fontSize: '14px',
                    fontFamily: 'Montserrat',
                    fontWeight: activeTab === 'info' ? 700 : 400,
                    lineHeight: '22px',
                    wordWrap: 'break-word',
                  }}>
                    Charger Info
                  </span>
                </div>
              </div>
            </div>
            <div
              onClick={() => setActiveTab('connectors')}
              style={{
                height: '48px',
                padding: '12px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                borderBottom: activeTab === 'connectors' ? '3px var(--theme-primary) solid' : 'none',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'inline-flex',
                cursor: 'pointer',
              }}
            >
              <div style={{ width: '48px', height: '1px' }} />
              <div style={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                display: 'inline-flex',
              }}>
                <div style={{
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'flex',
                }}>
                  <span style={{
                    color: '#011309',
                    fontSize: '14px',
                    fontFamily: 'Montserrat',
                    fontWeight: activeTab === 'connectors' ? 700 : 400,
                    lineHeight: '22px',
                    wordWrap: 'break-word',
                  }}>
                    Connectors
                  </span>
                </div>
              </div>
            </div>
            {canAccessBilling ? (
              <div
                onClick={() => setActiveTab('pricing')}
                style={{
                  height: '48px',
                  padding: '12px',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  borderBottom: activeTab === 'pricing' ? '3px var(--theme-primary) solid' : 'none',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  display: 'inline-flex',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '48px', height: '1px' }} />
                <div style={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  display: 'inline-flex',
                }}>
                  <div style={{
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: '8px',
                    display: 'flex',
                  }}>
                    <span style={{
                      color: '#011309',
                      fontSize: '14px',
                      fontFamily: 'Montserrat',
                      fontWeight: activeTab === 'pricing' ? 700 : 400,
                      lineHeight: '22px',
                      wordWrap: 'break-word',
                    }}>
                      Pricing
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="add-charger-progress-lines">
            {Array.from({ length: totalStages }, (_, index) => index + 1).map((stage) => (
              <svg
                key={stage}
                width="100%"
                height="6"
                viewBox="0 0 374 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={stage <= currentStage ? 'active' : ''}
                preserveAspectRatio="none"
                style={{ flex: 1, minWidth: 0 }}
              >
                <path
                  d="M3 3H371"
                  stroke={stage <= currentStage ? 'var(--theme-primary)' : '#CCD0CE'}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            ))}
          </div>
        )}
      </div>

      <form className="add-charger-form" onSubmit={handleSubmit} noValidate>
        {((!isEditMode && currentStage === 1) || (isEditMode && activeTab === 'info')) && (
        <div className="add-charger-stage-container">
          {!isEditMode && <h2 className="add-charger-stage-title">1- Charger info</h2>}
          <div className="add-charger-stage-content">
            {/* Charger Product Section */}
            
          <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Charger Product</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.name || errors.form ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Charger name <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      placeholder="Enter name"
                      required
                    />
                  </div>
                  {errors.name || errors.form ? (
                    <span className="add-charger-field-error">{errors.name || errors.form}</span>
                  ) : null}
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Site Owner</span>
                  </div>
                  <PillDropdown
                    id="charger-site-owner"
                    value={form.owner || ''}
                    onChange={(event) => updateField('owner', event.target.value)}
                    searchable
                    searchPlaceholder="Search site owners"
                    options={[
                      { value: '', label: 'Select owner' },
                      ...siteOwners.map((so) => ({
                        value: String(so.id),
                        label: so.display_name || so.name || so.company_name || so.user?.name || 'Site Owner',
                      })),
                    ]}
                  />
                </div>
              </div>
            {/* Financing Type and Visibility Type Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-two-column-row">
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Financing Type</span>
                  </div>
                  <div className="add-charger-radio-group">
                    {FINANCING_OPTIONS.map((option) => (
                      <label key={option.value} className="add-charger-radio-option" onClick={() => updateField('financingType', option.value)}>
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="financingType"
                            value={option.value}
                            checked={form.financingType === option.value}
                            onChange={() => {}}
                          />
                          {form.financingType === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Visibility Type</span>
                  </div>
                  <div className="add-charger-radio-group">
                    {VISIBILITY_OPTIONS.map((option) => (
                      <label key={option.value} className="add-charger-radio-option" onClick={() => updateField('visibility', option.value)}>
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="visibility"
                            value={option.value}
                            checked={form.visibility === option.value}
                            onChange={() => {}}
                          />
                          {form.visibility === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Station and Charger Type Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-two-column-row">
                <div className={`add-charger-input-field full-width${errors.station ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Station <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <PillDropdown
                    id="charger-station"
                    value={form.stationId || ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateField('stationId', value);
                      setStationId(value);
                    }}
                    searchable
                    searchPlaceholder="Search stations"
                    options={[
                      { value: '', label: 'Select station' },
                      ...stationOptions.map((station) => ({ value: String(station.id), label: station.name })),
                    ]}
                  />
                  {errors.station ? <span className="add-charger-field-error">{errors.station}</span> : null}
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Charger Type</span>
                  </div>
                  <PillDropdown
                    id="charger-type"
                    value={form.chargerType || ''}
                    onChange={(event) => updateField('chargerType', event.target.value)}
                    options={[
                      { value: '', label: 'Select type' },
                      ...CHARGER_TYPES,
                    ]}
                  />
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Meter Mode</span>
                  </div>
                  <PillDropdown
                    id="charger-meter-mode"
                    value={form.meterMode || ''}
                    onChange={(event) => updateField('meterMode', event.target.value)}
                    options={[
                      { value: '', label: 'Select mode' },
                      ...METER_MODE_OPTIONS,
                    ]}
                  />
                </div>
                {form.visibility === 'private' ? (
                  <div className="add-charger-input-field">
                    <div className="add-charger-input-header">
                      <span className="add-charger-input-label">Authorized Customers for this Charger</span>
                    </div>
                    <AuthorizedCustomersField
                      selectedCustomers={form.authorizedCustomers}
                      onCustomersChange={(customers) => updateField('authorizedCustomers', customers)}
                    />
                    <span className="add-charger-input-label-hint">
                      Only selected users will be able to start charging on this charger
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            </div>

            

            

            {/* Charger Station Configuration Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Charger Station Configuration</h3>
              </div>
              <div className="add-charger-two-column-row">
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">OCCP Transport</span>
                  </div>
                  <div className="add-charger-radio-group">
                    {OCPP_TRANSPORT.map((option) => (
                      <label key={option.value} className="add-charger-radio-option" onClick={() => updateField('ocppTransport', option.value)}>
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="ocppTransport"
                            value={option.value}
                            checked={form.ocppTransport === option.value}
                            onChange={() => {}}
                          />
                          {form.ocppTransport === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Charger Access Type</span>
                  </div>
                  <div className="add-charger-checkbox-group">
                    {ACCESS_TYPES.map((option) => (
                      <label key={option.value} className="add-charger-checkbox-option" onClick={() => toggleAccessType(option.value)}>
                        <div className="add-charger-checkbox-button">
                          <input
                            type="checkbox"
                            value={option.value}
                            checked={form.accessTypes.has(option.value)}
                            onChange={() => {}}
                          />
                          {form.accessTypes.has(option.value) ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="var(--theme-primary)" strokeWidth="1.5" fill="var(--theme-primary)"/>
                              <path d="M5 9L8 12L13 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="0.75" y="0.75" width="16.5" height="16.5" rx="2.25" stroke="#99A19D" strokeWidth="1.5"/>
                              <rect x="0.5" y="0.5" width="17" height="17" rx="3.5" stroke="#99A19D"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="add-charger-two-column-row">
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Cost Display</span>
                  </div>
                  <div className="add-charger-radio-group">
                    {COST_DISPLAY.map((option) => (
                      <label key={option.value} className="add-charger-radio-option" onClick={() => updateField('costDisplay', option.value)}>
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="costDisplay"
                            value={option.value}
                            checked={form.costDisplay === option.value}
                            onChange={() => {}}
                          />
                          {form.costDisplay === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className={`add-charger-input-field full-width${errors.ocppVersion ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      OCPP Version <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <PillDropdown
                    id="charger-ocpp-version"
                    value={form.ocppVersion || ''}
                    onChange={(event) => updateField('ocppVersion', event.target.value)}
                    options={[
                      { value: '', label: 'Select version' },
                      { value: '1.6', label: '1.6' },
                      { value: '2.0.1', label: '2.0.1' },
                    ]}
                  />
                  {errors.ocppVersion ? (
                    <span className="add-charger-field-error">{errors.ocppVersion}</span>
                  ) : null}
                </div>
              </div>
              <div className="add-charger-two-column-row">
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Show in Mobile</span>
                  </div>
                  <div className="add-charger-input-field-status add-charger-input-field-status--transparent">
                    <button
                      type="button"
                      className={`add-charger-toggle-button ${form.showInMobile ? 'enabled' : ''}`}
                      onClick={() => updateField('showInMobile', !form.showInMobile)}
                      aria-pressed={form.showInMobile}
                      aria-label={`Show in Mobile: ${form.showInMobile ? 'On' : 'Off'}`}
                    >
                      <div className="add-charger-toggle-circle" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Charger Validity Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Charger Validity</h3>
              </div>
              <div className="add-charger-two-column-row">
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Status</span>
                    <div className="manual-override-toggle" style={{marginLeft: 8}}>
                      <label className="manual-override-toggle-switch">
                        <input
                          type="checkbox"
                          checked={form.availabilityOverride}
                          onChange={(e) => updateField('availabilityOverride', e.target.checked)}
                        />
                        <span className="manual-override-toggle-slider"></span>
                      </label>
                      <span style={{ marginLeft: 8, fontSize: '14px', color: '#555' }}>{"(Manual)"}</span>
                    </div>
                  </div>
                  <div className="add-charger-radio-group">
                    {STATUS_OPTIONS.map((option) => (
                      <label 
                        key={option.value} 
                        className={`add-charger-radio-option ${!form.availabilityOverride ? 'disabled' : ''}`}
                        onClick={(e) => {
                          if (!form.availabilityOverride) {
                            e.preventDefault();
                            return;
                          }
                          updateField('status', option.value);
                        }}
                        style={{
                          opacity: form.availabilityOverride ? 1 : 0.5,
                          cursor: form.availabilityOverride ? 'pointer' : 'not-allowed'
                        }}
                      >
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="status"
                            value={option.value}
                            checked={form.status === option.value}
                            disabled={!form.availabilityOverride}
                            style={{cursor: form.availabilityOverride ? 'pointer' : 'not-allowed'}}
                            onChange={() => {}}
                          />
                          {form.status === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Subscription</span>
                  </div>
                  <div className="add-charger-radio-group">
                    {SUBSCRIPTION_OPTIONS.map((option) => (
                      <label key={option.value} className="add-charger-radio-option" onClick={() => updateField('subscription', option.value)}>
                        <div className="add-charger-radio-button">
                          <input
                            type="radio"
                            name="subscription"
                            value={option.value}
                            checked={form.subscription === option.value}
                            onChange={() => {}}
                          />
                          {form.subscription === option.value ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                              <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                        <span className="add-charger-radio-label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Valid from</span>
                  </div>
                  <DatePickerField
                    id="charger-valid-from"
                    value={form.validFrom}
                    onChange={(event) => updateField('validFrom', event.target.value)}
                    placeholder="Choose date"
                  />
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Valid to</span>
                  </div>
                  <DatePickerField
                    id="charger-valid-to"
                    value={form.validTo}
                    onChange={(event) => updateField('validTo', event.target.value)}
                    placeholder="Choose date"
                  />
                </div>
              </div>
            </div>

            {/* Charging Station Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Charging Station</h3>
              </div>
              <div className="add-charger-input-row">
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Charger URL</span>
                    <span className="add-charger-input-label-hint-inline">(SOAP Only)</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.chargerUrl}
                      onChange={(event) => updateField('chargerUrl', event.target.value)}
                      placeholder="Enter Charger URL"
                    />
                  </div>
                </div>
                <div className={`add-charger-input-field full-width${errors.chargerBoxId ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">
                      Charger Box ID <span className="required-indicator">*</span>
                    </span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.chargerBoxId}
                      onChange={(event) => updateField('chargerBoxId', event.target.value)}
                      placeholder="Select box id"
                      required
                    />
                  </div>
                  {errors.chargerBoxId ? (
                    <span className="add-charger-field-error">{errors.chargerBoxId}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* kWh Limitation Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">kWh Limitation</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.maxPower ? ' has-error' : ''}`} style={{ flex: '0 0 50%' }}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">maximum power output</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.maxPower}
                      onChange={(event) => updateField('maxPower', event.target.value)}
                      placeholder="Enter power output"
                    />
                  </div>
                  {errors.maxPower ? <span className="add-charger-field-error">{errors.maxPower}</span> : null}
                </div>
                <div className="add-charger-input-field" style={{ flex: '0 0 50%', visibility: 'hidden' }} aria-hidden="true" />
              </div>
            </div>

            {/* Attachments Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-section-title">
                <h3 className="add-charger-section-title-text">Attachments</h3>
              </div>
              <div className="add-charger-input-row add-charger-logo-row">
                <div className="add-charger-logo-upload">
                  <div className="add-charger-file-upload">
                    <span className="add-charger-upload-text">Upload charger logo here</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange('brandLogo', event.target.files)}
                    />
                    {brandLogoStatus ? (
                      <p className="add-charger-upload-hint" aria-live="polite">
                        {brandLogoStatus}
                      </p>
                    ) : (
                      <p className="add-charger-upload-hint" aria-live="polite">
                        No logo selected yet.
                      </p>
                    )}
                    <div className="add-charger-file-upload-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 10.2997L12.2184 19.0821C11.2057 20.0948 9.83221 20.6638 8.40004 20.6638C6.96786 20.6638 5.59434 20.0948 4.58163 19.0821C3.56893 18.0694 3 16.6959 3 15.2637C3 13.8315 3.56893 12.458 4.58163 11.4453L11.7944 4.23332C12.1265 3.88948 12.5238 3.61522 12.963 3.42655C13.4022 3.23788 13.8746 3.13857 14.3526 3.13441C14.8306 3.13026 15.3046 3.22135 15.7471 3.40236C16.1895 3.58337 16.5914 3.85068 16.9295 4.18869C17.2675 4.52671 17.5348 4.92865 17.7158 5.37108C17.8968 5.81351 17.9879 6.28756 17.9837 6.76556C17.9796 7.24357 17.8803 7.71596 17.6916 8.15517C17.5029 8.59439 17.2287 8.99163 16.8848 9.32372L9.67284 16.5397C9.3334 16.8677 8.87875 17.0492 8.40679 17.0451C7.93484 17.0411 7.48334 16.8519 7.14956 16.5182C6.81577 16.1845 6.62639 15.7331 6.62222 15.2611C6.61804 14.7892 6.7994 14.3345 7.12724 13.9949L14.34 6.77972" stroke="#67716B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="add-charger-logo-preview">
                  {brandLogoPreview ? (
                    <img src={brandLogoPreview} alt="Brand logo preview" />
                  ) : (
                    <div className="add-charger-logo-placeholder">Logo preview</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {((!isEditMode && currentStage === 2) || (isEditMode && activeTab === 'connectors')) && (
        <div className="add-charger-stage-container">
          {!isEditMode && <h2 className="add-charger-stage-title">2 - Connectors</h2>}
          <div className="add-charger-stage-content">
            {form.connectors.map((connector, index) => (
              <div key={connector.id} className="add-charger-section-card">
                <div className="add-charger-connector-header">
                  <h3 className="add-charger-connector-title">Connector {index + 1}</h3>
                  {form.connectors.length > 1 && (
                    <button
                      type="button"
                      className="add-charger-remove-connector-button"
                      onClick={() => removeConnector(connector.id)}
                      title="Remove connector"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 5L5 15M5 5L15 15" stroke="#ED4A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="add-charger-connector-content">
                  <div className="add-charger-input-row">
                    <div className={`add-charger-input-field${errors.connectors && index === 0 ? ' has-error' : ''}`}>
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">
                          Connector ID <span className="required-indicator">*</span>
                        </span>
                      </div>
                      <div className="add-charger-input-field-status">
                        <input
                          type="number"
                          min="1"
                          value={connector.connectorId}
                          onChange={(event) => updateConnector(connector.id, 'connectorId', event.target.value)}
                          placeholder="Enter connector number"
                        />
                      </div>
                      {errors.connectors && index === 0 ? (
                        <span className="add-charger-field-error">{errors.connectors}</span>
                      ) : null}
                    </div>
                    <div className="add-charger-input-field" style={{ width: '540px', height: '78px' }}>
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Power Type</span>
                      </div>
                      <div className="add-charger-radio-group" style={{ flexDirection: 'row', gap: '20px' }}>
                        {POWER_TYPE_OPTIONS.map((option) => (
                          <label key={option.value} className="add-charger-radio-option" onClick={() => updateConnector(connector.id, 'powerType', option.value)}>
                            <div className="add-charger-radio-button">
                              <input
                                type="radio"
                                name={`powerType-${connector.id}`}
                                value={option.value}
                                checked={connector.powerType === option.value}
                                onChange={() => {}}
                              />
                              {connector.powerType === option.value ? (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2"/>
                                  <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)"/>
                                </svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect x="1" y="1" width="18" height="18" rx="9" stroke="#67716B" strokeWidth="2"/>
                                </svg>
                              )}
                            </div>
                            <span className="add-charger-radio-label">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="add-charger-input-row">
                    <div className="add-charger-input-field">
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Format</span>
                      </div>
                      <PillDropdown
                        id={`connector-format-${connector.id}`}
                        value={connector.format || ''}
                        onChange={(event) => updateConnector(connector.id, 'format', event.target.value)}
                        options={[
                          { value: '', label: 'Select format' },
                          ...CONNECTOR_FORMAT_OPTIONS,
                        ]}
                      />
                    </div>
                    <div className="add-charger-input-field">
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Plug Type</span>
                      </div>
                      <PillDropdown
                        id={`connector-plug-${connector.id}`}
                        value={connector.plug || ''}
                        onChange={(event) => updateConnector(connector.id, 'plug', event.target.value)}
                        options={[
                          { value: '', label: 'Select plug type' },
                          ...CONNECTOR_PLUG_TYPE_OPTIONS,
                        ]}
                      />
                    </div>
                  </div>
                  <div className="add-charger-input-row">
                    <div className="add-charger-input-field">
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Power (kW)</span>
                      </div>
                      <div className="add-charger-input-field-status">
                        <input
                          type="text"
                          value={connector.powerKw}
                          onChange={(event) => updateConnector(connector.id, 'powerKw', event.target.value)}
                          placeholder="Enter connector power"
                        />
                      </div>
                    </div>
                    <div className="add-charger-input-field">
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Voltage (V)</span>
                      </div>
                      <div className="add-charger-input-field-status">
                        <input
                          type="text"
                          value={connector.voltage}
                          onChange={(event) => updateConnector(connector.id, 'voltage', event.target.value)}
                          placeholder="Enter name"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="add-charger-input-row">
                    <div className="add-charger-input-field">
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">Amperage (A)</span>
                      </div>
                      <div className="add-charger-input-field-status">
                        <input
                          type="text"
                          value={connector.amperage}
                          onChange={(event) => updateConnector(connector.id, 'amperage', event.target.value)}
                          placeholder="Enter connector power"
                        />
                      </div>
                    </div>
                    <div className="add-charger-input-field" style={{ opacity: 0 }}>
                      <div className="add-charger-input-header">
                        <span className="add-charger-input-label">
                          Connector ID <span className="required-indicator">*</span>
                        </span>
                      </div>
                      <div className="add-charger-input-field-status">
                        <span className="add-charger-readonly-value">{connector.connectorId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="add-charger-add-connector-button" onClick={addConnector}>
              <div className="add-charger-plus-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 7H13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 1V13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="add-charger-add-connector-label">Add new Connector</span>
            </button>
          </div>
        </div>
        )}

        {canAccessBilling && ((!isEditMode && currentStage === 3) || (isEditMode && activeTab === 'pricing')) && (
        <div className="add-charger-stage-container">
          {!isEditMode && <h2 className="add-charger-stage-title">3 - Pricing</h2>}
          <div className="add-charger-stage-content">
            {/* Pricing Section */}
            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Pricing</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.pricing ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">DC</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.pricing.dc}
                      onChange={(event) => updatePricing('dc', event.target.value)}
                      placeholder={defaultPrices?.dc ?? defaultPrices?.dc_rate_per_kwh ?? "-"}
                    />
                  </div>
                  {errors.pricing ? <span className="add-charger-field-error">{errors.pricing}</span> : null}
                </div>
                <div className="add-charger-input-field full-width">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">AC</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.pricing.ac}
                      onChange={(event) => updatePricing('ac', event.target.value)}
                      placeholder={defaultPrices?.ac ?? defaultPrices?.ac_rate_per_kwh ?? "-"}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Idle Fees Section (DC) */}
            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Idle Fees (DC)</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.idleFees ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Idle After</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.dcIdleAfter}
                      onChange={(event) => updateIdleFees('dcIdleAfter', event.target.value)}
                      placeholder={defaultPrices?.dc_idle_after_minutes ?? "-"}
                    />
                  </div>
                  {errors.idleFees ? <span className="add-charger-field-error">{errors.idleFees}</span> : null}
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Fees</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.dcFees}
                      onChange={(event) => updateIdleFees('dcFees', event.target.value)}
                      placeholder={defaultPrices?.dc_idle_fee_amount ?? "-"}
                    />
                    <span className="add-charger-egp-suffix">{stationCurrency}</span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">For each</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.dcForEach}
                      onChange={(event) => updateIdleFees('dcForEach', event.target.value)}
                      placeholder={defaultPrices?.dc_idle_interval_minutes ?? "-"}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Idle Fees Section (AC) */}
            <div className="add-charger-section-card">
              <div className="add-charger-connector-header">
                <h3 className="add-charger-connector-title">Idle Fees (AC)</h3>
              </div>
              <div className="add-charger-input-row">
                <div className={`add-charger-input-field${errors.idleFees ? ' has-error' : ''}`}>
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Idle After</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.acIdleAfter}
                      onChange={(event) => updateIdleFees('acIdleAfter', event.target.value)}
                      placeholder={defaultPrices?.ac_idle_after_minutes ?? "-"}
                    />
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">Fees</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.acFees}
                      onChange={(event) => updateIdleFees('acFees', event.target.value)}
                      placeholder={defaultPrices?.ac_idle_fee_amount ?? "-"}
                    />
                    <span className="add-charger-egp-suffix">{stationCurrency}</span>
                  </div>
                </div>
                <div className="add-charger-input-field">
                  <div className="add-charger-input-header">
                    <span className="add-charger-input-label">For each</span>
                  </div>
                  <div className="add-charger-input-field-status">
                    <input
                      type="text"
                      value={form.idleFees.acForEach}
                      onChange={(event) => updateIdleFees('acForEach', event.target.value)}
                      placeholder={defaultPrices?.ac_idle_interval_minutes ?? "-"}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Hours Pricing Section */}
            {form.customPricing.length > 0 && (
              <div className="add-charger-section-card">
                <div className="add-charger-connector-header">
                  <h3 className="add-charger-connector-title">Custom Hours Pricing</h3>
                </div>
                <div className="add-charger-custom-pricing-content">
                  {form.customPricing.map((period, index) => {
                    const labels = resolvePeriodLabels(period, index)
                    const periodErrors = errors.customPricingPeriods?.[period.id] || {}
                    return (
                      <div key={period.id} className="add-charger-pricing-period">
                        <div className="add-charger-period-header">
                          <div>
                            <h4 className="add-charger-period-title">{labels.english}</h4>
                            <span className="station-secondary-text">{labels.arabic}</span>
                          </div>
                          <div className="add-charger-period-actions">
                            <button
                              type="button"
                              className={`add-charger-toggle-button ${period.enabled ? 'enabled' : ''}`}
                              onClick={() => toggleCustomPricing(period.id)}
                            >
                              <div className="add-charger-toggle-circle" />
                            </button>
                            <button
                              type="button"
                              className="add-charger-delete-pricing-button"
                              onClick={() => removeCustomPricing(period.id)}
                              title="Delete custom pricing"
                            >
                              <span className="add-charger-delete-label">Delete</span>
                            </button>
                          </div>
                        </div>
                        <div className="add-charger-period-content">
                          <div className="add-charger-input-row">
                            <div className={`add-charger-input-field${periodErrors.englishPeriodLabel ? ' has-error' : ''}`}>
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">
                                  English period label <span className="required-indicator">*</span>
                                </span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  value={period.englishPeriodLabel ?? ''}
                                  onChange={(event) => updateCustomPricing(period.id, 'englishPeriodLabel', event.target.value)}
                                  placeholder="Enter English period label"
                                  readOnly={!period.enabled}
                                />
                              </div>
                              {periodErrors.englishPeriodLabel ? (
                                <span className="add-charger-field-error">{periodErrors.englishPeriodLabel}</span>
                              ) : null}
                            </div>
                            <div className={`add-charger-input-field${periodErrors.arabicPeriodLabel ? ' has-error' : ''}`}>
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">
                                  Arabic period label <span className="required-indicator">*</span>
                                </span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  dir="rtl"
                                  value={period.arabicPeriodLabel ?? ''}
                                  onChange={(event) => updateCustomPricing(period.id, 'arabicPeriodLabel', event.target.value)}
                                  placeholder="أدخل اسم الفترة بالعربية"
                                  readOnly={!period.enabled}
                                />
                              </div>
                              {periodErrors.arabicPeriodLabel ? (
                                <span className="add-charger-field-error">{periodErrors.arabicPeriodLabel}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="add-charger-input-row">
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">From</span>
                                <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  value={period.from}
                                  onChange={(event) => updateCustomPricing(period.id, 'from', event.target.value)}
                                  placeholder="Start Time ex: 18:30"
                                  readOnly={!period.enabled}
                                />
                              </div>
                            </div>
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">To</span>
                                <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  value={period.to}
                                  onChange={(event) => updateCustomPricing(period.id, 'to', event.target.value)}
                                  placeholder="End Time ex: 06:30"
                                  readOnly={!period.enabled}
                                />
                              </div>
                            </div>
                            <div className={`add-charger-input-field${errors.customPricing && index === 0 ? ' has-error' : ''}`}>
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">DC</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  value={period.dc}
                                  onChange={(event) => updateCustomPricing(period.id, 'dc', event.target.value)}
                                  placeholder={defaultPrices?.dc ?? defaultPrices?.dc_rate_per_kwh ?? '-'}
                                  readOnly={!period.enabled}
                                />
                              </div>
                              {errors.customPricing && index === 0 ? (
                                <span className="add-charger-field-error">{errors.customPricing}</span>
                              ) : null}
                            </div>
                            <div className="add-charger-input-field">
                              <div className="add-charger-input-header">
                                <span className="add-charger-input-label">AC</span>
                              </div>
                              <div className="add-charger-input-field-status">
                                <input
                                  type="text"
                                  value={period.ac}
                                  onChange={(event) => updateCustomPricing(period.id, 'ac', event.target.value)}
                                  placeholder={defaultPrices?.ac ?? defaultPrices?.ac_rate_per_kwh ?? '-'}
                                  readOnly={!period.enabled}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add Custom Pricing Button */}
            {form.customPricing.length < MAX_CUSTOM_PERIODS && (
              <button type="button" className="add-charger-add-connector-button" onClick={addCustomPricing}>
                <div className="add-charger-plus-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 7H13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 1V13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="add-charger-add-connector-label">Add Custom Days / Hours Pricing</span>
              </button>
            )}
          </div>
        </div>
        )}

      </form>
    </div>
  )
}

export default AddCharger
