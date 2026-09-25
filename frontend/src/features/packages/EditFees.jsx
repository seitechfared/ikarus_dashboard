import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCountries } from '@/services/referenceApi'
import { updateAllPackageFees } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const DEFAULT_FEES = {
  fixedFee: 35,
  adjustableFeePercent: 1.5,
}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function EditFees() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { pushError, pushSuccess } = useInlineToast('package-fees')
  const selectedCountry = searchParams.get('country') || 'EG'
  const [countries, setCountries] = useState([])
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || 'EGP'
  const feeCurrency = location.state?.currency || selectedCountryCurrency

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((items) => {
        if (!isActive || !Array.isArray(items)) {
          return
        }
        setCountries(items)
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

  const initialFees = useMemo(() => {
    const fees = location.state?.fees
    if (fees) {
      return {
        fixedFee: fees.fixedFee ?? fees.fixed_fee ?? DEFAULT_FEES.fixedFee,
        adjustableFeePercent:
          fees.adjustableFeePercent ??
          fees.adjustable_fee_percent ??
          DEFAULT_FEES.adjustableFeePercent,
      }
    }
    return DEFAULT_FEES
  }, [location.state])

  const [fixedFee, setFixedFee] = useState(() =>
    initialFees.fixedFee !== null && initialFees.fixedFee !== undefined
      ? String(initialFees.fixedFee)
      : ''
  )
  const [adjustableFeePercent, setAdjustableFeePercent] = useState(() =>
    initialFees.adjustableFeePercent !== null &&
    initialFees.adjustableFeePercent !== undefined
      ? String(initialFees.adjustableFeePercent)
      : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const fixedValue = toNumber(fixedFee)
    const adjustableValue = toNumber(adjustableFeePercent)

    if (fixedValue === null || fixedValue < 0) {
      pushError('Fixed fee must be a non-negative number.')
      return
    }
    if (adjustableValue === null || adjustableValue < 0) {
      pushError('Adjustable fee must be a non-negative number.')
      return
    }

    setIsSaving(true)
    try {
      await updateAllPackageFees({
        fixed_fee: fixedValue,
        adjustable_fee_percent: adjustableValue,
        country_code: selectedCountry,
      })
      pushSuccess('Fees updated for all packages.')
      navigate(`/packages?country=${selectedCountry}`)
    } catch (saveError) {
      pushError(saveError?.message || 'Failed to update fees.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="packages-page">
      <header className="packages-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Billing' },
                { label: 'Packages Manager', to: '/packages' },
                { label: 'Edit Fees' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/packages" ariaLabel="Back to packages" />
              <h1>Edit Fees</h1>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="primary-button packages-save-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <InlineToastRegion region="package-fees" />

      <section className="package-form-card">
        <div className="package-form-row">
          <label className="package-field">
            <span className="package-field-label">Fixed Fee</span>
            <div className="package-input">
              <input
                type="number"
                min="0"
                step="0.01"
                value={fixedFee}
                onChange={(event) => setFixedFee(event.target.value)}
                placeholder="Enter fixed fee"
              />
              <span className="package-input-suffix">{feeCurrency}</span>
            </div>
          </label>
          <label className="package-field">
            <span className="package-field-label">Adjustable Fee</span>
            <div className="package-input">
              <input
                type="number"
                min="0"
                step="0.01"
                value={adjustableFeePercent}
                onChange={(event) => setAdjustableFeePercent(event.target.value)}
                placeholder="Enter adjustable fee"
              />
              <span className="package-input-suffix">%</span>
            </div>
          </label>
        </div>
      </section>
    </div>
  )
}

export default EditFees
