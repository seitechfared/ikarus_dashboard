import { useEffect, useRef, useState } from 'react'
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
import { ADMIN_ROLE_OPTIONS, canonicalizeAdminRole } from './adminRoleUtils'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import { validateEmail, validateName } from '@/utils/validation'

const EyeIcon = () => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.5 12s3.6-7 10.5-7 10.5 7 10.5 7-3.6 7-10.5 7S1.5 12 1.5 12Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const EyeOffIcon = () => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M3 5.5 20 20.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M9.42 9.62A3 3 0 0 0 12 15a3 3 0 0 0 2.58-5.38"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.1 7.1A12.4 12.4 0 0 1 12 5c6.9 0 10.5 7 10.5 7a13.46 13.46 0 0 1-3.24 4.24m-4 2A12.39 12.39 0 0 1 12 19c-6.9 0-10.5-7-10.5-7a13.46 13.46 0 0 1 2.72-3.63"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DEFAULT_ROLE = 'operation'

const trimValue = (value) => (typeof value === 'string' ? value.trim() : '')

const deriveNameParts = (data) => {
  const directFirst = trimValue(data?.first_name ?? data?.firstName)
  const directLast = trimValue(data?.last_name ?? data?.lastName)
  if (directFirst || directLast) {
    return { firstName: directFirst, lastName: directLast }
  }
  if (!data?.name) {
    return { firstName: '', lastName: '' }
  }
  const trimmed = data.name.trim()
  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }
  const [firstName, ...rest] = trimmed.split(/\s+/)
  return {
    firstName,
    lastName: rest.join(' ').trim(),
  }
}

