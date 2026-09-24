import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE } from '@/constants'
import { validateName } from '@/utils/validation'
import { validatePassword } from '@/utils/password'
import './CustomerInvitationComplete.css'

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
  country_code: '',
  city_id: '',
  district_id: '',
  car_model: '',
}

const readJson = async (response) => response.json().catch(() => ({}))

function CustomerInvitationComplete() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams])
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [countries, setCountries] = useState([])
  const [cities, setCities] = useState([])
  const [districts, setDistricts] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [submitState, setSubmitState] = useState({ isSubmitting: false, success: false, message: '' })
  const expiresAtLabel = useMemo(() => {
    if (!meta?.expires_at) {
      return null
    }
    const parsed = new Date(meta.expires_at)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }, [meta?.expires_at])

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      if (!token) {
        setSubmitState({
          isSubmitting: false,
          success: false,
          message: 'Invitation token is missing.',
        })
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const invitationResponse = await fetch(
          `${API_BASE}/customers/invitations/${encodeURIComponent(token)}/`
        )
        const invitationData = await readJson(invitationResponse)
        if (!invitationResponse.ok) {
          throw new Error(invitationData?.detail || 'Invitation link is invalid or expired.')
        }
        const countriesResponse = await fetch(`${API_BASE}/reference/countries/`)
        const countriesData = await readJson(countriesResponse)
        if (!countriesResponse.ok) {
          throw new Error('Failed to load countries.')
        }
        if (cancelled) {
          return
        }
        setMeta(invitationData)
        setCountries(Array.isArray(countriesData) ? countriesData : [])
        setForm({
          first_name: invitationData.first_name || '',
          last_name: invitationData.last_name || '',
          password: '',
          confirm_password: '',
          country_code: invitationData.country_code || '',
          city_id: invitationData.city_id || '',
          district_id: invitationData.district_id || '',
          car_model: invitationData.car_model || '',
        })
      } catch (error) {
        if (!cancelled) {
          setSubmitState({
            isSubmitting: false,
            success: false,
            message: error.message || 'Unable to open invitation link.',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    const loadCities = async () => {
      if (!form.country_code) {
        setCities([])
        return
      }
      setLoadingCities(true)
      try {
        const response = await fetch(
          `${API_BASE}/reference/cities/?country=${encodeURIComponent(form.country_code)}`
        )
        const data = await readJson(response)
        if (!response.ok) {
          throw new Error('Failed to load governorates.')
        }
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          const hasCurrent = list.some((item) => item.id === form.city_id)
          if (form.city_id && !hasCurrent && meta?.city) {
            setCities([...list, { id: form.city_id, name: meta.city }])
          } else {
            setCities(list)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCities([])
        }
      } finally {
        if (!cancelled) {
          setLoadingCities(false)
        }
      }
    }
    loadCities()
    return () => {
      cancelled = true
    }
  }, [form.country_code, form.city_id, meta?.city])

  useEffect(() => {
    let cancelled = false
    const loadDistricts = async () => {
      if (!form.city_id) {
        setDistricts([])
        return
      }
      setLoadingDistricts(true)
      try {
        const response = await fetch(
          `${API_BASE}/reference/districts/?city_id=${encodeURIComponent(form.city_id)}`
        )
        const data = await readJson(response)
        if (!response.ok) {
          throw new Error('Failed to load districts.')
        }
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          const hasCurrent = list.some((item) => item.id === form.district_id)
          if (form.district_id && !hasCurrent && meta?.district) {
            setDistricts([...list, { id: form.district_id, name: meta.district }])
          } else {
            setDistricts(list)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setDistricts([])
        }
      } finally {
        if (!cancelled) {
          setLoadingDistricts(false)
        }
      }
    }
    loadDistricts()
    return () => {
      cancelled = true
    }
  }, [form.city_id, form.district_id, meta?.district])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) {
        return prev
      }
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validateForm = () => {
    const nextErrors = {}
    const firstNameError = validateName(form.first_name, { required: true, label: 'First name' })
    if (firstNameError) {
      nextErrors.first_name = firstNameError
    }
    const lastNameError = validateName(form.last_name, { required: true, label: 'Last name' })
    if (lastNameError) {
      nextErrors.last_name = lastNameError
    }
    const carModelError = validateName(form.car_model, { required: true, label: 'Car model' })
    if (carModelError) {
      nextErrors.car_model = carModelError
    }
    const passwordError = validatePassword(form.password, { required: true })
    if (passwordError) {
      nextErrors.password = passwordError
    }
    if (!form.confirm_password.trim()) {
      nextErrors.confirm_password = 'Confirm password is required.'
    } else if (form.confirm_password.trim() !== form.password.trim()) {
      nextErrors.confirm_password = 'Passwords do not match.'
    }
    if (!form.country_code) {
      nextErrors.country_code = 'Country is required.'
    }
    if (!form.city_id) {
      nextErrors.city_id = 'Governorate is required.'
    }
    if (!form.district_id) {
      nextErrors.district_id = 'District is required.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!token || !validateForm()) {
      return
    }
    setSubmitState({ isSubmitting: true, success: false, message: '' })
    try {
      const response = await fetch(
        `${API_BASE}/customers/invitations/${encodeURIComponent(token)}/complete/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            password: form.password.trim(),
            confirm_password: form.confirm_password.trim(),
            country_code: form.country_code,
            city_id: form.city_id,
            district_id: form.district_id,
            car_model: form.car_model.trim(),
          }),
        }
      )
      const data = await readJson(response)
      if (!response.ok) {
        setErrors((prev) => ({ ...prev, ...data }))
        throw new Error(data?.detail || 'Failed to complete invitation.')
      }
      setSubmitState({
        isSubmitting: false,
        success: true,
        message: data?.detail || 'Account setup completed successfully.',
      })
    } catch (error) {
      setSubmitState({
        isSubmitting: false,
        success: false,
        message: error.message || 'Failed to complete invitation.',
      })
    }
  }

  if (loading) {
    return (
      <div className="invitation-shell">
        <div className="invitation-card invitation-loading">Loading invitation...</div>
      </div>
    )
  }

  if (submitState.success) {
    return (
      <div className="invitation-shell">
        <section className="invitation-card invitation-success-card">
          <div className="invitation-success-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" />
              <path d="M7.4 12.3L10.3 15.2L16.8 8.8" />
            </svg>
          </div>
          <h1>Account Setup Complete</h1>
          <p>{submitState.message}</p>
          <p>You can now sign in from the mobile app using your email and password.</p>
        </section>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="invitation-shell">
        <section className="invitation-card invitation-error-card">
          <h1>Invitation Not Available</h1>
          <p>{submitState.message || 'Invitation link is invalid or expired.'}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="invitation-shell">
      <section className="invitation-card">
        <header className="invitation-header">
          <p className="invitation-badge">IKARUS ONBOARDING</p>
          <h1>Complete Your Account</h1>
          <p>Fill all required fields to activate your account.</p>
          {expiresAtLabel ? <p className="invitation-expiry">Link expires: {expiresAtLabel}</p> : null}
        </header>

        <div className="invitation-readonly-grid">
          <div className="invitation-readonly-item">
            <span>Email</span>
            <strong>{meta?.email || 'N/A'}</strong>
          </div>
          <div className="invitation-readonly-item">
            <span>Mobile</span>
            <strong>{meta?.phone_e164 || 'N/A'}</strong>
          </div>
        </div>

        {submitState.message ? <div className="invitation-alert">{submitState.message}</div> : null}

        <form onSubmit={handleSubmit} className="invitation-form-grid">
          <div className="invitation-field">
            <label htmlFor="invite-first-name">First Name *</label>
            <input
              id="invite-first-name"
              type="text"
              className="invitation-input"
              value={form.first_name}
              autoComplete="given-name"
              required
              onChange={(e) => updateField('first_name', e.target.value)}
            />
            {errors.first_name ? <span className="invitation-error">{errors.first_name}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-last-name">Last Name *</label>
            <input
              id="invite-last-name"
              type="text"
              className="invitation-input"
              value={form.last_name}
              autoComplete="family-name"
              required
              onChange={(e) => updateField('last_name', e.target.value)}
            />
            {errors.last_name ? <span className="invitation-error">{errors.last_name}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-password">Password *</label>
            <input
              id="invite-password"
              type="password"
              className="invitation-input"
              value={form.password}
              autoComplete="new-password"
              required
              onChange={(e) => updateField('password', e.target.value)}
            />
            {errors.password ? <span className="invitation-error">{errors.password}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-confirm-password">Confirm Password *</label>
            <input
              id="invite-confirm-password"
              type="password"
              className="invitation-input"
              value={form.confirm_password}
              autoComplete="new-password"
              required
              onChange={(e) => updateField('confirm_password', e.target.value)}
            />
            {errors.confirm_password ? <span className="invitation-error">{errors.confirm_password}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-country">Country *</label>
            <select
              id="invite-country"
              className="invitation-input"
              value={form.country_code}
              required
              onChange={(e) => {
                updateField('country_code', e.target.value)
                updateField('city_id', '')
                updateField('district_id', '')
              }}
            >
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            {errors.country_code ? <span className="invitation-error">{errors.country_code}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-governorate">Governorate *</label>
            <select
              id="invite-governorate"
              className="invitation-input"
              value={form.city_id}
              required
              onChange={(e) => {
                updateField('city_id', e.target.value)
                updateField('district_id', '')
              }}
              disabled={!form.country_code || loadingCities}
            >
              <option value="">{loadingCities ? 'Loading...' : 'Select governorate'}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            {errors.city_id ? <span className="invitation-error">{errors.city_id}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-district">District *</label>
            <select
              id="invite-district"
              className="invitation-input"
              value={form.district_id}
              required
              onChange={(e) => updateField('district_id', e.target.value)}
              disabled={!form.city_id || loadingDistricts}
            >
              <option value="">{loadingDistricts ? 'Loading...' : 'Select district'}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
            {errors.district_id ? <span className="invitation-error">{errors.district_id}</span> : null}
          </div>

          <div className="invitation-field">
            <label htmlFor="invite-car-model">Car Model *</label>
            <input
              id="invite-car-model"
              type="text"
              className="invitation-input"
              value={form.car_model}
              autoComplete="off"
              required
              onChange={(e) => updateField('car_model', e.target.value)}
            />
            {errors.car_model ? <span className="invitation-error">{errors.car_model}</span> : null}
          </div>

          <div className="invitation-submit-row">
            <button type="submit" className="invitation-submit" disabled={submitState.isSubmitting}>
              {submitState.isSubmitting ? 'Submitting...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default CustomerInvitationComplete
