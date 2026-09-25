import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import PillDropdown from '@/components/ui/molecules/PillDropdown'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const COMMENT_OPTIONS = [
  'Wallet Top-up (Addition)',
  'Admin Adjustment (Addition)',
  'Admin Adjustment (Deduction)',
  'Charging Cost (Deduction)',
  'Refund (Addition)',
  'Gift (Addition)',
  'Loyalty Reward (Addition)',
  'Wallet Transfer In (Addition)',
]

const COMMENT_TYPE_MAP = new Map([
  ['Wallet Top-up (Addition)', 'custom_topup'],
  ['Admin Adjustment (Addition)', 'custom_topup'],
  ['Admin Adjustment (Deduction)', 'admin_deduction'],
  ['Charging Cost (Deduction)', 'admin_deduction'],
  ['Refund (Addition)', 'refund'],
  ['Gift (Addition)', 'gift_bonus'],
  ['Loyalty Reward (Addition)', 'gift_bonus'],
  ['Wallet Transfer In (Addition)', 'custom_topup'],
])

const CUSTOMER_PAGE_SIZE = 100

const fetchCustomersPage = async ({ page = 1, pageSize = CUSTOMER_PAGE_SIZE, email = '', countryCode = '', signal } = {}) => {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  if (email.trim()) {
    params.set('email', email.trim())
  }
  if (countryCode.trim()) {
    params.set('country', countryCode.trim())
  }
  const response = await fetch(`${API_BASE}/customers/?${params.toString()}`, {
    signal,
    credentials: 'include',
    headers: appendAuthHeader(),
  })
  if (!response.ok) {
    throw new Error('Failed to load customers.')
  }
  const data = await response.json()
  const results = Array.isArray(data) ? data : data.results ?? []
  const pagination = Array.isArray(data)
    ? { total_pages: 1 }
    : data.pagination ?? {
        total_pages:
          data.total_pages ??
          (data.total_items && pageSize
            ? Math.max(1, Math.ceil(data.total_items / pageSize))
            : 1),
      }
  return { results, pagination }
}

const createInitialForm = () => ({
  customerId: '',
  amount: '',
  comment: '',
  currency: 'EGP',
})

