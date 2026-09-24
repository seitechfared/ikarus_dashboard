import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ToastProvider from '@/components/common/ToastProvider'
import DashboardLiveUpdatesProvider from '@/components/common/DashboardLiveUpdatesProvider'
import DashboardLayout from '@/layouts/DashboardLayout'
import Overview from '@/features/overview/Overview'
import Stations from '@/features/stations/Stations'
import AddStation from '@/features/stations/AddStation'
import StationDetails from '@/features/stations/StationDetails'
import Chargers from '@/features/chargers/Chargers'
import AddCharger from '@/features/chargers/AddCharger'
import ChargerDetails from '@/features/chargers/ChargerDetails'
import Connectors from '@/features/connectors/Connectors'
import ConnectorDetails from '@/features/connectors/ConnectorDetails'
import AddConnector from '@/features/connectors/AddConnector'
import Partners from '@/features/partners/Partners'
import AddPartner from '@/features/partners/AddPartner'
import PartnerDetails from '@/features/partners/PartnerDetails'
import SiteOwners from '@/features/site-owners/SiteOwners'
import AddSiteOwner from '@/features/site-owners/AddSiteOwner'
import SiteOwnerDetails from '@/features/site-owners/SiteOwnerDetails'
import Customers from '@/features/customers/Customers'
import AddCustomer from '@/features/customers/AddCustomer'
import CustomerDetails from '@/features/customers/CustomerDetails'
import CustomerInvitationComplete from '@/features/customers/CustomerInvitationComplete'
import Admins from '@/features/admins/Admins'
import AddAdmin from '@/features/admins/AddAdmin'
import AdminDetails from '@/features/admins/AdminDetails'
import Ratings from '@/features/ratings/Ratings'
import Sessions from '@/features/sessions/Sessions'
import Transactions from '@/features/transactions/Transactions'
import Packages from '@/features/packages/Packages'
import EditFees from '@/features/packages/EditFees'
import EditPackage from '@/features/packages/EditPackage'
import Pricing from '@/features/pricing/Pricing'
import PricingCustomForm from '@/features/pricing/PricingCustomForm'
import PricingGeneralEdit from '@/features/pricing/PricingGeneralEdit'
import PrePaySetup from '@/features/prepay/PrePaySetup'
import SettingsLayout from '@/features/settings/SettingsLayout'
import ThemeSettingsPage from '@/features/settings/ThemeSettingsPage'
import CountriesSettingsPage from '@/features/settings/CountriesSettingsPage'
import GovernoratesSettingsPage from '@/features/settings/GovernoratesSettingsPage'
import DistrictsSettingsPage from '@/features/settings/DistrictsSettingsPage'
import AppVersionSettingsPage from '@/features/settings/AppVersionSettingsPage'
import MyAccount from '@/features/my-account/MyAccount'
import Login from '@/features/auth/Login'
import PushNotifications from '@/features/push-notifications/PushNotifications'
import AddPushNotification from '@/features/push-notifications/AddPushNotification'
import PushNotificationDetails from '@/features/push-notifications/PushNotificationDetails'
import { API_BASE } from '@/constants'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import {
  normalizeUser,
  getStoredSession,
  storeSession,
  clearStoredSession,
  installSessionExpiryInterceptor,
  SESSION_EXPIRED_EVENT,
} from '@/utils/session'
import { applyTheme, defaultTheme } from '@/utils/theme'

