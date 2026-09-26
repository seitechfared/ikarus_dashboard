import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import PillDropdown from '@/components/PillDropdown'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchCities, fetchCompanyTypes, fetchCountries } from '@/services/referenceApi'
import { buildMediaUrl } from '@/utils/media'
import { validateEmail, validateName, validatePhone } from '@/utils/validation'
import '@/styles/dashboard.css'

function AddPartner() {
  const navigate = useNavigate()
  const { partnerId } = useParams()
  const isEditMode = Boolean(partnerId)
  const { showToast } = useInlineToast('partners')

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    company_type: '',
    first_name: '',
    last_name: '',
    job_title: '',
    email: '',
    phone_e164: '',
    zip_code: '',
    country_code: '',
    city_id: '',
    street: '',
    notes: '',
  })
  const [profileImage, setProfileImage] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [companyTypeOptions, setCompanyTypeOptions] = useState([])
  const [countryOptions, setCountryOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
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
    if (isEditMode && partnerId) {
      setIsLoading(true)
      fetch(`${API_BASE}/partners/${partnerId}/`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to load partner')
          }
          return res.json()
        })
        .then((data) => {
          setForm({
            name: data.name || '',
            company_name: data.company_name || '',
            company_type: data.company_type || '',
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            job_title: data.job_title || '',
            email: data.email || '',
            phone_e164: data.phone_e164 || '',
            zip_code: data.zip_code || '',
            country_code: data.country_code || '',
            city_id: data.city_id || '',
            street: data.street || '',
            notes: data.notes || '',
          })
          if (data.profile_image) {
            setProfileImagePreview(buildMediaUrl(data.profile_image))
          } else {
            setProfileImagePreview(null)
          }
        })
        .catch((err) => {
          console.error(err)
          showToast({
            title: 'Load failed',
            message: 'Unable to load partner details.',
            variant: 'error',
          })
          navigate('/partners', { replace: true })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [isEditMode, partnerId, navigate, showToast])

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
        if (isActive) {
          console.error(metadataError)
        }
      }
    }
    loadMetadata()
    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

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
        if (isActive && Array.isArray(cities)) {
          const sorted = [...cities].sort((a, b) => a.name.localeCompare(b.name))
          setCityOptions(sorted)
        }
      })
      .catch((cityError) => {
        if (isActive) {
          console.error(cityError)
        }
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

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleFileChange = (field, files) => {
    if (!files || files.length === 0) {
      return
    }
    const file = files[0]
    if (file && file.type.startsWith('image/')) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(file)
      setProfileImage(file)
      setProfileImagePreview(previewUrlRef.current)
    }
  }

  const handleCountryChange = (value) => {
    updateField('country_code', value)
    updateField('city_id', '')
  }

  const cityPlaceholder = !form.country_code
    ? "Select country first"
    : isCitiesLoading
      ? "Loading cities..."
      : "Select city"
  const isCitySelectDisabled = !form.country_code || isCitiesLoading || !cityOptions.length

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    const nameError = validateName(form.name, { required: true, label: 'Partner name' })
    if (nameError) {
      nextErrors.name = nameError
    }
    const companyNameError = validateName(form.company_name, { required: false, label: 'Company name' })
    if (companyNameError) {
      nextErrors.company_name = companyNameError
    }
    const firstNameError = validateName(form.first_name, { required: false, label: 'First name' })
    if (firstNameError) {
      nextErrors.first_name = firstNameError
    }
    const lastNameError = validateName(form.last_name, { required: false, label: 'Last name' })
    if (lastNameError) {
      nextErrors.last_name = lastNameError
    }
    const jobTitleError = validateName(form.job_title, { required: false, label: 'Job title' })
    if (jobTitleError) {
      nextErrors.job_title = jobTitleError
    }
    const emailValue = form.email.trim()
    const emailError = validateEmail(emailValue, { required: false, label: 'Email' })
    if (emailError) {
      nextErrors.email = emailError
    }
    const phoneError = validatePhone(form.phone_e164, {
      required: false,
      label: 'Phone',
      countryCode: form.country_code,
    })
    if (phoneError) {
      nextErrors.phone_e164 = phoneError
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', form.name.trim())
      if (form.company_name.trim()) {
        formData.append('company_name', form.company_name.trim())
      }
      if (form.company_type) {
        formData.append('company_type', form.company_type)
      }
      if (form.first_name.trim()) {
        formData.append('first_name', form.first_name.trim())
      }
      if (form.last_name.trim()) {
        formData.append('last_name', form.last_name.trim())
      }
      if (form.job_title.trim()) {
        formData.append('job_title', form.job_title.trim())
      }
      if (emailValue) {
        formData.append('email', emailValue)
      }
      if (form.phone_e164.trim()) {
        formData.append('phone_e164', form.phone_e164.trim())
      }
      if (form.zip_code.trim()) {
        formData.append('zip_code', form.zip_code.trim())
      }
      if (form.country_code) {
        formData.append('country_code', form.country_code)
      }
      if (form.city_id) {
        formData.append('city_id', form.city_id)
      }
      if (form.street.trim()) {
        formData.append('street', form.street.trim())
      }
      if (form.notes.trim()) {
        formData.append('notes', form.notes.trim())
      }
      if (profileImage) {
        formData.append('profile_image', profileImage)
      }

      const url = isEditMode ? `${API_BASE}/partners/${partnerId}/` : `${API_BASE}/partners/`
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          ...appendAuthHeader(),
        },
        body: formData,
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        const detail = data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} partner.`
        throw new Error(detail)
      }

      const savedPartner = data && typeof data === 'object' ? data.partner || data : null
      const nextPartnerId = savedPartner?.id ?? partnerId ?? savedPartner?.partner_id ?? null
      const partnerName = savedPartner?.name || form.name || 'Partner'

      showToast({
        title: isEditMode ? 'Partner updated' : 'Partner created',
        message: `${partnerName} ${isEditMode ? 'updated' : 'created'} successfully.`,
        variant: 'success',
      })
      if (nextPartnerId) {
        navigate(`/partners/${nextPartnerId}`, { replace: true })
      } else {
        navigate('/partners', { replace: true })
      }
    } catch (error) {
      console.error(error)
      showToast({
        title: 'Save failed',
        message: error.message || `Unable to ${isEditMode ? 'update' : 'create'} partner. Please try again.`,
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="add-station-page">
        <p className="data-placeholder">Loading partner details…</p>
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
                { label: 'Partners', to: '/partners' },
                { label: isEditMode ? 'Edit Partner' : 'Add Partner' },
              ]}
            />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/partners" ariaLabel="Back to partners" />
              <h1>{isEditMode ? 'Edit Partner' : 'Add Partner'}</h1>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="primary-save-button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Save' : 'Save'}
        </button>
      </header>

      <InlineToastRegion region="partners" />

      <form onSubmit={handleSubmit} className="add-charger-form" id="partner-form">
        <section className="add-customer-card">
          <div className="add-customer-card__header">
            <div>
              <h2>Profile Image</h2>
              <p>Upload or update the partner profile photo.</p>
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
                onChange={(event) => handleFileChange('profile_image', event.target.files)}
                disabled={isSubmitting}
              />
              <span>Upload profile image</span>
              <p>PNG or JPG, square image recommended.</p>
            </label>
          </div>
        </section>
        
        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Partner Information</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">
                  Partner name <span className="required-indicator">*</span>
                </span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-name"
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Enter partner name"
                  required
                />
              </div>
              {errors.name ? <span className="add-charger-field-error">{errors.name}</span> : null}
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Company type</span>
              </div>
              <PillDropdown
                id="partner-company-type"
                value={form.company_type}
                onChange={(event) => updateField("company_type", event.target.value)}
                options={[
                  { value: "", label: "Select company type" },
                  ...companyTypeOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
              />
            </div>
          </div>
          <div className={`add-charger-input-field full-width${errors.company_name ? ' has-error' : ''}`}>
            <div className="add-charger-input-header">
              <span className="add-charger-input-label">Company name</span>
            </div>
            <div className="add-charger-input-field-status">
              <input
                id="partner-company"
                type="text"
                  value={form.company_name}
                  onChange={(event) => updateField("company_name", event.target.value)}
                  placeholder="Enter company name"
                />
              </div>
              {errors.company_name ? <span className="add-charger-field-error">{errors.company_name}</span> : null}
            </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Contact Person</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.first_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">First name</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-first-name"
                  type="text"
                  value={form.first_name}
                  onChange={(event) => updateField("first_name", event.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              {errors.first_name ? <span className="add-charger-field-error">{errors.first_name}</span> : null}
            </div>
            <div className={`add-charger-input-field${errors.last_name ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Last name</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-last-name"
                  type="text"
                  value={form.last_name}
                  onChange={(event) => updateField("last_name", event.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              {errors.last_name ? <span className="add-charger-field-error">{errors.last_name}</span> : null}
            </div>
          </div>
          <div className={`add-charger-input-field full-width${errors.job_title ? ' has-error' : ''}`}>
            <div className="add-charger-input-header">
              <span className="add-charger-input-label">Job title</span>
            </div>
            <div className="add-charger-input-field-status">
              <input
                id="partner-job-title"
                type="text"
                value={form.job_title}
                onChange={(event) => updateField("job_title", event.target.value)}
                placeholder="ex: Accountant"
              />
            </div>
            {errors.job_title ? <span className="add-charger-field-error">{errors.job_title}</span> : null}
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Contact Details</h3>
          </div>
          <div className="add-charger-input-row">
            <div className={`add-charger-input-field${errors.email ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Email</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="Enter email here"
                />
              </div>
              {errors.email ? <span className="add-charger-field-error">{errors.email}</span> : null}
            </div>
            <div className={`add-charger-input-field${errors.phone_e164 ? ' has-error' : ''}`}>
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Phone</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-phone"
                  type="tel"
                  value={form.phone_e164}
                  onChange={(event) => updateField("phone_e164", event.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              {errors.phone_e164 ? <span className="add-charger-field-error">{errors.phone_e164}</span> : null}
            </div>
          </div>
          <div className="add-charger-input-field full-width">
            <div className="add-charger-input-header">
              <span className="add-charger-input-label">Notes</span>
            </div>
            <div className="add-charger-input-field-status add-charger-input-field-status--multiline">
              <textarea
                id="partner-notes"
                rows={5}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Enter notes"
              />
            </div>
          </div>
        </div>

        <div className="add-charger-section-card">
          <div className="add-charger-section-title">
            <h3 className="add-charger-section-title-text">Address Details</h3>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Zip code</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-zip"
                  type="text"
                  value={form.zip_code}
                  onChange={(event) => updateField("zip_code", event.target.value)}
                  placeholder="Enter zip code"
                />
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Country</span>
              </div>
              <div className="add-charger-input-field-status">
                <select
                  id="partner-country"
                  value={form.country_code}
                  onChange={(event) => handleCountryChange(event.target.value)}
                >
                  <option value="">Select country</option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="add-charger-input-row">
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">City</span>
              </div>
              <div className="add-charger-input-field-status">
                <select
                  id="partner-city"
                  value={form.city_id}
                  onChange={(event) => updateField("city_id", event.target.value)}
                  disabled={isCitySelectDisabled}
                >
                  <option value="">{cityPlaceholder}</option>
                  {cityOptions.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="add-charger-input-field">
              <div className="add-charger-input-header">
                <span className="add-charger-input-label">Street</span>
              </div>
              <div className="add-charger-input-field-status">
                <input
                  id="partner-street"
                  type="text"
                  value={form.street}
                  onChange={(event) => updateField("street", event.target.value)}
                  placeholder="Enter street name, address details"
                />
              </div>
            </div>
          </div>
        </div>

        

      </form>


    </div>
  )
}

export default AddPartner

