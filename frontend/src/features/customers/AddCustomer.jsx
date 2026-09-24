import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import '@/styles/dashboard.css'
import { validatePassword } from '@/utils/password'
import { fetchCities, fetchCountries, fetchDistricts, fetchPackages } from '@/services/referenceApi'
import PillDropdown from '@/components/PillDropdown'
import { validateEmail, validateName, validatePhone } from '@/utils/validation'
import { deriveRoleCapabilities } from '@/utils/adminRoles'

const INITIAL_FORM = {
  email: '',
  password: '',
  confirm_password: '',
  first_name: '',
  last_name: '',
  phone_e164: '',
  car_model: '',
  package_id: '',
  country_code: '',
  city_id: '',
  district_id: '',
  postal_code: '',
  is_active: true,
}

const ACCOUNT_STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

function AddCustomer() {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canAccessBilling = roleCapabilities.canAccessBilling
  const { customerId } = useParams()
  const isEditMode = Boolean(customerId)
  const { showToast } = useInlineToast('customers')

  const [form, setForm] = useState(INITIAL_FORM)
  const [profileImage, setProfileImage] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [packageOptions, setPackageOptions] = useState([{ value: '', label: 'No package' }])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [countryOptions, setCountryOptions] = useState([])
  const [isCountriesLoading, setIsCountriesLoading] = useState(false)
  const [cityOptions, setCityOptions] = useState([])
  const [isCitiesLoading, setIsCitiesLoading] = useState(false)
  const [prefillCountryOption, setPrefillCountryOption] = useState(null)
  const [prefillCityOption, setPrefillCityOption] = useState(null)
  const [districtOptions, setDistrictOptions] = useState([])
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(false)
  const [prefillDistrictOption, setPrefillDistrictOption] = useState(null)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!form.country_code) {
      setCityOptions([])
      setIsCitiesLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setIsCitiesLoading(true)
    fetchCities({ countryCode: form.country_code, signal: controller.signal })
      .then((cities) => {
        if (cancelled) {
          return
        }
        if (Array.isArray(cities)) {
          const sorted = [...cities].sort((a, b) => a.name.localeCompare(b.name))
          setCityOptions(sorted)
        } else {
          setCityOptions([])
        }
      })
      .catch((cityError) => {
        if (!cancelled && cityError?.name !== 'AbortError') {
          console.error(cityError)
          showToast({
            title: 'Unable to load cities',
            message: cityError.message || 'Failed to load cities list.',
            variant: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCitiesLoading(false)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [form.country_code, showToast])

  useEffect(() => {
    if (!form.city_id) {
      setDistrictOptions([])
      setIsDistrictsLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setIsDistrictsLoading(true)
    fetchDistricts({ cityId: form.city_id, signal: controller.signal })
      .then((districts) => {
        if (cancelled) {
          return
        }
        if (Array.isArray(districts)) {
          const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name))
          setDistrictOptions(sorted)
        } else {
          setDistrictOptions([])
        }
      })
      .catch((districtError) => {
        if (!cancelled && districtError?.name !== 'AbortError') {
          console.error(districtError)
          showToast({
            title: 'Unable to load districts',
            message: districtError.message || 'Failed to load districts list.',
            variant: 'error',
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDistrictsLoading(false)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [form.city_id, showToast])

  useEffect(() => {
    if (!isEditMode || !customerId) {
      return
    }
    setIsLoading(true)
    fetch(`${API_BASE}/customers/${customerId}/`, {
      credentials: 'include',
      headers: appendAuthHeader(),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load customer')
        }
        return res.json()
      })
      .then((data) => {
        setForm((prev) => ({
          ...prev,
          email: data.email || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone_e164: data.phone_e164 || '',
          car_model: data.car_model || '',
          package_id: canAccessBilling ? data.package_id || data.package?.id || '' : '',
          country_code: data.country_code || '',
          city_id: data.city_id || '',
          district_id: data.district_id || '',
          postal_code: data.postal_code || '',
          is_active: data.is_active !== false,
          password: '',
          confirm_password: '',
        }))
        if (data.country_code) {
          setPrefillCountryOption({
            code: data.country_code,
            name: data.country || data.country_code,
          })
        } else {
          setPrefillCountryOption(null)
        }
        if (data.city_id) {
          setPrefillCityOption({
            id: data.city_id,
            name: data.city || 'Selected city',
          })
        } else {
          setPrefillCityOption(null)
        }
        if (data.district_id) {
          setPrefillDistrictOption({
            id: data.district_id,
            name: data.district || 'Selected district',
          })
        } else {
          setPrefillDistrictOption(null)
        }
        setProfileImage(null)
        const existingImageUrl = data.profile_image ? buildMediaUrl(data.profile_image) : null
        setProfileImagePreview(existingImageUrl)
      })
      .catch((error) => {
        console.error(error)
        showToast({
          title: 'Load failed',
          message: 'Unable to load customer details.',
          variant: 'error',
        })
        navigate('/customers', { replace: true })
      })
      .finally(() => setIsLoading(false))
  }, [canAccessBilling, isEditMode, customerId, navigate, showToast])

  useEffect(() => {
    if (!canAccessBilling) {
      setPackageOptions([{ value: '', label: 'No package' }])
      setPackagesLoading(false)
      return undefined
    }
    let cancelled = false
    const controller = new AbortController()
    const loadPackages = async () => {
      setPackagesLoading(true)
      try {
        const data = await fetchPackages({ includeInactive: true, signal: controller.signal })
        const list = Array.isArray(data) ? data : []
        const mapped = list.map((pkg) => ({
          value: pkg.id,
          label: pkg.description ? `${pkg.name} - ${pkg.description}` : pkg.name,
        }))
        if (!cancelled) {
          setPackageOptions([{ value: '', label: 'No package' }, ...mapped])
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
          showToast({
            title: 'Unable to load packages',
            message: error.message || 'Failed to load packages list.',
            variant: 'error',
          })
        }
      } finally {
        if (!cancelled) {
          setPackagesLoading(false)
        }
      }
    }
    loadPackages()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [canAccessBilling, showToast])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const loadCountries = async () => {
      setIsCountriesLoading(true)
      try {
        const countries = await fetchCountries({ signal: controller.signal })
        if (cancelled) {
          return
        }
        if (Array.isArray(countries)) {
          const sorted = [...countries].sort((a, b) => a.name.localeCompare(b.name))
          setCountryOptions(sorted)
        } else {
          setCountryOptions([])
        }
      } catch (countryError) {
        if (!cancelled && countryError?.name !== 'AbortError') {
          console.error(countryError)
          showToast({
            title: 'Unable to load countries',
            message: countryError.message || 'Failed to load countries list.',
            variant: 'error',
          })
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
      controller.abort()
    }
  }, [showToast])

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

  const handleCountrySelect = (eventOrValue) => {
    const nextValue =
      typeof eventOrValue === 'string'
        ? eventOrValue
        : eventOrValue?.target?.value ?? ''
    updateField('country_code', nextValue)
    updateField('city_id', '')
    updateField('district_id', '')
    if (nextValue) {
      const match =
        countryOptions.find((country) => country.code === nextValue) ||
        (prefillCountryOption && prefillCountryOption.code === nextValue ? prefillCountryOption : null)
      setPrefillCountryOption(
        match
          ? { code: nextValue, name: match.name || match.label || nextValue }
          : { code: nextValue, name: nextValue }
      )
    } else {
      setPrefillCountryOption(null)
    }
    setPrefillCityOption(null)
    setPrefillDistrictOption(null)
    setDistrictOptions([])
  }

  const handleCitySelect = (eventOrValue) => {
    const nextValue =
      typeof eventOrValue === 'string'
        ? eventOrValue
        : eventOrValue?.target?.value ?? ''
    updateField('city_id', nextValue)
    updateField('district_id', '')
    if (nextValue) {
      const match =
        mergedCityOptions.find((city) => city.id === nextValue) ||
        (prefillCityOption && prefillCityOption.id === nextValue ? prefillCityOption : null)
      setPrefillCityOption(
        match
          ? { id: nextValue, name: match.name || match.label || 'Selected city' }
          : { id: nextValue, name: 'Selected city' }
      )
    } else {
      setPrefillCityOption(null)
    }
    setPrefillDistrictOption(null)
    setDistrictOptions([])
  }

  const handleDistrictSelect = (eventOrValue) => {
    const nextValue =
      typeof eventOrValue === 'string'
        ? eventOrValue
        : eventOrValue?.target?.value ?? ''
    updateField('district_id', nextValue)
    if (nextValue) {
      const match =
        mergedDistrictOptions.find((district) => district.id === nextValue) ||
        (prefillDistrictOption && prefillDistrictOption.id === nextValue ? prefillDistrictOption : null)
      setPrefillDistrictOption(
        match
          ? { id: nextValue, name: match.name || match.label || 'Selected district' }
          : { id: nextValue, name: 'Selected district' }
      )
    } else {
      setPrefillDistrictOption(null)
    }
  }

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

  const countryDropdownOptions = useMemo(() => {
    const merged = [...countryOptions]
    if (
      form.country_code &&
      !merged.some((country) => country.code === form.country_code) &&
      prefillCountryOption
    ) {
      merged.push(prefillCountryOption)
    }
    const sorted = merged.sort((a, b) => a.name.localeCompare(b.name))
    const placeholder = isCountriesLoading ? 'Loading countries...' : 'Select country'
    return [
      { value: '', label: placeholder },
      ...sorted.map((country) => ({
        value: country.code,
        label: country.name,
      })),
    ]
  }, [countryOptions, form.country_code, prefillCountryOption, isCountriesLoading])

  const mergedCityOptions = useMemo(() => {
    const merged = [...cityOptions]
    if (
      form.city_id &&
      !merged.some((city) => city.id === form.city_id) &&
      prefillCityOption
    ) {
      merged.push(prefillCityOption)
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [cityOptions, form.city_id, prefillCityOption])

  const cityDropdownOptions = useMemo(
    () => [
      { value: '', label: cityPlaceholder },
      ...mergedCityOptions.map((city) => ({
        value: city.id,
        label: city.name,
      })),
    ],
    [cityPlaceholder, mergedCityOptions]
  )

  const districtPlaceholder = useMemo(() => {
    if (!form.city_id) {
      return 'Select a city first'
    }
    if (isDistrictsLoading) {
      return 'Loading districts...'
    }
    if (!districtOptions.length) {
      return 'No districts available'
    }
    return 'Select district'
  }, [form.city_id, districtOptions.length, isDistrictsLoading])

  const isDistrictSelectDisabled = useMemo(
    () => !form.city_id || isDistrictsLoading || !districtOptions.length,
    [form.city_id, isDistrictsLoading, districtOptions.length]
  )

  const mergedDistrictOptions = useMemo(() => {
    const merged = [...districtOptions]
    if (
      form.district_id &&
      !merged.some((district) => district.id === form.district_id) &&
      prefillDistrictOption
    ) {
      merged.push(prefillDistrictOption)
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [districtOptions, form.district_id, prefillDistrictOption])

  const districtDropdownOptions = useMemo(
    () => [
      { value: '', label: districtPlaceholder },
      ...mergedDistrictOptions.map((district) => ({
        value: district.id,
        label: district.name,
      })),
    ],
    [districtPlaceholder, mergedDistrictOptions]
  )

  const handleFileChange = (files) => {
    if (!files || !files.length) {
      return
    }
    const file = files[0]
    if (!file.type.startsWith('image/')) {
      showToast({
        title: 'Invalid file',
        message: 'Please select an image file.',
        variant: 'error',
      })
      return
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = URL.createObjectURL(file)
    setProfileImage(file)
    setProfileImagePreview(previewUrlRef.current)
  }

  const handlePackageChange = (eventOrValue) => {
    const nextValue =
      typeof eventOrValue === 'string'
        ? eventOrValue
        : eventOrValue?.target?.value ?? ''
    updateField('package_id', nextValue)
  }

  const handleActiveStatusChange = (eventOrValue) => {
    const nextValue =
      typeof eventOrValue === 'string'
        ? eventOrValue
        : eventOrValue?.target?.value ?? 'true'
    updateField('is_active', nextValue === 'true')
  }

  const validateForm = () => {
    const newErrors = {}

    const emailError = validateEmail(form.email, { required: true, label: 'Email' })
    if (emailError) {
      newErrors.email = emailError
    }
    const firstNameError = validateName(form.first_name, { required: true, label: 'First name' })
    if (firstNameError) {
      newErrors.first_name = firstNameError
    }
    const lastNameError = validateName(form.last_name, { required: true, label: 'Last name' })
    if (lastNameError) {
      newErrors.last_name = lastNameError
    }

    if (!form.country_code) {
      newErrors.country_code = 'Country is required'
    }
    if (!form.city_id) {
      newErrors.city_id = 'City is required'
    }
    if (!form.district_id) {
      newErrors.district_id = 'District is required'
    }

    const phoneError = validatePhone(form.phone_e164, {
      required: true,
      label: 'Mobile number',
      countryCode: form.country_code,
    })
    if (phoneError) {
      newErrors.phone_e164 = phoneError
    }
    const carModelError = validateName(form.car_model, { required: true, label: 'Car model' })
    if (carModelError) {
      newErrors.car_model = carModelError
    }

    const trimmedPassword = form.password.trim()
    const trimmedConfirmPassword = form.confirm_password.trim()
    const passwordFilled = Boolean(trimmedPassword || trimmedConfirmPassword)
    const passwordRequired = !isEditMode || passwordFilled
    const passwordError = validatePassword(trimmedPassword, { required: passwordRequired })
    if (passwordError) {
      newErrors.password = passwordError
    }
    if (passwordRequired) {
      if (!trimmedConfirmPassword) {
        newErrors.confirm_password = 'Confirm password is required'
      } else if (trimmedPassword && trimmedPassword !== trimmedConfirmPassword) {
        newErrors.confirm_password = 'Passwords do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) {
      showToast({
        title: 'Validation failed',
        message: 'Please fix the errors in the form.',
        variant: 'error',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('email', form.email.trim().toLowerCase())
      formData.append('first_name', form.first_name.trim())
      formData.append('last_name', form.last_name.trim())
      formData.append('phone_e164', form.phone_e164.trim())
      formData.append('car_model', form.car_model.trim())
      formData.append('country_code', form.country_code || '')
      formData.append('city_id', form.city_id || '')
      formData.append('district_id', form.district_id || '')
      formData.append('postal_code', form.postal_code.trim())
      if (canAccessBilling) {
        formData.append('package_id', form.package_id || '')
      }
      if (isEditMode && roleCapabilities.isSuperAdmin) {
        formData.append('is_active', String(Boolean(form.is_active)))
      }

      const passwordFilled = Boolean(form.password.trim() || form.confirm_password.trim())
      if (!isEditMode || passwordFilled) {
        formData.append('password', form.password.trim())
        formData.append('confirm_password', form.confirm_password.trim())
      }

      if (profileImage) {
        formData.append('profile_image', profileImage)
      }

      const url = isEditMode ? `${API_BASE}/customers/${customerId}/` : `${API_BASE}/customers/`
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: appendAuthHeader({ skipContentType: true }),
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 400 && data) {
          const fieldErrors = {}
          Object.entries(data).forEach(([key, value]) => {
            const normalizedKey =
              key === 'country'
                ? 'country_code'
                : key === 'city'
                ? 'city_id'
                : key === 'district'
                ? 'district_id'
                : key
            if (key === 'detail') {
              return
            }
            if (typeof value === 'string') {
              fieldErrors[normalizedKey] = value
            } else if (Array.isArray(value) && value.length) {
              fieldErrors[normalizedKey] = value[0]
            }
          })
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
            showToast({
              title: 'Validation failed',
              message: 'Please fix the errors in the form.',
              variant: 'error',
            })
            return
          }
        }
        throw new Error(data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} customer`)
      }

      showToast({
        title: isEditMode ? 'Customer updated' : 'Customer created',
        message: `Customer ${isEditMode ? 'updated' : 'created'} successfully.`,
        variant: 'success',
      })
      const nextCustomerId = data?.id ?? customerId ?? null
      if (nextCustomerId) {
        navigate(`/customers/${nextCustomerId}`, { replace: true })
      } else {
        navigate('/customers', { replace: true })
      }
    } catch (error) {
      console.error(error)
      showToast({
        title: isEditMode ? 'Update failed' : 'Create failed',
        message: error.message || `Unable to ${isEditMode ? 'update' : 'create'} customer.`,
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderInputField = (
    name,
    { label, type = 'text', placeholder = '', required = false, autoComplete, inputMode } = {}
  ) => {
    const inputId = `customer-${name}`
    const hasError = Boolean(errors[name])
    const describedBy = hasError ? `${inputId}-error` : undefined
    const value = form[name] ?? ''
    return (
      <div className="add-customer-field" key={name}>
        <label htmlFor={inputId} className="add-customer-label">
          {label}
          {required ? <span className="required-indicator">*</span> : null}
        </label>
        <input
          id={inputId}
          name={name}
          type={type}
          className={`add-customer-input${hasError ? ' has-error' : ''}`}
          value={value}
          onChange={(event) => updateField(name, event.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
        />
        {hasError ? (
          <span id={describedBy} className="add-customer-error">
            {errors[name]}
          </span>
        ) : null}
      </div>
    )
  }

  const heading = isEditMode ? 'Edit Customer' : 'Add Customer'
  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'User Management' },
    { label: 'Customers', to: '/customers' },
    { label: heading },
  ]
  const requiredFilled =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.phone_e164.trim() &&
    form.car_model.trim()
  const passwordComplete = isEditMode
    ? (form.password.trim() === '' && form.confirm_password.trim() === '') ||
      (form.password.trim() && form.confirm_password.trim())
    : form.password.trim() && form.confirm_password.trim()
  const saveLabel = isSubmitting ? 'Saving...' : 'Save'
  const isSaveDisabled =
    isSubmitting || isLoading || !requiredFilled || !passwordComplete

  const formContent = isLoading ? (
    <div className="data-placeholder">Loading customer details...</div>
  ) : (
    <form id="customer-form" onSubmit={handleSubmit} className="add-customer-form" noValidate>
      <section className="add-customer-card">
        <div className="add-customer-card__header">
          <div>
            <h2>Profile Image</h2>
            <p>Upload or update the customer profile photo.</p>
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

      <section className="add-customer-card">
        <div className="add-customer-card__header">
          <div>
            <h2>Register Details</h2>
            <p>{isEditMode ? 'Update credentials or leave fields blank to keep current password.' : 'Set the login credentials for this customer.'}</p>
          </div>
        </div>
        <div className="add-customer-grid two-column">
          {renderInputField('email', {
            label: 'Email',
            type: 'email',
            placeholder: 'Email address',
            required: true,
            autoComplete: 'email',
          })}
          {renderInputField('password', {
            label: 'Password',
            type: 'password',
            placeholder: isEditMode ? 'Enter new password' : 'Create a password',
            required: !isEditMode,
          })}
          {renderInputField('confirm_password', {
            label: 'Confirm Password',
            type: 'password',
            placeholder: 'Re-enter password',
            required: !isEditMode,
          })}
        </div>
      </section>

      <section className="add-customer-card">
        <div className="add-customer-card__header">
          <div>
            <h2>Customer Details</h2>
            <p>Provide the primary profile and location information.</p>
          </div>
        </div>
        <div className="add-customer-grid two-column">
          {renderInputField('first_name', {
            label: 'First Name',
            placeholder: 'Enter first name',
            required: true,
            autoComplete: 'given-name',
          })}
          {renderInputField('last_name', {
            label: 'Last Name',
            placeholder: 'Enter last name',
            required: true,
            autoComplete: 'family-name',
          })}
          {renderInputField('phone_e164', {
            label: 'Mobile Number',
            type: 'tel',
            placeholder: '+123456789',
            required: true,
            autoComplete: 'tel',
            inputMode: 'tel',
          })}
          {renderInputField('car_model', {
            label: 'Car Model',
            placeholder: 'e.g., Tesla Model 3',
            required: true,
            autoComplete: 'off',
          })}
          {isEditMode && roleCapabilities.isSuperAdmin ? (
            <div className="add-customer-field" key="is_active">
              <label htmlFor="customer-is-active" className="add-customer-label">
                Account Status
              </label>
              <PillDropdown
                id="customer-is-active"
                value={form.is_active ? 'true' : 'false'}
                onChange={handleActiveStatusChange}
                options={ACCOUNT_STATUS_OPTIONS}
                disabled={isSubmitting}
              />
            </div>
          ) : null}
          {canAccessBilling ? (
            <div className="add-customer-field" key="package_id">
              <label htmlFor="customer-package" className="add-customer-label">
                Package
              </label>
              <PillDropdown
                id="customer-package"
                value={form.package_id}
                onChange={handlePackageChange}
                options={packageOptions}
                className={errors.package_id ? 'has-error' : ''}
                disabled={isSubmitting || packagesLoading}
              />
              {errors.package_id ? (
                <span className="add-customer-error">{errors.package_id}</span>
              ) : null}
            </div>
          ) : null}
          <div className="add-customer-field" key="country_code">
            <label htmlFor="customer-country" className="add-customer-label">
              Country <span className="required-indicator">*</span>
            </label>
            <PillDropdown
              id="customer-country"
              value={form.country_code}
              onChange={handleCountrySelect}
              options={countryDropdownOptions}
              className={errors.country_code ? 'has-error' : ''}
              disabled={isSubmitting || isCountriesLoading}
            />
            {errors.country_code ? (
              <span className="add-customer-error">{errors.country_code}</span>
            ) : null}
          </div>
          <div className="add-customer-field" key="city_id">
            <label htmlFor="customer-city" className="add-customer-label">
              City <span className="required-indicator">*</span>
            </label>
            <PillDropdown
              id="customer-city"
              value={form.city_id}
              onChange={handleCitySelect}
              options={cityDropdownOptions}
              className={errors.city_id ? 'has-error' : ''}
              disabled={isSubmitting || isCitySelectDisabled}
            />
            {errors.city_id ? <span className="add-customer-error">{errors.city_id}</span> : null}
          </div>
          <div className="add-customer-field" key="district_id">
            <label htmlFor="customer-district" className="add-customer-label">
              District <span className="required-indicator">*</span>
            </label>
            <PillDropdown
              id="customer-district"
              value={form.district_id}
              onChange={handleDistrictSelect}
              options={districtDropdownOptions}
              className={errors.district_id ? 'has-error' : ''}
              disabled={isSubmitting || isDistrictSelectDisabled}
            />
            {errors.district_id ? (
              <span className="add-customer-error">{errors.district_id}</span>
            ) : null}
          </div>
          {renderInputField('postal_code', {
            label: 'Postal Code',
            placeholder: 'Postal code',
            autoComplete: 'postal-code',
          })}
        </div>
      </section>

      <footer className="add-customer-footer">
        <button
          type="button"
          className="ghost-button"
          onClick={() => navigate('/customers')}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={isSaveDisabled}>
          {saveLabel}
        </button>
      </footer>
    </form>
  )

  return (
    <div className="stations-page add-customer-page">
      <header className="add-entity-header">
        <div className="add-entity-heading">
          <Breadcrumbs items={breadcrumbs} />
          <div className="add-entity-title-row">
            <BackButton fallbackTo="/customers" ariaLabel="Back to customers" />
            <div>
              <h1>{heading}</h1>
              <p className="add-entity-subtitle">Manage customer credentials and profile</p>
            </div>
          </div>
        </div>
        <div className="add-entity-actions">
          <button type="submit" form="customer-form" className="primary-save-button" disabled={isSaveDisabled}>
            {saveLabel}
          </button>
        </div>
      </header>

      <InlineToastRegion region="customers" />

      {formContent}
    </div>
  )
}

export default AddCustomer
