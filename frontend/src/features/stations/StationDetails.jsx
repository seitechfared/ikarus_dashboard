import { GoogleMap, Marker } from '@react-google-maps/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import ChargerActionMenu from '@/components/ui/organisms/ChargerActionMenu'
import {
  API_BASE,
  GOOGLE_MAPS_API_KEY,
} from '@/constants'
import { createMapPinIcon } from '@/utils/mapPinIcon'
import { hexToRgba } from '@/utils/color'
import { getThemeColors } from '@/utils/theme'
import { fetchCities, fetchCountries } from '@/services/referenceApi'
import {
  DEFAULT_MAP_CENTER,
  MAP_CONTAINER_STYLE,
  buildMapOptions,
  useGoogleMapsLoader,
} from '@/utils/mapConfig'
import {
  CHARGER_STATUS_COLORS,
  CHARGER_STATUS_LABELS,
  CONNECTOR_STATUS_COLORS,
  CONNECTOR_STATUS_LABELS,
  normalizeChargerStatus,
  normalizeConnectorStatus,
} from '@/utils/status'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import PillDropdown from '@/components/ui/molecules/PillDropdown'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { buildMediaUrl } from '@/utils/media'
import { fetchAllPages } from '@/utils/fetchAllPages'
import '@/styles/dashboard.css'

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const MAP_SEARCH_MIN_LENGTH = 3
const GEOCODER_UNAVAILABLE_STATUSES = new Set(['REQUEST_DENIED', 'OVER_QUERY_LIMIT'])

const MAP_OPTIONS = buildMapOptions({ region: 'EG', language: 'en' })

const formatCoordinateForField = (value) => {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return ''
  }
  return numeric.toFixed(6)
}

const sortStationImages = (images) =>
  Array.isArray(images)
    ? [...images].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || (a.id ?? 0) - (b.id ?? 0)
      )
    : []

const API_MEDIA_BASE = (() => {
  const candidate = API_BASE.replace(/\/api\/?$/, '/')
  return candidate.endsWith('/') ? candidate : `${candidate}/`
})()

const buildAbsoluteMediaUrl = (value) => {
  if (!value) return ''
  if (/^(?:https?:|blob:|data:)/i.test(value)) {
    return value
  }
  if (value.startsWith('/')) {
    return `${API_MEDIA_BASE}${value.replace(/^\//, '')}`
  }
  return `${API_MEDIA_BASE}${value}`
}

const resolveStationImageUrl = (image) => {
  if (!image) return ''
  if (image.preview) {
    return image.preview
  }
  if (image.url) {
    return buildAbsoluteMediaUrl(image.url)
  }
  if (image.path) {
    return buildAbsoluteMediaUrl(image.path)
  }
  return ''
}

const mapExistingImageEntries = (images) =>
  sortStationImages(images).map((image) => ({
    id: image.id,
    url: resolveStationImageUrl(image),
    isNew: false,
  }))

const resolveBrandLogoUrl = (brandPayload, fallbackLogo) => {
  const pickLogoCandidate = (candidate) => {
    if (!candidate) {
      return ''
    }
    if (typeof candidate === 'string') {
      return buildMediaUrl(candidate)
    }
    if (typeof candidate === 'object') {
      const value = candidate.url || candidate.path || candidate.preview
      return value ? buildMediaUrl(value) : ''
    }
    return ''
  }

  const candidate =
    brandPayload?.logo ||
    brandPayload?.logo_url ||
    brandPayload?.logoUrl ||
    brandPayload?.logo_path ||
    brandPayload?.logoPath ||
    fallbackLogo

  return pickLogoCandidate(candidate)
}

const toTitleFromToken = (value, fallback = 'N/A') => {
  if (!value || typeof value !== 'string') {
    return fallback
  }
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatStatusLabel = (value) => toTitleFromToken(value, 'Unknown')
const formatVisibilityLabel = (value) => toTitleFromToken(value, 'Not set')

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase()

const parseCoordinateSearchQuery = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const match = value.trim().match(
    /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/
  )
  if (!match) {
    return null
  }
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }
  return { lat, lng }
}

const createNearbyPlaceId = () =>
  `nearby-${Date.now()}-${Math.random().toString(16).slice(2)}`

const normalizeNearbyPlaces = (items) => {
  if (!Array.isArray(items)) {
    return []
  }
  return items
    .map((item) => ({
      id: item?.id ? String(item.id) : createNearbyPlaceId(),
      name: item?.name ? String(item.name).trim() : '',
      logo: item?.logo ? String(item.logo) : '',
    }))
    .filter((item) => item.name || item.logo)
}

const resolveNearbyLogoUrl = (value) => {
  if (!value) {
    return ''
  }
  return buildAbsoluteMediaUrl(value)
}

const matchCountryOption = (options, value) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return null
  }
  const exact = options.find(
    (country) =>
      normalizeToken(country.code) === normalized ||
      normalizeToken(country.name) === normalized
  )
  if (exact) {
    return exact
  }
  return (
    options.find((country) => {
      const nameToken = normalizeToken(country.name)
      return nameToken && (normalized.includes(nameToken) || nameToken.includes(normalized))
    }) || null
  )
}

const matchCityOption = (options, value) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return null
  }
  const exact = options.find((city) => normalizeToken(city.name) === normalized)
  if (exact) {
    return exact
  }
  return (
    options.find((city) => {
      const nameToken = normalizeToken(city.name)
      return nameToken && (normalized.includes(nameToken) || nameToken.includes(normalized))
    }) || null
  )
}

// Only 4 connector statuses: Available, Charging, Preparing, Unavailable/Faulted
const normalizeChargerRow = (row, fallbackIndex = 0) => {
  const statusValue = row?.status?.value || row?.status
  const normalizedStatus = normalizeChargerStatus(statusValue)
  const visibilityValue = row?.visibility?.value || row?.visibility
  const number =
    row?.number ||
    row?.charger_box_id ||
    row?.box_id ||
    row?.serial_number ||
    row?.ocpp_identifier ||
    row?.identifier ||
    `charger-${fallbackIndex}`
  return {
    id: row?.id ? String(row.id) : `charger-${fallbackIndex}`,
    name: row?.name?.trim() || number,
    number,
    chargerBoxId: row?.charger_box_id || row?.box_id || null,
    status: {
      value: normalizedStatus,
      label: CHARGER_STATUS_LABELS[normalizedStatus] || normalizedStatus,
      color: CHARGER_STATUS_COLORS[normalizedStatus] || CHARGER_STATUS_COLORS.planned,
    },
    connectorStatus: row?.connector_status || { summary: {}, total: 0, tooltips: [] },
    visibility: row?.visibility
      ? {
          value: visibilityValue,
          label: row.visibility.label || visibilityValue,
          color: row.visibility.color,
        }
      : { value: visibilityValue, label: visibilityValue },
    brand: row?.brand
      ? {
          ...row.brand,
          name: row.brand?.name || row?.brand_name || '—',
          logo: resolveBrandLogoUrl(
            row.brand,
            row?.brand_logo || row?.brand_logo_url || row?.brandLogoUrl
          ),
        }
      : {
          name: row?.brand_name || '—',
          logo: resolveBrandLogoUrl(null, row?.brand_logo || row?.brand_logo_url || row?.brandLogoUrl),
        },
    actions: row?.actions?.length ? row.actions : undefined,
  }
}

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'semi_public', label: 'Semi Public' },
  { value: 'private', label: 'Private' },
]

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'offline', label: 'Offline' },
  { value: 'decommissioned', label: 'Decommissioned' },
]

