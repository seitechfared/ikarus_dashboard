import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext({
  showToast: () => {},
  dismiss: () => {},
  pushSuccess: () => {},
  pushError: () => {},
  pushWarning: () => {},
  pushInfo: () => {},
  toasts: [],
})

const generateId = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`

const ToastSuccessIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="16" fill="#C6F0D8" />
    <path
      d="M14.4 20 10.8 16.4 9.4 17.8 14.4 22.8 23 14.2 21.6 12.8 14.4 20Z"
      fill="#2EA561"
    />
  </svg>
)

const ToastErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <mask id="toast-error-mask-24" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
      <rect width="24" height="24" fill="#D9D9D9" />
    </mask>
    <g mask="url(#toast-error-mask-24)">
      <path
        d="m8.4 17 3.6-3.6 3.6 3.6 1.4-1.4L13.4 12l3.6-3.6L15.6 7 12 10.6 8.4 7 7 8.4l3.6 3.6L7 15.6 8.4 17Zm3.6 5c-1.383 0-2.683-.263-3.9-.788-1.216-.525-2.275-1.237-3.175-2.137-.9-.9-1.612-1.958-2.137-3.175C2.263 14.683 2 13.383 2 12c0-1.383.263-2.683.788-3.9C3.313 6.883 4.025 5.825 4.925 4.925 5.825 4.025 6.883 3.312 8.1 2.787 9.317 2.262 10.617 2 12 2c1.383 0 2.683.262 3.9.787 1.216.525 2.275 1.238 3.175 2.138.9.9 1.612 1.958 2.137 3.175.525 1.217.788 2.517.788 3.9 0 1.383-.263 2.683-.788 3.9-.525 1.216-1.237 2.275-2.137 3.175-.9.9-1.959 1.612-3.175 2.137-1.217.525-2.517.788-3.9.788Z"
        fill="#F04248"
      />
    </g>
  </svg>
)

const ToastWarningIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="16" fill="#FFF1D6" />
    <path
      d="M16 11.5v9M16 22.5h.01"
      stroke="#C8740B"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ToastInfoIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="16" fill="#E1EDFF" />
    <path
      d="M16 13v9M15.99 10h.02"
      stroke="#1D4E89"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4l8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

const TOAST_VARIANT_META = {
  success: { defaultTitle: 'Success', Icon: ToastSuccessIcon },
  error: { defaultTitle: 'Action needed', Icon: ToastErrorIcon },
  warning: { defaultTitle: 'Heads up', Icon: ToastWarningIcon },
  info: { defaultTitle: 'Notice', Icon: ToastInfoIcon },
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastViewport({ toasts = [], dismiss, layout = 'overlay', className, region }) {
  if (!toasts.length) {
    return null
  }
  const viewportClassName = [
    'toast-viewport',
    layout === 'inline' ? 'toast-viewport--inline' : 'toast-viewport--overlay',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={viewportClassName} data-region={region} aria-live="assertive" aria-atomic="true">
      {toasts.map((toast) => {
        const meta = TOAST_VARIANT_META[toast.variant] || TOAST_VARIANT_META.info
        const Icon = meta.Icon
        return (
          <div key={toast.id} className={`toast ${toast.variant}`}>
            <span className="toast-icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="toast-body">
              {toast.title ? <strong>{toast.title}</strong> : null}
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <CloseIcon />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    ({
      message,
      title,
      variant = 'error',
      duration = 5000,
      placement = 'overlay',
      region,
    }) => {
      if (!message) return
      const normalizedVariant = TOAST_VARIANT_META[variant] ? variant : 'info'
      const meta = TOAST_VARIANT_META[normalizedVariant]
      const id = generateId()
      const resolvedPlacement = placement === 'inline' ? 'inline' : 'overlay'
      const resolvedRegion =
        resolvedPlacement === 'inline' ? region || 'inline-default' : 'overlay-global'
      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          title: title ?? meta.defaultTitle,
          variant: normalizedVariant,
          placement: resolvedPlacement,
          region: resolvedRegion,
        },
      ])
      const timer = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, timer)
    },
    [dismiss]
  )

  const contextValue = useMemo(() => {
    const pushWithVariant = (variant) => (message, options = {}) =>
      showToast({ message, variant, ...options })
    return {
      showToast,
      toasts,
      dismiss,
      pushSuccess: pushWithVariant('success'),
      pushError: pushWithVariant('error'),
      pushWarning: pushWithVariant('warning'),
      pushInfo: pushWithVariant('info'),
    }
  }, [dismiss, showToast, toasts])

  const overlayToasts = toasts.filter((toast) => toast.placement !== 'inline')

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {overlayToasts.length ? (
        <ToastViewport toasts={overlayToasts} dismiss={dismiss} layout="overlay" region="overlay" />
      ) : null}
    </ToastContext.Provider>
  )
}

export function InlineToastRegion({ region = 'inline-default', className }) {
  const { toasts, dismiss } = useContext(ToastContext)
  const inlineToasts = toasts.filter((toast) => {
    if (toast.placement !== 'inline') {
      return false
    }
    if (!region) {
      return true
    }
    return toast.region === region
  })
  if (!inlineToasts.length) {
    return null
  }
  return (
    <ToastViewport
      toasts={inlineToasts}
      dismiss={dismiss}
      layout="inline"
      className={className}
      region={region}
    />
  )
}
