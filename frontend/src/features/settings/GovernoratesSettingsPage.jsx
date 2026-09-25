import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import CountryFilterMenu from '@/components/ui/molecules/CountryFilterMenu'
import ReferenceManagerPage from './ReferenceManagerPage'
import { fetchCities, fetchCountries } from '@/services/referenceApi'
import { createCity, updateCity } from '@/services/settingsReferenceApi'
import '@/styles/dashboard.css'

const emptyForm = { name: '', country_code: '', is_active: true }

function GovernoratesSettingsPage() {
  const { capabilities } = useOutletContext() || {}
  const { pushError, pushSuccess } = useInlineToast('settings-governorates')
  const canEdit = Boolean(capabilities?.canEdit)
  const [countries, setCountries] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    fetchCountries({ signal: controller.signal })
      .then((data) => {
        if (!isActive) {
          return
        }
        const list = Array.isArray(data) ? data.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []
        setCountries(list)
        setSelectedCountry((prev) => prev || list[0]?.code || '')
      })
      .catch((loadError) => {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        pushError(loadError.message || 'Unable to load countries.')
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [pushError])

  useEffect(() => {
    if (!selectedCountry) {
      setGovernorates([])
      return
    }
    let isActive = true
    const controller = new AbortController()
    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchCities({
          countryCode: selectedCountry,
          includeInactive: true,
          signal: controller.signal,
        })
        if (!isActive) {
          return
        }
        const list = Array.isArray(data) ? data.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []
        setGovernorates(list)
        setSelectedId((prev) => (list.some((item) => item.id === prev) ? prev : list[0]?.id || ''))
      } catch (loadError) {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        setError(loadError.message || 'Unable to load governorates.')
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
  }, [selectedCountry])

  const filteredGovernorates = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return governorates
    }
    return governorates.filter((item) => `${item.name} ${item.country_name || ''}`.toLowerCase().includes(query))
  }, [governorates, search])

  const selectedGovernorate = useMemo(
    () => governorates.find((item) => item.id === selectedId) || null,
    [governorates, selectedId]
  )

  useEffect(() => {
    if (!selectedGovernorate || isCreating) {
      if (!selectedGovernorate && !isCreating) {
        setForm({ ...emptyForm, country_code: selectedCountry })
      }
      return
    }
    setForm({
      name: selectedGovernorate.name || '',
      country_code: selectedGovernorate.country_code || selectedCountry,
      is_active: Boolean(selectedGovernorate.is_active),
    })
  }, [isCreating, selectedCountry, selectedGovernorate])

  const handleSave = async () => {
    if (!canEdit || isSaving) {
      return
    }
    const name = form.name.trim()
    if (!name || !form.country_code) {
      pushError('Governorate name is required.')
      return
    }
    setIsSaving(true)
    try {
      if (isCreating) {
        const created = await createCity({
          name,
          country_code: form.country_code,
          is_active: form.is_active,
        })
        setSelectedId(created.id)
        if (created.country_code !== selectedCountry) {
          setSelectedCountry(created.country_code)
        } else {
          setGovernorates((prev) =>
            [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          )
        }
        setIsCreating(false)
        pushSuccess('Governorate created.')
      } else {
        if (!selectedGovernorate) {
          pushError('Select a governorate first.')
          return
        }
        const updated = await updateCity(selectedGovernorate.id, {
          name,
          country_code: form.country_code,
          is_active: form.is_active,
        })
        setGovernorates((prev) =>
          prev
            .map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        )
        if (updated.country_code && updated.country_code !== selectedCountry) {
          setSelectedCountry(updated.country_code)
        }
        pushSuccess('Governorate updated.')
      }
    } catch (saveError) {
      pushError(saveError.message || `Unable to ${isCreating ? 'create' : 'update'} governorate.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedId('')
    setForm({ ...emptyForm, country_code: selectedCountry })
  }

  const toolbar = (
    <div className="settings-toolbar-stack">
      <CountryFilterMenu
        id="settings-governorates-country"
        title="Country"
        value={selectedCountry}
        options={countries}
        align="right"
        className="pricing-header-country"
        onChange={(value) => setSelectedCountry(value)}
        showAllOption={false}
      />
      {canEdit ? (
        <button type="button" className="settings-save-button settings-action-button" onClick={handleStartCreate}>
          <span>Add Governorate</span>
        </button>
      ) : null}
    </div>
  )

  const detailCard = selectedGovernorate || isCreating ? (
    <div className="settings-detail-stack">
      <div className="settings-detail-header">
        <div>
          <h3 className="settings-card-title">{isCreating ? 'Add Governorate' : 'Governorate Details'}</h3>
          <p className="settings-detail-subtitle">
            {isCreating
              ? 'Create a governorate under the selected country.'
              : 'Edit governorate name, country, and active status.'}
          </p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label className="settings-field settings-field-full">
          <span className="settings-field-label">Governorate Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">Country</span>
          <select
            value={form.country_code}
            onChange={(event) => setForm((prev) => ({ ...prev, country_code: event.target.value }))}
            disabled={!canEdit}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field settings-field-toggle">
          <span className="settings-field-label">Active</span>
          <button
            type="button"
            className={`package-toggle-button ${form.is_active ? 'is-active' : ''}`}
            aria-pressed={form.is_active}
            disabled={!canEdit}
            onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
          >
            <span className="package-toggle-circle" aria-hidden="true" />
          </button>
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
    <p className="data-placeholder">Select a governorate to view details or add a new one.</p>
  )

  return (
    <>
      <InlineToastRegion region="settings-governorates" />
      <ReferenceManagerPage
        title="Governorates"
        description="Manage governorates grouped by country."
        searchValue={search}
        onSearchChange={setSearch}
        toolbar={toolbar}
        isLoading={isLoading}
        error={error}
        items={filteredGovernorates}
        columns={[
          { key: 'name', label: 'Governorate', width: '1.4fr' },
          { key: 'country_name', label: 'Country', width: '1fr' },
          {
            key: 'is_active',
            label: 'Status',
            width: '120px',
            render: (item) => (item.is_active ? 'Active' : 'Inactive'),
          },
        ]}
        selectedId={selectedId}
        onSelect={(item) => {
          setIsCreating(false)
          setSelectedId(item.id)
        }}
        detailCard={detailCard}
        emptyLabel="No governorates available."
      />
    </>
  )
}

export default GovernoratesSettingsPage
