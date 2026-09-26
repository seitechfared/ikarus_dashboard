import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import CountryFilterMenu from '@/components/CountryFilterMenu'
import ReferenceManagerPage from './ReferenceManagerPage'
import { fetchCities, fetchCountries, fetchDistricts } from '@/services/referenceApi'
import { createDistrict, updateDistrict } from '@/services/settingsReferenceApi'
import '@/styles/dashboard.css'

const emptyForm = { name: '', city_id: '', is_active: true }

function DistrictsSettingsPage() {
  const { capabilities } = useOutletContext() || {}
  const { pushError, pushSuccess } = useInlineToast('settings-districts')
  const canEdit = Boolean(capabilities?.canEdit)
  const [countries, setCountries] = useState([])
  const [governorates, setGovernorates] = useState([])
  const [districts, setDistricts] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedGovernorate, setSelectedGovernorate] = useState('')
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
    fetchCities({ countryCode: selectedCountry, includeInactive: true, signal: controller.signal })
      .then((data) => {
        if (!isActive) {
          return
        }
        const list = Array.isArray(data) ? data.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []
        setGovernorates(list)
        setSelectedGovernorate((prev) => (list.some((item) => item.id === prev) ? prev : list[0]?.id || ''))
      })
      .catch((loadError) => {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        pushError(loadError.message || 'Unable to load governorates.')
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [pushError, selectedCountry])

  useEffect(() => {
    if (!selectedGovernorate) {
      setDistricts([])
      return
    }
    let isActive = true
    const controller = new AbortController()
    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchDistricts({
          cityId: selectedGovernorate,
          includeInactive: true,
          signal: controller.signal,
        })
        if (!isActive) {
          return
        }
        const list = Array.isArray(data) ? data.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')) : []
        setDistricts(list)
        setSelectedId((prev) => (list.some((item) => item.id === prev) ? prev : list[0]?.id || ''))
      } catch (loadError) {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        setError(loadError.message || 'Unable to load districts.')
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
  }, [selectedGovernorate])

  const filteredDistricts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return districts
    }
    const governorateMap = new Map(governorates.map((item) => [item.id, item.name]))
    return districts.filter((item) => {
      const haystack = `${item.name} ${item.city_name || governorateMap.get(item.city_id) || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [districts, governorates, search])

  const selectedDistrict = useMemo(
    () => districts.find((item) => item.id === selectedId) || null,
    [districts, selectedId]
  )

  useEffect(() => {
    if (!selectedDistrict || isCreating) {
      if (!selectedDistrict && !isCreating) {
        setForm({ ...emptyForm, city_id: selectedGovernorate })
      }
      return
    }
    setForm({
      name: selectedDistrict.name || '',
      city_id: selectedDistrict.city_id || selectedGovernorate,
      is_active: Boolean(selectedDistrict.is_active),
    })
  }, [isCreating, selectedDistrict, selectedGovernorate])

  const handleSave = async () => {
    if (!canEdit || isSaving) {
      return
    }
    const name = form.name.trim()
    if (!name || !form.city_id) {
      pushError('District name and governorate are required.')
      return
    }
    setIsSaving(true)
    try {
      if (isCreating) {
        const created = await createDistrict({
          name,
          city_id: form.city_id,
          is_active: form.is_active,
        })
        setSelectedId(created.id)
        if (created.city_id !== selectedGovernorate) {
          setSelectedGovernorate(created.city_id)
        } else {
          setDistricts((prev) =>
            [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          )
        }
        setIsCreating(false)
        pushSuccess('District created.')
      } else {
        if (!selectedDistrict) {
          pushError('Select a district first.')
          return
        }
        const updated = await updateDistrict(selectedDistrict.id, {
          name,
          city_id: form.city_id,
          is_active: form.is_active,
        })
        setDistricts((prev) =>
          prev
            .map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        )
        pushSuccess('District updated.')
      }
    } catch (saveError) {
      pushError(saveError.message || `Unable to ${isCreating ? 'create' : 'update'} district.`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartCreate = () => {
    setIsCreating(true)
    setSelectedId('')
    setForm({ ...emptyForm, city_id: selectedGovernorate })
  }

  const toolbar = (
    <div className="settings-toolbar-stack">
      <CountryFilterMenu
        id="settings-districts-country"
        title="Country"
        value={selectedCountry}
        options={countries}
        align="right"
        className="pricing-header-country"
        onChange={(value) => setSelectedCountry(value)}
        showAllOption={false}
      />
      <div className="filter-field">
        <select
          className="multi-select-trigger country-filter-trigger"
          value={selectedGovernorate}
          onChange={(event) => setSelectedGovernorate(event.target.value)}
        >
          {governorates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {canEdit ? (
        <button type="button" className="settings-save-button settings-action-button" onClick={handleStartCreate}>
          <span>Add District</span>
        </button>
      ) : null}
    </div>
  )

  const detailCard = selectedDistrict || isCreating ? (
    <div className="settings-detail-stack">
      <div className="settings-detail-header">
        <div>
          <h3 className="settings-card-title">{isCreating ? 'Add District' : 'District Details'}</h3>
          <p className="settings-detail-subtitle">
            {isCreating
              ? 'Create a district under the selected governorate.'
              : 'Edit district name, governorate, and active status.'}
          </p>
        </div>
      </div>
      <div className="settings-form-grid">
        <label className="settings-field settings-field-full">
          <span className="settings-field-label">District Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="settings-field settings-field-full">
          <span className="settings-field-label">Governorate</span>
          <select
            value={form.city_id}
            onChange={(event) => setForm((prev) => ({ ...prev, city_id: event.target.value }))}
            disabled={!canEdit}
          >
            {governorates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
    <p className="data-placeholder">Select a district to view details or add a new one.</p>
  )

  return (
    <>
      <InlineToastRegion region="settings-districts" />
      <ReferenceManagerPage
        title="Districts"
        description="Manage districts under each governorate."
        searchValue={search}
        onSearchChange={setSearch}
        toolbar={toolbar}
        isLoading={isLoading}
        error={error}
        items={filteredDistricts}
        columns={[
          { key: 'name', label: 'District', width: '1.3fr' },
          {
            key: 'city_name',
            label: 'Governorate',
            width: '1.1fr',
            render: (item) => item.city_name || governorates.find((gov) => gov.id === item.city_id)?.name || '-',
          },
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
        emptyLabel="No districts available."
      />
    </>
  )
}

export default DistrictsSettingsPage
