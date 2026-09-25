import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { deletePackage, fetchCountries, fetchPackages, updatePackage } from '@/services/referenceApi'
import '@/styles/dashboard.css'

const DEFAULT_FEES = {
  fixedFee: 35,
  adjustableFeePercent: 1.5,
}

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizePackage = (pkg, index) => {
  const amount = toNumber(pkg.amount ?? pkg.price ?? pkg.value)
  return {
    id: pkg.id ?? pkg.package_id ?? `package-${index + 1}`,
    name: pkg.name ?? pkg.package_name ?? `Package ${index + 1}`,
    subtitle: pkg.description ?? pkg.subtitle ?? '',
    arabicSubtitle: pkg.arabic_subtitle ?? pkg.arabicSubtitle ?? '',
    amount,
    currency: pkg.currency_code ?? pkg.currency ?? '',
    fixedFee: toNumber(pkg.fixed_fee),
    adjustableFeePercent: toNumber(pkg.adjustable_fee_percent),
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

const formatAmount = (value) => {
  if (!Number.isFinite(value)) {
    return '-'
  }
  return value.toLocaleString()
}

const deriveFeeValues = (items) => {
  const match = items.find(
    (pkg) =>
      Number.isFinite(pkg.fixedFee) || Number.isFinite(pkg.adjustableFeePercent)
  )
  return {
    fixedFee: match?.fixedFee ?? DEFAULT_FEES.fixedFee,
    adjustableFeePercent:
      match?.adjustableFeePercent ?? DEFAULT_FEES.adjustableFeePercent,
  }
}

const AddIcon = () => (
  <span className="primary-add-button__icon" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 12H19"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5V19"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
)

function Packages() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pushError, pushSuccess } = useInlineToast('packages')
  const [packages, setPackages] = useState([])
  const [countries, setCountries] = useState([])
  const selectedCountry = searchParams.get('country') || 'EG'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    packageItem: null,
  })

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
    let cancelled = false
    const controller = new AbortController()

    const loadPackages = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchPackages({
          includeInactive: true,
          countryCode: selectedCountry,
          signal: controller.signal,
        })
        const list = Array.isArray(data) ? data : data?.results ?? []
        const normalized = list.map((pkg, index) => normalizePackage(pkg, index))
        if (!cancelled) {
          setPackages(normalized)
        }
      } catch (loadError) {
        if (!cancelled && loadError?.name !== 'AbortError') {
          const message = loadError?.message || 'Failed to load packages.'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPackages()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedCountry])

  useEffect(() => {
    if (error) {
      pushError(error)
    }
  }, [error, pushError])

  const feeValues = useMemo(() => deriveFeeValues(packages), [packages])
  const selectedCountryMeta = useMemo(
    () => countries.find((country) => country.code === selectedCountry) || null,
    [countries, selectedCountry]
  )
  const selectedCountryCurrency = selectedCountryMeta?.currency_code || 'EGP'
  const feeCurrency = selectedCountryCurrency || packages[0]?.currency || 'EGP'

  const handleToggleVisibility = async (packageItem) => {
    const nextValue = !packageItem.isActive
    setPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === packageItem.id ? { ...pkg, isActive: nextValue } : pkg
      )
    )
    try {
      await updatePackage(packageItem.id, { is_active: nextValue, country_code: selectedCountry })
    } catch (updateError) {
      setPackages((prev) =>
        prev.map((pkg) =>
          pkg.id === packageItem.id ? { ...pkg, isActive: packageItem.isActive } : pkg
        )
      )
      pushError(updateError?.message || 'Failed to update package visibility.')
    }
  }

  const handleDelete = async () => {
    if (!deleteModalState.packageItem) {
      return
    }
    const target = deleteModalState.packageItem
    try {
      await deletePackage(target.id)
      setPackages((prev) => prev.filter((pkg) => pkg.id !== target.id))
      pushSuccess('Package deleted.')
    } catch (deleteError) {
      pushError(deleteError?.message || 'Failed to delete package.')
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
                { label: 'Packages Manager' },
              ]}
            />
            <div className="page-heading-title-row">
              <h1>Packages Manager</h1>
            </div>
          </div>
        </div>
        <div className="pricing-header-actions">
          <CountryFilterMenu
            id="packages-country-filter"
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
            className="primary-add-button"
            onClick={() => navigate(`/packages/new?country=${selectedCountry}`)}
          >
            <AddIcon />
            <span className="primary-add-button__label">Add New Package</span>
          </button>
        </div>
      </header>

      <InlineToastRegion region="packages" />

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? (
        <p className="data-placeholder">Loading packages...</p>
      ) : null}

      <div className="packages-content">
        <section className="package-card">
          <div className="package-card-header">
            <div>
              <h2 className="package-card-title">Fees</h2>
              <p className="package-card-subtitle">These fees apply to all plans</p>
            </div>
            <div className="package-actions">
              <button
                type="button"
                className="package-action-button edit"
                onClick={() =>
                  navigate(`/packages/fees?country=${selectedCountry}`, {
                    state: { fees: feeValues, currency: feeCurrency },
                  })
                }
              >
                Edit
              </button>
            </div>
          </div>
          <div className="package-card-grid">
            <div className="package-detail">
              <span className="package-detail-label">Fixed Fee</span>
              <span className="package-detail-value">
                {formatAmount(feeValues.fixedFee)}{' '}
                <span className="package-detail-unit">{feeCurrency}</span>
              </span>
            </div>
            <div className="package-detail">
              <span className="package-detail-label">Adjustable Fee</span>
              <span className="package-detail-value">
                {formatAmount(feeValues.adjustableFeePercent)}{' '}
                <span className="package-detail-unit">%</span>
              </span>
            </div>
            <div className="package-detail package-detail-placeholder" aria-hidden="true" />
          </div>
        </section>

        {!isLoading && packages.length === 0 ? (
          <p className="data-placeholder">No packages to display.</p>
        ) : null}

        {packages.map((pkg, index) => (
          <section className="package-card" key={pkg.id}>
            <div className="package-card-header">
              <h2 className="package-card-title">{pkg.name || `Package ${index + 1}`}</h2>
              <div className="package-actions">
                <button
                  type="button"
                  className="package-action-button delete"
                  onClick={() =>
                    setDeleteModalState({
                      isOpen: true,
                      packageItem: pkg,
                    })
                  }
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="package-action-button edit"
                  onClick={() =>
                    navigate(`/packages/${pkg.id}/edit?country=${selectedCountry}`, {
                      state: { packageItem: pkg },
                    })
                  }
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="package-card-grid">
              <div className="package-detail">
                <span className="package-detail-label">Name</span>
                <span className="package-detail-value">{pkg.name || '-'}</span>
              </div>
              <div className="package-detail">
                <span className="package-detail-label">Amount</span>
                <span className="package-detail-value">
                  {formatAmount(pkg.amount)}{' '}
                  <span className="package-detail-unit">{selectedCountryCurrency}</span>
                </span>
              </div>
              <div className="package-detail">
                <span className="package-detail-label">Visibility on mobile app</span>
                <button
                  type="button"
                  className={`package-toggle-button ${pkg.isActive ? 'is-active' : ''}`}
                  aria-pressed={pkg.isActive}
                  onClick={() => handleToggleVisibility(pkg)}
                >
                  <span className="package-toggle-circle" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, packageItem: null })}
        onConfirm={handleDelete}
        title="Delete Package"
        itemName={deleteModalState.packageItem?.name}
        confirmationMessage={
          deleteModalState.packageItem
            ? `Are you sure you want to delete "${deleteModalState.packageItem.name}"?`
            : undefined
        }
      />
    </div>
  )
}

export default Packages