function App() {
  const [session, setSession] = useState(() => getStoredSession())
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const currentUser = session?.user ?? null
  const roleCapabilities = deriveRoleCapabilities(currentUser?.role)
  const guardBillingRoute = (element) =>
    roleCapabilities.canAccessBilling ? element : <Navigate to="/overview" replace />

  const persistSession = useCallback((nextSession) => {
    setSession(nextSession)
    if (nextSession) {
      storeSession(nextSession)
    } else {
      clearStoredSession()
    }
  }, [])

  const handleAuthenticated = useCallback(
    (nextSession) => {
      persistSession(nextSession ?? null)
    },
    [persistSession]
  )

  const handleLogout = useCallback(async () => {
    try {
      const headers =
        session?.token != null ? { Authorization: `Bearer ${session.token}` } : undefined
      await fetch(`${API_BASE}/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers,
      })
    } catch (error) {
      console.warn('Unable to reach logout endpoint', error)
    } finally {
      persistSession(null)
    }
  }, [persistSession, session?.token])

  useEffect(() => {
    const cleanupFetch = installSessionExpiryInterceptor(API_BASE)
    const handleExpired = () => {
      persistSession(null)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
      }
      cleanupFetch()
    }
  }, [persistSession])

  useEffect(() => {
    let isMounted = true

    const bootstrapSession = async () => {
      try {
        const stored = getStoredSession()
        const token = stored?.token ?? null
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined

        const response = await fetch(`${API_BASE}/auth/me/`, {
          credentials: 'include',
          headers,
        })

        if (!isMounted) {
          return
        }

        if (response.ok) {
          const data = await response.json().catch(() => null)
          const sessionUser = normalizeUser(data?.user || data)
          if (sessionUser) {
            persistSession({
              user: sessionUser,
              token: token ?? data?.token ?? null,
              refreshToken: stored?.refreshToken ?? data?.refresh_token ?? null,
              expiresAt: stored?.expiresAt ?? data?.expires_at ?? null,
            })
          } else {
            persistSession(null)
          }
        } else if (response.status === 401 || response.status === 403) {
          persistSession(null)
        }
      } catch (error) {
        if (isMounted) {
          console.warn('Unable to verify active session', error)
          persistSession(null)
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrapSession()

    return () => {
      isMounted = false
    }
  }, [persistSession])

  useEffect(() => {
    if (!currentUser) {
      applyTheme(defaultTheme)
    }
  }, [currentUser])

  const handleSessionUserUpdate = useCallback(
    (nextUserPayload) => {
      setSession((prev) => {
        if (!prev) {
          return prev
        }
        const normalizedUser = normalizeUser(nextUserPayload, prev.user) || prev.user
        const nextSession = {
          ...prev,
          user: normalizedUser,
        }
        storeSession(nextSession)
        return nextSession
      })
    },
    []
  )

  if (isBootstrapping) {
    return null
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        {currentUser ? (
          <Routes>
            <Route path="/invite/complete" element={<CustomerInvitationComplete />} />
            <Route
              path="/"
              element={
                <DashboardLiveUpdatesProvider>
                  <DashboardLayout
                    user={currentUser}
                    onLogout={handleLogout}
                    onSessionUserUpdate={handleSessionUserUpdate}
                  />
                </DashboardLiveUpdatesProvider>
              }
            >
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="stations" element={<Stations />} />
              <Route path="stations/new" element={<AddStation />} />
              <Route path="stations/:stationId" element={<StationDetails />} />
              <Route path="chargers" element={<Chargers />} />
              <Route path="chargers/new" element={<AddCharger />} />
              <Route path="chargers/:chargerId/edit" element={<AddCharger />} />
              <Route path="chargers/:chargerId" element={<ChargerDetails />} />
              <Route path="connectors" element={<Connectors />} />
              <Route path="connectors/new" element={<AddConnector />} />
              <Route path="connectors/:connectorId" element={<ConnectorDetails />} />
              <Route path="connectors/:connectorId/edit" element={<AddConnector />} />
              <Route path="partners" element={<Partners />} />
              <Route path="partners/new" element={<AddPartner />} />
              <Route path="partners/:partnerId" element={<PartnerDetails />} />
              <Route path="partners/:partnerId/edit" element={<AddPartner />} />
              <Route path="site-owners" element={<SiteOwners />} />
              <Route path="site-owners/new" element={<AddSiteOwner />} />
              <Route path="site-owners/:siteOwnerId" element={<SiteOwnerDetails />} />
              <Route path="site-owners/:siteOwnerId/edit" element={<AddSiteOwner />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/new" element={<AddCustomer />} />
              <Route path="customers/:customerId" element={<CustomerDetails />} />
              <Route path="customers/:customerId/edit" element={<AddCustomer />} />
              <Route path="admins" element={<Admins />} />
              <Route path="admins/new" element={<AddAdmin />} />
              <Route path="admins/:adminId" element={<AdminDetails />} />
              <Route path="admins/:adminId/edit" element={<AddAdmin />} />
              <Route path="push-notifications" element={<PushNotifications />} />
              <Route path="push-notifications/new" element={<AddPushNotification />} />
              <Route path="push-notifications/:notificationId" element={<PushNotificationDetails />} />
              <Route path="push-notifications/:notificationId/edit" element={<AddPushNotification />} />
              <Route path="ratings" element={<Ratings />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="transactions" element={guardBillingRoute(<Transactions />)} />
              <Route path="packages" element={guardBillingRoute(<Packages />)} />
              <Route path="packages/fees" element={guardBillingRoute(<EditFees />)} />
              <Route path="packages/new" element={guardBillingRoute(<EditPackage />)} />
              <Route path="packages/:packageId/edit" element={guardBillingRoute(<EditPackage />)} />
              <Route path="pricing" element={guardBillingRoute(<Pricing />)} />
              <Route path="pricing/custom/new" element={guardBillingRoute(<PricingCustomForm />)} />
              <Route path="pricing/custom/:chargerId/edit" element={guardBillingRoute(<PricingCustomForm />)} />
              <Route path="pricing/general" element={guardBillingRoute(<PricingGeneralEdit />)} />
              <Route path="pre-pay" element={guardBillingRoute(<PrePaySetup />)} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/theme" replace />} />
                <Route path="theme" element={<ThemeSettingsPage />} />
                <Route path="countries" element={<CountriesSettingsPage />} />
                <Route path="governorates" element={<GovernoratesSettingsPage />} />
                <Route path="districts" element={<DistrictsSettingsPage />} />
                <Route path="app-version" element={<AppVersionSettingsPage />} />
              </Route>
              <Route path="my-account" element={<MyAccount />} />
            </Route>
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/invite/complete" element={<CustomerInvitationComplete />} />
            <Route path="/" element={<Login onAuthenticated={handleAuthenticated} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
