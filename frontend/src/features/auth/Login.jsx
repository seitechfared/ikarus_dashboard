import { useEffect, useState } from 'react'
import { API_BASE, LOGIN_LOGO_URL } from '@/constants'
import { consumeSessionExpired, normalizeUser } from '@/utils/session'
import { validateEmail } from '@/utils/validation'
import '@/styles/login.css'

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
    <path
      d="M3 5.5 20 20.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
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

const backgroundImage = '/assets/login-background.png'
const EMAIL_ERROR_MESSAGE = 'Enter a valid email address'
const PASSWORD_ERROR_MESSAGE = 'Wrong password, ask your admin if you forget it'

function Login({ onAuthenticated }) {
  const [showPassword, setShowPassword] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Login'
    }
    if (consumeSessionExpired()) {
      setFormError('Your session expired. Please log in again.')
    }
  }, [])

  return (
    <div className="login-page">
      <div className="background" aria-hidden="true">
        <img src={backgroundImage} alt="" className="background-image" />
        <div className="background-overlay" />
      </div>

      <div className="login-content">
        <header className="brand">
          {logoFailed ? (
            <div className="brand-fallback">
              <span className="brand-accent">IKARUS</span>
              <span className="brand-secondary">Electric</span>
            </div>
          ) : (
            <img
              src={LOGIN_LOGO_URL}
              alt="Ikarus Electric"
              onError={() => setLogoFailed(true)}
            />
          )}
        </header>

        <main className="hero-section">
          <div className="hero-copy">
            <h1 className="hero-title hero-slogan" aria-label="Charging Up the future">
              <span className="slogan-accent">Charging&nbsp;</span>
              <span className="slogan-text">Up the&nbsp;</span>
              <span className="slogan-accent">future</span>
            </h1>
          </div>

          <section className="login-card" aria-labelledby="login-heading">
            <h2 id="login-heading">Login</h2>

            <form
                className="login-form"
                onSubmit={async (event) => {
                  event.preventDefault()

                const trimmedEmail = email.trim()
                const trimmedPassword = password.trim()

                let emailError = ''
                let passwordError = ''

                if (validateEmail(trimmedEmail, { required: true, label: 'Email' })) {
                  emailError = EMAIL_ERROR_MESSAGE
                }

                if (!trimmedPassword) {
                  passwordError = PASSWORD_ERROR_MESSAGE
                }

                setError({ email: emailError, password: passwordError })

                if (emailError || passwordError) {
                  return
                }

                try {
                  setIsSubmitting(true)
                  setFormError('')
                  const response = await fetch(`${API_BASE}/auth/login/`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
                  })

                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    const detail = (data.detail || '').toLowerCase()
                    const isEmailIssue =
                      response.status === 404 || detail.includes('email') || detail.includes('user')
                    setError({
                      email: isEmailIssue ? EMAIL_ERROR_MESSAGE : '',
                      password: isEmailIssue ? '' : PASSWORD_ERROR_MESSAGE,
                    })
                    return
                  }

                  let data = {}
                  if (response.status !== 204) {
                    data = await response.json().catch(() => ({}))
                  }

                  let userPayload = data.user
                  const sessionToken =
                    data.token || userPayload?.token || userPayload?.auth_token || null
                  const authHeaders = sessionToken
                    ? { Authorization: `Bearer ${sessionToken}` }
                    : undefined

                  if (!userPayload) {
                    try {
                      const meResponse = await fetch(`${API_BASE}/auth/me/`, {
                        credentials: 'include',
                        headers: authHeaders,
                      })
                      if (meResponse.ok) {
                        const meData = await meResponse.json().catch(() => ({}))
                        userPayload = meData.user || meData
                      }
                    } catch (profileError) {
                      console.warn('Unable to read session profile after login', profileError)
                    }
                  }

                  const nextUser =
                    normalizeUser(userPayload, {
                      email: trimmedEmail,
                      role: data.role || 'user',
                    }) || {
                      email: trimmedEmail,
                      role: data.role || 'user',
                    }

                  onAuthenticated({
                    user: nextUser,
                    token: sessionToken,
                    refreshToken: data.refresh_token || userPayload?.refresh_token || null,
                    expiresAt: data.expires_at || userPayload?.expires_at || null,
                  })
                  setEmail('')
                  setPassword('')
                } catch (apiError) {
                  console.error(apiError)
                  setFormError('Unable to reach the server. Please try again.')
                } finally {
                  setIsSubmitting(false)
                }
              }}
              noValidate
            >
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Your email here"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (error.email) {
                    setError((prev) => ({ ...prev, email: '' }))
                  }
                }}
                aria-invalid={Boolean(error.email)}
                aria-describedby={error.email ? 'email-error' : undefined}
              />
              {error.email ? (
                <span id="email-error" className="field-error">
                  {error.email}
                </span>
              ) : null}

              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (error.password) {
                      setError((prev) => ({ ...prev, password: '' }))
                    }
                  }}
                  aria-invalid={Boolean(error.password)}
                  aria-describedby={
                    error.password ? 'password-error' : undefined
                  }
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {error.password ? (
                <span id="password-error" className="field-error">
                  {error.password}
                </span>
              ) : null}

              {formError ? <p className="form-error">{formError}</p> : null}

              <button type="submit" className="login-button" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Login'}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Login
