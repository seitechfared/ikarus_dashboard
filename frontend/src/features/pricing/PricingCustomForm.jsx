import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import PillDropdown from '@/components/PillDropdown'
import CountryFilterMenu from '@/components/CountryFilterMenu'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { deleteChargerPricing, fetchAllChargers, fetchChargerPricing, fetchGeneralPricing, updateChargerPricing, } from './pricingApi'
import { fetchCountries } from '@/services/referenceApi'
import {
  MAX_CUSTOM_PERIODS,
  buildCustomPeriodsPayload,
  buildPricingPayload,
  getArabicPeriodLabel,
  getPeriodLabel,
  mapServerCustomPeriods,
  normalizePricingPayload,
  resolvePeriodLabels,
  validateCustomPeriodLabels,
} from './pricingHelpers'
import { validateNonNegativeNumber } from '@/utils/validation'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
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
  customPricing: [],
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

function PricingCustomForm() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { chargerId } = useParams()
  const isEditMode = Boolean(chargerId)
  const { pushError, pushSuccess } = useInlineToast('pricing')
  const pushErrorRef = useRef(pushError)
  const isFormDirtyRef = useRef(false)
  const loadedPricingChargerIdRef = useRef(null)
  const pricingRequestIdRef = useRef(0)
  const [chargers, setChargers] = useState([])
  const [selectedChargerId, setSelectedChargerId] = useState(chargerId || '')
  const [form, setForm] = useState(createInitialForm)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPricing, setIsLoadingPricing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [customPricingPeriods, setCustomPricingPeriods] = useState({})
  const [countries, setCountries] = useState([])
  const [defaultPrices, setDefaultPrices] = useState(null);
  const selectedCountry = searchParams.get('country') || 'EG'
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || 'EGP'
  const displayCurrency = selectedCountryCurrency || form.currency || 'EGP'

  useEffect(() => {
    pushErrorRef.current = pushError
  }, [pushError])

  const markFormDirty = () => {
    isFormDirtyRef.current = true
    pricingRequestIdRef.current += 1
  }

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

    const loadChargers = async () => {
      setIsLoading(true)
      try {
        const list = await fetchAllChargers({ countryCode: selectedCountry, signal: controller.signal })
        if (cancelled) return
        setChargers(list)
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          pushErrorRef.current(error?.message || 'Failed to load chargers.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadChargers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [chargerId, selectedCountry])

  useEffect(() => {
    if (!selectedChargerId) {
      loadedPricingChargerIdRef.current = null
      return
    }

    if (
      loadedPricingChargerIdRef.current === selectedChargerId &&
      isFormDirtyRef.current
    ) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const requestId = pricingRequestIdRef.current

    const loadPricing = async () => {
      setIsLoadingPricing(true)
      try {
        const pricingData = await fetchChargerPricing(selectedChargerId, {
          signal: controller.signal,
        })
        if (cancelled) return
        if (requestId !== pricingRequestIdRef.current) return
        if (isFormDirtyRef.current) return
        const normalizedPricing = normalizePricingPayload(pricingData?.pricing)
        const customPricing = mapServerCustomPeriods(
          pricingData?.custom_periods || pricingData?.customPricing || []
        )
        loadedPricingChargerIdRef.current = selectedChargerId
        isFormDirtyRef.current = false
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
          customPricing,
          currency: normalizedPricing?.currency || selectedCountryCurrency,
        })
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          if (!isFormDirtyRef.current) {
            setForm({ ...createInitialForm(), currency: selectedCountryCurrency })
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPricing(false)
        }
      }
    }

    loadPricing()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedChargerId])

  const chargerOptions = useMemo(() => {
    const options = chargers
      .filter((charger) => charger?.id)
      .map((charger) => ({
        value: charger.id,
        label: charger.name || charger.station?.name || 'Charger',
      }))
    return [{ value: '', label: 'Select charger' }, ...options]
  }, [chargers])

  const selectedCharger = useMemo(
    () => chargers.find((charger) => String(charger?.id || '') === String(selectedChargerId)),
    [chargers, selectedChargerId]
  )

  const saveCountryCode = selectedCharger?.station?.country_code || selectedCountry

  useEffect(() => {
    if (isEditMode || !selectedChargerId || isLoading) {
      return
    }
    const exists = chargers.some((charger) => String(charger?.id || '') === String(selectedChargerId))
    if (!exists && !isFormDirtyRef.current) {
      setSelectedChargerId('')
    }
  }, [chargers, isEditMode, isLoading, selectedChargerId])

  useEffect(() => {
    if (!selectedCountry) {
      return
    }

    const controller = new AbortController()

    const loadDefaultPricing = async () => {
      try {
        const pricingData = await fetchGeneralPricing({
          countryCode: selectedCountry,
          signal: controller.signal,
        })
        const normalizedPricing = normalizePricingPayload(pricingData?.pricing)
        const generalPricing = pricingData?.pricing || null
        setDefaultPrices(generalPricing)

        if (isFormDirtyRef.current) {
          return
        }

        setForm((prev) => ({
          ...prev,
          pricing: {
            dc: generalPricing?.dc ?? generalPricing?.dc_rate_per_kwh ?? prev.pricing.dc ?? normalizedPricing?.dc ?? '',
            ac: generalPricing?.ac ?? generalPricing?.ac_rate_per_kwh ?? prev.pricing.ac ?? normalizedPricing?.ac ?? '',
          },
          idleFees: {
            idleAfter: generalPricing?.idle_after ?? generalPricing?.idle_after_minutes ?? prev.idleFees.idleAfter ?? normalizedPricing?.idleAfter ?? '',
            fees: generalPricing?.idle_fees ?? generalPricing?.idle_fee_amount ?? prev.idleFees.fees ?? normalizedPricing?.idleFees ?? '',
            forEach: generalPricing?.idle_for_each ?? generalPricing?.idle_interval_minutes ?? prev.idleFees.forEach ?? normalizedPricing?.idleForEach ?? '',
            dcIdleAfter: generalPricing?.dc_idle_after_minutes ?? prev.idleFees.dcIdleAfter ?? normalizedPricing?.dcIdleAfter ?? '',
            dcFees: generalPricing?.dc_idle_fee_amount ?? prev.idleFees.dcFees ?? normalizedPricing?.dcIdleFees ?? '',
            dcForEach: generalPricing?.dc_idle_interval_minutes ?? prev.idleFees.dcForEach ?? normalizedPricing?.dcIdleForEach ?? '',
            acIdleAfter: generalPricing?.ac_idle_after_minutes ?? prev.idleFees.acIdleAfter ?? normalizedPricing?.acIdleAfter ?? '',
            acFees: generalPricing?.ac_idle_fee_amount ?? prev.idleFees.acFees ?? normalizedPricing?.acIdleFees ?? '',
            acForEach: generalPricing?.ac_idle_interval_minutes ?? prev.idleFees.acForEach ?? normalizedPricing?.acIdleForEach ?? '',
          },
          customPricing: prev.customPricing.map(period => ({
            ...period,
            dc: generalPricing?.dc ?? generalPricing?.dc_rate_per_kwh ?? period.dc ?? normalizedPricing?.dc ?? '',
            ac: generalPricing?.ac ?? generalPricing?.ac_rate_per_kwh ?? period.ac ?? normalizedPricing?.ac ?? '',
          })),
          currency: normalizedPricing?.currency || prev.currency || selectedCountryCurrency,
        }))
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error(error)
        }
      }
    }

    loadDefaultPricing()
    return () => controller.abort()
  }, [selectedCountry])

  const updatePricing = (field, value) => {
    markFormDirty()
    setForm((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: value,
      },
    }))
  }

  const updateIdleFees = (field, value) => {
    markFormDirty()
    setForm((prev) => ({
      ...prev,
      idleFees: {
        ...prev.idleFees,
        [field]: value,
      },
    }))
  }

  const addCustomPricing = () => {
    markFormDirty()
    setForm((prev) => {
      if (prev.customPricing.length >= MAX_CUSTOM_PERIODS) {
        return prev
      }
      const maxId = prev.customPricing.reduce(
        (largest, period) => Math.max(largest, Number(period.id) || 0),
        0
      )
      const nextIndex = prev.customPricing.length
      const newPeriod = {
        id: maxId + 1,
        backendId: null,
        englishPeriodLabel: getPeriodLabel(nextIndex),
        arabicPeriodLabel: getArabicPeriodLabel(nextIndex),
        from: '',
        to: '',
        dc: '',
        ac: '',
        enabled: true,
      }
      return {
        ...prev,
        customPricing: [...prev.customPricing, newPeriod],
      }
    })
  }

  const removeCustomPricing = (pricingId) => {
    markFormDirty()
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.filter((period) => period.id !== pricingId),
    }))
    setCustomPricingPeriods((prev) => {
      if (!prev[pricingId]) {
        return prev
      }
      const next = { ...prev }
      delete next[pricingId]
      return next
    })
  }

  const updateCustomPricing = (pricingId, field, value) => {
    markFormDirty()
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.map((period) =>
        period.id === pricingId ? { ...period, [field]: value } : period
      ),
    }))
    if (customPricingPeriods[pricingId]?.[field]) {
      setCustomPricingPeriods((prev) => {
        const periodErrors = { ...prev[pricingId] }
        delete periodErrors[field]
        const next = { ...prev }
        if (Object.keys(periodErrors).length === 0) {
          delete next[pricingId]
        } else {
          next[pricingId] = periodErrors
        }
        return next
      })
    }
  }

  const toggleCustomPricing = (pricingId) => {
    markFormDirty()
    setForm((prev) => ({
      ...prev,
      customPricing: prev.customPricing.map((period) =>
        period.id === pricingId ? { ...period, enabled: !period.enabled } : period
      ),
    }))
  }

  const handleSave = async () => {
    if (!selectedChargerId) {
      pushError('Please select a charger.')
      return
    }
    const dcError = validateNonNegativeNumber(form.pricing.dc || defaultPrices?.dc || defaultPrices?.dc_rate_per_kwh, { required: false, label: 'DC rate' })
    if (dcError) {
      pushError(dcError)
      return
    }
    const acError = validateNonNegativeNumber(form.pricing.ac || defaultPrices?.ac || defaultPrices?.ac_rate_per_kwh, { required: false, label: 'AC rate' })
    if (acError) {
      pushError(acError)
      return
    }

    const idleAfterMinutes = parseMinutesValue(form.idleFees.idleAfter || defaultPrices?.idle_after || defaultPrices?.idle_after_minutes)
    if (form.idleFees.idleAfter && (idleAfterMinutes === null || idleAfterMinutes < 0)) {
      pushError('Idle after must be a non negative number of minutes.')
      return
    }
    const idleFeeError = validateNonNegativeNumber(form.idleFees.fees || defaultPrices?.idle_fees || defaultPrices?.idle_fee_amount, { required: false, label: 'Idle fee' })
    if (idleFeeError) {
      pushError(idleFeeError)
      return
    }
    const idleIntervalMinutes = parseMinutesValue(form.idleFees.forEach)
    if (form.idleFees.forEach && (idleIntervalMinutes === null || idleIntervalMinutes <= 0)) {
      pushError('Idle interval must be a positive number of minutes.')
      return
    }

    const dcIdleAfterMinutes = parseMinutesValue(form.idleFees.dcIdleAfter)
    if (form.idleFees.dcIdleAfter && (dcIdleAfterMinutes === null || dcIdleAfterMinutes < 0)) {
      pushError('DC idle after must be a non-negative number of minutes.')
      return
    }
    const dcIdleFeeError = validateNonNegativeNumber(form.idleFees.dcFees || defaultPrices?.dc_idle_fee_amount, { required: false, label: 'DC idle fee' })
    if (dcIdleFeeError) { pushError(dcIdleFeeError); return }
    const dcIdleIntervalMinutes = parseMinutesValue(form.idleFees.dcForEach)
    if (form.idleFees.dcForEach && (dcIdleIntervalMinutes === null || dcIdleIntervalMinutes <= 0)) {
      pushError('DC idle interval must be a positive number of minutes.')
      return
    }

    const acIdleAfterMinutes = parseMinutesValue(form.idleFees.acIdleAfter)
    if (form.idleFees.acIdleAfter && (acIdleAfterMinutes === null || acIdleAfterMinutes < 0)) {
      pushError('AC idle after must be a non-negative number of minutes.')
      return
    }
    const acIdleFeeError = validateNonNegativeNumber(form.idleFees.acFees || defaultPrices?.ac_idle_fee_amount, { required: false, label: 'AC idle fee' })
    if (acIdleFeeError) { pushError(acIdleFeeError); return }
    const acIdleIntervalMinutes = parseMinutesValue(form.idleFees.acForEach)
    if (form.idleFees.acForEach && (acIdleIntervalMinutes === null || acIdleIntervalMinutes <= 0)) {
      pushError('AC idle interval must be a positive number of minutes.')
      return
    }

    for (let index = 0; index < form.customPricing.length; index += 1) {
      const period = form.customPricing[index]
      const labelErrors = validateCustomPeriodLabels(period, index)
      const periodErrors = {}
      if (labelErrors.englishPeriodLabel) {
        periodErrors.englishPeriodLabel = labelErrors.englishPeriodLabel
      }
      if (labelErrors.arabicPeriodLabel) {
        periodErrors.arabicPeriodLabel = labelErrors.arabicPeriodLabel
      }
      if (Object.keys(periodErrors).length) {
        setCustomPricingPeriods((prev) => ({
          ...prev,
          [period.id]: { ...(prev[period.id] || {}), ...periodErrors },
        }))
        pushError(periodErrors.englishPeriodLabel || periodErrors.arabicPeriodLabel)
        return
      }
      const periodLabel = resolvePeriodLabels(period, index).english
      if (period.enabled !== false) {
        const periodDcError = validateNonNegativeNumber(period.dc || defaultPrices?.dc || defaultPrices?.dc_rate_per_kwh, { required: true, label: `${periodLabel} DC rate` })
        if (periodDcError) {
          pushError(periodDcError)
          return
        }
        const periodAcError = validateNonNegativeNumber(period.ac || defaultPrices?.ac || defaultPrices?.ac_rate_per_kwh, { required: true, label: `${periodLabel} AC rate` })
        if (periodAcError) {
          pushError(periodAcError)
          return
        }
      }
    }
    setIsSaving(true)
    setCustomPricingPeriods({})
    try {
      const payload = {
        pricing: buildPricingPayload(form.pricing, form.idleFees, selectedCountryCurrency, null, defaultPrices),
        custom_periods: buildCustomPeriodsPayload(form.customPricing, defaultPrices),
      }

      if (payload.pricing.dc_rate_per_kwh === null || payload.pricing.ac_rate_per_kwh === null) {
        pushError('DC rate and AC rate are required.')
        setIsSaving(false)
        return
      }

      await updateChargerPricing(selectedChargerId, payload, { countryCode: saveCountryCode })
      isFormDirtyRef.current = false
      loadedPricingChargerIdRef.current = selectedChargerId
      pushSuccess(isEditMode ? 'Custom pricing updated.' : 'Custom pricing added.')
      navigate('/pricing')
    } catch (error) {
      pushError(error?.message || 'Failed to save custom pricing.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteChargerPricing(selectedChargerId)
      pushSuccess('Custom pricing deleted.')
      navigate('/pricing')
    } catch (error) {
      pushError(error?.message || 'Failed to delete custom pricing.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
    <div className="pricing-form-page">
      <div className="pricing-form-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Billing' },
                { label: 'Pricing', to: '/pricing' },
                { label: isEditMode ? 'Edit custom pricing' : 'Add custom pricing' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/pricing" ariaLabel="Back to pricing" />
              <h1 className="pricing-form-title">
                {isEditMode ? 'Edit custom pricing' : 'Add custom pricing'}
              </h1>
            </div>
          </div>
        </div>
        <div className="pricing-form-actions">
          {!isEditMode && (
            <CountryFilterMenu
              id="pricing-custom-country-filter"
              title="Country"
              value={selectedCountry}
              options={countries}
              align="right"
              className="pricing-header-country"
              showAllOption={false}
              onChange={(nextValue) => {
                isFormDirtyRef.current = false
                loadedPricingChargerIdRef.current = null
                pricingRequestIdRef.current += 1
                const next = new URLSearchParams(searchParams)
                next.set('country', nextValue || 'EG')
                setSearchParams(next)
              }}
            />
          )}
          {isEditMode && (
            <button
              type="button"
              className="pricing-delete-button"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isDeleting || isSaving}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6h14z" stroke="#ED4A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="add-charger-delete-label">{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}
          <button
            type="button"
            className="add-charger-next-button"
            onClick={handleSave}
            disabled={isSaving || isDeleting || !selectedChargerId}
          >
            <span>{isSaving ? 'Saving...' : isEditMode ? 'Save' : 'Add'}</span>
          </button>
        </div>
      </div>

      <InlineToastRegion region="pricing" />

      {isLoading ? <p className="data-placeholder">Loading chargers...</p> : null}
      {!isLoading && chargers.length === 0 ? (
        <p className="data-placeholder">No chargers available.</p>
      ) : null}
      {isLoadingPricing ? <p className="data-placeholder">Loading pricing...</p> : null}

      <div className="pricing-form-sections">
        <div className="add-charger-section-card">
          <div className="add-charger-connector-header">
            <h3 className="add-charger-connector-title">Charger</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field full-width pricing-select">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Select charger</span>
              </div>
              <PillDropdown
                id="pricing-charger"
                value={selectedChargerId}
                onChange={(event) => {
                  const nextChargerId = event.target.value
                  if (nextChargerId !== selectedChargerId) {
                    isFormDirtyRef.current = false
                    loadedPricingChargerIdRef.current = null
                    pricingRequestIdRef.current += 1
                  }
                  setSelectedChargerId(nextChargerId)
                }}
                options={chargerOptions}
                disabled={isEditMode}
              />
            </div>
          </div>
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
                  placeholder={defaultPrices?.dc ?? defaultPrices?.dc_rate_per_kwh ?? "-"}
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
                  placeholder={defaultPrices?.ac ?? defaultPrices?.ac_rate_per_kwh ?? "-"}
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
                  placeholder={defaultPrices?.dc_idle_after_minutes ?? "-"}
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
                  placeholder={defaultPrices?.dc_idle_fee_amount ?? "-"}
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
                  placeholder={defaultPrices?.dc_idle_interval_minutes ?? "-"}
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
                  placeholder={defaultPrices?.ac_idle_after_minutes ?? "-"}
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
                  placeholder={defaultPrices?.ac_idle_fee_amount ?? "-"}
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
                  placeholder={defaultPrices?.ac_idle_interval_minutes ?? "-"}
                />
              </div>
            </div>
          </div>
        </div>

        {form.customPricing.length > 0 && (
          <div className="add-charger-section-card">
            <div className="add-charger-connector-header">
              <h3 className="add-charger-connector-title">Custom Hours Pricing</h3>
            </div>
            <div className="add-charger-custom-pricing-content">
              {form.customPricing.map((period, index) => {
                const labels = resolvePeriodLabels(period, index)
                const periodErrors = customPricingPeriods[period.id] || {}
                return (
                  <div key={period.id} className="add-charger-pricing-period">
                    <div className="add-charger-period-header">
                      <div>
                        <h4 className="add-charger-period-title">{labels.english}</h4>
                        <span className="station-secondary-text">{labels.arabic}</span>
                      </div>
                      <div className="add-charger-period-actions">
                        <button
                          type="button"
                          className={`add-charger-toggle-button ${period.enabled ? 'enabled' : ''}`}
                          onClick={() => toggleCustomPricing(period.id)}
                        >
                          <div className="add-charger-toggle-circle" />
                        </button>
                        <button
                          type="button"
                          className="add-charger-delete-pricing-button"
                          onClick={() => removeCustomPricing(period.id)}
                          title="Delete this pricing period"
                        >
                          <span className="add-charger-delete-label">Delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="add-charger-period-content">
                      <div className="add-charger-input-row">
                        <div className={`add-charger-input-field${periodErrors.englishPeriodLabel ? ' has-error' : ''}`}>
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">
                              English period label <span className="required-indicator">*</span>
                            </span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              value={period.englishPeriodLabel ?? ''}
                              onChange={(event) => updateCustomPricing(period.id, 'englishPeriodLabel', event.target.value)}
                              placeholder="Enter English period label"
                              readOnly={!period.enabled}
                            />
                          </div>
                          {periodErrors.englishPeriodLabel ? (
                            <span className="add-charger-field-error">{periodErrors.englishPeriodLabel}</span>
                          ) : null}
                        </div>
                        <div className={`add-charger-input-field${periodErrors.arabicPeriodLabel ? ' has-error' : ''}`}>
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">
                              Arabic period label <span className="required-indicator">*</span>
                            </span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              dir="rtl"
                              value={period.arabicPeriodLabel ?? ''}
                              onChange={(event) => updateCustomPricing(period.id, 'arabicPeriodLabel', event.target.value)}
                              placeholder="أدخل اسم الفترة بالعربية"
                              readOnly={!period.enabled}
                            />
                          </div>
                          {periodErrors.arabicPeriodLabel ? (
                            <span className="add-charger-field-error">{periodErrors.arabicPeriodLabel}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="add-charger-input-row">
                        <div className="add-charger-input-field">
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">From</span>
                            <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              value={period.from}
                              onChange={(event) => updateCustomPricing(period.id, 'from', event.target.value)}
                              placeholder="Start Time ex: 18:30"
                              readOnly={!period.enabled}
                            />
                          </div>
                        </div>
                        <div className="add-charger-input-field">
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">To</span>
                            <span className="add-charger-input-label-hint-inline">(24 hrs format)</span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              value={period.to}
                              onChange={(event) => updateCustomPricing(period.id, 'to', event.target.value)}
                              placeholder="End Time ex: 06:30"
                              readOnly={!period.enabled}
                            />
                          </div>
                        </div>
                        <div className="add-charger-input-field">
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">DC</span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              value={period.dc}
                              onChange={(event) => updateCustomPricing(period.id, 'dc', event.target.value)}
                              placeholder={defaultPrices?.dc ?? defaultPrices?.dc_rate_per_kwh ?? "-"}
                              readOnly={!period.enabled}
                            />
                          </div>
                        </div>
                        <div className="add-charger-input-field">
                          <div className="add-charger-input-header">
                            <span className="add-charger-input-label">AC</span>
                          </div>
                          <div className="add-charger-input-field-status">
                            <input
                              type="text"
                              value={period.ac}
                              onChange={(event) => updateCustomPricing(period.id, 'ac', event.target.value)}
                              placeholder={defaultPrices?.ac ?? defaultPrices?.ac_rate_per_kwh ?? "-"}
                              readOnly={!period.enabled}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {form.customPricing.length < MAX_CUSTOM_PERIODS && (
          <button type="button" className="add-charger-add-connector-button" onClick={addCustomPricing}>
            <div className="add-charger-plus-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 7H13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 1V13" stroke="var(--theme-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="add-charger-add-connector-label">Add Custom Days / Hours Pricing</span>
          </button>
        )}
      </div>
    </div>

    <DeleteConfirmationModal
      isOpen={isDeleteModalOpen}
      onClose={() => setIsDeleteModalOpen(false)}
      onConfirm={handleDelete}
      className="pricing-delete-modal"
      title="Delete Pricing"
      confirmationMessage="Are you sure you want to delete this custom pricing?"
      warningMessage="This will remove all custom rates and periods for this charger."
      confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
      confirmDisabled={isDeleting}
    />
    </>
  )
}

export default PricingCustomForm