function AddAdmin() {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const roleCapabilities = outletContext.capabilities ?? deriveRoleCapabilities()
  const canManageAdmins = roleCapabilities.canEdit
  const { adminId } = useParams()
  const isEditMode = Boolean(adminId)
  const { showToast } = useInlineToast('admins')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: DEFAULT_ROLE,
    position: '',
  })
  const [profileImage, setProfileImage] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isEditMode && adminId) {
      setIsLoading(true)
      fetch(`${API_BASE}/admins/${adminId}/`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to load admin')
          }
          return res.json()
        })
        .then((data) => {
          const { firstName, lastName } = deriveNameParts(data)
          setForm({
            first_name: firstName,
            last_name: lastName,
            email: data.email || '',
            password: '',
            role: canonicalizeAdminRole(data.role) || DEFAULT_ROLE,
            position: trimValue(data.position),
          })
          setShowPassword(false)
          setProfileImage(null)
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
          }
          setProfileImagePreview(
            data.profile_image ? buildMediaUrl(data.profile_image) : null
          )
        })
        .catch((err) => {
          console.error(err)
          showToast({
            title: 'Load failed',
            message: 'Unable to load admin details.',
            variant: 'error',
          })
          navigate('/admins', { replace: true })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [isEditMode, adminId, navigate, showToast])

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

  const handleFileChange = (files) => {
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
    } else {
      showToast({
        title: 'Invalid file',
        message: 'Please select an image file.',
        variant: 'error',
      })
    }
  }

  const validateForm = () => {
    const newErrors = {}
    const firstName = trimValue(form.first_name)
    const lastName = trimValue(form.last_name)
    const email = trimValue(form.email)
    const passwordValue = trimValue(form.password)

    const firstNameError = validateName(firstName, { required: true, label: 'First name' })
    if (firstNameError) {
      newErrors.first_name = firstNameError
    }
    const lastNameError = validateName(lastName, { required: true, label: 'Last name' })
    if (lastNameError) {
      newErrors.last_name = lastNameError
    }
    const emailError = validateEmail(email, { required: true, label: 'Email' })
    if (emailError) {
      newErrors.email = emailError
    }
    const positionError = validateName(form.position, { required: false, label: 'Position' })
    if (positionError) {
      newErrors.position = positionError
    }

    if (!form.role) {
      newErrors.role = 'Role is required'
    } else if (!ADMIN_ROLE_OPTIONS.some((option) => option.value === form.role)) {
      newErrors.role = 'Please select a valid role'
    }

    const passwordRequired = !isEditMode
    const passwordError = validatePassword(form.password, { required: passwordRequired })
    if (passwordError) {
      newErrors.password = passwordError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      const firstName = trimValue(form.first_name)
      const lastName = trimValue(form.last_name)
      const email = trimValue(form.email)
      const passwordValue = trimValue(form.password)
      const position = trimValue(form.position)
      const formData = new FormData()
      formData.append('first_name', firstName)
      formData.append('last_name', lastName)
      formData.append('email', email)
      const selectedRole =
        ADMIN_ROLE_OPTIONS.find((option) => option.value === form.role)?.value ?? DEFAULT_ROLE
      formData.append('role', selectedRole)
      if (passwordValue) {
        formData.append('password', passwordValue)
      }
      formData.append('position', position)
      if (profileImage) {
        formData.append('profile_image', profileImage)
      }

      const url = isEditMode
        ? `${API_BASE}/admins/${adminId}/`
        : `${API_BASE}/admins/`
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: appendAuthHeader({ skipContentType: true }),
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 400) {
          const fieldErrors = {}
          if (data.first_name) {
            fieldErrors.first_name = Array.isArray(data.first_name)
              ? data.first_name[0]
              : data.first_name
          }
          if (data.last_name) {
            fieldErrors.last_name = Array.isArray(data.last_name) ? data.last_name[0] : data.last_name
          }
          if (data.email) {
            fieldErrors.email = Array.isArray(data.email) ? data.email[0] : data.email
          }
          if (data.role) {
            fieldErrors.role = Array.isArray(data.role) ? data.role[0] : data.role
          }
          if (data.password) {
            fieldErrors.password = Array.isArray(data.password) ? data.password[0] : data.password
          }
          if (data.position) {
            fieldErrors.position = Array.isArray(data.position) ? data.position[0] : data.position
          }
          if (data.name && !fieldErrors.first_name) {
            fieldErrors.first_name = Array.isArray(data.name) ? data.name[0] : data.name
          }
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
        throw new Error(data.detail || `Failed to ${isEditMode ? 'update' : 'create'} admin`)
      }

      showToast({
        title: isEditMode ? 'Admin updated' : 'Admin created',
        message: `Admin ${isEditMode ? 'updated' : 'created'} successfully.`,
        variant: 'success',
      })
      const nextAdminId = data?.id ?? adminId ?? null
      if (nextAdminId) {
        navigate(`/admins/${nextAdminId}`, { replace: true })
      } else {
        navigate('/admins', { replace: true })
      }
    } catch (error) {
      console.error(error)
      showToast({
        title: isEditMode ? 'Update failed' : 'Create failed',
        message: error.message || `Unable to ${isEditMode ? 'update' : 'create'} admin.`,
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderInputField = (
    field,
    { label, type = 'text', placeholder = '', required = false, autoComplete } = {}
  ) => {
    const inputId = `admin-${field}`
    const hasError = Boolean(errors[field])
    const describedBy = hasError ? `${inputId}-error` : undefined
    const value = form[field] ?? ''
    return (
      <div className="add-customer-field" key={field}>
        <label htmlFor={inputId} className="add-customer-label">
          {label}
          {required ? <span className="required-indicator">*</span> : null}
        </label>
        <input
          id={inputId}
          name={field}
          type={type}
          className={`add-customer-input${hasError ? ' has-error' : ''}`}
          value={value}
          onChange={(event) => updateField(field, event.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
        />
        {hasError ? (
          <span id={describedBy} className="add-customer-error">
            {errors[field]}
          </span>
        ) : null}
      </div>
    )
  }

  const renderRoleField = () => {
    const inputId = 'admin-role'
    const hasError = Boolean(errors.role)
    const describedBy = hasError ? `${inputId}-error` : undefined
    return (
      <div className="add-customer-field">
        <label htmlFor={inputId} className="add-customer-label">
          Role <span className="required-indicator">*</span>
        </label>
        <select
          id={inputId}
          className={`add-customer-input${hasError ? ' has-error' : ''}`}
          value={form.role}
          onChange={(event) => updateField('role', event.target.value)}
          disabled={isSubmitting}
          required
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
        >
          {ADMIN_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasError ? (
          <span id={describedBy} className="add-customer-error">
            {errors.role}
          </span>
        ) : null}
      </div>
    )
  }

  const renderPasswordField = () => {
    const inputId = 'admin-password'
    const hasError = Boolean(errors.password)
    const describedBy = hasError ? `${inputId}-error` : undefined
    const isPasswordRequired = !isEditMode
    const passwordPlaceholder = isEditMode ? 'Enter new password (optional)' : 'Create a password'
    return (
      <div className="add-customer-field">
        <label htmlFor={inputId} className="add-customer-label">
          Password{' '}
          {isPasswordRequired ? (
            <span className="required-indicator">*</span>
          ) : (
            <span className="field-optional-hint">(Optional)</span>
          )}
        </label>
        <div className="add-customer-password">
          <input
            id={inputId}
            name="password"
            type={showPassword ? 'text' : 'password'}
            className={`add-customer-input${hasError ? ' has-error' : ''}`}
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            placeholder={passwordPlaceholder}
            disabled={isSubmitting}
            required={isPasswordRequired}
            autoComplete="new-password"
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            className="add-customer-password__toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        <p className="field-optional-hint">
          Must include uppercase, lowercase, number, and special character.
        </p>
        {hasError ? (
          <span id={describedBy} className="add-customer-error">
            {errors.password}
          </span>
        ) : null}
      </div>
    )
  }

  const trimmedFirstName = trimValue(form.first_name)
  const trimmedLastName = trimValue(form.last_name)
  const trimmedEmail = trimValue(form.email)
  const trimmedPassword = trimValue(form.password)
  const passwordRequired = !isEditMode
  const requiredFieldsFilled = Boolean(
    trimmedFirstName &&
      trimmedLastName &&
      trimmedEmail &&
      form.role &&
      (passwordRequired ? trimmedPassword : true)
  )
  const pageTitle = isEditMode ? 'Edit Admin' : 'Add Admin'
  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'Admins', to: '/admins' },
    { label: pageTitle },
  ]
  const subtitle = 'Manage admin credentials and profile'
  const saveLabel = isSubmitting ? 'Saving...' : isEditMode ? 'Save' : 'Save'

  if (!canManageAdmins) {
    return (
      <div className="stations-page">
        <header className="stations-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Admins' }]} />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
                <h1>Admins</h1>
              </div>
            </div>
          </div>
        </header>
        <InlineToastRegion region="admins" />
        <div className="data-warning">
          You do not have permission to add or edit admins. Please contact a Super Admin.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="stations-page">
        <header className="stations-header">
          <div className="page-heading-left">
            <div className="page-heading-titles">
              <Breadcrumbs
                items={[
                  { label: 'Home', to: '/overview' },
                  { label: 'Admins', to: '/admins' },
                  { label: isEditMode ? 'Edit Admin' : 'Add Admin' },
                ]}
              />
              <div className="page-heading-title-row">
                <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
                <h1>{isEditMode ? 'Edit Admin' : 'Add Admin'}</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="data-placeholder">Loading admin details…</div>
      </div>
    )
  }

  return (
    <div className="stations-page add-customer-page">
      <header className="add-entity-header">
        <div className="add-entity-heading">
          <Breadcrumbs items={breadcrumbs} />
          <div className="add-entity-title-row">
            <BackButton fallbackTo="/admins" ariaLabel="Back to admins" />
            <div>
              <h1>{pageTitle}</h1>
              <p className="add-entity-subtitle">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="add-entity-actions">
          <button
            type="submit"
            form="admin-form"
            className="primary-save-button"
            disabled={isSubmitting || !requiredFieldsFilled}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      <InlineToastRegion region="admins" />

      <form id="admin-form" onSubmit={handleSubmit} className="add-station-form add-customer-form">
        <section className="add-customer-card">
          <div className="add-customer-card__header">
            <div>
              <h2>Profile Image</h2>
              <p>Upload or update the admin profile photo.</p>
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
              <h2>Admin Details</h2>
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
            {renderInputField('email', {
              label: 'Email',
              type: 'email',
              placeholder: 'Email address',
              required: true,
              autoComplete: 'email',
            })}
            {renderPasswordField()}
            {renderRoleField()}
            {renderInputField('position', {
              label: 'Position',
              placeholder: 'Job title or department',
              autoComplete: 'organization-title',
            })}
          </div>
        </section>

        <div className="add-customer-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/admins')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting || !requiredFieldsFilled}
            style={{ minWidth: '160px' }}
          >
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddAdmin
