import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { buildMediaUrl } from '@/utils/media'
import { DASHBOARD_LOGO_URL } from '@/constants'
import { ChevronDown } from '@/components/ui/atoms/ChevronDown'
import { ChevronUp } from '@/components/ui/atoms/ChevronUp'
import { IconBigDot } from '@/components/ui/atoms/IconBigDot'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import { applyTheme, defaultTheme, normalizeTheme } from '@/utils/theme'
import { fetchThemeSettings } from '@/services/themeSettingsApi'
import useAlertToasts from '@/hooks/useAlertToasts'
import {
  OverviewIcon,
  StationsIcon,
  ChargersIcon,
  ConnectorsIcon,
  UsersIcon,
  BillingIcon,
  TransactionsIcon,
  SessionsIcon,
  SettingsIcon,
  PushNotificationsIcon,
} from '@/components/ui/atoms/icons/MenuIcons'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_TITLE = 'Ikarus Electric'
const PAGE_TITLE_RULES = [
  { pattern: /^\/stations\/new(?:\/|$)/i, title: 'Add Station' },
  { pattern: /^\/stations\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Station' },
  { pattern: /^\/stations\/[^/]+(?:\/|$)/i, title: 'Station Details' },
  { pattern: /^\/stations(?:\/|$)/i, title: 'Stations' },
  { pattern: /^\/chargers\/new(?:\/|$)/i, title: 'Add Charger' },
  { pattern: /^\/chargers\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Charger' },
  { pattern: /^\/chargers\/[^/]+(?:\/|$)/i, title: 'Charger Details' },
  { pattern: /^\/chargers(?:\/|$)/i, title: 'Chargers' },
  { pattern: /^\/connectors\/new(?:\/|$)/i, title: 'Add Connector' },
  { pattern: /^\/connectors\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Connector' },
  { pattern: /^\/connectors\/[^/]+(?:\/|$)/i, title: 'Connector Details' },
  { pattern: /^\/connectors(?:\/|$)/i, title: 'Connectors' },
  { pattern: /^\/partners\/new(?:\/|$)/i, title: 'Add Partner' },
  { pattern: /^\/partners\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Partner' },
  { pattern: /^\/partners\/[^/]+(?:\/|$)/i, title: 'Partner Details' },
  { pattern: /^\/partners(?:\/|$)/i, title: 'Partners' },
  { pattern: /^\/site-owners\/new(?:\/|$)/i, title: 'Add Site Owner' },
  { pattern: /^\/site-owners\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Site Owner' },
  { pattern: /^\/site-owners\/[^/]+(?:\/|$)/i, title: 'Site Owner Details' },
  { pattern: /^\/site-owners(?:\/|$)/i, title: 'Site Owners' },
  { pattern: /^\/customers\/new(?:\/|$)/i, title: 'Add Customer' },
  { pattern: /^\/customers\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Customer' },
  { pattern: /^\/customers\/[^/]+(?:\/|$)/i, title: 'Customer Details' },
  { pattern: /^\/customers(?:\/|$)/i, title: 'Customers' },
  { pattern: /^\/admins\/new(?:\/|$)/i, title: 'Add Admin' },
  { pattern: /^\/admins\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Admin' },
  { pattern: /^\/admins\/[^/]+(?:\/|$)/i, title: 'Admin Details' },
  { pattern: /^\/admins(?:\/|$)/i, title: 'Admins' },
  { pattern: /^\/ratings(?:\/|$)/i, title: 'Rating & Feedback' },
  { pattern: /^\/my-account(?:\/|$)/i, title: 'My Account' },
  { pattern: /^\/packages\/fees(?:\/|$)/i, title: 'Edit Fees' },
  { pattern: /^\/packages\/new(?:\/|$)/i, title: 'Add Package' },
  { pattern: /^\/packages\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Package' },
  { pattern: /^\/packages(?:\/|$)/i, title: 'Packages Manager' },
  { pattern: /^\/pricing\/custom\/new(?:\/|$)/i, title: 'Add Custom Pricing' },
  { pattern: /^\/pricing\/custom\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Custom Pricing' },
  { pattern: /^\/pricing\/general(?:\/|$)/i, title: 'Edit Pricing' },
  { pattern: /^\/pricing(?:\/|$)/i, title: 'Pricing' },
  { pattern: /^\/pre-pay(?:\/|$)/i, title: 'Pre-pay customer setup' },
  { pattern: /^\/settings\/theme(?:\/|$)/i, title: 'Theme Settings' },
  { pattern: /^\/settings\/countries(?:\/|$)/i, title: 'Countries Settings' },
  { pattern: /^\/settings\/governorates(?:\/|$)/i, title: 'Governorates Settings' },
  { pattern: /^\/settings\/districts(?:\/|$)/i, title: 'Districts Settings' },
  { pattern: /^\/settings\/app-version(?:\/|$)/i, title: 'App Version Settings' },
  { pattern: /^\/settings(?:\/|$)/i, title: 'Settings' },
  { pattern: /^\/push-notifications\/new(?:\/|$)/i, title: 'Push New Notifications' },
  { pattern: /^\/push-notifications\/[^/]+\/edit(?:\/|$)?/i, title: 'Edit Push Notification' },
  { pattern: /^\/push-notifications\/[^/]+(?:\/|$)/i, title: 'Push Notification Details' },
  { pattern: /^\/push-notifications(?:\/|$)/i, title: 'Push Notifications' },
  { pattern: /^\/sessions(?:\/|$)/i, title: 'Sessions' },
  { pattern: /^\/transactions(?:\/|$)/i, title: 'Transactions' },
  { pattern: /^\/overview(?:\/|$)/i, title: 'Overview' },
  { pattern: /^\/$/i, title: 'Overview' },
]

const derivePageTitle = (pathname) => {
  if (!pathname) return DEFAULT_PAGE_TITLE
  for (const rule of PAGE_TITLE_RULES) {
    if (rule.pattern.test(pathname)) {
      return rule.title
    }
  }
  const normalized = pathname.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return 'Overview'
  }
  const [firstSegment] = normalized.split('/')
  if (!firstSegment) {
    return DEFAULT_PAGE_TITLE
  }
  return firstSegment
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const NAV_ITEMS = [
  { label: 'Overview', icon: 'overview', path: '/overview' },
  { label: 'Stations', icon: 'stations', path: '/stations' },
  { label: 'Chargers', icon: 'chargers', path: '/chargers' },
  { label: 'Connectors', icon: 'connectors', path: '/connectors' },
  {
    label: 'User management',
    icon: 'users',
    path: null,
    subItems: [
      { label: 'Partners', path: '/partners' },
      { label: 'Site Owners', path: '/site-owners' },
      { label: 'Customers', path: '/customers' },
      { label: 'Admins', path: '/admins' },
      { label: 'Rating & Feedback', path: '/ratings' },
    ],
  },
  {
    label: 'Billing',
    icon: 'billing',
    path: null,
    subItems: [
      { label: 'Packages Manager', path: '/packages' },
      { label: 'Pre-pay customer setup', path: '/pre-pay' },
      { label: 'Pricing', path: '/pricing' },
    ],
  },
  { label: 'Transactions', icon: 'transactions', path: '/transactions' },
  { label: 'Sessions', icon: 'sessions', path: '/sessions' },
  { label: 'Push Notifications', icon: 'push-notifications', path: '/push-notifications' },
  {
    label: 'Settings',
    icon: 'settings',
    path: null,
    subItems: [
      { label: 'Theme', path: '/settings/theme' },
      { label: 'Countries', path: '/settings/countries' },
      { label: 'Governorates', path: '/settings/governorates' },
      { label: 'Districts', path: '/settings/districts' },
      { label: 'App Version', path: '/settings/app-version' },
    ],
  },
]

const resolveUserName = (email) => {
  if (!email) return 'User'
  const localPart = email.split('@')[0]
  if (!localPart) return 'User'
  return localPart.replace(/^\w/, (char) => char.toUpperCase())
}

function DashboardLayout({ user, onLogout, onSessionUserUpdate = () => {} }) {
  const location = useLocation()
  const [expandedMenus, setExpandedMenus] = useState({})
  const [themeSettings, setThemeSettings] = useState(defaultTheme)
  const [themePreview, setThemePreview] = useState(null)
  useAlertToasts({ enabled: Boolean(user?.id) })

  const userEmail = user?.email ?? 'user@example.com'
  const userName =
    [user?.firstName, user?.lastName].filter((token) => token && token.trim()).join(' ').trim() ||
    resolveUserName(user?.email) ||
    'User'
  const userAvatar = user?.profile_image ? buildMediaUrl(user.profile_image) : 'https://i.pravatar.cc/80?img=12'

  const toggleMenu = (label) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  const isMyAccountActive =
    location.pathname === '/my-account' || location.pathname.startsWith('/my-account/')

  const renderIcon = (iconName, isActive) => {
    switch (iconName) {
      case 'overview':
        return <OverviewIcon isActive={isActive} />
      case 'stations':
        return <StationsIcon isActive={isActive} />
      case 'chargers':
        return <ChargersIcon isActive={isActive} />
      case 'connectors':
        return <ConnectorsIcon isActive={isActive} />
      case 'users':
        return <UsersIcon isActive={isActive} />
      case 'billing':
        return <BillingIcon isActive={isActive} />
      case 'transactions':
        return <TransactionsIcon isActive={isActive} />
      case 'sessions':
        return <SessionsIcon isActive={isActive} />
      case 'push-notifications':
        return <PushNotificationsIcon isActive={isActive} />
      case 'settings':
        return <SettingsIcon isActive={isActive} />
      default:
        return null
    }
  }

  const renderSubItemIcon = (subItemLabel, subItemIcon, isSubItemActive) => {
    if (subItemIcon === 'transactions') {
      return <TransactionsIcon isActive={isSubItemActive} />
    }
    if (subItemIcon === 'sessions') {
      return <SessionsIcon isActive={isSubItemActive} />
    }
    return <IconBigDot />
  }

  const capabilities = useMemo(() => deriveRoleCapabilities(user?.role), [user?.role])

  const navItems = useMemo(() => {
    let items = NAV_ITEMS
    if (capabilities.isSiteOwner) {
      items = NAV_ITEMS.reduce((acc, item) => {
        if (['Stations', 'Chargers'].includes(item.label)) {
          acc.push(item)
          return acc
        }
        if (item.label === 'User management' && Array.isArray(item.subItems)) {
          const allowedSubItems = item.subItems.filter(
            (subItem) => subItem.label === 'Rating & Feedback'
          )
          if (allowedSubItems.length) {
            acc.push({ ...item, subItems: allowedSubItems })
          }
        }
        return acc
      }, [])
    }
    if (!capabilities.canAccessBilling) {
      items = items.filter((item) => item.label !== 'Billing' && item.label !== 'Transactions')
    }
    return items
  }, [capabilities])

  useEffect(() => {
    const nextTitle = derivePageTitle(location.pathname)
    if (nextTitle && typeof document !== 'undefined') {
      document.title = nextTitle
    }
    
    // Auto-expand menu if a submenu item is active
    NAV_ITEMS.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        const hasActiveSubItem = item.subItems.some(
          (subItem) =>
            subItem.path &&
            (location.pathname === subItem.path ||
              location.pathname.startsWith(`${subItem.path}/`))
        )
        if (hasActiveSubItem) {
          setExpandedMenus((prev) => ({
            ...prev,
            [item.label]: true,
          }))
        }
      }
    })
  }, [location.pathname])

  useEffect(() => {
    let isMounted = true

    const loadTheme = async () => {
      if (!user?.id) {
        setThemeSettings(defaultTheme)
        setThemePreview(null)
        return
      }
      try {
        const data = await fetchThemeSettings()
        if (isMounted) {
          setThemeSettings(normalizeTheme(data))
        }
      } catch (error) {
        console.warn('Unable to load theme settings', error)
        if (isMounted) {
          setThemeSettings(defaultTheme)
        }
      }
    }

    loadTheme()

    return () => {
      isMounted = false
    }
  }, [user?.id])

  const effectiveTheme = useMemo(
    () => normalizeTheme(themePreview || themeSettings || defaultTheme),
    [themePreview, themeSettings]
  )

  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  const updateThemePreview = useCallback(
    (draft) => {
      const base = themeSettings || defaultTheme
      setThemePreview(normalizeTheme({ ...base, ...draft }, base))
    },
    [themeSettings]
  )

  const clearThemePreview = useCallback(() => {
    setThemePreview(null)
  }, [])

  const commitThemeSettings = useCallback((nextTheme) => {
    setThemeSettings(normalizeTheme(nextTheme))
    setThemePreview(null)
  }, [])

  const sidebarLogo = effectiveTheme.logo ? buildMediaUrl(effectiveTheme.logo) : DASHBOARD_LOGO_URL

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-content-wrapper">
          {/* Logo at top */}
          <div className="sidebar-brand">
            <img src={sidebarLogo} alt="Ikarus Electric" />
          </div>

          {/* Navigation items */}
          <div className="sidebar-section">
            <nav className="sidebar-nav" aria-label="Primary">
              {navItems.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0
                const isSubItemActive = hasSubItems
                  ? item.subItems.some(
                      (subItem) =>
                        subItem.path &&
                        (location.pathname === subItem.path ||
                          location.pathname.startsWith(`${subItem.path}/`))
                    )
                  : false
                const isActive =
                  (item.path &&
                    (location.pathname === item.path ||
                      location.pathname.startsWith(`${item.path}/`))) ||
                  isSubItemActive
                const isDisabled = !item.path && !hasSubItems
                const isExpanded = expandedMenus[item.label] || false

                return (
                  <div key={item.label} className="nav-item-wrapper">
                    {hasSubItems || isDisabled ? (
                      <button
                        type="button"
                        className={`nav-item ${isActive ? 'active' : ''} ${
                          isDisabled ? 'nav-item-disabled' : ''
                        } ${hasSubItems ? 'nav-item-with-submenu' : ''}`.trim()}
                        onClick={() => {
                          if (hasSubItems) {
                            toggleMenu(item.label)
                          }
                        }}
                        disabled={isDisabled && !hasSubItems}
                        aria-current={isActive ? 'page' : undefined}
                        aria-expanded={hasSubItems ? isExpanded : undefined}
                      >
                        {item.icon ? (
                          <span className="nav-item-icon" aria-hidden="true">
                            {renderIcon(item.icon, isActive)}
                          </span>
                        ) : null}
                        <span className="nav-item-label">{item.label}</span>
                        {hasSubItems ? (
                          <span className="nav-item-chevron" aria-hidden="true">
                            {isExpanded ? <ChevronUp isActive={isActive} /> : <ChevronDown />}
                          </span>
                        ) : null}
                        {isDisabled && !hasSubItems ? (
                          <span className="nav-item-pill">Soon</span>
                        ) : null}
                      </button>
                    ) : (
                      <NavLink
                        to={item.path}
                        className={`nav-item ${isActive ? 'active' : ''}`.trim()}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {item.icon ? (
                          <span className="nav-item-icon" aria-hidden="true">
                            {renderIcon(item.icon, isActive)}
                          </span>
                        ) : null}
                        <span className="nav-item-label">{item.label}</span>
                      </NavLink>
                    )}
                    {hasSubItems && isExpanded && (
                      <ul className="nav-submenu">
                        {item.subItems.map((subItem) => {
                          const isSubItemActive =
                            subItem.path &&
                            (location.pathname === subItem.path ||
                              location.pathname.startsWith(`${subItem.path}/`))
                          const hasIcon = subItem.icon === 'transactions' || subItem.icon === 'sessions'
                          return (
                            <li key={subItem.label}>
                              {subItem.path ? (
                                <NavLink
                                  to={subItem.path}
                                  className={`nav-submenu-item ${isSubItemActive ? 'active' : ''} ${!hasIcon ? 'has-big-dot' : ''}`.trim()}
                                  aria-current={isSubItemActive ? 'page' : undefined}
                                >
                                  <span className="nav-submenu-bullet">
                                    {renderSubItemIcon(subItem.label, subItem.icon, isSubItemActive)}
                                  </span>
                                  <span className="nav-submenu-label">{subItem.label}</span>
                                </NavLink>
                              ) : (
                                <button
                                  type="button"
                                  className={`nav-submenu-item ${!hasIcon ? 'has-big-dot' : ''}`.trim()}
                                  disabled
                                >
                                  <span className="nav-submenu-bullet">
                                    {renderSubItemIcon(subItem.label, subItem.icon, isSubItemActive)}
                                  </span>
                                  <span className="nav-submenu-label">{subItem.label}</span>
                                  <span className="nav-item-pill">Soon</span>
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>

          {/* User profile at bottom */}
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <NavLink
                to="/my-account"
                className={`sidebar-user-button ${isMyAccountActive ? 'active' : ''}`.trim()}
                aria-current={isMyAccountActive ? 'page' : undefined}
              >
                <div className="user-info">
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="user-avatar"
                  />
                  <div className="user-details">
                    <p className="user-name">{userName}</p>
                    <p className="user-email">{userEmail}</p>
                  </div>
                </div>
              </NavLink>
            </div>
            <button type="button" className="logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <Outlet
          context={{
            user,
            onLogout,
            capabilities,
            updateSessionUser: onSessionUserUpdate,
            themeSettings,
            updateThemePreview,
            clearThemePreview,
            commitThemeSettings,
          }}
        />
      </main>
    </div>
  )
}

export default DashboardLayout
