import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { validateEmail, validateName } from '@/utils/validation'
import '@/styles/dashboard.css'

const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  position: '',
  role: '',
  password: '',
  confirm_password: '',
}

const roleLabel = (value) => {
  if (!value) return 'N/A'
  return value
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function MyAccount() {
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreview, setProfileImagePreview] = useState(null)
  const [profileImageRemoved, setProfileImageRemoved] = useState(false)
  const previewUrlRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)

  const { showToast } = useInlineToast('my-account')
  const outletContext = useOutletContext() || {}
  const { updateSessionUser } = outletContext

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      revokePreviewUrl()
    },
    [revokePreviewUrl]
  )

  const resetFormState = useCallback(
    (data) => {
      if (!data) {
        setForm(INITIAL_FORM)
        setProfileImageFile(null)
        setProfileImagePreview(null)
        setProfileImageRemoved(false)
        revokePreviewUrl()
        return
      }
      const existing = data.profile_image ? buildMediaUrl(data.profile_image) : null
      const bustedExisting = existing
        ? `${existing}${existing.includes('?') ? '&' : '?'}v=${Date.now()}`
        : null
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        position: data.position || '',
        role: data.role || '',
        password: '',
        confirm_password: '',
      })
      setProfileImageFile(null)
      setProfileImagePreview(bustedExisting)
      setProfileImageRemoved(false)
      revokePreviewUrl()
    },
    [revokePreviewUrl]
  )

  const fetchAccount = useCallback(async () => {
    setIsLoading(true)
    setErrors({})
    try {
      const response = await fetch(`${API_BASE}/accounts/me/`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to load account details.')
      }
      setAccount(data)
      resetFormState(data)
    } catch (error) {
      console.error(error)
      showToast({
        title: 'Load failed',
        message: error.message || 'Unable to load account details.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }, [resetFormState, showToast])

  useEffect(() => {
    fetchAccount()
  }, [fetchAccount])

  const updateField = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

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
    revokePreviewUrl()
    previewUrlRef.current = URL.createObjectURL(file)
    setProfileImageFile(file)
    setProfileImagePreview(previewUrlRef.current)
    setProfileImageRemoved(false)
  }

  const handleRemoveImage = () => {
    setProfileImageFile(null)
    setProfileImageRemoved(true)
    setProfileImagePreview(null)
    revokePreviewUrl()
  }

  const handleStartEditing = () => {
    setIsEditing(true)
    setErrors({})
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return
    const nextErrors = {}
    const firstNameError = validateName(form.first_name, { required: true, label: 'First name' })
    if (firstNameError) {
      nextErrors.first_name = firstNameError
    }
    const lastNameError = validateName(form.last_name, { required: true, label: 'Last name' })
    if (lastNameError) {
      nextErrors.last_name = lastNameError
    }
    const emailError = validateEmail(form.email, { required: true, label: 'Email' })
    if (emailError) {
      nextErrors.email = emailError
    }
    const positionError = validateName(form.position, { required: false, label: 'Position' })
    if (positionError) {
      nextErrors.position = positionError
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      showToast({
        title: 'Validation failed',
        message: 'Please fix the highlighted fields.',
        variant: 'error',
      })
      return
    }
    setIsSaving(true)
    setErrors({})
    try {
      const formData = new FormData()
      formData.append('first_name', form.first_name || '')
      formData.append('last_name', form.last_name || '')
      formData.append('email', form.email || '')
      formData.append('position', form.position || '')
      if (profileImageFile) {
        formData.append('profile_image', profileImageFile)
      } else if (profileImageRemoved) {
        formData.append('profile_image', '')
      }
      if (form.password) {
        formData.append('password', form.password)
      }
      if (form.confirm_password) {
        formData.append('confirm_password', form.confirm_password)
      }

      const response = await fetch(`${API_BASE}/accounts/me/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: appendAuthHeader(),
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        if (data && typeof data === 'object') {
          setErrors(data)
        }
        throw new Error(data?.detail || 'Unable to save changes.')
      }
      setAccount(data)
      resetFormState(data)
      if (typeof updateSessionUser === 'function') {
        updateSessionUser(data)
      }
      setIsEditing(false)
      showToast({
        title: 'Profile updated',
        message: 'Your account details have been saved successfully.',
        variant: 'success',
      })
    } catch (error) {
      console.error(error)
      if (!error.handled) {
        showToast({
          title: 'Save failed',
          message: error.message || 'Unable to save your changes.',
          variant: 'error',
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const profileImageSource = profileImagePreview
  const displayName =
    (account?.first_name || account?.last_name) ?
      `${account.first_name ?? ''} ${account.last_name ?? ''}`.trim() :
      account?.email || 'Account'
  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'Settings' },
    { label: 'My Account' },
  ]

  const infoFields = useMemo(
    () => [
      { label: 'First Name', value: account?.first_name || 'N/A' },
      { label: 'Last Name', value: account?.last_name || 'N/A' },
      { label: 'Email', value: account?.email || 'N/A' },
      { label: 'Role', value: roleLabel(account?.role) },
      { label: 'Position', value: account?.position || 'N/A' },
      {
        label: 'Last Login',
        value: account?.last_login_at
          ? new Date(account.last_login_at).toLocaleString()
          : 'N/A',
      },
    ],
    [account]
  )

  const requiredComplete =
    form.first_name.trim() && form.last_name.trim() && form.email.trim()

  const saveLabel = isSaving ? 'Saving...' : 'Save'
  const formId = 'my-account-form'

  const renderTextInput = (name, { label, type = 'text', placeholder = '', required = false, readOnly = false } = {}) => {
    const inputId = `my-account-${name}`
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
          value={value}
          onChange={(event) => updateField(name, event.target.value)}
          placeholder={placeholder}
          className={`add-customer-input${hasError ? ' has-error' : ''}`}
          disabled={isSaving || readOnly}
          readOnly={readOnly}
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

  return (
    <div className="my-account-page">
      <header className="my-account-header">
        <div>
          <Breadcrumbs items={breadcrumbs} />
          <h1>My Account</h1>
        </div>
        <div className="my-account-header-actions">
          {!isEditing && (
            <button
              type="button"
              className="primary-button"
              onClick={handleStartEditing}
              disabled={isLoading}
            >
                Edit  
            </button>
          )}
          {isEditing ? (
            <button
              type="submit"
              form={formId}
              className="primary-button"
              disabled={isSaving || !requiredComplete}
            >
              {saveLabel}
            </button>
          ) : null}
        </div>
      </header>

      <InlineToastRegion region="my-account" />

      {isLoading ? (
        <div className="data-placeholder">Loading your profile...</div>
      ) : (
        <>
          {!isEditing && (
            <>
              <section className="customer-hero-card my-account-hero-card">
                <div className="customer-hero-info">
                  <div className="customer-hero-avatar" aria-hidden="true">
                    {profileImageSource ? (
                      <img src={profileImageSource} alt={`${displayName} profile`} />
                    ) : (
                      (displayName || 'A').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="customer-hero-meta">
                    <h2>{displayName}</h2>
                    <p>{account?.email || 'N/A'}</p>
                    <span className="status-badge charger-status-badge">
                      {roleLabel(account?.role)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="customer-card">
                <div className="customer-card-header">
                  <h3>Profile Overview</h3>
                </div>
                <div className="customer-info-grid">
                  {infoFields.map((field) => (
                    <div className="customer-info-field" key={field.label}>
                      <span className="customer-info-label">{field.label}</span>
                      <span className="customer-info-value">{field.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {isEditing && (
            <form
              id={formId}
              className="add-customer-form my-account-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <section className="add-customer-card">
                <div className="add-customer-card__header">
                  <div>
                    <h2>Profile Image</h2>
                  </div>
                  
                </div>
                <div className="add-customer-profile">
                  <div className="add-customer-preview" aria-live="polite">
                    {profileImageSource ? (
                      <img src={profileImageSource} alt="Profile preview" />
                    ) : (
                      <span className="add-customer-preview__placeholder">No image selected</span>
                    )}
                  </div>
                  <label className="add-customer-upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange(event.target.files)}
                      disabled={isSaving}
                    />
                    <span>Upload profile image</span>
                    <p>PNG or JPG, square image recommended.</p>
                  </label>
                </div>
              </section>

              <section className="add-customer-card">
                <div className="add-customer-card__header">
                  <div>
                    <h2>Account Details</h2>
                    <p>Update your personal information.</p>
                  </div>
                </div>
                <div className="add-customer-grid two-column">
                  {renderTextInput('first_name', {
                    label: 'First Name',
                    placeholder: 'Your first name',
                    required: true,
                  })}
                  {renderTextInput('last_name', {
                    label: 'Last Name',
                    placeholder: 'Your last name',
                    required: true,
                  })}
                  {renderTextInput('email', {
                    label: 'Email',
                    type: 'email',
                    placeholder: 'you@example.com',
                    required: true,
                  })}
                  {renderTextInput('position', {
                    label: 'Position',
                    placeholder: 'Your role title',
                  })}
                  {renderTextInput('role', {
                    label: 'Role',
                    readOnly: true,
                  })}
                </div>
              </section>

              <section className="add-customer-card">
                <div className="add-customer-card__header">
                  <div>
                    <h2>Change Password</h2>
                    <p>Leave blank to keep your current password.</p>
                  </div>
                </div>
                <div className="add-customer-grid two-column">
                  {renderTextInput('password', {
                    label: 'New Password',
                    type: 'password',
                    placeholder: 'Enter new password',
                  })}
                  {renderTextInput('confirm_password', {
                    label: 'Confirm Password',
                    type: 'password',
                    placeholder: 'Re-enter new password',
                  })}
                </div>
              </section>

              {errors.detail ? (
                <div className="data-warning">{errors.detail}</div>
              ) : null}
            </form>
          )}
        </>
      )}
    </div>
  )
}

export default MyAccount
