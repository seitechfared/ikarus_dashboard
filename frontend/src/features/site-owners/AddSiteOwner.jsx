import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCities, fetchCompanyTypes, fetchCountries } from '@/services/referenceApi'
import PillDropdown from '@/components/ui/molecules/PillDropdown'
import { validateEmail, validateName, validatePhone } from '@/utils/validation'
import '@/styles/dashboard.css'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on_hold', label: 'On hold' },
]

const EMPTY_FORM = {
  user_id: '',
  display_name: '',
  company_name: '',
  owner_code: '',
  internal_client_number: '',
  status: 'active',
  valid_from: '',
  valid_to: '',
  company_type: '',
  partner_id: '',
  contact_first_name: '',
  contact_last_name: '',
  contact_email: '',
  contact_phone_e164: '',
  country_code: '',
  city_id: '',
  street: '',
}

const buildStatusIcon = (checked) =>
  checked ? (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="18" height="18" rx="9" stroke="var(--theme-primary)" strokeWidth="2" />
      <rect x="5" y="5" width="10" height="10" rx="5" fill="var(--theme-primary)" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="18" height="18" rx="9" stroke="#99A19D" strokeWidth="2" />
    </svg>
  )

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

const buildMonthCells = (monthDate) => {
  const cells = []
  const firstOfMonth = startOfMonth(monthDate)
  const startDay = firstOfMonth.getDay()
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const prevMonthDays = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate()

  for (let i = startDay - 1; i >= 0; i -= 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, prevMonthDays - i)
    cells.push({ date, currentMonth: false })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      currentMonth: true,
    })
  }

  while (cells.length % 7 !== 0) {
    const date = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      cells.length - totalDays - startDay + 1
    )
    cells.push({ date, currentMonth: false })
  }

  return cells
}

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseLocalDate = (value) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const text = String(value)
  if (DATE_ONLY_PATTERN.test(text)) {
    const [year, month, day] = text.split('-').map((part) => Number(part))
    if (!year || !month || !day) {
      return null
    }
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

const formatLocalDate = (date) => {
  if (!date) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function AddSiteOwner() {
  const navigate = useNavigate()
  const { siteOwnerId } = useParams()
  const isEditMode = Boolean(siteOwnerId)
  const { showToast } = useInlineToast('site-owners')

  const [form, setForm] = useState(EMPTY_FORM)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [companyTypeOptions, setCompanyTypeOptions] = useState([])
  const [countryOptions, setCountryOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [partnerOptions, setPartnerOptions] = useState([])
  const [userOptions, setUserOptions] = useState([{ value: '', label: 'Select a site owner user (optional)', email: '' }])
  const [isUserOptionsLoading, setIsUserOptionsLoading] = useState(false)
  const [linkedUserEmail, setLinkedUserEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    const loadMetadata = async () => {
      try {
        const [types, countries] = await Promise.all([
          fetchCompanyTypes({ signal: controller.signal }),
          fetchCountries({ signal: controller.signal }),
        ])
        if (!isActive) {
          return
        }
        if (Array.isArray(types)) {
          setCompanyTypeOptions(types)
        }
        if (Array.isArray(countries)) {
          const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name))
          setCountryOptions(sorted)
        }
      } catch (metadataError) {
        if (!isActive || metadataError?.name === 'AbortError') {
          return
        }
        console.error(metadataError)
      }
    }
    loadMetadata()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const loadPartners = async () => {
      try {
        const params = new URLSearchParams({ page_size: '250' })
        const response = await fetch(`${API_BASE}/partners/?${params}`, {
          credentials: 'include',
          headers: appendAuthHeader(),
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to load partners (${response.status})`)
        }
        const data = await response.json()
        if (cancelled) {
          return
        }
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : []
        const mapped = list.map((partner) => ({
          value: partner.id,
          label: partner.name || partner.company_name || 'Unnamed partner',
        }))
        setPartnerOptions(mapped)
      } catch (partnerError) {
        if (cancelled || partnerError?.name === 'AbortError') {
          return
        }
        console.error(partnerError)
      }
    }
    loadPartners()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const loadUserOptions = useCallback(async () => {
    setIsUserOptionsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '250' })
      if (siteOwnerId) {
        params.set('site_owner_id', siteOwnerId)
      }
      const response = await fetch(`${API_BASE}/site-owners/available-users/?${params}`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error(`Failed to load site owner users (${response.status})`)
      }
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      const mapped = list.map((user) => {
        const baseLabel = user.name || user.email || 'Unnamed user'
        const emailLabel = user.name && user.email ? ` (${user.email})` : ''
        return {
          value: user.id,
          label: `${baseLabel}${emailLabel}`,
          email: user.email || '',
        }
      })
      setUserOptions([{ value: '', label: 'Select a site owner user (optional)', email: '' }, ...mapped])
    } catch (userError) {
      console.error(userError)
      showToast({
        title: 'Unable to load users',
        message: userError.message || 'Could not load site owner users.',
        variant: 'error',
      })
    } finally {
      setIsUserOptionsLoading(false)
    }
  }, [showToast, siteOwnerId])

  useEffect(() => {
    loadUserOptions()
  }, [loadUserOptions])

  useEffect(() => {
    if (!isEditMode || !siteOwnerId) {
      return
    }
    let isActive = true
    const controller = new AbortController()
    const loadSiteOwner = async () => {
      try {
        const response = await fetch(`${API_BASE}/site-owners/${siteOwnerId}/`, {
          credentials: 'include',
          headers: appendAuthHeader(),
          signal: controller.signal,
        })
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Site owner not found.')
          }
          throw new Error(`Failed to load site owner (${response.status})`)
        }
        const data = await response.json()
        if (!isActive) {
          return
        }
        setForm({
          user_id: data.user_id || '',
          display_name: data.display_name || data.name || '',
          company_name: data.company_name || '',
          owner_code: data.owner_code || '',
          internal_client_number: data.internal_client_number || '',
          status: data.status || 'active',
          valid_from: data.valid_from || '',
          valid_to: data.valid_to || '',
          company_type: data.company_type || '',
          partner_id: data.partner_id || '',
          contact_first_name: data.contact_first_name || '',
          contact_last_name: data.contact_last_name || '',
          contact_email: data.contact_email || '',
          contact_phone_e164: data.contact_phone_e164 || '',
          country_code: data.country_code || '',
          city_id: data.city_id || '',
          street: data.street || '',
        })
        if (data.profile_image) {
          setProfileImagePreview(buildMediaUrl(data.profile_image))
        }
        setLinkedUserEmail(data.email || '')
      } catch (loadError) {
        if (loadError?.name === 'AbortError') {
          return
        }
        console.error(loadError)
        showToast({
          title: 'Load failed',
          message: loadError.message || 'Unable to load site owner.',
          variant: 'error',
        })
        navigate('/site-owners', { replace: true })
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }
    loadSiteOwner()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [isEditMode, siteOwnerId, navigate, showToast])

  useEffect(() => {
    if (!form.country_code) {
      setCityOptions([])
      setIsCitiesLoading(false)
      return
    }
    let isActive = true
    const controller = new AbortController()
    setIsCitiesLoading(true)
    fetchCities({ countryCode: form.country_code, signal: controller.signal })
      .then((cities) => {
        if (!isActive) {
          return
        }
        if (Array.isArray(cities)) {
          const sorted = [...cities].sort((a, b) => a.name.localeCompare(b.name))
          setCityOptions(sorted)
        }
      })
      .catch((cityError) => {
        if (!isActive || cityError?.name === 'AbortError') {
          return
        }
        console.error(cityError)
      })
      .finally(() => {
        if (isActive) {
          setIsCitiesLoading(false)
        }
      })
    return () => {
      isActive = false
      controller.abort()
    }
  }, [form.country_code])

const cityPlaceholder = useMemo(() => {
  if (!form.country_code) {
    return 'Select a country first'
  }
  if (isCitiesLoading) {
    return 'Loading cities...'
  }
  if (!cityOptions.length) {
    return 'No cities available'
  }
  return 'Select city'
}, [form.country_code, cityOptions.length, isCitiesLoading])

const isCitySelectDisabled = useMemo(
  () => !form.country_code || isCitiesLoading || !cityOptions.length,
  [form.country_code, isCitiesLoading, cityOptions.length]
)

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleCountryChange = (value) => {
    updateField('country_code', value)
    updateField('city_id', '')
  }

  const handleUserChange = (value) => {
    updateField('user_id', value)
    const selected = userOptions.find((option) => option.value === value)
    setLinkedUserEmail(selected?.email || '')
  }

  const handleFileChange = (files) => {
    if (!files || !files.length) {
      return
    }
    const file = files[0]
    if (file && file.type.startsWith('image/')) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      const url = URL.createObjectURL(file)
      previewUrlRef.current = url
      setProfileImageFile(file)
      setProfileImagePreview(url)
    } else {
      showToast({
        title: 'Invalid file',
        message: 'Please select an image file.',
        variant: 'error',
      })
    }
  }

  const validateForm = () => {
    const nextErrors = {}
    const ownerNameError = validateName(form.display_name, { required: true, label: 'Owner name' })
    if (ownerNameError) {
      nextErrors.display_name = ownerNameError
    }
    const companyNameError = validateName(form.company_name, { required: false, label: 'Company name' })
    if (companyNameError) {
      nextErrors.company_name = companyNameError
    }
    const contactFirstError = validateName(form.contact_first_name, { required: false, label: 'First name' })
    if (contactFirstError) {
      nextErrors.contact_first_name = contactFirstError
    }
    const contactLastError = validateName(form.contact_last_name, { required: false, label: 'Last name' })
    if (contactLastError) {
      nextErrors.contact_last_name = contactLastError
    }
    const contactEmailError = validateEmail(form.contact_email, { required: false, label: 'Email' })
    if (contactEmailError) {
      nextErrors.contact_email = contactEmailError
    }
    const contactPhoneError = validatePhone(form.contact_phone_e164, {
      required: false,
      label: 'Phone',
      countryCode: form.country_code,
    })
    if (contactPhoneError) {
      nextErrors.contact_phone_e164 = contactPhoneError
    }
    if (form.valid_from && form.valid_to) {
      const fromDate = parseLocalDate(form.valid_from)
      const toDate = parseLocalDate(form.valid_to)
      if (fromDate && toDate && toDate < fromDate) {
        nextErrors.valid_to = 'Valid to must be after valid from.'
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) {
      showToast({
        title: 'Validation failed',
        message: 'Please fix the highlighted fields.',
        variant: 'error',
      })
      return
    }
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('user_id', form.user_id.trim())
      const normalizedEntries = {
        display_name: form.display_name.trim(),
        company_name: form.company_name.trim(),
        owner_code: form.owner_code.trim(),
        internal_client_number: form.internal_client_number.trim(),
        status: form.status || 'active',
        valid_from: form.valid_from || '',
        valid_to: form.valid_to || '',
        company_type: form.company_type || '',
        partner_id: form.partner_id || '',
        contact_first_name: form.contact_first_name.trim(),
        contact_last_name: form.contact_last_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone_e164: form.contact_phone_e164.trim(),
        country_code: form.country_code || '',
        city_id: form.city_id || '',
        street: form.street.trim(),
      }
      Object.entries(normalizedEntries).forEach(([key, value]) => {
        formData.append(key, value)
      })
      if (profileImageFile) {
        formData.append('profile_image', profileImageFile)
      }
      const url = isEditMode
        ? `${API_BASE}/site-owners/${siteOwnerId}/`
        : `${API_BASE}/site-owners/`
      const method = isEditMode ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: appendAuthHeader(),
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} site owner.`
        throw new Error(detail)
      }
      const siteOwnerPayload =
        data && typeof data === 'object'
          ? data.site_owner || data
          : null
      const nextId = siteOwnerPayload?.id || siteOwnerId
      const ownerName =
        siteOwnerPayload?.name ||
        siteOwnerPayload?.display_name ||
        form.display_name ||
        'Site owner'
      showToast({
        title: isEditMode ? 'Site owner updated' : 'Site owner created',
        message: `${ownerName} ${isEditMode ? 'updated' : 'created'} successfully.`,
        variant: 'success',
      })
      if (nextId) {
        navigate(`/site-owners/${nextId}`, { replace: true })
      } else {
        navigate('/site-owners', { replace: true })
      }
    } catch (submitError) {
      console.error(submitError)
      showToast({
        title: 'Save failed',
        message: submitError.message || 'Unable to save site owner.',
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="add-station-page">
        <p className="data-placeholder">Loading site owner…</p>
      </div>
    )
  }

  return (
    <div className="add-station-page">
      <header className="add-station-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/overview' },
                { label: 'Site Owners', to: '/site-owners' },
                { label: isEditMode ? 'Edit Site Owner' : 'Add Site Owner' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/site-owners" ariaLabel="Back to site owners" />
              <h1>{isEditMode ? 'Edit Site Owner' : 'Add Site Owner'}</h1>
            </div>
          </div>
        </div>
        <button type="button" className="primary-save-button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      </header>

      <InlineToastRegion region="site-owners" />

      <form onSubmit={handleSubmit} className="add-charger-form" id="site-owner-form">
        <section className="add-customer-card">
          <div className="add-customer-card__header">
            <div>
              <h2>Profile Image</h2>
              <p>Upload or update the site owner profile photo.</p>
            </div>
          </div>
          <div className="add-customer-profile">
            <div className="add-customer-preview" aria-live="polite">
              {profileImagePreview ? (
                <img src={profileImagePreview} alt="Profile preview" />
              ) : (
                <span className="add-customer-preview__placeholder">No image selected</span>
              )}
            </div>
            <label className="add-customer-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFileChange(event.target.files)}
                disabled={isSubmitting}
              />
              <span>Upload profile image</span>
              <p>PNG or JPG, square image recommended.</p>
            </label>
          </div>
        </section>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Owner Details</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.display_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">
                  Owner name <span className="required-indicator">*</span>
                </span>
              </div>
                <div className="add-charger-input-field-status">
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(event) => updateField('display_name', event.target.value)}
                    placeholder="Enter owner name"
                    required
                  />
                </div>
              {errors.display_name ? (
                <p className="add-charger-field-error">{errors.display_name}</p>
              ) : null}
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Owner code</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.owner_code}
                  onChange={(event) => updateField('owner_code', event.target.value)}
                  placeholder="Auto-generated if left blank"
                />
              </div>
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Internal client number</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.internal_client_number}
                  onChange={(event) => updateField('internal_client_number', event.target.value)}
                  placeholder="Enter internal number"
                />
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Status</span>
              </div>
              <div className="add-charger-radio-group">
                {STATUS_OPTIONS.map((option) => {
                  const checked = form.status === option.value
                  return (
                    <label key={option.value} className="add-charger-radio-option">
                      <span className="add-charger-radio-button">
                        <input
                          type="radio"
                          name="site-owner-status"
                          value={option.value}
                          checked={checked}
                          onChange={() => updateField('status', option.value)}
                        />
                        {buildStatusIcon(checked)}
                      </span>
                      <span className="add-charger-radio-label">{option.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Valid from</span>
              </div>
              <DatePickerField
                id="site-owner-valid-from"
                value={form.valid_from}
                onChange={(event) => updateField('valid_from', event.target.value)}
                placeholder="Choose start date"
              />
            </div>
            <div className={`add-charger-input-field${errors.valid_to ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Valid to</span>
              </div>
              <DatePickerField
                id="site-owner-valid-to"
                value={form.valid_to}
                onChange={(event) => updateField('valid_to', event.target.value)}
                placeholder="Choose end date"
              />
              {errors.valid_to ? <p className="add-charger-field-error">{errors.valid_to}</p> : null}
            </div>
          </div>
          
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Company Details</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.company_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Company name</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(event) => updateField('company_name', event.target.value)}
                  placeholder="Enter company name"
                />
              </div>
              {errors.company_name ? (
                <p className="add-charger-field-error">{errors.company_name}</p>
              ) : null}
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Company type</span>
              </div>
              <PillDropdown
                id="site-owner-company-type"
                value={form.company_type}
                onChange={(event) => updateField('company_type', event.target.value)}
                options={[
                  { value: '', label: 'Select company type' },
                  ...companyTypeOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
              />
            </div>
          </div>
          
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Contact Person</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.contact_first_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">First name</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.contact_first_name}
                  onChange={(event) => updateField('contact_first_name', event.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              {errors.contact_first_name ? (
                <p className="add-charger-field-error">{errors.contact_first_name}</p>
              ) : null}
            </div>
            <div className={`add-charger-input-field${errors.contact_last_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Last name</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.contact_last_name}
                  onChange={(event) => updateField('contact_last_name', event.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              {errors.contact_last_name ? (
                <p className="add-charger-field-error">{errors.contact_last_name}</p>
              ) : null}
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.contact_phone_e164 ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Phone</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="text"
                  value={form.contact_phone_e164}
                  onChange={(event) => updateField('contact_phone_e164', event.target.value)}
                  placeholder="+201234567890"
                />
              </div>
              {errors.contact_phone_e164 ? (
                <p className="add-charger-field-error">{errors.contact_phone_e164}</p>
              ) : null}
            </div>
            <div className={`add-charger-input-field${errors.contact_email ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Email</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => updateField('contact_email', event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              {errors.contact_email ? (
                <p className="add-charger-field-error">{errors.contact_email}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Location</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Country</span>
              </div>
              <PillDropdown
                id="site-owner-country"
                value={form.country_code}
                onChange={(event) => handleCountryChange(event.target.value)}
                options={[
                  { value: '', label: 'Select country' },
                  ...countryOptions.map((country) => ({
                    value: country.code,
                    label: country.name,
                  })),
                ]}
              />
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">City</span>
              </div>
              <PillDropdown
                id="site-owner-city"
                value={form.city_id}
                onChange={(event) => updateField('city_id', event.target.value)}
                options={[
                  { value: '', label: cityPlaceholder },
                  ...cityOptions.map((city) => ({
                    value: city.id,
                    label: city.name,
                  })),
                ]}
                disabled={isCitySelectDisabled}
              />
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field full-width">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Street</span>
              </div>
              <div className="add-charger-input-field-status add-charger-input-field-status--multiline">
                <textarea
                  rows={3}
                  value={form.street}
                  onChange={(event) => updateField('street', event.target.value)}
                  placeholder="Street name, address details"
                />
              </div>
            </div>
          </div>
        </div>

          <div className="add-charger-section-card">
            <div className="add-charger-section-title">
              <h3 className="add-charger-section-title-text">User Details</h3>
            </div>
            <div className="add-charger-input-row">
              <div className="add-charger-input-field">
                <div className="add-charger-input-header">
                  <span className="add-charger-input-label">Linked site owner user</span>
                  <span className="add-charger-input-label-hint">
                    Select an existing site owner login or leave blank to skip linking.
                  </span>
                </div>
                <PillDropdown
                  id="site-owner-user"
                  value={form.user_id}
                  onChange={(event) => handleUserChange(event.target.value)}
                  options={userOptions}
                  disabled={isUserOptionsLoading || isSubmitting}
                />
                {linkedUserEmail ? (
                  <p className="add-charger-input-label-hint">
                    Linked login: {linkedUserEmail}
                  </p>
                ) : (
                  <p className="add-charger-input-label-hint">No login linked.</p>
                )}
                {isUserOptionsLoading ? (
                  <p className="data-placeholder">Loading available users…</p>
                ) : null}
              </div>
              <div className="add-charger-input-field">
                
              </div>
            </div>
          </div>
      </form>
    </div>
  )
}

export default AddSiteOwner

function DatePickerField({ value, onChange, id, placeholder }) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initialDate = parseLocalDate(value) || new Date()
    return startOfMonth(initialDate)
  })
  const pickerRef = useRef(null)

  useEffect(() => {
    const date = parseLocalDate(value)
    if (date) {
      setCurrentMonth(startOfMonth(date))
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const cells = buildMonthCells(currentMonth)

  const handleDateSelect = (date, isCurrentMonth) => {
    if (!isCurrentMonth) return
    const dateStr = formatLocalDate(date)
    onChange({ target: { value: dateStr } })
    setIsOpen(false)
  }

  const handleMonthStep = (direction) => {
    setCurrentMonth((prev) => {
      const nextDate = new Date(prev)
      nextDate.setMonth(prev.getMonth() + direction)
      return startOfMonth(nextDate)
    })
  }

  const displayValue = value
    ? parseLocalDate(value)?.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : placeholder || 'Choose date'

  return (
    <div className="date-picker-field" ref={pickerRef}>
      <input
        type="text"
        id={id}
        value={displayValue}
        readOnly
        onClick={() => setIsOpen((prev) => !prev)}
        className="add-charger-date-input date-picker-input"
        placeholder={placeholder || 'Choose date'}
      />
      {isOpen ? (
        <div className="date-picker-dialog">
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav-button"
              onClick={() => handleMonthStep(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="date-picker-month">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              className="date-picker-nav-button"
              onClick={() => handleMonthStep(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="date-picker-calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day} className="date-picker-day-name">
                {day}
              </span>
            ))}
            {cells.map(({ date, currentMonth: isCurrentMonth }) => {
              const selectedDate = parseLocalDate(value)
              const selected = selectedDate && isSameDay(date, selectedDate)
              return (
                <button
                  key={formatLocalDate(date)}
                  type="button"
                  className={`date-picker-day ${!isCurrentMonth ? 'muted' : ''} ${
                    selected ? 'selected' : ''
                  }`}
                  onClick={() => handleDateSelect(date, isCurrentMonth)}
                  disabled={!isCurrentMonth}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
