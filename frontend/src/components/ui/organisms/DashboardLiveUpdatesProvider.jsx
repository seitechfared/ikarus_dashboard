import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSessionToken } from '@/utils/session'
import { API_BASE } from '@/constants'

export const DashboardLiveUpdatesContext = createContext(null)

const RECONNECT_DELAY_MS = 5000

const resolveDashboardSocketUrl = (token) => {
  if (!token || typeof window === 'undefined') {
    return null
  }

  const apiBase = API_BASE || ''
  try {
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const url = new URL(apiBase)
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${url.host}/ws/dashboard/?token=${encodeURIComponent(token)}`
    }
  } catch (error) {
    return null
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/dashboard/?token=${encodeURIComponent(token)}`
}

export default function DashboardLiveUpdatesProvider({ children }) {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const subscribersRef = useRef(new Map())
  const reconnectCallbacksRef = useRef(new Map())
  const shouldReconnectRef = useRef(true)
  const hasConnectedRef = useRef(false)
  const refetchOnReconnectRef = useRef(false)
  const [connectionState, setConnectionState] = useState('idle')

  const dispatchMessage = useCallback((message) => {
    const eventType = message?.type
    if (!eventType) {
      return
    }

    const handlers = subscribersRef.current.get(eventType)
    if (!handlers || !handlers.size) {
      return
    }

    Array.from(handlers).forEach((handler) => {
      try {
        handler(message)
      } catch (error) {
        console.error(`Dashboard live update handler failed for ${eventType}`, error)
      }
    })
  }, [])

  const subscribe = useCallback((eventType, handler) => {
    if (!eventType || typeof handler !== 'function') {
      return () => {}
    }

    let handlers = subscribersRef.current.get(eventType)
    if (!handlers) {
      handlers = new Set()
      subscribersRef.current.set(eventType, handlers)
    }
    handlers.add(handler)

    return () => {
      const currentHandlers = subscribersRef.current.get(eventType)
      if (!currentHandlers) {
        return
      }
      currentHandlers.delete(handler)
      if (!currentHandlers.size) {
        subscribersRef.current.delete(eventType)
      }
    }
  }, [])

  const subscribeMany = useCallback(
    (handlersByEvent = {}) => {
      const cleanups = Object.entries(handlersByEvent).map(([eventType, handler]) =>
        subscribe(eventType, handler)
      )
      return () => {
        cleanups.forEach((cleanup) => cleanup())
      }
    },
    [subscribe]
  )

  const registerReconnectRefetch = useCallback((key, callback) => {
    if (!key || typeof callback !== 'function') {
      return () => {}
    }

    reconnectCallbacksRef.current.set(key, callback)
    return () => {
      reconnectCallbacksRef.current.delete(key)
    }
  }, [])

  useEffect(() => {
    shouldReconnectRef.current = true

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const notifyReconnectCallbacks = () => {
      Array.from(reconnectCallbacksRef.current.values()).forEach((callback) => {
        try {
          callback()
        } catch (error) {
          console.error('Dashboard reconnect refetch callback failed', error)
        }
      })
    }

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current || reconnectTimerRef.current) {
        return
      }
      setConnectionState('reconnecting')
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, RECONNECT_DELAY_MS)
    }

    const connect = () => {
      clearReconnectTimer()

      const token = getSessionToken()
      if (!token) {
        setConnectionState('idle')
        return
      }

      const socketUrl = resolveDashboardSocketUrl(token)
      if (!socketUrl) {
        setConnectionState('disconnected')
        return
      }

      if (socketRef.current) {
        socketRef.current.close()
      }

      setConnectionState(hasConnectedRef.current ? 'reconnecting' : 'connecting')
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          socket.close()
          return
        }

        const shouldNotifyReconnect = hasConnectedRef.current && refetchOnReconnectRef.current
        hasConnectedRef.current = true
        setConnectionState('connected')

        if (shouldNotifyReconnect) {
          refetchOnReconnectRef.current = false
          notifyReconnectCallbacks()
        }
      }

      socket.onmessage = (event) => {
        let message
        try {
          message = JSON.parse(event.data)
        } catch (error) {
          return
        }

        if (!message || typeof message !== 'object') {
          return
        }

        dispatchMessage(message)
      }

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null
        }

        if (!shouldReconnectRef.current) {
          return
        }

        if (hasConnectedRef.current) {
          refetchOnReconnectRef.current = true
        }
        scheduleReconnect()
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      shouldReconnectRef.current = false
      clearReconnectTimer()
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      setConnectionState('idle')
    }
  }, [dispatchMessage])

  const value = useMemo(
    () => ({
      subscribe,
      subscribeMany,
      registerReconnectRefetch,
      connectionState,
    }),
    [connectionState, registerReconnectRefetch, subscribe, subscribeMany]
  )

  return (
    <DashboardLiveUpdatesContext.Provider value={value}>
      {children}
    </DashboardLiveUpdatesContext.Provider>
  )
}

// TODO: Dashboard WebSocket currently validates token but does not enforce
// admin/dashboard role. Before adding sensitive dashboard events such as
// sessions, payments, users, or billing, harden /ws/dashboard/ or move to
// /ws/admin/dashboard/.