function StationDetails() {
  const { stationId } = useParams()
  const navigate = useNavigate()
  const [station, setStation] = useState(null)
  const [chargers, setChargers] = useState([])
  const [normalizedChargers, setNormalizedChargers] = useState([])
  const [selectedConnector, setSelectedConnector] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [form, setForm] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStationModalState, setDeleteStationModalState] = useState({ isOpen: false })
  const [deleteChargerModalState, setDeleteChargerModalState] = useState({
    isOpen: false,
    charger: null,
  })
  const previewUrlsRef = useRef(new Set())
  const [imageEntries, setImageEntries] = useState([])
  const [removedImageIds, setRemovedImageIds] = useState(new Set())
  const [partners, setPartners] = useState([])
  const [siteOwners, setSiteOwners] = useState([])
  const [serviceProviders, setServiceProviders] = useState([])
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [countryOptions, setCountryOptions] = useState([])
  const [isCountriesLoading, setIsCountriesLoading] = useState(false)
  const [cityOptions, setCityOptions] = useState([])
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const { showToast } = useInlineToast('stations')
  const [mapSearch, setMapSearch] = useState('')
  const [isSearchingMap, setIsSearchingMap] = useState(false)
  const [mapSearchFeedback, setMapSearchFeedback] = useState('')
  const [mapSearchResults, setMapSearchResults] = useState([])
  const geocoderRef = useRef(null)
  const geocoderAvailabilityRef = useRef('unknown')
  const geocoderAvailabilityToastRef = useRef(false)
  const lastReverseGeocodeRef = useRef({ lat: null, lng: null })
  const reverseGeocodeErrorToastedRef = useRef(false)

  const siteOwnerOptions = useMemo(() => {
    const baseOptions = siteOwners.map((owner) => ({ value: owner.id, label: owner.name }))
    const selectedId = form.site_owner || station?.site_owner_id || ''
    const selectedLabel = station?.site_owner
    if (selectedId && !baseOptions.some((option) => option.value === selectedId)) {
      baseOptions.unshift({
        value: selectedId,
        label: selectedLabel || 'Selected site owner',
      })
    }
    return [{ value: '', label: 'Select Site Owner' }, ...baseOptions]
  }, [form.site_owner, siteOwners, station?.site_owner_id, station?.site_owner])

  const partnerOptions = useMemo(() => {
    const baseOptions = partners.map((partner) => ({ value: partner.id, label: partner.name }))
    const selectedId = form.maintenance_partner || station?.maintenance_partner_id || ''
    const selectedLabel = station?.maintenance_partner
    if (selectedId && !baseOptions.some((option) => option.value === selectedId)) {
      baseOptions.unshift({
        value: selectedId,
        label: selectedLabel || 'Selected partner',
      })
    }
    return [{ value: '', label: 'Select Partner' }, ...baseOptions]
  }, [form.maintenance_partner, partners, station?.maintenance_partner_id, station?.maintenance_partner])

  const serviceProviderOptions = useMemo(() => {
    const baseOptions = serviceProviders.map((provider) => ({ value: provider.id, label: provider.name }))
    const selectedId = form.service_provider || station?.service_provider_id || ''
    const selectedLabel = station?.service_provider
    if (selectedId && !baseOptions.some((option) => option.value === selectedId)) {
      baseOptions.unshift({
        value: selectedId,
        label: selectedLabel || 'Selected provider',
      })
    }
    return [{ value: '', label: 'Select Service Provider' }, ...baseOptions]
  }, [form.service_provider, serviceProviders, station?.service_provider_id, station?.service_provider])

  const selectedCountryOption = useMemo(
    () => matchCountryOption(countryOptions, form.country),
    [countryOptions, form.country]
  )

  const selectedCountryCode = selectedCountryOption?.code || ''

  const countryDropdownOptions = useMemo(() => {
    const sorted = [...countryOptions].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    )
    const options = sorted
      .filter((country) => country?.name)
      .map((country) => ({ value: country.name, label: country.name }))
    if (form.country && !options.some((option) => option.value === form.country)) {
      options.unshift({ value: form.country, label: form.country })
    }
    const placeholder = isCountriesLoading ? 'Loading countries...' : 'Select Country'
    return [{ value: '', label: placeholder }, ...options]
  }, [countryOptions, form.country, isCountriesLoading])

  const availableGovernorates = useMemo(() => {
    if (!cityOptions.length) {
      return []
    }
    return [...cityOptions]
      .filter((city) => city?.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map((city) => ({ value: city.name, label: city.name }))
  }, [cityOptions])

  useEffect(() => {
    if (!form.governorate || !cityOptions.length) {
      return
    }
    const matched = matchCityOption(cityOptions, form.governorate)
    if (matched && matched.name && matched.name !== form.governorate) {
      setForm((prev) => ({ ...prev, governorate: matched.name }))
    }
  }, [cityOptions, form.governorate])

  useEffect(() => {
    if (!selectedCountryCode) {
      setCityOptions([])
      setIsCitiesLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setIsCitiesLoading(true)
    fetchCities({ countryCode: selectedCountryCode, signal: controller.signal })
      .then((cities) => {
        if (cancelled) {
          return
        }
        setCityOptions(Array.isArray(cities) ? cities : [])
      })
      .catch((cityError) => {
        if (!cancelled && cityError?.name !== 'AbortError') {
          console.error(cityError)
          showToast({
            title: 'Unable to load cities',
            message: cityError.message || 'Failed to load cities list.',
            variant: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCitiesLoading(false)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedCountryCode, showToast])

  const isMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY)
  const { isLoaded: isMapLoaded, loadError: mapLoadError } = useGoogleMapsLoader()
  const isGoogleMapsReady = useMemo(
    () =>
      Boolean(
        isMapsConfigured &&
          (isMapLoaded || (typeof window !== 'undefined' && window.google?.maps))
      ),
    [isMapLoaded, isMapsConfigured]
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadStation = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE}/stations/${stationId}/`, {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!response.ok) {
          throw new Error('Failed to fetch station details.')
        }
        const data = await response.json()

        if (!cancelled) {
          const sanitizedStation = {
            ...data,
            latitude: toNumberOrNull(data.latitude),
            longitude: toNumberOrNull(data.longitude),
          }

          setStation(sanitizedStation)
          setNearbyPlaces(normalizeNearbyPlaces(sanitizedStation.nearby))
          setImageEntries(mapExistingImageEntries(data.images || []))
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
          setError('Unable to load station details.')
          showToast({
            title: 'Load failed',
            message: loadError.message || 'Unable to load station details.',
            variant: 'error',
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    const loadChargers = async () => {
      try {
        const params = new URLSearchParams()
        params.set('station_id', stationId)
        params.set('ordering', 'id')
        const data = await fetchAllPages(`${API_BASE}/chargers/?${params.toString()}`, {
          pageSize: 200,
          credentials: 'include',
          headers: appendAuthHeader(),
        })
        if (!cancelled) {
          const normalized = data.map((row, index) => normalizeChargerRow(row, index))
          setChargers(data)
          setNormalizedChargers(normalized)
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError)
        }
      }
    }

    const loadOptions = async () => {
      try {
        const [partnersData, siteOwnersData, providersData] = await Promise.all([
          fetchAllPages(`${API_BASE}/partners/`, {
            pageSize: 200,
            credentials: 'include',
            headers: appendAuthHeader(),
          }),
          fetchAllPages(`${API_BASE}/site-owners/`, {
            pageSize: 200,
            credentials: 'include',
            headers: appendAuthHeader(),
          }),
          fetchAllPages(`${API_BASE}/service-providers/`, {
            pageSize: 200,
            credentials: 'include',
            headers: appendAuthHeader(),
          }),
        ])

        if (!cancelled) {
          setPartners(Array.isArray(partnersData) ? partnersData : [])
          setSiteOwners(Array.isArray(siteOwnersData) ? siteOwnersData : [])
          setServiceProviders(Array.isArray(providersData) ? providersData : [])
        }
      } catch (err) {
        console.error('Failed to load options:', err)
      }
    }

    loadOptions()
    loadStation()
    loadChargers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [stationId])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setIsCountriesLoading(true)
    fetchCountries({ signal: controller.signal })
      .then((countries) => {
        if (cancelled) {
          return
        }
        setCountryOptions(Array.isArray(countries) ? countries : [])
      })
      .catch((countryError) => {
        if (!cancelled && countryError?.name !== 'AbortError') {
          console.error(countryError)
          showToast({
            title: 'Unable to load countries',
            message: countryError.message || 'Failed to load countries list.',
            variant: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCountriesLoading(false)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [showToast])

  // Handle click outside for connector popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.connector-dot-wrapper') && !event.target.closest('.connector-popup')) {
        setSelectedConnector(null)
      }
    }
    if (selectedConnector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [selectedConnector])

  // Render functions (matching Chargers.jsx)
  const renderConnectorSummary = (charger) => {
    const tooltips = charger.connectorStatus?.tooltips || []
    const total = charger.connectorStatus?.total ?? 0

    if (total === 0) {
      return <span className="connector-empty">No connectors</span>
    }

    return (
      <div className="charger-connector-dots">
        <div className="connector-dots-container">
          {tooltips.map((connector, index) => {
            const isSelected = selectedConnector?.id === connector.id && selectedConnector?.chargerId === charger.id
            // Normalize connector status
            const normalizedStatus = normalizeConnectorStatus(connector.status)
            const statusColor = CONNECTOR_STATUS_COLORS[normalizedStatus] || CONNECTOR_STATUS_COLORS.unavailable
            const statusLabel = CONNECTOR_STATUS_LABELS[normalizedStatus] || 'Unavailable'
            
            return (
              <div
                key={connector.id || index}
                className={`connector-dot-wrapper ${isSelected ? 'popup-open' : ''}`}
              >
                <button
                  type="button"
                  className="connector-dot-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedConnector(isSelected ? null : { ...connector, chargerId: charger.id })
                  }}
                  style={{
                    backgroundColor: connector.color || statusColor,
                  }}
                  aria-label={`Connector ${connector.label || index + 1} - ${statusLabel}`}
                />
                {isSelected && (
                  <div className="connector-popup">
                    <div className="connector-popup-status">
                      <span
                        className="connector-popup-status-badge"
                        style={{
                          backgroundColor: (() => {
                            const color = connector.color || statusColor
                            const hex = color.replace('#', '')
                            const r = parseInt(hex.slice(0, 2), 16)
                            const g = parseInt(hex.slice(2, 4), 16)
                            const b = parseInt(hex.slice(4, 6), 16)
                            return `rgba(${r}, ${g}, ${b}, 0.12)`
                          })(),
                          color: connector.color || statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="connector-popup-identifier">
                      {connector.label || `Connector ${index + 1}`}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderStatusBadge = (status) => {
    if (!status?.label) {
      return <span className="status-badge">—</span>
    }
    const themeColors = getThemeColors()
    const statusValue = status.value || ''
    let backgroundColor, textColor
    if (statusValue === 'available') {
      backgroundColor = 'rgba(46, 165, 98, 0.12)'
      textColor = '#2EA561'
    } else if (statusValue === 'unavailable') {
      backgroundColor = 'rgba(237, 74, 74, 0.12)'
      textColor = '#ED4A4A'
    } else if (statusValue === 'planned') {
      backgroundColor = 'rgba(62, 79, 68, 0.12)'
      textColor = '#3E4F44'
    } else {
      const fallbackColor = themeColors.secondary
      backgroundColor = hexToRgba(status.color || fallbackColor, 0.15)
      textColor = status.color || fallbackColor
    }
    return (
      <span
        className="status-badge charger-status-badge"
        style={{ backgroundColor, color: textColor }}
      >
        {status.label}
      </span>
    )
  }

  const renderVisibilityPill = (visibility) => {
    if (!visibility?.label) {
      return <span className="status-pill charger-visibility-pill">—</span>
    }
    const backgroundColor = hexToRgba(visibility.color || '#1f2937', 0.15)
    const textColor = visibility.color || '#1f2937'
    return (
      <span
        className="status-pill charger-visibility-pill"
        style={{ backgroundColor, color: textColor }}
      >
        {visibility.label}
      </span>
    )
  }

  const handleChargerAction = (charger, action) => {
    if (action === 'edit') {
      navigate(`/chargers/${charger.id}/edit`)
      return
    }
    if (action === 'remote_actions') {
      navigate(`/chargers/${charger.id}`, { state: { openRemoteActions: true } })
      return
    }
    if (action === 'logs') {
      navigate(`/chargers/${charger.id}`, { state: { focusTab: 'logs' } })
      return
    }
    if (action === 'delete') {
      handleDeleteChargerClick(charger)
      return
    }
  }

  const handleDeleteChargerClick = (charger) => {
    setDeleteChargerModalState({ isOpen: true, charger })
  }

  const handleDeleteCharger = async () => {
    const charger = deleteChargerModalState.charger
    if (!charger) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/chargers/${charger.id}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete charger.')
      }
      // Reload station data to refresh charger list
      if (stationId) {
        loadStationData()
      }
      showToast({
        title: 'Charger deleted',
        message: `${charger.name} was removed successfully.`,
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete charger.',
        variant: 'error',
      })
    } finally {
      setDeleteChargerModalState({ isOpen: false, charger: null })
    }
  }

  // Initialize form when station data and options are both available
  useEffect(() => {
    if (!station) {
      return
    }

    // Find IDs for dropdowns (options may still be loading)
    const siteOwnerId =
      station.site_owner_id ||
      siteOwners.find((so) => so.name === station.site_owner)?.id ||
      ''
    const partnerId =
      station.maintenance_partner_id ||
      partners.find((p) => p.name === station.maintenance_partner)?.id ||
      ''
    const providerId =
      station.service_provider_id ||
      serviceProviders.find((sp) => sp.name === station.service_provider)?.id ||
      ''
    
    setForm(prev => {
      // Only update if form is empty or if values don't match (to avoid infinite loops)
      if (!prev.name && station.name) {
        return {
          name: station.name?.trim() || '',
          arabic_name: station.arabic_name?.trim() || '',
          site_owner: siteOwnerId,
          maintenance_partner: partnerId,
          service_provider: providerId,
          country: station.country || '',
          governorate: station.governorate?.trim() || '',
          address: station.address?.trim() || '',
          visibility: station.visibility ?? 'public',
          status: station.status ?? 'operational',
          latitude: formatCoordinateForField(station.latitude),
          longitude: formatCoordinateForField(station.longitude),
        }
      }
      // Update dropdown IDs if they don't match
      if (prev.site_owner !== siteOwnerId || prev.maintenance_partner !== partnerId || prev.service_provider !== providerId) {
        return {
          ...prev,
          site_owner: siteOwnerId,
          maintenance_partner: partnerId,
          service_provider: providerId,
          country: station.country || prev.country || '',
          governorate: station.governorate?.trim() || prev.governorate || '',
        }
      }
      return prev
    })
  }, [station, partners, siteOwners, serviceProviders])

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    },
    []
  )

  useEffect(() => {
    if (!station) {
      setImageEntries([])
      setRemovedImageIds(new Set())
      return
    }
    setImageEntries(mapExistingImageEntries(station.images || []))
    setRemovedImageIds(new Set())
  }, [station, partners, siteOwners, serviceProviders])

  useEffect(() => {
    if (!isEditing && station) {
      setImageEntries(mapExistingImageEntries(station.images || []))
      setRemovedImageIds(new Set())
      setMapSearchResults([])
    }
  }, [isEditing, station])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddNearbyPlace = () => {
    setNearbyPlaces((prev) => [
      ...prev,
      { id: createNearbyPlaceId(), name: '', logo: '' },
    ])
  }

  const handleNearbyNameChange = (placeId, value) => {
    setNearbyPlaces((prev) =>
      prev.map((item) => (item.id === placeId ? { ...item, name: value } : item))
    )
  }

  const handleNearbyLogoChange = (placeId, value) => {
    setNearbyPlaces((prev) =>
      prev.map((item) => (item.id === placeId ? { ...item, logo: value } : item))
    )
  }

  const handleNearbyLogoFile = (placeId, file) => {
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result ? String(reader.result) : ''
      if (!result) {
        return
      }
      setNearbyPlaces((prev) =>
        prev.map((item) => (item.id === placeId ? { ...item, logo: result } : item))
      )
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveNearbyPlace = (placeId) => {
    setNearbyPlaces((prev) => prev.filter((item) => item.id !== placeId))
  }

  const handleNewImageSelect = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }
    setImageEntries((prev) => [
      ...prev,
      ...files.map((file) => {
        const preview = URL.createObjectURL(file)
        previewUrlsRef.current.add(preview)
        return { id: null, url: preview, file, isNew: true }
      }),
    ])
    event.target.value = ''
  }

  const handleImageRemove = (index) => {
    setImageEntries((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed?.id) {
        setRemovedImageIds((current) => {
          const updated = new Set(current)
          updated.add(removed.id)
          return updated
        })
      }
      if (removed?.isNew && removed.url) {
        URL.revokeObjectURL(removed.url)
        previewUrlsRef.current.delete(removed.url)
      }
      return next
    })
  }

  const handleImageMove = (index, direction) => {
    setImageEntries((prev) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  const handleSave = async () => {
    if (!station) return
    if (
      !String(form.name || '').trim() ||
      !form.country ||
      !String(form.governorate || '').trim() ||
      !form.visibility ||
      !form.status
    ) {
      showToast({
        title: 'Validation failed',
        message: 'Station name, country, governorate, visibility, and status are required.',
        variant: 'error',
      })
      return
    }
    setIsSaving(true)
    try {
      const normalizeField = (value) => {
        if (typeof value !== 'string') {
          return value ?? null
        }
        const trimmed = value.trim()
        return trimmed ? trimmed : null
      }

      const nearbyPayload = nearbyPlaces
        .map((item) => ({
          name: String(item.name || '').trim(),
          logo: item.logo ? String(item.logo) : null,
        }))
        .filter((item) => item.name || item.logo)

      const payload = {
        name: normalizeField(form.name),
        arabic_name: normalizeField(form.arabic_name),
        nearby: nearbyPayload,
        service_provider: normalizeField(form.service_provider),
        maintenance_partner: normalizeField(form.maintenance_partner),
        site_owner: normalizeField(form.site_owner),
        country: form.country || '',
        country_code: selectedCountryCode || '',
        governorate: normalizeField(form.governorate),
        visibility: normalizeField(form.visibility),
        status: normalizeField(form.status),
        address: normalizeField(form.address),
        latitude: toNumberOrNull(form.latitude),
        longitude: toNumberOrNull(form.longitude),
      }

      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        // Always include country fields so the backend cannot keep a stale code.
        if (key === 'country' || key === 'country_code') {
          formData.append(key, value || '')
        } else if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value))
        } else if (value === null || value === undefined || value === '') {
          return
        } else {
          formData.append(key, typeof value === 'number' ? String(value) : value)
        }
      })
      const orderedExistingIds = imageEntries
        .filter((entry) => entry.id)
        .map((entry) => entry.id)
      if (orderedExistingIds.length) {
        formData.append('images_order', JSON.stringify(orderedExistingIds))
      }
      const removedIds = Array.from(removedImageIds)
      if (removedIds.length) {
        formData.append('remove_image_ids', JSON.stringify(removedIds))
      }
      imageEntries.forEach((entry) => {
        if (entry.isNew && entry.file) {
          formData.append('images', entry.file)
        }
      })
      const response = await fetch(`${API_BASE}/stations/${stationId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...appendAuthHeader(),
        },
        body: formData,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const detail = data.detail || 'Failed to update station.'
        throw new Error(detail)
      }
      const body =
        response.status === 204 ? {} : await response.json().catch(() => ({}))
      const nextStation = {
        ...station,
        ...payload,
        ...body,
        latitude: toNumberOrNull(
          body.latitude !== undefined ? body.latitude : station.latitude
        ),
        longitude: toNumberOrNull(
          body.longitude !== undefined ? body.longitude : station.longitude
        ),
        images: sortStationImages(body.images ?? station.images),
      }
      setStation(nextStation)
      setNearbyPlaces(normalizeNearbyPlaces(nextStation.nearby))
      const nextSiteOwnerId =
        nextStation.site_owner_id ||
        siteOwners.find((so) => so.name === nextStation.site_owner)?.id ||
        ''
      const nextPartnerId =
        nextStation.maintenance_partner_id ||
        partners.find((p) => p.name === nextStation.maintenance_partner)?.id ||
        ''
      const nextProviderId =
        nextStation.service_provider_id ||
        serviceProviders.find((sp) => sp.name === nextStation.service_provider)?.id ||
        ''
      setForm((prev) => ({
        ...prev,
        name: nextStation.name?.trim() || '',
        arabic_name: nextStation.arabic_name?.trim() || '',
        owner: nextStation.owner?.trim() || '',
        site_owner: nextSiteOwnerId,
        maintenance_partner: nextPartnerId,
        service_provider: nextProviderId,
        country: nextStation.country || '',
        governorate: nextStation.governorate?.trim() || '',
        visibility: nextStation.visibility ?? 'public',
        status: nextStation.status ?? 'operational',
        address: nextStation.address?.trim() || '',
        latitude: formatCoordinateForField(nextStation.latitude),
        longitude: formatCoordinateForField(nextStation.longitude),
      }))
      showToast({
        title: 'Station updated',
        message: 'Changes saved successfully.',
        variant: 'success',
      })
      setIsEditing(false)
    } catch (saveError) {
      console.error(saveError)
      showToast({
        title: 'Update failed',
        message: saveError.message || 'Unable to update station.',
        variant: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteStationClick = useCallback(() => {
    if (!station) {
      return
    }
    setDeleteStationModalState({ isOpen: true })
  }, [station])

  const handleDeleteStation = useCallback(async () => {
    if (!station) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/stations/${stationId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to delete station.')
      }
      showToast({
        title: 'Station deleted',
        message: `${station.name} was removed successfully.`,
        variant: 'success',
      })
      navigate('/stations', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete station.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteStationModalState({ isOpen: false })
    }
  }, [station, stationId, navigate, showToast])

  const markerPosition = useMemo(() => {
    const lat = toNumberOrNull(form.latitude)
    const lng = toNumberOrNull(form.longitude)
    if (lat === null || lng === null) {
      return null
    }
    return { lat, lng }
  }, [form.latitude, form.longitude])

  const mapCenter = markerPosition || DEFAULT_MAP_CENTER
  const mapZoom = markerPosition ? 13 : 6

  const resolveTagToken = (value) =>
    typeof value === 'string'
      ? value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : ''
  const visibilityValue = form.visibility || station?.visibility || ''
  const statusValue = form.status || station?.status || ''
  const visibilityLabel = formatVisibilityLabel(visibilityValue)
  const statusLabel = formatStatusLabel(statusValue)
  const stationStatusToken = resolveTagToken(statusValue) || 'default'
  const stationVisibilityToken = resolveTagToken(visibilityValue) || 'default'
  const heroLocationLine = [form.address]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(', ')
  const heroSubtitle = heroLocationLine || 'Location not provided yet.'
  const derivedChargersCount = (station?.chargers ?? chargers.length) || 0

  const connectorsTotal = chargers.reduce(
    (sum, charger) => sum + (Number(charger.connectors_total) || 0),
    0
  )
  const detailItems = [
    {
      label: 'Site Owner',
      value: station?.site_owner || 'N/A',
    },
    {
      label: 'Maintenance Partner',
      value: station?.maintenance_partner || 'N/A',
    },
    {
      label: 'Governorate',
      value: station?.governorate || 'N/A',
    },
    {
      label: 'Chargers',
      value: derivedChargersCount || '0',
    },
    {
      label: 'Connectors',
      value: connectorsTotal || '0',
    },
  ]

  const handleOpenInMaps = () => {
    if (typeof window === 'undefined') return
    const queryTarget = heroLocationLine || station.name || 'Charging station'
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryTarget)}`,
      '_blank',
      'noopener'
    )
  }

  const mapPinIcon = useMemo(() => {
    const googleMaps = typeof window !== 'undefined' ? window.google?.maps : undefined
    return createMapPinIcon(googleMaps)
  }, [isGoogleMapsReady])

  const markGeocoderUnavailable = useCallback(() => {
    geocoderAvailabilityRef.current = 'unavailable'
    if (!geocoderAvailabilityToastRef.current) {
      geocoderAvailabilityToastRef.current = true
      showToast({
        title: 'Geocoding unavailable',
        message:
          'Google geocoding is disabled for this API key. Address auto-fill will be skipped.',
        variant: 'error',
      })
    }
  }, [showToast])

  const getGeocoder = useCallback(() => {
    if (
      !isGoogleMapsReady ||
      geocoderAvailabilityRef.current === 'unavailable' ||
      typeof window === 'undefined' ||
      !window.google?.maps?.Geocoder
    ) {
      return null
    }
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder()
    }
    return geocoderRef.current
  }, [isGoogleMapsReady])

  const buildLocationDetails = useCallback(
    (result) => {
      const components = result?.address_components || []
      const pickComponent = (...types) => {
        for (const type of types) {
          const match = components.find((component) => component.types.includes(type))
          if (match?.long_name) {
            return match.long_name
          }
        }
        return ''
      }

      const streetNumber = pickComponent('street_number')
      const route = pickComponent('route')
      const premise = pickComponent(
        'premise',
        'point_of_interest',
        'establishment',
        'subpremise'
      )
      const formattedAddress = result?.formatted_address || ''
      let address = formattedAddress.trim()
      if (!address) {
        const addressParts = [streetNumber, route].filter(Boolean)
        if (addressParts.length) {
          address = addressParts.join(' ').trim()
        } else if (premise) {
          address = premise.trim()
        }
      }

      const countryName = pickComponent('country')
      const matchedCountry = matchCountryOption(countryOptions, countryName)
      const country = matchedCountry?.name || ''

      const normalizedGovernorate = (pickComponent('administrative_area_level_1') || '')
        .replace(/\s+governorate$/i, '')
        .replace(/\s+province$/i, '')
        .replace(/\s+region$/i, '')
        .replace(/\s+state$/i, '')
        .trim()
      const matchedCity = matchCityOption(cityOptions, normalizedGovernorate)
      const governorate = matchedCity?.name || normalizedGovernorate

      return {
        address,
        country,
        governorate,
      }
    },
    [cityOptions, countryOptions]
  )

  const reverseGeocodeCoordinates = useCallback(
    (lat, lng) =>
      new Promise((resolve) => {
        const geocoder = getGeocoder()
        if (!geocoder) {
          resolve(null)
          return
        }
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.length) {
            geocoderAvailabilityRef.current = 'available'
            geocoderAvailabilityToastRef.current = false
            reverseGeocodeErrorToastedRef.current = false
            resolve(buildLocationDetails(results[0]))
            return
          }
          if (GEOCODER_UNAVAILABLE_STATUSES.has(status)) {
            markGeocoderUnavailable()
            resolve(null)
            return
          }
          if (status !== 'ZERO_RESULTS' && !reverseGeocodeErrorToastedRef.current) {
            console.warn('Reverse geocoding failed', status, results)
            showToast({
              title: 'Map lookup failed',
              message: 'Unable to retrieve address details from Google Maps right now.',
              variant: 'error',
            })
            reverseGeocodeErrorToastedRef.current = true
          }
          resolve(null)
        })
      }),
    [buildLocationDetails, getGeocoder, markGeocoderUnavailable, showToast]
  )

  const geocodeAddressSearch = useCallback(
    (query) =>
      new Promise((resolve, reject) => {
        const geocoder = getGeocoder()
        if (!geocoder) {
          resolve({ blocked: true, results: [] })
          return
        }
        geocoder.geocode({ address: query, region: 'eg' }, (results, status) => {
          if (status === 'OK' && results?.length) {
            geocoderAvailabilityRef.current = 'available'
            geocoderAvailabilityToastRef.current = false
            resolve({ blocked: false, results })
            return
          }
          if (GEOCODER_UNAVAILABLE_STATUSES.has(status)) {
            markGeocoderUnavailable()
            resolve({ blocked: true, results: [] })
            return
          }
          if (status === 'ZERO_RESULTS') {
            resolve({ blocked: false, results: [] })
            return
          }
          reject(new Error(`Google geocoding failed (${status || 'UNKNOWN'})`))
        })
      }),
    [getGeocoder, markGeocoderUnavailable]
  )

  const currentCoordinates = useMemo(() => {
    const lat = toNumberOrNull(form.latitude)
    const lng = toNumberOrNull(form.longitude)
    if (lat === null || lng === null) {
      return null
    }
    return { lat, lng }
  }, [form.latitude, form.longitude])

  useEffect(() => {
    if (!isGoogleMapsReady || !currentCoordinates || !isEditing) {
      return
    }
    const { lat, lng } = currentCoordinates
    if (
      lastReverseGeocodeRef.current.lat === lat &&
      lastReverseGeocodeRef.current.lng === lng
    ) {
      return
    }
    lastReverseGeocodeRef.current = { lat, lng }
    let isCancelled = false
    reverseGeocodeCoordinates(lat, lng)
      .then((result) => {
        if (isCancelled || !result) {
          return
        }
        setForm((prev) => {
          let updated = false
          const next = { ...prev }
          if (result.address && result.address !== prev.address) {
            next.address = result.address
            updated = true
          }
          if (result.country && result.country !== prev.country) {
            next.country = result.country
            updated = true
            // Clear governorate if country changes
            if (result.country !== prev.country) {
              next.governorate = ''
            }
          }
          if (result.governorate && result.governorate !== prev.governorate) {
            next.governorate = result.governorate
            updated = true
          }
          return updated ? next : prev
        })
      })
      .catch((error) => {
        console.warn('Reverse geocoding promise rejected', error)
      })
    return () => {
      isCancelled = true
    }
  }, [currentCoordinates, isGoogleMapsReady, reverseGeocodeCoordinates, isEditing])

  const handleMapSearchChange = (event) => {
    setMapSearch(event.target.value)
    if (mapSearchFeedback) {
      setMapSearchFeedback('')
    }
    if (mapSearchResults.length) {
      setMapSearchResults([])
    }
  }

  const handleMapSearchResultSelect = (candidate) => {
    if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
      setMapSearchFeedback('Unable to resolve coordinates for this location.')
      return
    }
    const { lat, lng, details, label } = candidate
    lastReverseGeocodeRef.current = { lat: null, lng: null }
    updateField('latitude', lat.toFixed(6))
    updateField('longitude', lng.toFixed(6))

    setForm((prev) => {
      const next = { ...prev }
      if (details?.address) {
        next.address = details.address
      }
      if (details?.country) {
        next.country = details.country
        if (details.country !== prev.country) {
          next.governorate = ''
        }
      }
      if (details?.governorate) {
        next.governorate = details.governorate
      }
      return next
    })

    setMapSearch(label || mapSearch.trim())
    setMapSearchFeedback('')
    setMapSearchResults([])
    showToast({
      title: 'Location updated',
      message: 'Address and coordinates were filled from selected search result.',
      variant: 'success',
    })
  }

  const handleMapSearchSubmit = async () => {
    const trimmed = mapSearch.trim()
    if (trimmed.length < MAP_SEARCH_MIN_LENGTH) {
      setMapSearchFeedback(`Type at least ${MAP_SEARCH_MIN_LENGTH} characters to search.`)
      setMapSearchResults([])
      return
    }

    const parsedCoordinateQuery = parseCoordinateSearchQuery(trimmed)
    if (parsedCoordinateQuery) {
      const { lat, lng } = parsedCoordinateQuery
      lastReverseGeocodeRef.current = { lat: null, lng: null }
      updateField('latitude', lat.toFixed(6))
      updateField('longitude', lng.toFixed(6))
      setMapSearchFeedback('')
      setMapSearchResults([])
      showToast({
        title: 'Location updated',
        message: 'Map centered using the provided coordinates.',
        variant: 'success',
      })
      return
    }

    setIsSearchingMap(true)
    setMapSearchFeedback('')
    try {
      const { blocked, results } = await geocodeAddressSearch(trimmed)
      if (blocked) {
        setMapSearchFeedback(
          'Text search is unavailable because geocoding is disabled. Use map pin or coordinates.'
        )
        setMapSearchResults([])
        return
      }
      if (!results.length) {
        setMapSearchFeedback('No locations found for this search.')
        setMapSearchResults([])
        return
      }

      const candidates = results
        .map((result, index) => {
          const location = result.geometry?.location
          if (!location?.lat || !location?.lng) {
            return null
          }
          const lat = location.lat()
          const lng = location.lng()
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null
          }
          return {
            id: result.place_id || `${lat}-${lng}-${index}`,
            label: result.formatted_address || `Result ${index + 1}`,
            lat,
            lng,
            details: buildLocationDetails(result),
          }
        })
        .filter(Boolean)

      if (!candidates.length) {
        setMapSearchFeedback('Unable to resolve coordinates for this location.')
        setMapSearchResults([])
        return
      }
      setMapSearchResults(candidates)
      setMapSearchFeedback('')
    } catch (error) {
      console.error('Map search failed', error)
      const message = error?.message ? String(error.message) : 'Unknown error'
      setMapSearchFeedback(`Search failed: ${message}`)
      setMapSearchResults([])
      showToast({
        title: 'Search failed',
        message: `Unable to search map right now. (${message})`,
        variant: 'error',
      })
    } finally {
      setIsSearchingMap(false)
    }
  }

  const handleMapSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleMapSearchSubmit()
    }
  }

  const handleMapClick = (event) => {
    if (!isEditing) {
      return
    }
    const lat = event.latLng?.lat?.()
    const lng = event.latLng?.lng?.()
    if (lat === undefined || lng === undefined) {
      return
    }
    // Reset last geocode ref to force reverse geocoding
    lastReverseGeocodeRef.current = { lat: null, lng: null }
    updateField('latitude', lat.toFixed(6))
    updateField('longitude', lng.toFixed(6))
    setMapSearchResults([])
  }

  const handleMarkerDragEnd = (event) => {
    if (!isEditing) {
      return
    }
    const lat = event.latLng?.lat?.()
    const lng = event.latLng?.lng?.()
    if (lat === undefined || lng === undefined) {
      return
    }
    // Reset last geocode ref to force reverse geocoding
    lastReverseGeocodeRef.current = { lat: null, lng: null }
    updateField('latitude', lat.toFixed(6))
    updateField('longitude', lng.toFixed(6))
    setMapSearchResults([])
  }

  if (isLoading) {
    return <p className="data-placeholder">Loading station...</p>
  }

  if (error) {
    return <div className="data-warning">{error}</div>
  }

  if (!station) {
    return null
  }

  return (
    <div className="station-details-page">
      <header className="station-details-hero">
        <div className="station-hero-left">
          <div className="station-hero-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Stations', to: '/stations' },
                { label: station.name },
              ]}
            />
            <div className="station-hero-title-row">
              <BackButton fallbackTo="/stations" ariaLabel="Back to stations" />
              <h1>{station.name}</h1>
              <span
                className={`station-pill station-status-pill status-${stationStatusToken}`}
                role="status"
              >
                {statusLabel}
              </span>
              <span
                className={`station-pill station-visibility-pill visibility-${stationVisibilityToken}`}
              >
                {visibilityLabel}
              </span>
            </div>
            <p className="station-hero-subtitle">{heroSubtitle}</p>
          </div>
        </div>
        <div className="station-hero-actions">
          <button
            type="button"
            className="ghost-button danger"
            onClick={handleDeleteStationClick}
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            disabled={isSaving || isDeleting}
          >
            {isEditing ? (isSaving ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>
      </header>

      <InlineToastRegion region="stations" />

      <div className="station-tabs">
        <button
          type="button"
          className={`station-tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={`station-tab ${activeTab === 'nearby' ? 'active' : ''}`}
          onClick={() => setActiveTab('nearby')}
        >
          NearBy
        </button>
      </div>

      {activeTab === 'details' ? (
      <>
      <section className="station-details-grid">
        

        <article className="station-card station-profile-card">
          <header className="station-card-header">
            <div>
              <h2>Station Profile</h2>
            </div>
          </header>
          <div className="section-grid two-column">
            <div className="field">
              <label htmlFor="station-name">
                Station Name <span className="required-indicator">*</span>
              </label>
              {isEditing ? (
                <input
                  id="station-name"
                  value={form.name || ''}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Enter station name"
                  required
                />
              ) : (
                <p className="station-text-value">{station.name || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-arabic-name">Arabic Name</label>
              {isEditing ? (
                <input
                  id="station-arabic-name"
                  value={form.arabic_name || ''}
                  onChange={(event) => updateField('arabic_name', event.target.value)}
                  placeholder="Enter Arabic station name"
                />
              ) : (
                <p className="station-text-value">{station.arabic_name || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-site-owner">Site Owner</label>
              {isEditing ? (
                <PillDropdown
                  id="station-site-owner"
                  value={form.site_owner || ''}
                  onChange={(event) => updateField('site_owner', event.target.value)}
                  searchable
                  searchPlaceholder="Search site owners"
                  options={siteOwnerOptions}
                />
              ) : (
                <p className="station-text-value">{station.site_owner || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-maintenance-partner">Maintenance Partner</label>
              {isEditing ? (
                <PillDropdown
                  id="station-maintenance-partner"
                  value={form.maintenance_partner || ''}
                  onChange={(event) => updateField('maintenance_partner', event.target.value)}
                  searchable
                  searchPlaceholder="Search partners"
                  options={partnerOptions}
                />
              ) : (
                <p className="station-text-value">{station.maintenance_partner || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-provider">Service Provider</label>
              {isEditing ? (
                <PillDropdown
                  id="station-provider"
                  value={form.service_provider || ''}
                  onChange={(event) => updateField('service_provider', event.target.value)}
                  searchable
                  searchPlaceholder="Search service providers"
                  options={serviceProviderOptions}
                />
              ) : (
                <p className="station-text-value">{station.service_provider || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-visibility">
                Visibility <span className="required-indicator">*</span>
              </label>
              {isEditing ? (
                <PillDropdown
                  id="station-visibility"
                  value={form.visibility}
                  onChange={(event) => updateField('visibility', event.target.value)}
                  options={VISIBILITY_OPTIONS}
                />
              ) : (
                <p className="station-text-value">{visibilityLabel}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-status">
                Status <span className="required-indicator">*</span>
              </label>
              {isEditing ? (
                <PillDropdown
                  id="station-status"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  options={STATUS_OPTIONS}
                />
              ) : (
                <p className="station-text-value">{statusLabel}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-country">
                Country <span className="required-indicator">*</span>
              </label>
              {isEditing ? (
                <PillDropdown
                  id="station-country"
                  value={form.country || ''}
                  onChange={(event) => {
                    updateField('country', event.target.value)
                    // Clear governorate when country changes
                    if (event.target.value !== form.country) {
                      updateField('governorate', '')
                    }
                  }}
                  searchable
                  searchPlaceholder="Search countries"
                  options={countryDropdownOptions}
                />
              ) : (
                <p className="station-text-value">{station.country || 'N/A'}</p>
              )}
            </div>
            <div className="field">
              <label htmlFor="station-governorate">
                Governorate <span className="required-indicator">*</span>
              </label>
              {isEditing ? (
                <PillDropdown
                  id="station-governorate"
                  value={form.governorate || ''}
                  onChange={(event) => updateField('governorate', event.target.value)}
                  searchable
                  searchPlaceholder="Search governorates"
                  options={[
                    {
                      value: '',
                      label: isCitiesLoading
                        ? 'Loading cities...'
                        : form.country
                          ? 'Select Governorate'
                          : 'Select Country first',
                    },
                    ...availableGovernorates,
                  ]}
                  disabled={!form.country || isCitiesLoading}
                />
              ) : (
                <p className="station-text-value">{station.governorate || 'N/A'}</p>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="station-card station-location-card">
        <header className="station-card-header">
          <div>
            <h2>Location on map</h2>
            <p className="station-address-line">{heroSubtitle}</p>
          </div>
          <button type="button" className="link-button" onClick={handleOpenInMaps}>
            View in Google Maps
          </button>
        </header>
        <div className="station-map-shell">
          <div className="station-map-canvas">
            {!isMapsConfigured ? (
              <div className="map-placeholder">
                Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the interactive map.
              </div>
            ) : mapLoadError ? (
              <div className="map-placeholder">
                Unable to load Google Maps.
                <br />
                <span className="map-error">{mapLoadError.message}</span>
              </div>
            ) : !isGoogleMapsReady ? (
              <p className="map-loading">Loading map...</p>
            ) : (
              <>
                {isEditing ? (
                  <div className="map-search-overlay">
                    <div className="map-search-bar">
                      <span className="map-search-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M16.423 15.248 19.256 18.073a1.314 1.314 0 0 1-1.184 2.19c-.222 0-.435-.089-.591-.246l-2.826-2.833A6.667 6.667 0 1 1 11.164 4.498a6.667 6.667 0 0 1 5.259 10.75Zm-5.259-9.083a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5Z"
                            fill="#67716B"
                          />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={mapSearch}
                        onChange={handleMapSearchChange}
                        onKeyDown={handleMapSearchKeyDown}
                        placeholder="Search for a street or landmark"
                        aria-label="Search for a street or landmark"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="small-button"
                        onClick={handleMapSearchSubmit}
                        disabled={isSearchingMap}
                      >
                        Search
                      </button>
                    </div>
                    {!isSearchingMap && mapSearchResults.length ? (
                      <div className="map-search-results" role="listbox" aria-label="Map search results">
                        {mapSearchResults.map((candidate) => (
                          <button
                            type="button"
                            key={candidate.id}
                            className="map-search-result"
                            onClick={() => handleMapSearchResultSelect(candidate)}
                          >
                            {candidate.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {isSearchingMap ? <p className="map-search-status">Searching...</p> : null}
                    {!isSearchingMap && mapSearchFeedback ? (
                      <p className="map-search-status muted">{mapSearchFeedback}</p>
                    ) : null}
                  </div>
                ) : null}
                <GoogleMap
                  key={station.id ?? 'station-map'}
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  options={MAP_OPTIONS}
                  center={mapCenter}
                  zoom={mapZoom}
                  onClick={handleMapClick}
                >
                  {markerPosition ? (
                    <Marker
                      position={markerPosition}
                      icon={mapPinIcon}
                      draggable={isEditing}
                      onDragEnd={handleMarkerDragEnd}
                      title={station.name}
                    />
                  ) : null}
                </GoogleMap>
                {!markerPosition ? (
                  <div className="map-overlay">
                    {isEditing
                      ? 'Click on the map to set the station location.'
                      : 'No coordinates recorded for this station yet.'}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {isMapsConfigured ? (
            <p className="map-hint">
              {isEditing
                ? 'Click the map or drag the marker to adjust coordinates.'
                : markerPosition
                  ? 'Station coordinates are displayed on the map.'
                  : 'No coordinates yet. Click "Edit Station" to add a location.'}
            </p>
          ) : null}
        </div>
        <div className="station-field-grid coordinates-grid">
          <div className="field">
            <label htmlFor="station-detail-latitude">Latitude</label>
            <input
              id="station-detail-latitude"
              value={form.latitude || ''}
              onChange={(event) => updateField('latitude', event.target.value)}
              placeholder="Latitude"
              inputMode="decimal"
              disabled={!isEditing}
            />
          </div>
          <div className="field">
            <label htmlFor="station-detail-longitude">Longitude</label>
            <input
              id="station-detail-longitude"
              value={form.longitude || ''}
              onChange={(event) => updateField('longitude', event.target.value)}
              placeholder="Longitude"
              inputMode="decimal"
              disabled={!isEditing}
            />
          </div>
        </div>
      </section>
      <section className="station-card station-chargers-card">
        <header className="station-card-header">
          <div>
            <h2>Chargers</h2>
            <p className="card-subtitle">
              {derivedChargersCount
                ? `Linked chargers: ${derivedChargersCount} | Connectors: ${connectorsTotal}`
                : 'No chargers linked to this station yet.'}
            </p>
          </div>
        </header>
        <div className="chargers-table" aria-busy={false}>
          <div className="chargers-table-header station-chargers-header">
            <div className="charger-cell order">No</div>
            <div className="charger-cell charger-box-id">Charge box id</div>
            <div className="charger-cell charger-status-cell">Charger status</div>
            <div className="charger-cell charger-connectors">Connectors</div>
            <div className="charger-cell charger-visibility-cell">Visibility</div>
            <div className="charger-cell">Brand</div>
            <div className="charger-cell charger-actions-cell"></div>
          </div>
          {normalizedChargers.map((charger, index) => (
            <article
              key={charger.id}
              className="charger-row clickable station-charger-row"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/chargers/${charger.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/chargers/${charger.id}`)
                }
              }}
            >
              <div className="charger-cell order">{index + 1}</div>
              <div className="charger-cell charger-box-id">
                <span>{charger.chargerBoxId || '—'}</span>
              </div>
              <div className="charger-cell charger-status-cell">
                {renderStatusBadge(charger.status)}
              </div>
              <div className="charger-cell charger-connectors">{renderConnectorSummary(charger)}</div>
              <div className="charger-cell charger-visibility-cell">
                {renderVisibilityPill(charger.visibility)}
              </div>
              {(() => {
                const rawCharger = chargers[index]
                const brandLogo =
                  resolveBrandLogoUrl(
                    rawCharger?.brand,
                    rawCharger?.brand_logo || rawCharger?.brand_logo_url || rawCharger?.brandLogoUrl
                  ) ||
                  charger.brand?.logo
                const brandName = charger.brand?.name || rawCharger?.brand_name || 'Brand logo'
                return (
                  <div className="charger-cell charger-brand">
                    {brandLogo ? (
                      <img src={brandLogo} alt={brandName} className="brand-icon" />
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                )
              })()}
              <div className="charger-cell charger-actions-cell" onClick={(event) => event.stopPropagation()}>
                <ChargerActionMenu
                  actions={charger.actions}
                  onAction={(action) => handleChargerAction(charger, action)}
                />
              </div>
            </article>
          ))}
          {!normalizedChargers.length ? (
            <p className="data-placeholder">No chargers available for this station.</p>
          ) : null}
        </div>
      </section>

      <section className="station-card station-images-card">
        <header className="station-card-header">
          <div>
            <h2>Station Images</h2>
            <p className="card-subtitle">Assets that appear in the overview and cards.</p>
          </div>
          {isEditing ? (
            <label className="small-button upload-button">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handleNewImageSelect}
              />
              Upload
            </label>
          ) : null}
        </header>
        {isEditing ? (
          imageEntries.length ? (
            <ul className="image-grid editable">
              {imageEntries.map((entry, index) => (
                <li key={entry.id ?? entry.url ?? index} className="image-card">
                  <img src={entry.url} alt={`Station image ${index + 1}`} />
                  <div className="image-card-actions">
                    <span className="image-badge">{entry.isNew ? 'New' : `#${index + 1}`}</span>
                    <div className="image-card-buttons">
                      <button
                        type="button"
                        onClick={() => handleImageMove(index, -1)}
                        disabled={index === 0}
                        aria-label="Move image up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImageMove(index, 1)}
                        disabled={index === imageEntries.length - 1}
                        aria-label="Move image down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImageRemove(index)}
                        aria-label="Remove image"
                        className="danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="image-placeholder">No images attached. Upload new photos to showcase this station.</div>
          )
        ) : station.images?.length ? (
          <ul className="image-grid">
            {sortStationImages(station.images).map((image) => (
              <li key={image.id} className="image-card">
                <img src={resolveStationImageUrl(image)} alt={station.name} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="image-placeholder">No images uploaded for this station yet.</div>
        )}
      </section>

      </>
      ) : null}

      {activeTab === 'nearby' ? (
      <section className="station-card station-nearby-card">
        <header className="station-card-header">
          <div>
            <h2>NearBy</h2>
            <p className="station-address-line">Nearby places with a name and logo.</p>
          </div>
          {isEditing ? (
            <button type="button" className="ghost-button" onClick={handleAddNearbyPlace}>
              Add place
            </button>
          ) : null}
        </header>
        <div className="station-nearby-list">
          {nearbyPlaces.length ? (
            nearbyPlaces.map((item) => (
              <div className="station-nearby-row" key={item.id}>
                {item.logo ? (
                  <img
                    src={resolveNearbyLogoUrl(item.logo)}
                    alt={item.name || 'Place'}
                    className="station-nearby-logo"
                  />
                ) : (
                  <div className="station-nearby-logo fallback">
                    {(item.name || 'P').charAt(0).toUpperCase()}
                  </div>
                )}
                {isEditing ? (
                  <div className="station-nearby-fields">
                    <input
                      type="text"
                      value={item.name}
                      placeholder="Place name"
                      onChange={(event) => handleNearbyNameChange(item.id, event.target.value)}
                      className="station-nearby-input"
                    />
                    <div className="station-nearby-logo-inputs">
                      <input
                        type="url"
                        value={item.logo && !String(item.logo).startsWith('data:') ? item.logo : ''}
                        placeholder="Logo URL (optional)"
                        onChange={(event) => handleNearbyLogoChange(item.id, event.target.value)}
                        className="station-nearby-input"
                      />
                      <label className="small-button upload-button">
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(event) => {
                            const [file] = event.target.files || []
                            handleNearbyLogoFile(item.id, file)
                            event.target.value = ''
                          }}
                        />
                        Upload logo
                      </label>
                    </div>
                  </div>
                ) : (
                  <span className="station-nearby-name">{item.name || 'Nearby place'}</span>
                )}
                {isEditing ? (
                  <button
                    type="button"
                    className="ghost-button danger station-nearby-remove"
                    onClick={() => handleRemoveNearbyPlace(item.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="data-placeholder">No nearby places yet.</p>
          )}
        </div>
      </section>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteStationModalState.isOpen}
        onClose={() => setDeleteStationModalState({ isOpen: false })}
        onConfirm={handleDeleteStation}
        title="Delete Station"
        itemName={station?.name}
        confirmationMessage={
          station ? `Are you sure you want to delete "${station.name}"?` : undefined
        }
      />

      <DeleteConfirmationModal
        isOpen={deleteChargerModalState.isOpen}
        onClose={() => setDeleteChargerModalState({ isOpen: false, charger: null })}
        onConfirm={handleDeleteCharger}
        title="Delete Charger"
        itemName={deleteChargerModalState.charger?.name}
        confirmationMessage={
          deleteChargerModalState.charger
            ? `Are you sure you want to delete "${deleteChargerModalState.charger.name}"?`
            : undefined
        }
      />
    </div>
  )
}

export default StationDetails
