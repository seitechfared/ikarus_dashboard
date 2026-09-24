import { useJsApiLoader } from '@react-google-maps/api'

import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAP_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
} from '@/constants'

export const DEFAULT_MAP_CENTER = { lat: 30.0444, lng: 31.2357 }
export const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }

const BASE_MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
}

export const buildMapOptions = (overrides = {}) => ({
  ...BASE_MAP_OPTIONS,
  ...overrides,
})

export const DEFAULT_MAP_OPTIONS = buildMapOptions()

export const useGoogleMapsLoader = () =>
  useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY ?? '',
    libraries: GOOGLE_MAP_LIBRARIES,
    preventGoogleFontsLoading: true,
  })
