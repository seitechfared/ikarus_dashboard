import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { useToast } from '@/components/common/ToastProvider'
import PillDropdown from '@/components/ui/molecules/PillDropdown'

const actionRequiresFieldValue = (field, value) => {
  if (!field.required) {
    return true
  }
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function ConnectorRemoteActionsDrawer({ connector, isOpen, onClose, onActionCompleted }) {
  const [context, setContext] = useState(null)
  const [selectedAction, setSelectedAction] = useState('')
  const [fieldValues, setFieldValues] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [isCustomerLoading, setIsCustomerLoading] = useState(false)
  const customerSearchAbortRef = useRef(null)
  const toast = useToast()

  const fetchRemoteActionsContext = useCallback(
    async ({ signal, customerQuery = '', silent = false } = {}) => {
      if (!connector?.id) {
        return
      }
      if (!silent) {
        setIsLoading(true)
      } else {
        setIsCustomerLoading(true)
      }
      try {
        const params = new URLSearchParams({
          customer_limit: '200',
          customer_offset: '0',
        })
        const normalizedCustomerQuery = customerQuery.trim()
        if (normalizedCustomerQuery) {
          params.set('customer_query', normalizedCustomerQuery)
        }
        const response = await fetch(
          `${API_BASE}/connectors/${connector.id}/remote-actions/?${params.toString()}`,
          {
            signal,
            credentials: 'include',
            headers: appendAuthHeader(),
          }
        )
        if (!response.ok) {
          throw new Error('Unable to load remote actions.')
        }
        const data = await response.json()
        if (signal?.aborted) {
          return
        }
        setContext(data)
        setSelectedAction((current) => {
          if (current && Array.isArray(data.actions) && data.actions.some((action) => action.key === current)) {
            return current
          }
          return data.actions?.[0]?.key || ''
        })
      } catch (error) {
        if (signal?.aborted) {
          return
        }
        console.error('Failed to load remote actions', error)
        if (!silent) {
          toast?.pushError?.('Unable to load remote actions.')
        }
      } finally {
        if (signal?.aborted) {
          return
        }
        if (!silent) {
          setIsLoading(false)
        } else {
          setIsCustomerLoading(false)
        }
      }
    },
    [connector?.id, toast]
  )

  useEffect(() => {
    if (!isOpen || !connector) {
      if (customerSearchAbortRef.current) {
        customerSearchAbortRef.current.abort()
        customerSearchAbortRef.current = null
      }
      setContext(null)
      setSelectedAction('')
      setFieldValues({})
      setCustomerSearch('')
      setIsCustomerLoading(false)
      return
    }
    const controller = new AbortController()
    fetchRemoteActionsContext({ signal: controller.signal, customerQuery: '' })
    return () => controller.abort()
  }, [connector, fetchRemoteActionsContext, isOpen])

  useEffect(() => {
    if (!isOpen || !context) {
      return
    }
    const currentQuery = String(context?.customer_options?.query || '').trim()
    const nextQuery = String(customerSearch || '').trim()
    if (nextQuery === currentQuery) {
      return
    }
    if (customerSearchAbortRef.current) {
      customerSearchAbortRef.current.abort()
      customerSearchAbortRef.current = null
    }
    const debounceId = setTimeout(() => {
      const controller = new AbortController()
      customerSearchAbortRef.current = controller
      fetchRemoteActionsContext({
        signal: controller.signal,
        customerQuery: nextQuery,
        silent: true,
      })
    }, 300)
    return () => {
      clearTimeout(debounceId)
      if (customerSearchAbortRef.current) {
        customerSearchAbortRef.current.abort()
        customerSearchAbortRef.current = null
      }
    }
  }, [context, customerSearch, fetchRemoteActionsContext, isOpen])

  const actions = context?.actions || []
  const connectorContext = context?.connector || connector
  const ctaLabel = context?.cta_label || 'Submit'
  const refreshNotes = context?.refresh_notes
  const customerOptionsMeta = context?.customer_options || {}

  const selectedDefinition = useMemo(
    () => actions.find((action) => action.key === selectedAction),
    [actions, selectedAction]
  )

  useEffect(() => {
    if (!selectedDefinition) {
      setFieldValues({})
      return
    }
    setFieldValues((previous) => {
      const next = {}
      selectedDefinition.fields.forEach((field) => {
        if (previous[field.name] !== undefined) {
          next[field.name] = previous[field.name]
        } else if (field.name === 'connector_id' && connector?.id) {
          next[field.name] = connector.id
        } else if (Array.isArray(field.options) && field.options.length > 0) {
          if (field.searchable) {
            next[field.name] = ''
          } else {
          next[field.name] = field.options[0].value ?? ''
          }
        } else {
          next[field.name] = ''
        }
      })
      return next
    })
  }, [selectedDefinition, connector])

  const isReady = useMemo(() => {
    if (!selectedDefinition) {
      return false
    }
    return selectedDefinition.fields.every((field) =>
      actionRequiresFieldValue(field, fieldValues[field.name])
    )
  }, [selectedDefinition, fieldValues])

  const handleActionChange = (event) => {
    setSelectedAction(event.target.value || '')
  }

  const handleFieldChange = (name, value) => {
    setFieldValues((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!connector || !selectedAction || !isReady) {
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/connectors/${connector.id}/remote-actions/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          action: selectedAction,
          ...fieldValues,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const detail = data?.detail || 'Unable to queue remote action.'
        throw new Error(detail)
      }
      const data = await response.json().catch(() => ({}))
      toast?.pushSuccess?.(data?.message || 'Remote action queued.')
      onActionCompleted?.(data)
      onClose?.()
    } catch (error) {
      console.error('Failed to submit remote action', error)
      toast?.pushError?.(error.message || 'Unable to queue remote action.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="remote-actions-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="remote-actions-modal" onClick={(event) => event.stopPropagation()}>
        <header className="remote-actions-header">
          <div className="remote-actions-heading">
            <p className="remote-actions-title">Remote Actions</p>
            <p className="remote-actions-subtitle">
              Connector {connectorContext?.connector_name || connectorContext?.label || connectorContext?.identifier || '-'}
            </p>
            {connectorContext?.charger?.name ? (
              <p className="remote-actions-subtitle">Charger {connectorContext.charger.name}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="remote-actions-close"
            onClick={onClose}
            aria-label="Close remote actions"
          >
            &times;
          </button>
        </header>
        <div className="remote-actions-body">
          {isLoading ? (
            <p className="remote-actions-loading">Loading remote actions...</p>
          ) : actions.length === 0 ? (
            <p className="remote-actions-loading">No remote actions available.</p>
          ) : (
            <>
              <div className="remote-actions-field">
                <label htmlFor="remote-action-select" className="remote-actions-label">
                  Action
                </label>
                <div className="remote-actions-control">
                  <select
                    id="remote-action-select"
                    value={selectedAction}
                    onChange={handleActionChange}
                  >
                    {actions.map((action) => (
                      <option key={action.key} value={action.key}>
                        {action.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedDefinition?.fields
                ?.filter((field) => field.name !== 'connector_id')
                .map((field) => {
                  const value = fieldValues[field.name] ?? ''
                  const options = Array.isArray(field.options) ? field.options : []
                  const isCustomerSource = field.source === 'customers'
                  const isSearchable = Boolean(field.searchable) && options.length > 0
                if (field.type === 'select') {
                  const placeholder = {
                    value: '',
                    label: `Select ${field.label || 'option'}`,
                  }
                  const dropdownOptions =
                    options.length && (options[0]?.value === '' || options[0]?.value === null)
                      ? options
                      : [placeholder, ...options]
                  return (
                    <div className="remote-actions-field" key={field.name}>
                      <label className="remote-actions-label" htmlFor={`field-${field.name}`}>
                        {field.label}
                      </label>
                      <div className="remote-actions-control">
                        {isSearchable ? (
                          <PillDropdown
                            id={`field-${field.name}`}
                            value={value}
                            onChange={(event) => handleFieldChange(field.name, event.target.value)}
                            options={dropdownOptions}
                            searchable
                            searchPlaceholder={field.search_placeholder || `Search ${field.label || 'options'}`}
                            searchTerm={isCustomerSource ? customerSearch : undefined}
                            onSearchTermChange={isCustomerSource ? setCustomerSearch : undefined}
                            isLoading={isCustomerSource && isCustomerLoading}
                          />
                        ) : (
                          <select
                            id={`field-${field.name}`}
                            value={value}
                            onChange={(event) => handleFieldChange(field.name, event.target.value)}
                            required={field.required}
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                }

                const inputType = field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
                const datalistId =
                  field.suggestions && field.suggestions.length
                    ? `suggestions-${field.name}`
                    : undefined
                return (
                  <div className="remote-actions-field" key={field.name}>
                    <label className="remote-actions-label" htmlFor={`field-${field.name}`}>
                      {field.label}
                    </label>
                    <div className="remote-actions-control">
                      <input
                        id={`field-${field.name}`}
                        type={inputType}
                        value={value}
                        onChange={(event) => handleFieldChange(field.name, event.target.value)}
                        required={field.required}
                        list={datalistId}
                      />
                      {datalistId ? (
                        <datalist id={datalistId}>
                          {field.suggestions.map((suggestion) => (
                            <option key={suggestion.value || suggestion.email} value={suggestion.value || suggestion.email}>
                              {suggestion.label || suggestion.email}
                            </option>
                          ))}
                        </datalist>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {Boolean(customerOptionsMeta?.has_more) ? (
                <p className="remote-actions-notes">Keep typing to narrow down customer results.</p>
              ) : null}
              {refreshNotes ? <p className="remote-actions-notes">{refreshNotes}</p> : null}
            </>
          )}
        </div>
        <footer className="remote-actions-footer">
          <button
            type="button"
            className="remote-actions-submit"
            disabled={!isReady || isSubmitting || isLoading}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Submitting...' : ctaLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ConnectorRemoteActionsDrawer

