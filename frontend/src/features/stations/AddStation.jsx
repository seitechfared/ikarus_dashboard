import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, Marker } from '@react-google-maps/api'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import {
  API_BASE,
  GOOGLE_MAPS_API_KEY,
} from '@/constants'
import { createMapPinIcon } from '@/utils/mapPinIcon'
import { fetchCities, fetchCountries } from '@/services/referenceApi'
import {
  DEFAULT_MAP_CENTER,
  MAP_CONTAINER_STYLE,
  buildMapOptions,
  useGoogleMapsLoader,
} from '@/utils/mapConfig'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import PillDropdown from '@/components/ui/molecules/PillDropdown'
import { validateName } from '@/utils/validation'
import { fetchAllPages } from '@/utils/fetchAllPages'
import '@/styles/dashboard.css'

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

const MAP_OPTIONS = buildMapOptions({ region: 'EG', language: 'en' })
const MAP_SEARCH_MIN_LENGTH = 3

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeOptional = (value) => {
  if (typeof value !== 'string') {
    return value ?? null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase()
const GEOCODER_UNAVAILABLE_STATUSES = new Set(['REQUEST_DENIED', 'OVER_QUERY_LIMIT'])

const createNearbyPlaceId = () =>
  `nearby-${Date.now()}-${Math.random().toString(16).slice(2)}`

const resolveNearbyLogoUrl = (value) => value || ''

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

function AddStation() {
  const navigate = useNavigate()
  const { user: _dashboardUser } = useOutletContext() || {}

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

  const mapPinIcon = useMemo(() => {
    const googleMaps = typeof window !== 'undefined' ? window.google?.maps : undefined
    return createMapPinIcon(googleMaps)
  }, [isGoogleMapsReady])

  const geocoderRef = useRef(null)
  const geocoderAvailabilityRef = useRef('unknown')
  const geocoderAvailabilityToastRef = useRef(false)
  const lastReverseGeocodeRef = useRef({ lat: null, lng: null })

  const [form, setForm] = useState({
    name: '',
    arabicName: '',
    siteOwner: '',
    maintenancePartner: '',
    serviceProvider: '',
    address: '',
    country: '',
    governorate: '',
    latitude: '',
    longitude: '',
    visibility: 'public',
    status: 'planning',
  })

  const previewUrlsRef = useRef(new Set())
  const [imageEntries, setImageEntries] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
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
  const reverseGeocodeErrorToastedRef = useRef(false)

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    },
    []
  )

  useEffect(() => {
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

        setPartners(Array.isArray(partnersData) ? partnersData : [])
        setSiteOwners(Array.isArray(siteOwnersData) ? siteOwnersData : [])
        setServiceProviders(Array.isArray(providersData) ? providersData : [])
      } catch (err) {
        console.error('Failed to load options:', err)
      }
    }

    loadOptions()
  }, [])

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

  const isFormValid = useMemo(
    () =>
      Boolean(
        form.name.trim() &&
          form.country &&
          form.governorate.trim() &&
          form.address.trim() &&
          form.visibility &&
          form.status
      ),
    [form.name, form.country, form.governorate, form.address, form.visibility, form.status]
  )

  const selectedCountryOption = useMemo(
    () => matchCountryOption(countryOptions, form.country),
    [countryOptions, form.country]
  )

  const selectedCountryCode = selectedCountryOption?.code || ''

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

  const currentCoordinates = useMemo(() => {
    const lat = toNumberOrNull(form.latitude)
    const lng = toNumberOrNull(form.longitude)
    if (lat === null || lng === null) {
      return null
    }
    return { lat, lng }
  }, [form.latitude, form.longitude])

  const composedMapAddress = useMemo(() => {
    const parts = [form.address].map((part) =>
      typeof part === 'string' ? part.trim() : ''
    )
    const filtered = parts.filter(Boolean)
    return filtered.length ? filtered.join(', ') : 'Location not set yet.'
  }, [form.address])
  
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
      updateField('governorate', matched.name)
    }
  }, [cityOptions, form.governorate])

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

  useEffect(() => {
    if (!isGoogleMapsReady || !currentCoordinates) {
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
  }, [currentCoordinates, isGoogleMapsReady, reverseGeocodeCoordinates])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      return
    }
    setImageEntries((prev) => [
      ...prev,
      ...files.map((file) => {
        const preview = URL.createObjectURL(file)
        previewUrlsRef.current.add(preview)
        return { file, preview }
      }),
    ])
    event.target.value = ''
  }

  const handleImageRemove = (index) => {
    setImageEntries((prev) => {
      const next = [...prev]
      const [removed] = next.splice(index, 1)
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview)
        previewUrlsRef.current.delete(removed.preview)
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

  const handleAddNearbyPlace = () => {
    setNearbyPlaces((prev) => [...prev, { id: createNearbyPlaceId(), name: '', logo: '' }])
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    const nameError = validateName(form.name, { required: true, label: 'Station name' })
    if (nameError) {
      nextErrors.name = nameError
    }
    const arabicNameError = validateName(form.arabicName, {
      required: false,
      label: 'Arabic name',
    })
    if (arabicNameError) {
      nextErrors.arabicName = arabicNameError
    }
    if (!form.country) {
      nextErrors.country = 'Country is required.'
    }
    const governorateError = validateName(form.governorate, {
      required: true,
      label: 'Governorate',
    })
    if (governorateError) {
      nextErrors.governorate = governorateError
    }
    if (!form.address.trim()) {
      nextErrors.address = 'Address is required.'
    }
    if (!form.visibility) {
      nextErrors.visibility = 'Visibility is required.'
    }
    if (!form.status) {
      nextErrors.status = 'Status is required.'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const nearbyPayload = nearbyPlaces
        .map((item) => ({
          name: String(item.name || '').trim(),
          logo: item.logo ? String(item.logo) : null,
        }))
        .filter((item) => item.name || item.logo)
      const payload = {
        name: form.name.trim(),
        arabic_name: normalizeOptional(form.arabicName),
        site_owner: normalizeOptional(form.siteOwner),
        maintenance_partner: normalizeOptional(form.maintenancePartner),
        service_provider: normalizeOptional(form.serviceProvider),
        address: normalizeOptional(form.address),
        country: form.country || null,
        country_code: selectedCountryCode || null,
        governorate: form.governorate.trim(),
        latitude: toNumberOrNull(form.latitude),
        longitude: toNumberOrNull(form.longitude),
        visibility: form.visibility,
        status: form.status,
      }
      const formData = new FormData()
      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return
        }
        formData.append(key, typeof value === 'number' ? String(value) : value)
      })
      if (nearbyPayload.length) {
        formData.append('nearby', JSON.stringify(nearbyPayload))
      }
      imageEntries.forEach((entry) => {
        if (entry.file) {
          formData.append('images', entry.file)
        }
      })
      const response = await fetch(`${API_BASE}/stations/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...appendAuthHeader(),
        },
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = data?.detail || 'Failed to create station.'
        throw new Error(detail)
      }

      const savedStation = data && typeof data === 'object' ? data.station || data : null
      const stationId = savedStation?.id ?? savedStation?.station_id ?? savedStation?.identifier ?? null
      const stationName = savedStation?.name || form.name || 'Station'

      showToast({
        title: 'Station created',
        message: `${stationName} created successfully.`,
        variant: 'success',
      })
      if (stationId) {
        navigate(`/stations/${stationId}`, { replace: true })
      } else {
        navigate('/stations', { replace: true })
      }
    } catch (error) {
      console.error(error)
      showToast({
        title: 'Save failed',
        message: error.message || 'Unable to save station. Please try again.',
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="add-station-page">
      <header className="add-station-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Stations', to: '/stations' },
                { label: 'Add Station' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/stations" ariaLabel="Back to stations" />
              <h1>Add Station</h1>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
          disabled={isSubmitting || !isFormValid}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </header>

      <InlineToastRegion region="stations" />

      <form className="add-station-form" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h2>Station details</h2>
          <div className="section-grid two-column">
            <div className={`field${errors.name ? ' has-error' : ''}`}>
              <label htmlFor="station-name">
                Station Name <span className="required-indicator">*</span>
              </label>
              <input
                id="station-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Enter station name"
                required
              />
              {errors.name ? <p className="field-error">{errors.name}</p> : null}
            </div>
            <div className={`field${errors.arabicName ? ' has-error' : ''}`}>
              <label htmlFor="station-arabic-name">Arabic Name</label>
              <input
                id="station-arabic-name"
                value={form.arabicName}
                onChange={(event) => updateField('arabicName', event.target.value)}
                placeholder="Enter Arabic station name"
              />
              {errors.arabicName ? <p className="field-error">{errors.arabicName}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="station-site-owner">Site Owner</label>
              <PillDropdown
                id="station-site-owner"
                value={form.siteOwner || ''}
                onChange={(event) => updateField('siteOwner', event.target.value)}
                searchable
                searchPlaceholder="Search site owners"
                options={[
                  { value: '', label: 'Select Site Owner' },
                  ...siteOwners.map(so => ({ value: so.id, label: so.name })),
                ]}
              />
            </div>
            <div className="field">
              <label htmlFor="station-maintenance-partner">Maintenance Partner</label>
              <PillDropdown
                id="station-maintenance-partner"
                value={form.maintenancePartner || ''}
                onChange={(event) => updateField('maintenancePartner', event.target.value)}
                searchable
                searchPlaceholder="Search partners"
                options={[
                  { value: '', label: 'Select Maintenance Partner' },
                  ...partners.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <div className="field">
              <label htmlFor="station-provider">Service Provider</label>
              <PillDropdown
                id="station-provider"
                value={form.serviceProvider || ''}
                onChange={(event) => updateField('serviceProvider', event.target.value)}
                searchable
                searchPlaceholder="Search service providers"
                options={[
                  { value: '', label: 'Select Service Provider' },
                  ...serviceProviders.map(sp => ({ value: sp.id, label: sp.name })),
                ]}
              />
            </div>
            <div className={`field${errors.country ? ' has-error' : ''}`}>
              <label htmlFor="station-country">
                Country <span className="required-indicator">*</span>
              </label>
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
                className={errors.country ? 'has-error' : ''}
                searchable
                searchPlaceholder="Search countries"
                options={countryDropdownOptions}
              />
              {errors.country ? <p className="field-error">{errors.country}</p> : null}
            </div>
            <div className={`field${errors.governorate ? ' has-error' : ''}`}>
              <label htmlFor="station-governorate">
                Governorate <span className="required-indicator">*</span>
              </label>
              <PillDropdown
                id="station-governorate"
                value={form.governorate || ''}
                onChange={(event) => updateField('governorate', event.target.value)}
                className={errors.governorate ? 'has-error' : ''}
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
              {errors.governorate ? <p className="field-error">{errors.governorate}</p> : null}
            </div>
            <div className={`field${errors.address ? ' has-error' : ''}`}>
              <label htmlFor="station-address">
                Address <span className="required-indicator">*</span>
              </label>
              <input
                id="station-address"
                value={form.address}
                onChange={(event) => updateField('address', event.target.value)}
                placeholder="Street address"
                required
              />
              {errors.address ? <p className="field-error">{errors.address}</p> : null}
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2>Location on map</h2>
          <p className="station-address-line">{composedMapAddress}</p>
          
          <div className="station-map-shell">
            <div className="station-map-canvas">
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
                  <GoogleMap
                    key="add-station-map"
                    mapContainerStyle={MAP_CONTAINER_STYLE}
                    options={MAP_OPTIONS}
                    center={currentCoordinates || DEFAULT_MAP_CENTER}
                    zoom={currentCoordinates ? 13 : 6}
                    onClick={handleMapClick}
                  >
                    {currentCoordinates ? (
                      <Marker
                        position={currentCoordinates}
                        icon={mapPinIcon}
                        draggable
                        onDragEnd={handleMarkerDragEnd}
                        title={form.name || 'Station location'}
                      />
                    ) : null}
                  </GoogleMap>
                  {!currentCoordinates ? (
                    <div className="map-overlay">Click on the map to set the station location.</div>
                  ) : null}
                </>
              )}
            </div>
            {isMapsConfigured ? (
              <p className="map-hint">
                Click anywhere on the map to drop a marker. Drag the marker to fine-tune the coordinates.
              </p>
            ) : null}
          </div>
          <div className="section-grid two-column">
            <div className="field">
              <label htmlFor="station-latitude">Latitude</label>
              <input
                id="station-latitude"
                value={form.latitude}
                onChange={(event) => updateField('latitude', event.target.value)}
                placeholder="Latitude"
                inputMode="decimal"
              />
            </div>
            <div className="field">
              <label htmlFor="station-longitude">Longitude</label>
              <input
                id="station-longitude"
                value={form.longitude}
                onChange={(event) => updateField('longitude', event.target.value)}
                placeholder="Longitude"
                inputMode="decimal"
              />
            </div>
          </div>
        </section>

        
        <section className="form-section">
          <h2>Visibility & Status</h2>
          <div className="section-grid two-column">
            <div className={`field${errors.visibility ? ' has-error' : ''}`}>
              <label htmlFor="station-visibility">
                Visibility <span className="required-indicator">*</span>
              </label>
              <PillDropdown
                id="station-visibility"
                value={form.visibility}
                onChange={(event) => updateField('visibility', event.target.value)}
                options={VISIBILITY_OPTIONS}
              />
              {errors.visibility ? <p className="field-error">{errors.visibility}</p> : null}
            </div>
            <div className={`field${errors.status ? ' has-error' : ''}`}>
              <label htmlFor="station-status">
                Status <span className="required-indicator">*</span>
              </label>
              <PillDropdown
                id="station-status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                options={STATUS_OPTIONS}
              />
              {errors.status ? <p className="field-error">{errors.status}</p> : null}
            </div>
          </div>
        </section>

        <section className="form-section">
          <header className="section-heading">
            <h2>Station Images</h2>
            <label className="small-button upload-button">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handleImageSelect}
              />
              Upload
            </label>
          </header>
          <p className="field-hint">
            Upload up to 10 images (JPG or PNG). Drag controls let you fine-tune the display order.
          </p>
          {imageEntries.length ? (
            <ul className="image-grid">
              {imageEntries.map((entry, index) => (
                <li key={entry.preview || index} className="image-card">
                  <img src={entry.preview} alt={`Station image ${index + 1}`} />
                  <div className="image-card-actions">
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
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="image-placeholder">No images added yet.</div>
          )}
        </section>

        <section className="form-section">
          <header className="section-heading">
            <h2>NearBy Places</h2>
            <button type="button" className="ghost-button" onClick={handleAddNearbyPlace}>
              Add place
            </button>
          </header>
          <p className="field-hint">Add nearby places with just a name and logo.</p>
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
                  <button
                    type="button"
                    className="ghost-button danger station-nearby-remove"
                    onClick={() => handleRemoveNearbyPlace(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="data-placeholder">No nearby places added yet.</p>
            )}
          </div>
        </section>


        <footer className="form-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/stations')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={isSubmitting || !isFormValid}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default AddStation
