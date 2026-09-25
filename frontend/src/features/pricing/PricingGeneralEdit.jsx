import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchGeneralPricing, updateGeneralPricing } from './pricingApi'
import { buildPricingPayload, normalizePricingPayload } from './pricingHelpers'
import { validateNonNegativeNumber, validateNumber } from '@/utils/validation'
import { fetchCountries } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const createInitialForm = () => ({
  pricing: {
    dc: '',
    ac: '',
  },
  idleFees: {
    idleAfter: '',
    fees: '',
    forEach: '',
    dcIdleAfter: '',
    dcFees: '',
    dcForEach: '',
    acIdleAfter: '',
    acFees: '',
    acForEach: '',
  },
  balanceRules: {
    minStart: '',
    lowBalance: '',
    stopBalance: '',
  },
  currency: '',
})

const parseMinutesValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const match = String(value).match(/-?\d+/)
  if (!match) return null
  const minutes = Number(match[0])
  return Number.isFinite(minutes) ? minutes : null
}

function PricingGeneralEdit() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pushError, pushSuccess } = useInlineToast('pricing')
  const [form, setForm] = useState(createInitialForm)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [countries, setCountries] = useState([])
  const selectedCountry = searchParams.get('country') || 'EG'
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || 'EGP'
  const displayCurrency = selectedCountryCurrency || form.currency || 'EGP'

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((items) => {
        if (!isActive || !Array.isArray(items)) {
          return
        }
        setCountries(items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      })
      .catch((error) => {
        if (!isActive || error?.name === 'AbortError') {
          return
        }
        console.error(error)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadGeneralPricing = async () => {
      setIsLoading(true)
      try {
        const pricingData = await fetchGeneralPricing({ countryCode: selectedCountry, signal: controller.signal })
        if (cancelled) return
        const normalizedPricing = normalizePricingPayload(pricingData?.pricing)
        setForm({
          pricing: {
            dc: normalizedPricing?.dc ?? '',
            ac: normalizedPricing?.ac ?? '',
          },
          idleFees: {
            idleAfter: normalizedPricing?.idleAfter ?? '',
            fees: normalizedPricing?.idleFees ?? '',
            forEach: normalizedPricing?.idleForEach ?? '',
            dcIdleAfter: normalizedPricing?.dcIdleAfter ?? '',
            dcFees: normalizedPricing?.dcIdleFees ?? '',
            dcForEach: normalizedPricing?.dcIdleForEach ?? '',
            acIdleAfter: normalizedPricing?.acIdleAfter ?? '',
            acFees: normalizedPricing?.acIdleFees ?? '',
            acForEach: normalizedPricing?.acIdleForEach ?? '',
          },
          balanceRules: {
            minStart: normalizedPricing?.minBalanceToStart ?? '',
            lowBalance: normalizedPricing?.lowBalanceThreshold ?? '',
            stopBalance: normalizedPricing?.stopSessionBalance ?? '',
          },
          currency: normalizedPricing?.currency || selectedCountryCurrency,
        })
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          pushError(error?.message || 'Failed to load general pricing.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadGeneralPricing()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [pushError, selectedCountry, selectedCountryCurrency])

  const updatePricing = (field, value) => {
    setForm((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: value,
      },
    }))
  }

  const updateIdleFees = (field, value) => {
    setForm((prev) => ({
      ...prev,
      idleFees: {
        ...prev.idleFees,
        [field]: value,
      },
    }))
  }

  const updateBalanceRules = (field, value) => {
    setForm((prev) => ({
      ...prev,
      balanceRules: {
        ...prev.balanceRules,
        [field]: value,
      },
    }))
  }

  const handleSave = async () => {
    const dcError = validateNonNegativeNumber(form.pricing.dc, { required: false, label: 'DC rate' })
    if (dcError) {
      pushError(dcError)
      return
    }
    const acError = validateNonNegativeNumber(form.pricing.ac, { required: false, label: 'AC rate' })
    if (acError) {
      pushError(acError)
      return
    }
    const idleAfterMinutes = parseMinutesValue(form.idleFees.idleAfter)
    if (form.idleFees.idleAfter && (idleAfterMinutes === null || idleAfterMinutes < 0)) {
      pushError('Idle after must be a non-negative number of minutes.')
      return
    }
    const idleFeeError = validateNonNegativeNumber(form.idleFees.fees, { required: false, label: 'Idle fee' })
    if (idleFeeError) {
      pushError(idleFeeError)
      return
    }
    const idleIntervalMinutes = parseMinutesValue(form.idleFees.forEach)
    if (form.idleFees.forEach && (idleIntervalMinutes === null || idleIntervalMinutes < 0)) {
      pushError('Idle interval must be a non-negative number of minutes.')
      return
    }
    const dcIdleAfterMinutes = parseMinutesValue(form.idleFees.dcIdleAfter)
    if (form.idleFees.dcIdleAfter && (dcIdleAfterMinutes === null || dcIdleAfterMinutes < 0)) {
      pushError('DC idle after must be a non-negative number of minutes.')
      return
    }
    const dcIdleFeeError = validateNonNegativeNumber(form.idleFees.dcFees, { required: false, label: 'DC idle fee' })
    if (dcIdleFeeError) { pushError(dcIdleFeeError); return }
    const dcIdleIntervalMinutes = parseMinutesValue(form.idleFees.dcForEach)
    if (form.idleFees.dcForEach && (dcIdleIntervalMinutes === null || dcIdleIntervalMinutes < 0)) {
      pushError('DC idle interval must be a non-negative number of minutes.')
      return
    }
    const acIdleAfterMinutes = parseMinutesValue(form.idleFees.acIdleAfter)
    if (form.idleFees.acIdleAfter && (acIdleAfterMinutes === null || acIdleAfterMinutes < 0)) {
      pushError('AC idle after must be a non-negative number of minutes.')
      return
    }
    const acIdleFeeError = validateNonNegativeNumber(form.idleFees.acFees, { required: false, label: 'AC idle fee' })
    if (acIdleFeeError) { pushError(acIdleFeeError); return }
    const acIdleIntervalMinutes = parseMinutesValue(form.idleFees.acForEach)
    if (form.idleFees.acForEach && (acIdleIntervalMinutes === null || acIdleIntervalMinutes < 0)) {
      pushError('AC idle interval must be a non-negative number of minutes.')
      return
    }
    const minStartError = validateNonNegativeNumber(form.balanceRules.minStart, {
      required: false,
      label: 'Minimum balance to start',
    })
    if (minStartError) {
      pushError(minStartError)
      return
    }
    const lowBalanceError = validateNonNegativeNumber(form.balanceRules.lowBalance, {
      required: false,
      label: 'Low balance notification threshold',
    })
    if (lowBalanceError) {
      pushError(lowBalanceError)
      return
    }
    const stopBalanceError = validateNumber(form.balanceRules.stopBalance, {
      required: false,
      label: 'Stop session balance',
    })
    if (stopBalanceError) {
      pushError(stopBalanceError)
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        pricing: buildPricingPayload(
          form.pricing,
          form.idleFees,
          selectedCountryCurrency,
          form.balanceRules
        ),
      }
      await updateGeneralPricing({ ...payload, country_code: selectedCountry }, { countryCode: selectedCountry })
      pushSuccess('General pricing updated.')
      navigate('/pricing')
    } catch (error) {
      pushError(error?.message || 'Failed to update general pricing.')
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
                { label: 'Pricing', to: '/pricing' },
                { label: 'Edit pricing' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/pricing" ariaLabel="Back to pricing" />
              <h1 className="pricing-form-title">Edit pricing</h1>
            </div>
          </div>
        </div>
        <div className="pricing-form-actions">
          <CountryFilterMenu
            id="pricing-general-country-filter"
            title="Country"
            value={selectedCountry}
            options={countries}
            align="right"
            className="pricing-header-country"
            onChange={(nextValue) => {
              const next = new URLSearchParams(searchParams)
              next.set('country', nextValue || 'EG')
              setSearchParams(next)
            }}
          />
          <button
            type="button"
            className="add-charger-next-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      <InlineToastRegion region="pricing" />

      {isLoading ? <p className="data-placeholder">Loading pricing...</p> : null}
      <div className="pricing-form-sections">
        <div className="pricing-general-note">
          Updates the default pricing used when a charger has zero rates configured.
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-connector-header">
            <h3 className="add-charger-connector-title">Pricing</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">DC</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.pricing.dc}
                  onChange={(event) => updatePricing('dc', event.target.value)}
                  placeholder="3.75"
                />
              </div>
            </div>
            <div className="add-charger-input-field full-width">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">AC</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.pricing.ac}
                  onChange={(event) => updatePricing('ac', event.target.value)}
                  placeholder="1.89"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-connector-header">
            <h3 className="add-charger-connector-title">Idle Fees (DC)</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Idle After</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.dcIdleAfter}
                  onChange={(event) => updateIdleFees('dcIdleAfter', event.target.value)}
                  placeholder="10m"
                />
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Fees</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.dcFees}
                  onChange={(event) => updateIdleFees('dcFees', event.target.value)}
                  placeholder="8"
                />
                <span className="add-charger-egp-suffix">{displayCurrency}</span>
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">For each</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.dcForEach}
                  onChange={(event) => updateIdleFees('dcForEach', event.target.value)}
                  placeholder="5m"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-connector-header">
            <h3 className="add-charger-connector-title">Idle Fees (AC)</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Idle After</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.acIdleAfter}
                  onChange={(event) => updateIdleFees('acIdleAfter', event.target.value)}
                  placeholder="10m"
                />
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Fees</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.acFees}
                  onChange={(event) => updateIdleFees('acFees', event.target.value)}
                  placeholder="8"
                />
                <span className="add-charger-egp-suffix">{displayCurrency}</span>
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">For each</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.idleFees.acForEach}
                  onChange={(event) => updateIdleFees('acForEach', event.target.value)}
                  placeholder="5m"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-connector-header">
            <h3 className="add-charger-connector-title">Balance Rules</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Minimum Balance to Start</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.balanceRules.minStart}
                  onChange={(event) => updateBalanceRules('minStart', event.target.value)}
                  placeholder="50"
                />
                <span className="add-charger-egp-suffix">{displayCurrency}</span>
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Low Balance Notification</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.balanceRules.lowBalance}
                  onChange={(event) => updateBalanceRules('lowBalance', event.target.value)}
                  placeholder="30"
                />
                <span className="add-charger-egp-suffix">{displayCurrency}</span>
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Stop Session Balance</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.balanceRules.stopBalance}
                  onChange={(event) => updateBalanceRules('stopBalance', event.target.value)}
                  placeholder="5 (or -1 to disable)"
                />
                <span className="add-charger-egp-suffix">{displayCurrency}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingGeneralEdit
