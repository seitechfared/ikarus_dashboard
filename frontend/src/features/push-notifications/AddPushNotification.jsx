import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import CountrySelect from '@/components/ui/molecules/CountrySelect'
import SearchableMultiSelect from '@/components/common/SearchableMultiSelect'
import { InlineToastRegion, useToast } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import {
  createPushNotification,
  getPushNotification,
  listPushNotificationCities,
  listPushNotificationCountries,
  listPushNotificationDistricts,
  updatePushNotification,
} from './pushNotificationsApi'
import './pushNotifications.css'
import '@/styles/dashboard.css'

const INITIAL_FORM = {
  title_en: '',
  body_en: '',
  title_ar: '',
  body_ar: '',
  country_code: '',
  all_cities: true,
  city_ids: [],
  all_districts: true,
  district_ids: [],
}

const normalizeIdentifier = (value) => String(value ?? '').trim()

const resolveNotificationId = (response) =>
  normalizeIdentifier(
    response?.notification_id || response?.id || response?.data?.id || response?.notification?.id
  )

const resolveJobId = (response) => normalizeIdentifier(response?.job_id)

const normalizeNotificationToForm = (notification) => {
  const rawCityIds =
    notification?.city_ids ||
    (Array.isArray(notification?.cities) ? notification.cities.map((city) => city.id) : [])
  const rawDistrictIds =
    notification?.district_ids ||
    (Array.isArray(notification?.districts)
      ? notification.districts.map((district) => district.id)
      : [])
  const cityIds = Array.from(new Set(rawCityIds.map(normalizeIdentifier).filter(Boolean)))
  const districtIds = Array.from(new Set(rawDistrictIds.map(normalizeIdentifier).filter(Boolean)))
  const allCities = notification?.all_cities === true ? true : cityIds.length === 0
  const allDistricts =
    allCities || notification?.all_districts === true ? true : districtIds.length === 0

  return {
    title_en: notification?.title_en || '',
    body_en: notification?.body_en || '',
    title_ar: notification?.title_ar || '',
    body_ar: notification?.body_ar || '',
    country_code: notification?.country_code || '',
    all_cities: allCities,
    city_ids: allCities ? [] : cityIds,
    all_districts: allDistricts,
    district_ids: allDistricts ? [] : districtIds,
  }
}

function AddPushNotification() {
  const navigate = useNavigate()
  const { notificationId } = useParams()
  const isEditMode = Boolean(notificationId)
  const toast = useToast()
  const { pushError } = useInlineToast('push-notification-form')

  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])
  const [isCountriesLoading, setIsCountriesLoading] = useState(false)
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadCountries = async () => {
      setIsCountriesLoading(true)
      try {
        const data = await listPushNotificationCountries()
        if (!cancelled) {
          setCountries(Array.isArray(data) ? data : [])
        }
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          pushError(loadError.message || 'Unable to load countries.', { title: 'Load failed' })
        }
      } finally {
        if (!cancelled) {
          setIsCountriesLoading(false)
        }
      }
    }
    loadCountries()
    return () => {
      cancelled = true
    }
  }, [pushError])

  useEffect(() => {
    if (!form.country_code) {
      setCities([])
      setIsCitiesLoading(false)
      return
    }
    let cancelled = false
    const loadCities = async () => {
      setIsCitiesLoading(true)
      try {
        const data = await listPushNotificationCities({ countryCode: form.country_code })
        if (!cancelled) {
          setCities(Array.isArray(data) ? data : [])
        }
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          pushError(loadError.message || 'Unable to load governorates.', { title: 'Load failed' })
        }
      } finally {
        if (!cancelled) {
          setIsCitiesLoading(false)
        }
      }
    }
    loadCities()
    return () => {
      cancelled = true
    }
  }, [form.country_code, pushError])

  useEffect(() => {
    if (form.all_cities || !form.city_ids.length) {
      setDistricts([])
      setIsDistrictsLoading(false)
      return
    }
    let cancelled = false
    const loadDistricts = async () => {
      setIsDistrictsLoading(true)
      try {
        const data = await listPushNotificationDistricts({ cityIds: form.city_ids })
        if (!cancelled) {
          setDistricts(Array.isArray(data) ? data : [])
        }
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          pushError(loadError.message || 'Unable to load areas.', { title: 'Load failed' })
        }
      } finally {
        if (!cancelled) {
          setIsDistrictsLoading(false)
        }
      }
    }
    loadDistricts()
    return () => {
      cancelled = true
    }
  }, [form.all_cities, form.city_ids, pushError])

  useEffect(() => {
    if (!isEditMode || !notificationId) {
      return undefined
    }

    let cancelled = false
    const loadNotification = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await getPushNotification(notificationId)
        if (cancelled) {
          return
        }
        setForm(normalizeNotificationToForm(data))
      } catch (loadError) {
        console.error(loadError)
        if (!cancelled) {
          setError('Unable to load push notification.')
          toast.pushError(loadError.message || 'Unable to load push notification.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadNotification()

    return () => {
      cancelled = true
    }
  }, [isEditMode, notificationId, toast])

  useEffect(() => {
    if (!districts.length || form.all_districts || !form.district_ids.length) {
      return
    }
    const allowedIds = new Set(districts.map((district) => normalizeIdentifier(district.id)).filter(Boolean))
    const filteredDistrictIds = form.district_ids.filter((districtId) =>
      allowedIds.has(normalizeIdentifier(districtId))
    )
    if (filteredDistrictIds.length !== form.district_ids.length) {
      setForm((current) => ({
        ...current,
        district_ids: filteredDistrictIds,
        all_districts: filteredDistrictIds.length === 0,
      }))
    }
  }, [districts, form.all_districts, form.district_ids])

  const countryOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.code,
        label: country.name,
      })),
    [countries]
  )

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city.id,
        label: city.name,
      })),
    [cities]
  )

  const districtOptions = useMemo(
    () =>
      districts.map((district) => ({
        value: district.id,
        label: district.name,
      })),
    [districts]
  )

  const districtOptionGroups = useMemo(
    () =>
      cityOptions
        .filter((city) =>
          form.city_ids.map(normalizeIdentifier).includes(normalizeIdentifier(city.value))
        )
        .map((city) => ({
          id: normalizeIdentifier(city.value),
          label: city.label,
          options: districtOptions.filter((district) =>
            districts.some(
              (entry) =>
                normalizeIdentifier(entry.id) === normalizeIdentifier(district.value) &&
                normalizeIdentifier(entry.city_id) === normalizeIdentifier(city.value)
            )
          ),
        }))
        .filter((group) => group.options.length > 0),
    [cityOptions, districtOptions, districts, form.city_ids]
  )

  const pageTitle = isEditMode ? 'Edit Notification' : 'Push New Notifications'
  const submitLabel = isEditMode ? 'Save' : 'Push'
  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'Push Notifications', to: '/push-notifications' },
    { label: pageTitle },
  ]

  const validateForm = () => {
    const nextErrors = {}

    if (!form.title_en.trim()) {
      nextErrors.title_en = 'Headline English is required.'
    }
    if (!form.body_en.trim()) {
      nextErrors.body_en = 'Description English is required.'
    }
    if (!form.title_ar.trim()) {
      nextErrors.title_ar = 'Headline Arabic is required.'
    }
    if (!form.body_ar.trim()) {
      nextErrors.body_ar = 'Description Arabic is required.'
    }
    if (!form.country_code) {
      nextErrors.country_code = 'Country is required.'
    }
    if (!form.all_cities && !form.city_ids.length) {
      nextErrors.city_ids = 'Select at least one governorate or choose All.'
    }

    return nextErrors
  }

  const handleTextFieldChange = (field) => (event) => {
    const nextValue = event.target.value
    setForm((current) => ({ ...current, [field]: nextValue }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const handleCountryChange = ({ target }) => {
    const nextCountryCode = target.value
    setForm((current) => ({
      ...current,
      country_code: nextCountryCode,
      all_cities: true,
      city_ids: [],
      all_districts: true,
      district_ids: [],
    }))
    setErrors((current) => ({
      ...current,
      country_code: '',
      city_ids: '',
      district_ids: '',
    }))
  }

  const handleCitiesApply = ({ values, allSelected }) => {
    setForm((current) => ({
      ...current,
      all_cities: allSelected,
      city_ids: allSelected ? [] : values,
      all_districts: true,
      district_ids: [],
    }))
    setErrors((current) => ({ ...current, city_ids: '', district_ids: '' }))
  }

  const handleDistrictsApply = ({ values, allSelected }) => {
    setForm((current) => ({
      ...current,
      all_districts: allSelected,
      district_ids: allSelected ? [] : values,
    }))
    setErrors((current) => ({ ...current, district_ids: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validateForm()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      toast.pushError('Please fix the highlighted fields.')
      return
    }

    const payload = new FormData()
    payload.append('title_en', form.title_en.trim())
    payload.append('body_en', form.body_en.trim())
    payload.append('title_ar', form.title_ar.trim())
    payload.append('body_ar', form.body_ar.trim())
    payload.append('country_code', form.country_code)
    payload.append('all_cities', String(form.all_cities))
    payload.append('all_districts', String(form.all_districts || form.all_cities))
    form.city_ids.forEach((cityId) => {
      payload.append('city_ids', cityId)
    })
    form.district_ids.forEach((districtId) => {
      payload.append('district_ids', districtId)
    })

    setIsSubmitting(true)
    try {
      if (isEditMode && notificationId) {
        await updatePushNotification(notificationId, payload)
        toast.pushSuccess('Push notification updated.')
        navigate(`/push-notifications/${notificationId}`)
      } else {
        const createdNotification = await createPushNotification(payload)
        const createdNotificationId = resolveNotificationId(createdNotification)
        const createdJobId = resolveJobId(createdNotification)
        if (!createdNotificationId) {
          throw new Error('Created notification ID was not returned.')
        }
        if (createdNotification?.async_enabled === true && createdJobId) {
          toast.pushSuccess('Push notification queued. Delivery is running in the background.')
          navigate(`/push-notifications/${createdNotificationId}`, {
            state: { jobId: createdJobId },
          })
          return
        }
        toast.pushSuccess('Push notification created and pushed.')
        navigate(`/push-notifications/${createdNotificationId}`)
      }
    } catch (submitError) {
      console.error(submitError)
      toast.pushError(submitError.message || 'Unable to save push notification.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDistrictSelectDisabled =
    isSubmitting || form.all_cities || !form.city_ids.length || isDistrictsLoading

  if (isLoading) {
    return (
      <div className="stations-page push-notifications-page">
        <header className="stations-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs items={breadcrumbs} />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/push-notifications" ariaLabel="Back to push notifications" />
                <h1>{pageTitle}</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="data-placeholder">Loading push notification…</div>
      </div>
    )
  }

  return (
    <div className="stations-page add-customer-page push-notifications-page">
      <header className="add-entity-header">
        <div className="add-entity-heading">
          <Breadcrumbs items={breadcrumbs} />
          <div className="add-entity-title-row">
            <BackButton fallbackTo="/push-notifications" ariaLabel="Back to push notifications" />
            <div>
              <h1>{pageTitle}</h1>
            </div>
          </div>
        </div>
        <div className="add-entity-actions">
          <button
            type="submit"
            form="push-notification-form"
            className="primary-save-button"
            disabled={isSubmitting}
          >
            {submitLabel}
          </button>
        </div>
      </header>

      <InlineToastRegion region="push-notification-form" />

      {error ? <div className="data-warning">{error}</div> : null}

      <form
        id="push-notification-form"
        className="add-customer-form push-notification-form"
        onSubmit={handleSubmit}
      >
        <section className="add-customer-card push-notification-card">
          <div className="add-customer-card__header">
            <div>
              <h2>Details</h2>
            </div>
          </div>

          <div className="add-customer-grid two-column push-notification-grid">
            <div className="add-customer-field">
              <label htmlFor="push-title-en" className="add-customer-label">
                Headline English <span className="required-indicator">*</span>
              </label>
              <input
                id="push-title-en"
                type="text"
                className={`add-customer-input ${errors.title_en ? 'has-error' : ''}`}
                placeholder="Ex: New station"
                value={form.title_en}
                onChange={handleTextFieldChange('title_en')}
                disabled={isSubmitting}
              />
              {errors.title_en ? <span className="add-customer-error">{errors.title_en}</span> : null}
            </div>

            <div className="add-customer-field">
              <label htmlFor="push-title-ar" className="add-customer-label">
                Headline Arabic <span className="required-indicator">*</span>
              </label>
              <input
                id="push-title-ar"
                type="text"
                dir="rtl"
                className={`add-customer-input push-notification-input--rtl ${errors.title_ar ? 'has-error' : ''}`}
                placeholder="مثال: محطة جديدة"
                value={form.title_ar}
                onChange={handleTextFieldChange('title_ar')}
                disabled={isSubmitting}
              />
              {errors.title_ar ? <span className="add-customer-error">{errors.title_ar}</span> : null}
            </div>

            <div className="add-customer-field">
              <label htmlFor="push-body-en" className="add-customer-label">
                Description English <span className="required-indicator">*</span>
              </label>
              <textarea
                id="push-body-en"
                className={`add-customer-input push-notification-textarea ${errors.body_en ? 'has-error' : ''}`}
                placeholder="Ex: Now 5th settlement station near you"
                value={form.body_en}
                onChange={handleTextFieldChange('body_en')}
                disabled={isSubmitting}
              />
              {errors.body_en ? <span className="add-customer-error">{errors.body_en}</span> : null}
            </div>

            <div className="add-customer-field">
              <label htmlFor="push-body-ar" className="add-customer-label">
                Description Arabic <span className="required-indicator">*</span>
              </label>
              <textarea
                id="push-body-ar"
                dir="rtl"
                className={`add-customer-input push-notification-input--rtl push-notification-textarea ${errors.body_ar ? 'has-error' : ''}`}
                placeholder="مثال: تتوفر الآن محطة جديدة بالقرب منك"
                value={form.body_ar}
                onChange={handleTextFieldChange('body_ar')}
                disabled={isSubmitting}
              />
              {errors.body_ar ? <span className="add-customer-error">{errors.body_ar}</span> : null}
            </div>
          </div>
        </section>

        <section className="add-customer-card push-notification-card">
          <div className="add-customer-card__header">
            <div>
              <h2>Notification Area</h2>
            </div>
          </div>

          <div className="add-customer-grid two-column push-notification-grid">
            <div className="add-customer-field">
              <label htmlFor="push-country" className="add-customer-label">
                Country <span className="required-indicator">*</span>
              </label>
              <CountrySelect
                id="push-country"
                value={form.country_code}
                onChange={handleCountryChange}
                options={countryOptions}
                placeholder={isCountriesLoading ? 'Loading countries…' : 'Select country'}
                className={errors.country_code ? 'has-error' : ''}
                disabled={isSubmitting || isCountriesLoading}
              />
              {errors.country_code ? (
                <span className="add-customer-error">{errors.country_code}</span>
              ) : null}
            </div>

            <div className="add-customer-field">
              <label htmlFor="push-governorates" className="add-customer-label">
                Governorate / City
              </label>
              <SearchableMultiSelect
                id="push-governorates"
                options={cityOptions}
                selectedValues={form.city_ids}
                allSelected={form.all_cities}
                onApply={handleCitiesApply}
                placeholder="Select governorates"
                searchPlaceholder="Search by governorate"
                resetLabel="Reset to All"
                disabled={isSubmitting || isCitiesLoading || !form.country_code}
                isLoading={isCitiesLoading}
                className={errors.city_ids ? 'has-error' : ''}
              />
              {errors.city_ids ? <span className="add-customer-error">{errors.city_ids}</span> : null}
            </div>

            <div className="add-customer-field push-notification-grid__full">
              <label htmlFor="push-areas" className="add-customer-label">
                Area / District
              </label>
              <SearchableMultiSelect
                id="push-areas"
                groups={districtOptionGroups}
                selectedValues={form.district_ids}
                allSelected={form.all_districts || form.all_cities}
                onApply={handleDistrictsApply}
                placeholder={
                  form.all_cities ? 'All areas' : form.city_ids.length ? 'Select areas' : 'Select governorates first'
                }
                searchPlaceholder="Search by area"
                resetLabel="Reset to All"
                showReset={false}
                disabled={isDistrictSelectDisabled}
                isLoading={isDistrictsLoading}
                className={errors.district_ids ? 'has-error' : ''}
              />
              {errors.district_ids ? (
                <span className="add-customer-error">{errors.district_ids}</span>
              ) : null}
            </div>
          </div>
        </section>
      </form>
    </div>
  )
}

export default AddPushNotification