function PrePaySetup() {
  const { pushError, pushSuccess } = useInlineToast('prepay')
  const [form, setForm] = useState(createInitialForm)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState(null)
  const [currencyMap, setCurrencyMap] = useState({})
  const [countries, setCountries] = useState([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const customerSearchAbortRef = useRef(null)
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || 'EGP'

  const loadCustomers = useCallback(
    async ({ search = '', signal } = {}) => {
      const { results } = await fetchCustomersPage({
        page: 1,
        pageSize: CUSTOMER_PAGE_SIZE,
        email: search,
        countryCode: selectedCountry,
        signal,
      })
      setCustomers(results)
    },
    [selectedCountry]
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadCustomersAndCurrencies = async () => {
      setIsLoadingCustomers(true)
      try {
        const [list, countries] = await Promise.all([
          fetchCustomersPage({
            page: 1,
            pageSize: CUSTOMER_PAGE_SIZE,
            countryCode: selectedCountry,
            signal: controller.signal,
          }).then(
            (payload) => payload.results
          ),
          fetchCountries({ signal: controller.signal }).catch(() => []),
        ])
        if (cancelled) return
        setCustomers(list)
        if (Array.isArray(countries)) {
          setCountries(countries)
          const nextMap = {}
          countries.forEach((country) => {
            const code = country?.code ? String(country.code).toUpperCase() : ''
            const currency = country?.currency_code ? String(country.currency_code).toUpperCase() : ''
            if (code && currency) {
              nextMap[code] = currency
            }
          })
          setCurrencyMap(nextMap)
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          pushError(error?.message || 'Failed to load customers.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCustomers(false)
        }
      }
    }

    loadCustomersAndCurrencies()

    return () => {
      cancelled = true
      if (customerSearchAbortRef.current) {
        customerSearchAbortRef.current.abort()
        customerSearchAbortRef.current = null
      }
      controller.abort()
    }
  }, [pushError, selectedCountry])

  useEffect(() => {
    const searchValue = customerSearch.trim()
    if (customerSearchAbortRef.current) {
      customerSearchAbortRef.current.abort()
      customerSearchAbortRef.current = null
    }
    const debounceId = setTimeout(async () => {
      const controller = new AbortController()
      customerSearchAbortRef.current = controller
      setIsLoadingCustomers(true)
      try {
        await loadCustomers({ search: searchValue, signal: controller.signal })
      } catch (error) {
        if (error?.name !== 'AbortError') {
          pushError(error?.message || 'Failed to load customers.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCustomers(false)
        }
      }
    }, 300)
    return () => {
      clearTimeout(debounceId)
      if (customerSearchAbortRef.current) {
        customerSearchAbortRef.current.abort()
        customerSearchAbortRef.current = null
      }
    }
  }, [customerSearch, loadCustomers, pushError])

  const customerOptions = useMemo(() => {
    const baseOptions = customers
      .filter((customer) => customer?.id)
      .map((customer) => ({
        value: customer.id,
        label: customer.email || customer.user_email || customer.user?.email || 'Customer',
        raw: customer,
      }))
      .filter((option) => option.label)
    const optionMap = new Map(baseOptions.map((option) => [String(option.value), option]))
    if (selectedCustomerSnapshot?.id && !optionMap.has(String(selectedCustomerSnapshot.id))) {
      optionMap.set(String(selectedCustomerSnapshot.id), {
        value: selectedCustomerSnapshot.id,
        label:
          selectedCustomerSnapshot.email ||
          selectedCustomerSnapshot.user_email ||
          selectedCustomerSnapshot.user?.email ||
          'Customer',
        raw: selectedCustomerSnapshot,
      })
    }
    const options = Array.from(optionMap.values()).map((option) => ({
      value: option.value,
      label: option.label,
      raw: option.raw,
    }))
    options.sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))
    return [{ value: '', label: 'Select customer by email' }, ...options]
  }, [customers, selectedCustomerSnapshot])

  const commentOptions = useMemo(
    () => [{ value: '', label: 'Select Comment' }, ...COMMENT_OPTIONS.map((label) => ({ value: label, label }))],
    []
  )

  const resolveCustomerCurrency = (customer) => {
    const preferred = customer?.preferred_currency || customer?.preferredCurrency
    if (preferred) {
      return String(preferred).toUpperCase()
    }
    const countryCode = customer?.country_code || customer?.countryCode
    if (countryCode) {
      const mapped = currencyMap[String(countryCode).toUpperCase()]
      if (mapped) {
        return mapped
      }
    }
    return selectedCountryCurrency
  }

  useEffect(() => {
    if (form.customerId) {
      return
    }
    if (!selectedCountryCurrency || selectedCountryCurrency === form.currency) {
      return
    }
    setForm((prev) => ({ ...prev, currency: selectedCountryCurrency }))
  }, [form.currency, form.customerId, selectedCountryCurrency])

  useEffect(() => {
    if (!form.customerId) {
      return
    }
    const selectedCustomer =
      customers.find((customer) => String(customer.id) === String(form.customerId)) || selectedCustomerSnapshot
    const nextCurrency = resolveCustomerCurrency(selectedCustomer)
    if (nextCurrency && nextCurrency !== form.currency) {
      setForm((prev) => ({ ...prev, currency: nextCurrency }))
    }
  }, [customers, currencyMap, form.currency, form.customerId, selectedCustomerSnapshot, selectedCountryCurrency])

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleCustomerChange = (event) => {
    const nextId = event.target.value
    const selectedCustomer =
      customers.find((customer) => String(customer.id) === String(nextId)) ||
      selectedCustomerSnapshot
    setSelectedCustomerSnapshot(selectedCustomer || null)
    const nextCurrency = resolveCustomerCurrency(selectedCustomer)
    setForm((prev) => ({
      ...prev,
      customerId: nextId,
      currency: nextCurrency || prev.currency,
    }))
  }

  const handleSubmit = async () => {
    if (!form.customerId) {
      pushError('Please select a customer email.')
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      pushError('Please enter a valid amount.')
      return
    }
    if (!form.comment) {
      pushError('Please select a comment.')
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`${API_BASE}/wallet/top-up/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...appendAuthHeader(),
        },
        body: JSON.stringify({
          customer_id: form.customerId,
          amount: Number(form.amount),
          currency: form.currency,
          description: form.comment,
          transaction_type: COMMENT_TYPE_MAP.get(form.comment) || 'custom_topup',
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.detail || 'Failed to create transaction.')
      }
      pushSuccess('Pre-pay offer created.')
      setForm(createInitialForm())
    } catch (error) {
      pushError(error?.message || 'Failed to create transaction.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="pricing-form-page">
      <div className="pricing-form-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Billing' },
                { label: 'Pre-pay customer setup' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/transactions" ariaLabel="Back to transactions" />
              <h1 className="pricing-form-title">Create new pre-pay offer</h1>
            </div>
          </div>
        </div>
        <div className="pricing-form-actions">
          <CountryFilterMenu
            id="prepay-country-filter"
            title="Country"
            value={selectedCountry}
            options={countries}
            align="right"
            className="pricing-header-country"
            onChange={(nextValue) => setSelectedCountry(nextValue)}
          />
          <button
            type="button"
            className="add-charger-next-button prepay-action-button"
            onClick={handleSubmit}
            disabled={isSaving || isLoadingCustomers}
          >
            <span>{isSaving ? 'Saving...' : 'Add pre-pay offer'}</span>
          </button>
        </div>
      </div>

      <InlineToastRegion region="prepay" />

      {isLoadingCustomers ? <p className="data-placeholder">Loading customers...</p> : null}

      <div className="pricing-form-sections">
        <div className="add-charger-section-card">
          <div className="add-charger-input-row">
            <div className="add-charger-input-field pricing-select">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Select Customer Email</span>
              </div>
              <PillDropdown
                id="prepay-driver"
                value={form.customerId}
                onChange={handleCustomerChange}
                options={customerOptions}
                disabled={isLoadingCustomers}
                searchable
                searchPlaceholder="Search customers"
                searchTerm={customerSearch}
                onSearchTermChange={setCustomerSearch}
                isLoading={isLoadingCustomers}
              />
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Amount</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  placeholder="Enter Amount to charge"
                />
                <span className="add-charger-egp-suffix">{form.currency}</span>
              </div>
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field pricing-select">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Select Comment for the Customer</span>
              </div>
              <PillDropdown
                id="prepay-comment"
                value={form.comment}
                onChange={(event) => updateField('comment', event.target.value)}
                options={commentOptions}
              />
            </div>
            <div className="add-charger-input-field" style={{ opacity: 0 }}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Amount</span>
              </div>
              <div className="add-charger-input-field-status">
                <input type="text" value="" readOnly />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrePaySetup
