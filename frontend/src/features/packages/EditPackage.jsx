import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import CountryFilterMenu from '@/components/CountryFilterMenu'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { createPackage, fetchCountries, fetchPackage, updatePackage } from '@/services/referenceApi'
import { validateName, validatePositiveNumber } from '@/utils/validation'
import '@/styles/dashboard.css'

const DEFAULT_CURRENCY = 'EGP'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizePackage = (pkg) => {
  const amount = toNumber(pkg.amount ?? pkg.price ?? pkg.value)
  return {
    id: pkg.id ?? pkg.package_id ?? null,
    name: pkg.name ?? pkg.package_name ?? '',
    subtitle: pkg.description ?? pkg.subtitle ?? '',
    arabicSubtitle: pkg.arabic_subtitle ?? pkg.arabicSubtitle ?? '',
    amount,
    countryCode: pkg.country_code ?? pkg.countryCode ?? null,
    currency: pkg.currency_code ?? pkg.currency ?? '',
    isActive:
      typeof pkg.is_active === 'boolean'
        ? pkg.is_active
        : typeof pkg.isActive === 'boolean'
          ? pkg.isActive
          : typeof pkg.visibility_on_app === 'boolean'
            ? pkg.visibility_on_app
            : true,
  }
}

const toFormState = (pkg) => ({
  name: pkg?.name ?? '',
  subtitle: pkg?.subtitle ?? '',
  arabicSubtitle: pkg?.arabicSubtitle ?? '',
  amount: pkg?.amount !== null && pkg?.amount !== undefined ? String(pkg.amount) : '',
  currency: pkg?.currency ?? '',
  isActive: pkg?.isActive ?? true,
})

function EditPackage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { packageId } = useParams()
  const isEditMode = Boolean(packageId)
  const { pushError, pushSuccess } = useInlineToast('package-editor')

  const seedPackage = location.state?.packageItem
  const [formState, setFormState] = useState(() =>
    seedPackage ? toFormState(normalizePackage(seedPackage)) : toFormState(null)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [countries, setCountries] = useState([])
  const selectedCountry = searchParams.get('country') || 'EG'
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || DEFAULT_CURRENCY

  useEffect(() => {
    const normalizedSeed = seedPackage ? normalizePackage(seedPackage) : null
    if (!normalizedSeed?.countryCode || selectedCountry === normalizedSeed.countryCode) {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('country', normalizedSeed.countryCode)
    setSearchParams(next)
  }, [searchParams, seedPackage, selectedCountry, setSearchParams])

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
      .catch((loadError) => {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        console.error(loadError)
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!isEditMode || seedPackage) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadPackage = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchPackage(packageId, { signal: controller.signal })
        if (!cancelled && data) {
          const normalized = normalizePackage(data)
          if (normalized.countryCode) {
            const next = new URLSearchParams(searchParams)
            next.set('country', normalized.countryCode)
            setSearchParams(next)
          }
          setFormState(toFormState(normalized))
        }
      } catch (loadError) {
        if (!cancelled && loadError?.name !== 'AbortError') {
          const message = loadError?.message || 'Failed to load package.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPackage()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isEditMode, packageId, searchParams, seedPackage, setSearchParams])

  useEffect(() => {
    if (error) {
      pushError(error)
    }
  }, [error, pushError])

  useEffect(() => {
    if (!countries.length) {
      return
    }
    setFormState((prev) => {
      if (prev.currency === selectedCountryCurrency) {
        return prev
      }
      return {
        ...prev,
        currency: selectedCountryCurrency,
      }
    })
  }, [countries.length, selectedCountryCurrency])

  const headerTitle = useMemo(() => {
    if (!isEditMode) {
      return 'Add Package'
    }
    return formState.name ? `Edit ${formState.name}` : 'Edit Package'
  }, [formState.name, isEditMode])

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleToggleVisibility = () => {
    setFormState((prev) => ({
      ...prev,
      isActive: !prev.isActive,
    }))
  }

  const handleSave = async () => {
    const name = formState.name.trim()
    const amountValue = toNumber(formState.amount)

    const nameError = validateName(name, { required: true, label: 'Package name' })
    if (nameError) {
      pushError(nameError)
      return
    }
    const amountError = validatePositiveNumber(amountValue, { required: true, label: 'Amount' })
    if (amountError) {
      pushError(amountError)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name,
        description: formState.subtitle.trim() || null,
        arabic_subtitle: formState.arabicSubtitle.trim() || null,
        amount: amountValue,
        currency_code: selectedCountryCurrency,
        country_code: selectedCountry,
        is_active: formState.isActive,
      }
      if (isEditMode) {
        await updatePackage(packageId, payload)
        pushSuccess('Package updated.')
      } else {
        await createPackage(payload)
        pushSuccess('Package created.')
      }
      navigate('/packages')
    } catch (saveError) {
      pushError(saveError?.message || 'Failed to save package.')
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
                { label: headerTitle },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/packages" ariaLabel="Back to packages" />
              <h1>{headerTitle}</h1>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <CountryFilterMenu
            id="package-editor-country-filter"
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
            className="primary-button packages-save-button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <InlineToastRegion region="package-editor" />

      {error ? <div className="data-warning">{error}</div> : null}

      <section className="package-form-card">
        <div className="package-form-row">
          <label className="package-field">
            <span className="package-field-label">Name</span>
            <div className="package-input">
              <input
                type="text"
                value={formState.name}
                onChange={handleChange('name')}
                placeholder="Package name"
              />
            </div>
          </label>
          <label className="package-field">
            <span className="package-field-label">Amount</span>
            <div className="package-input">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.amount}
                onChange={handleChange('amount')}
                placeholder="Package amount"
              />
              <span className="package-input-suffix">{formState.currency}</span>
            </div>
          </label>
        </div>
        <div className="package-form-row">
          <label className="package-field">
            <span className="package-field-label">Subtitle</span>
            <div className="package-input">
              <input
                type="text"
                value={formState.subtitle}
                onChange={handleChange('subtitle')}
                placeholder="Package subtitle"
              />
            </div>
          </label>
          <label className="package-field">
            <span className="package-field-label">Arabic Subtitle</span>
            <div className="package-input">
              <input
                type="text"
                value={formState.arabicSubtitle}
                onChange={handleChange('arabicSubtitle')}
                placeholder="Package Arabic subtitle"
              />
            </div>
          </label>
        </div>
        <div className="package-visibility">
          <span className="package-field-label">Visibility on mobile app</span>
          <button
            type="button"
            className={`package-toggle-button ${formState.isActive ? 'is-active' : ''}`}
            aria-pressed={formState.isActive}
            onClick={handleToggleVisibility}
          >
            <span className="package-toggle-circle" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}

export default EditPackage
