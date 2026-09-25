import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import StationActionMenu from '@/components/ui/organisms/StationActionMenu'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchPricingSummary, updateChargerPricing } from './pricingApi'
import { fetchCountries } from '@/services/referenceApi'
import {
  buildPricingPayload,
  mapServerCustomPeriods,
  normalizePricingPayload,
  resolvePeriodLabels,
} from './pricingHelpers'
import '@/styles/dashboard.css'

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  const stringValue =
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : String(value)
  const needsQuotes = /[",\n]/.test(stringValue)
  const escaped = stringValue.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

const downloadCsv = ({ headers, rows, filename }) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  const csvLines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]
  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const DownloadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20.3447 14.1602C20.171 14.1602 20.0043 14.2292 19.8814 14.3521C19.7585 14.475 19.6895 14.6416 19.6895 14.8154V17.0531C19.6895 17.5806 19.48 18.0864 19.107 18.4594C18.734 18.8323 18.2282 19.0418 17.7008 19.0418H6.29924C5.7718 19.0418 5.26596 18.8323 4.893 18.4594C4.52005 18.0864 4.31052 17.5806 4.31052 17.0531V14.8154C4.31052 14.6416 4.24148 14.475 4.1186 14.3521C3.99571 14.2292 3.82905 14.1602 3.65526 14.1602C3.48147 14.1602 3.31481 14.2292 3.19192 14.3521C3.06904 14.475 3 14.6416 3 14.8154V17.0531C3.00087 17.9279 3.34874 18.7665 3.96728 19.3851C4.58582 20.0036 5.42449 20.3515 6.29924 20.3524H17.7008C18.5755 20.3515 19.4142 20.0036 20.0327 19.3851C20.6513 18.7665 20.9991 17.9279 21 17.0531V14.8154C21 14.6416 20.931 14.475 20.8081 14.3521C20.6852 14.2292 20.5185 14.1602 20.3447 14.1602Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
    <path
      d="M11.5348 16.0748C11.5957 16.1362 11.6682 16.185 11.748 16.2182C11.8279 16.2515 11.9135 16.2686 12 16.2686C12.0865 16.2686 12.1722 16.2515 12.252 16.2182C12.3319 16.185 12.4043 16.1362 12.4652 16.0748L16.1937 12.3464C16.2977 12.2212 16.3514 12.0618 16.3444 11.8992C16.3373 11.7366 16.27 11.5824 16.1555 11.4667C16.0411 11.351 15.8876 11.2821 15.7251 11.2733C15.5626 11.2645 15.4026 11.3165 15.2763 11.4192L12.6553 14.0402V4.29979C12.6553 4.12601 12.5862 3.95934 12.4634 3.83645C12.3405 3.71357 12.1738 3.64453 12 3.64453C11.8262 3.64453 11.6596 3.71357 11.5367 3.83645C11.4138 3.95934 11.3448 4.12601 11.3448 4.29979V14.0304L8.72371 11.4094C8.60076 11.2864 8.434 11.2173 8.26012 11.2173C8.08623 11.2173 7.91947 11.2864 7.79652 11.4094C7.67357 11.5323 7.60449 11.6991 7.60449 11.873C7.60449 12.0468 7.67357 12.2136 7.79652 12.3366L11.5348 16.0748Z"
      fill="var(--theme-secondary)"
      stroke="var(--theme-secondary)"
      strokeWidth="0.4"
    />
  </svg>
)

const EditIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12.2095 13.5192L9.56995 13.8968L9.94682 11.2566L16.7348 4.46861C17.0348 4.16856 17.4418 4 17.8661 4C18.2905 4 18.6974 4.16856 18.9974 4.46861C19.2975 4.76866 19.4661 5.17561 19.4661 5.59994C19.4661 6.02427 19.2975 6.43122 18.9974 6.73127L12.2095 13.5192Z"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.7994 13.5989V18.932C16.7994 19.2149 16.6871 19.4862 16.487 19.6863C16.287 19.8863 16.0157 19.9987 15.7328 19.9987H5.06662C4.78374 19.9987 4.51244 19.8863 4.31241 19.6863C4.11238 19.4862 4 19.2149 4 18.932V8.26584C4 7.98295 4.11238 7.71165 4.31241 7.51162C4.51244 7.31159 4.78374 7.19922 5.06662 7.19922H10.3997"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ReturnIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.34351 4.01562C5.44433 4.01254 5.54506 4.02974 5.6394 4.06543C5.73384 4.1012 5.82073 4.15542 5.89429 4.22461C5.96777 4.29375 6.02666 4.37677 6.06812 4.46875C6.10955 4.56072 6.13237 4.65992 6.1355 4.76074L6.20972 7.16406L6.21069 7.20117L6.23608 7.17383C6.94708 6.41251 7.80774 5.80607 8.76343 5.3916C9.71916 4.97715 10.75 4.76341 11.7917 4.76465C15.9944 4.76465 19.4021 8.17218 19.4021 12.375C19.4018 16.5776 15.9942 19.9844 11.7917 19.9844C10.3463 19.9846 8.9309 19.5728 7.71069 18.7979C6.49043 18.0229 5.51551 16.9169 4.90112 15.6084C4.85097 15.5058 4.82411 15.3925 4.823 15.2783C4.82196 15.1643 4.8472 15.0517 4.89526 14.9482V14.9473C4.95431 14.8151 5.05077 14.7032 5.17261 14.625C5.29463 14.5467 5.43681 14.5054 5.58179 14.5068C5.72679 14.5047 5.86955 14.5453 5.99194 14.623C6.11427 14.7008 6.21159 14.8122 6.27124 14.9443V14.9453C6.76074 15.9964 7.54057 16.8855 8.51831 17.5088C9.49627 18.1321 10.632 18.464 11.7917 18.4639C15.1544 18.4639 17.8804 15.7376 17.8806 12.375C17.8806 9.01217 15.1545 6.28516 11.7917 6.28516C10.9587 6.28417 10.1342 6.45488 9.36987 6.78613C8.60573 7.11735 7.91811 7.60254 7.34937 8.21094L7.323 8.23828L7.36108 8.2373L9.75464 8.16406C9.85542 8.16104 9.95625 8.17815 10.0505 8.21387C10.1448 8.24964 10.231 8.30396 10.3044 8.37305C10.378 8.44222 10.4378 8.52515 10.4792 8.61719C10.5206 8.70912 10.5435 8.80841 10.5466 8.90918C10.5497 9.01005 10.5325 9.1107 10.4968 9.20508C10.4611 9.29951 10.4068 9.3864 10.3376 9.45996C10.2685 9.53342 10.1855 9.59235 10.0935 9.63379C10.0015 9.67523 9.90235 9.69805 9.80151 9.70117L5.56323 9.83105C5.45769 9.83417 5.35262 9.81571 5.25464 9.77637C5.15649 9.73691 5.06705 9.67703 4.99292 9.60156H4.99194C4.91207 9.53219 4.84789 9.44614 4.80249 9.35059C4.7572 9.25513 4.73159 9.15151 4.72827 9.0459L4.59839 4.80859C4.5953 4.70781 4.61254 4.607 4.64819 4.5127C4.68396 4.41826 4.73819 4.33137 4.80737 4.25781C4.87651 4.18431 4.95952 4.12546 5.05151 4.08398C5.14349 4.04254 5.24268 4.01875 5.34351 4.01562Z"
      fill="#ED4A4A"
      stroke="#ED4A4A"
      strokeWidth="0.0312501"
    />
  </svg>
)

const formatRate = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value)
}

const formatPeriodTimeRange = (period) => {
  if (period.from && period.to) {
    return `${period.from} to ${period.to}`
  }
  return ''
}

function Pricing() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pushError, pushInfo, pushSuccess } = useInlineToast('pricing')
  const [chargersCount, setChargersCount] = useState(0)
  const [generalPricing, setGeneralPricing] = useState(null)
  const [customRows, setCustomRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCustom, setIsLoadingCustom] = useState(false)
  const [returningId, setReturningId] = useState(null)
  const [countries, setCountries] = useState([])
  const selectedCountry = searchParams.get('country') || 'EG'
  const selectedCountryCurrency =
    countries.find((country) => country.code === selectedCountry)?.currency_code || 'EGP'

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

  const handleDownload = () => {
    if (!customRows.length) {
      pushInfo('No custom pricing to download.')
      return
    }

    const headers = ['Charger', 'Base DC', 'Base AC', 'Period English Label', 'Period Arabic Label', 'Period Time Range', 'Period DC', 'Period AC']
    const rows = []
    customRows.forEach((row) => {
      const baseDc = row.pricing?.dc ?? ''
      const baseAc = row.pricing?.ac ?? ''
      if (row.periods?.length) {
        row.periods.forEach((period, periodIndex) => {
          const labels = resolvePeriodLabels(period, periodIndex)
          rows.push({
            Charger: row.chargerName || '',
            'Base DC': baseDc,
            'Base AC': baseAc,
            'Period English Label': labels.english,
            'Period Arabic Label': labels.arabic,
            'Period Time Range': formatPeriodTimeRange(period) || '',
            'Period DC': period.dc ?? '',
            'Period AC': period.ac ?? '',
          })
        })
      } else {
        rows.push({
          Charger: row.chargerName || '',
          'Base DC': baseDc,
          'Base AC': baseAc,
          Period: '',
          'Period English Label': '',
          'Period Arabic Label': '',
          'Period Time Range': '',
          'Period DC': '',
          'Period AC': '',
        })
      }
    })

    downloadCsv({
      headers,
      rows,
      filename: `custom_pricing_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadPricing = async () => {
      setIsLoading(true)
      setIsLoadingCustom(true)
      try {
        const summary = await fetchPricingSummary({ countryCode: selectedCountry, signal: controller.signal })
        if (cancelled) return
        const rows = Array.isArray(summary?.custom_rows) ? summary.custom_rows : []
        const mappedRows = rows.map((row) => {
          const charger = row.charger || {}
          const periods = mapServerCustomPeriods(row.custom_periods || row.customPricing || [])
          return {
            chargerId: charger.id,
            chargerName: charger.name || charger.station_name || 'Charger',
            pricing: row.pricing || null,
            isCustomRates: Boolean(row.is_custom_rates),
            periods,
          }
        })
        setChargersCount(Number(summary?.chargers_count) || 0)
        setGeneralPricing(normalizePricingPayload(summary?.general_pricing))
        setCustomRows(mappedRows)
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          pushError(error?.message || 'Failed to load pricing.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsLoadingCustom(false)
        }
      }
    }

    loadPricing()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [pushError, selectedCountry])

  const handleReturnToGeneralPricing = async (row) => {
    if (!generalPricing) {
      pushError('General pricing is not available yet.')
      return
    }
    setReturningId(row.chargerId)
    try {
      const payload = {
        pricing: buildPricingPayload(
          { dc: 0, ac: 0 },
          {
            idleAfter: 0,
            fees: 0,
            forEach: 0,
            dcIdleAfter: 0,
            dcFees: 0,
            dcForEach: 0,
            acIdleAfter: 0,
            acFees: 0,
            acForEach: 0,
          },
          generalPricing.currency
        ),
        custom_periods: [],
      }
      await updateChargerPricing(row.chargerId, payload, { countryCode: selectedCountry })
      setCustomRows((prev) => prev.filter((item) => item.chargerId !== row.chargerId))
      pushSuccess('Custom pricing cleared.')
    } catch (error) {
      pushError(error?.message || 'Failed to return pricing to general.')
    } finally {
      setReturningId(null)
    }
  }

  const generalCurrency = selectedCountryCurrency

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Billing' },
                { label: 'Pricing' },
              ]}
            />
            <div className="page-heading-title-row">
              <h1>Pricing</h1>
            </div>
          </div>
        </div>
        <div className="pricing-header-actions">
          <CountryFilterMenu
            id="pricing-country-filter"
            title="Country"
            value={selectedCountry}
            options={countries}
            align="right"
            className="pricing-header-country"
            showAllOption={false}
            onChange={(nextValue) => {
              const next = new URLSearchParams(searchParams)
              next.set('country', nextValue || 'EG')
              setSearchParams(next)
            }}
          />
          <button
            type="button"
            className="pricing-outline-button"
            onClick={() => navigate(`/pricing/custom/new?country=${selectedCountry}`)}
          >
            Custom Pricing
          </button>
          <button
            type="button"
            className="pricing-solid-button"
            onClick={() => navigate(`/pricing/general?country=${selectedCountry}`)}
          >
            Edit Pricing
          </button>
        </div>
      </header>

      <InlineToastRegion region="pricing" />

      {isLoading ? <p className="data-placeholder">Loading pricing...</p> : null}
      {!isLoading && chargersCount === 0 ? (
        <p className="data-placeholder">No chargers available.</p>
      ) : null}

      <section className="pricing-card">
        <div className="pricing-card-header">
          <div>
            <h2 className="pricing-card-title">General Pricing</h2>
            <p className="pricing-card-subtitle">
              Price for all chargers, if you change any charger to custom pricing manually will be
              out of general pricing
            </p>
          </div>
        </div>
        <div className="pricing-card-grid">
          <div className="pricing-metric">
            <span className="pricing-metric-label">DC Tarrif</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.dc)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">AC Tarrif</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.ac)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
        </div>
        <div className="pricing-card-grid">
          <div className="pricing-metric">
            <span className="pricing-metric-label">DC Idle After</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.dcIdleAfter)}
              <span className="pricing-metric-unit">min</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">DC Idle Fee</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.dcIdleFees)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">DC Idle Interval</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.dcIdleForEach)}
              <span className="pricing-metric-unit">min</span>
            </span>
          </div>
        </div>
        <div className="pricing-card-grid">
          <div className="pricing-metric">
            <span className="pricing-metric-label">AC Idle After</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.acIdleAfter)}
              <span className="pricing-metric-unit">min</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">AC Idle Fee</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.acIdleFees)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">AC Idle Interval</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.acIdleForEach)}
              <span className="pricing-metric-unit">min</span>
            </span>
          </div>
        </div>
        <div className="pricing-card-grid">
          <div className="pricing-metric">
            <span className="pricing-metric-label">Minimum Balance to Start</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.minBalanceToStart)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">Low Balance Notification</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.lowBalanceThreshold)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
          <div className="pricing-metric">
            <span className="pricing-metric-label">Stop Session Balance</span>
            <span className="pricing-metric-value">
              {formatRate(generalPricing?.stopSessionBalance)}
              <span className="pricing-metric-unit">{generalCurrency}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="pricing-card">
        <div className="pricing-card-header">
          <h2 className="pricing-card-title">Custom Chargers Pricing</h2>
          <button type="button" className="pricing-download-button" onClick={handleDownload}>
            <DownloadIcon />
            <span>Download</span>
          </button>
        </div>
        <div className="pricing-table">
          <div className="pricing-table-header">
            <div className="pricing-table-cell">Num</div>
            <div className="pricing-table-cell">Charger</div>
            <div className="pricing-table-cell">DC / AC Price</div>
            <div className="pricing-table-cell">Periods / DC - AC</div>
            <div className="pricing-table-cell pricing-table-actions">Actions</div>
          </div>
          {isLoadingCustom ? (
            <div className="pricing-table-row pricing-table-row-empty">
              <div className="pricing-table-cell pricing-table-empty">
                Loading custom pricing...
              </div>
            </div>
          ) : null}
          {!isLoadingCustom && customRows.length === 0 ? (
            <div className="pricing-table-row pricing-table-row-empty">
              <div className="pricing-table-cell pricing-table-empty">
                No custom pricing configured.
              </div>
            </div>
          ) : null}
          {!isLoadingCustom &&
            customRows.map((row, index) => (
              <div className="pricing-table-row" key={row.chargerId}>
                <div className="pricing-table-cell">{index + 1}</div>
                <div className="pricing-table-cell">{row.chargerName}</div>
                <div className="pricing-table-cell">
                  <div className="pricing-rate-pair">
                    <span>{formatRate(row.pricing?.dc)}</span>
                    <span>/</span>
                    <span>{formatRate(row.pricing?.ac)}</span>
                  </div>
                </div>
                <div className="pricing-table-cell">
                  <div className="pricing-periods">
                    {row.periods.length ? (
                      row.periods.map((period, periodIndex) => {
                        const labels = resolvePeriodLabels(period, periodIndex)
                        const timeRange = formatPeriodTimeRange(period)
                        return (
                        <div className="pricing-period" key={`${row.chargerId}-${period.id}`}>
                          <div className="pricing-period-label">
                            {timeRange ? <span>{timeRange}</span> : null}
                            <span>{labels.english}</span>
                            <span className="station-secondary-text">{labels.arabic}</span>
                          </div>
                          <span className="pricing-period-rate">{formatRate(period.dc)}</span>
                          <span className="pricing-period-rate">{formatRate(period.ac)}</span>
                        </div>
                        )
                      })
                    ) : (
                      <span className="pricing-period-empty">No custom periods</span>
                    )}
                  </div>
                </div>
                <div className="pricing-table-cell pricing-table-actions">
                  <StationActionMenu
                    disabled={returningId === row.chargerId}
                    actions={[
                      {
                        key: 'edit',
                        label: 'Edit',
                        icon: EditIcon,
                        onClick: () => navigate(`/pricing/custom/${row.chargerId}/edit?country=${selectedCountry}`),
                      },
                      {
                        key: 'return',
                        label: 'Return to General Pricing',
                        icon: ReturnIcon,
                        onClick: () => handleReturnToGeneralPricing(row),
                        variant: 'danger',
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}

export default Pricing
