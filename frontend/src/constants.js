export const API_BASE =
  import.meta.env.VITE_IKARUS_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  'http://localhost:8000/api'
export const LOGIN_LOGO_URL = '/assets/ikarus-logo.png'
export const DASHBOARD_LOGO_URL = '/assets/ikarus-db-logo.png'
export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GMAPS_API_KEY ||
  ''
export const GOOGLE_MAPS_SCRIPT_ID = 'ikarus-google-maps-script'
export const GOOGLE_MAP_LIBRARIES = Object.freeze(['marker', 'places'])
