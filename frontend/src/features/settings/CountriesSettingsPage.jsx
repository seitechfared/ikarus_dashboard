import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import ReferenceManagerPage from './ReferenceManagerPage'
import { fetchCountries } from '@/services/referenceApi'
import { createCountry, updateCountry } from '@/services/settingsReferenceApi'
import '@/styles/dashboard.css'

const sortCountries = (items) => items.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
const emptyForm = {
  code: '',
  name: '',
  currency_code: '',
  currency_name: '',
  currency_symbol: '',
}

function CountriesSettingsPage() {
  const { capabilities } = useOutletContext() || {}
  const { pushError, pushSuccess } = useInlineToast('settings-countries')
  const canEdit = Boolean(capabilities?.canEdit)
  const [countries, setCountries] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const countriesData = await fetchCountries({ signal: controller.signal })
        if (!isActive) {
          return
        }
        const normalized = sortCountries(Array.isArray(countriesData) ? countriesData : [])
        setCountries(normalized)
        setSelectedCode((prev) => prev || normalized[0]?.code || '')
      } catch (loadError) {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        setError(loadError.message || 'Unable to load countries.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return countries
    }
    return countries.filter((country) => {
      const haystack = [country.code, country.name, country.currency_code].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [countries, search])

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === selectedCode) || null,
    [countries, selectedCode]
  )

  useEffect(() => {
    if (!selectedCountry || isCreating) {
      if (!selectedCountry && !isCreating) {
        setForm(emptyForm)
      }
      return
    }
    setForm({
      code: selectedCountry.code || '',
      name: selectedCountry.name || '',
      currency_code: selectedCountry.currency_code || '',
      currency_name: selectedCountry.currency_name || '',
      currency_symbol: selectedCountry.currency_symbol || '',
    })
  }, [isCreating, selectedCountry])

  const handleSave = async () => {
    if (!canEdit || isSaving) {
      return
    }
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      currency_code: form.currency_code.trim().toUpperCase(),
      currency_name: form.currency_name.trim(),
      currency_symbol: form.currency_symbol.trim(),
    }
    if (!payload.code || payload.code.length !== 2) {
      pushError('Country code must be 2 letters.')
      return
    }
    if (!payload.name) {
      pushError('Country name is required.')
      return
    }
    if (!payload.currency_code || payload.currency_code.length !== 3) {
      pushError('Currency code must be 3 letters.')
      return
    }
    if (!payload.currency_name) {
      pushError('Currency name is required.')
      return
    }
    if (!payload.currency_symbol) {
      pushError('Currency symbol is required.')
      return
    }

    const name = form.name.trim()
    setIsSaving(true)
    try {
      if (isCreating) {
        const created = await createCountry(payload)
        setCountries((prev) => sortCountries([...prev, created]))
        setSelectedCode(created.code)
        setIsCreating(false)
        pushSuccess('Country created.')
      } else {
        if (!selectedCountry) {
          pushError('Select a country first.')
          return
        }
        const updated = await updateCountry(selectedCountry.code, payload)
        setCountries((prev) =>
          sortCountries(prev.map((country) => (country.code === updated.code ? { ...country, ...updated } : country)))
        )
        pushSuccess('Country updated.')
      }
    } catch (saveError) {
      pushError(saveError.message || `Unable to ${isCreating ? 'create' : 'update'} country.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedCode('')
    setForm(emptyForm)
  }

  const toolbar = canEdit ? (
    <div className="settings-toolbar-stack">
      <button type="button" className="settings-save-button settings-action-button" onClick={handleStartCreate}>
        <span>Add Country</span>
      </button>
    </div>
  ) : null

  const detailCard = selectedCountry || isCreating ? (
    <div className="settings-detail-stack">
      <div className="settings-detail-header">
        <div>
          <h3 className="settings-card-title">{isCreating ? 'Add Country' : 'Country Details'}</h3>
          <p className="settings-detail-subtitle">
            {isCreating
              ? 'Create a country and its default currency.'
              : 'Update the display name used across the system.'}
          </p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label className="settings-field">
          <span className="settings-field-label">Code</span>
          <input
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            disabled={!canEdit || !isCreating}
          />
        </label>
        <label className="settings-field settings-field-full">
          <span className="settings-field-label">Country Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Currency</span>
          <input
            value={form.currency_code}
            onChange={(event) => setForm((prev) => ({ ...prev, currency_code: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Symbol</span>
          <input
            value={form.currency_symbol}
            onChange={(event) => setForm((prev) => ({ ...prev, currency_symbol: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="settings-field settings-field-full">
          <span className="settings-field-label">Currency Name</span>
          <input
            value={form.currency_name}
            onChange={(event) => setForm((prev) => ({ ...prev, currency_name: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
      </div>
      <div className="settings-detail-actions">
        <button
          type="button"
          className="settings-save-button"
          onClick={handleSave}
          disabled={!canEdit || isSaving}
        >
          <span>{isSaving ? 'Saving...' : isCreating ? 'Create' : 'Save'}</span>
        </button>
      </div>
    </div>
  ) : (
    <p className="data-placeholder">Select a country to view details or add a new one.</p>
  )

  return (
    <>
      <InlineToastRegion region="settings-countries" />
      <ReferenceManagerPage
        title="Countries"
        description="List and update the countries available to the platform."
        searchValue={search}
        onSearchChange={setSearch}
        toolbar={toolbar}
        isLoading={isLoading}
        error={error}
        items={filteredCountries.map((country) => ({ ...country, id: country.code }))}
        columns={[
          { key: 'code', label: 'Code', width: '100px' },
          { key: 'name', label: 'Country', width: '1.4fr' },
          { key: 'currency_code', label: 'Currency', width: '120px' },
        ]}
        selectedId={selectedCode}
        onSelect={(item) => {
          setIsCreating(false)
          setSelectedCode(item.code)
        }}
        detailCard={detailCard}
        emptyLabel="No countries available."
      />
    </>
  )
}

export default CountriesSettingsPage
