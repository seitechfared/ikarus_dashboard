import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { buildMediaUrl } from '@/utils/media'
import { defaultTheme, normalizeTheme } from '@/utils/theme'
import { fetchThemeSettings, updateThemeSettings } from '@/services/themeSettingsApi'
import '@/styles/dashboard.css'

const COLOR_OPTIONS = [
  '#74A42D',
  '#124D5E',
  '#34C759',
  '#00C0E8',
  '#0088FF',
  '#6155F5',
  '#CB30E0',
  '#FF2D96',
  '#FF383C',
  '#FF8D28',
  '#FFCC00',
  '#00C8B3',
  '#AC7F5E',
  '#000000',
]

function ThemeSettingsPage() {
  const {
    themeSettings,
    updateThemePreview,
    clearThemePreview,
    commitThemeSettings,
    capabilities,
  } = useOutletContext() || {}
  const { pushError, pushSuccess } = useInlineToast('settings')
  const canEdit = Boolean(capabilities?.canEdit)
  const [primary, setPrimary] = useState(defaultTheme.primary)
  const [secondary, setSecondary] = useState(defaultTheme.secondary)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const previewUrlRef = useRef(null)
  const fileInputRef = useRef(null)

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    if (themeSettings) {
      return undefined
    }

    const loadSettings = async () => {
      try {
        const data = await fetchThemeSettings()
        if (!isMounted) {
          return
        }
        const normalized = normalizeTheme(data)
        commitThemeSettings?.(normalized)
      } catch (error) {
        if (isMounted) {
          pushError(error.message || 'Unable to load settings.')
        }
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [themeSettings, commitThemeSettings, pushError])

  useEffect(() => {
    const normalized = normalizeTheme(themeSettings || defaultTheme)
    revokePreviewUrl()
    setLogoFile(null)
    setPrimary(normalized.primary)
    setSecondary(normalized.secondary)
    setLogoPreview(normalized.logo || null)
  }, [themeSettings, revokePreviewUrl])

  useEffect(() => {
    if (!updateThemePreview) {
      return
    }
    updateThemePreview({ primary, secondary, logo: logoPreview })
  }, [primary, secondary, logoPreview, updateThemePreview])

  useEffect(() => {
    return () => {
      revokePreviewUrl()
      clearThemePreview?.()
    }
  }, [clearThemePreview, revokePreviewUrl])

  const swatchOptions = useMemo(
    () =>
      COLOR_OPTIONS.map((color) => ({
        value: color,
        label: color,
      })),
    []
  )

  const handleLogoClick = () => {
    if (!canEdit) {
      return
    }
    fileInputRef.current?.click()
  }

  const handleLogoChange = (event) => {
    if (!canEdit) {
      return
    }
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      pushError('Please select an image file.')
      return
    }
    revokePreviewUrl()
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setLogoFile(file)
    setLogoPreview(previewUrl)
  }

  const handleSave = async () => {
    if (!canEdit) {
      return
    }
    if (!primary || !secondary) {
      pushError('Please select both primary and secondary colors.')
      return
    }
    if (isSaving) {
      return
    }
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('primary', primary)
      formData.append('secondary', secondary)
      if (logoFile) {
        formData.append('logo', logoFile)
      }
      const data = await updateThemeSettings(formData)
      const normalized = normalizeTheme(data)
      revokePreviewUrl()
      setLogoFile(null)
      setPrimary(normalized.primary)
      setSecondary(normalized.secondary)
      setLogoPreview(normalized.logo || null)
      commitThemeSettings?.(normalized)
      pushSuccess('Theme settings saved.')
    } catch (error) {
      pushError(error.message || 'Unable to save settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2 className="settings-title">Theme</h2>
          <p className="settings-description">Manage logo and dashboard theme colors.</p>
        </div>
        <button
          type="button"
          className="settings-save-button"
          onClick={handleSave}
          disabled={isSaving || !canEdit}
        >
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      <InlineToastRegion region="settings" />

      <section className="settings-card">
        <h2 className="settings-card-title">Your Logo</h2>
        <div
          className={`settings-logo-card ${logoPreview ? 'has-logo' : ''}`.trim()}
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleLogoClick()
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="settings-logo-input"
            onChange={handleLogoChange}
            disabled={!canEdit}
          />
          {logoPreview ? (
            <img
              src={buildMediaUrl(logoPreview)}
              alt="Entity logo preview"
              className="settings-logo-preview"
            />
          ) : (
            <>
              <div className="settings-logo-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M19.375 10.0013C19.3789 11.4897 18.896 12.9386 18 14.127C17.9506 14.1927 17.8888 14.248 17.8181 14.2898C17.7474 14.3316 17.6691 14.359 17.5878 14.3705C17.5065 14.3821 17.4237 14.3775 17.3442 14.357C17.2646 14.3365 17.1899 14.3006 17.1242 14.2513C17.0585 14.2019 17.0032 14.1401 16.9615 14.0694C16.9197 13.9987 16.8923 13.9204 16.8807 13.8391C16.8692 13.7578 16.8738 13.675 16.8942 13.5954C16.9147 13.5159 16.9506 13.4411 17 13.3755C17.7334 12.4038 18.1286 11.2187 18.125 10.0013C18.125 8.50942 17.5324 7.07867 16.4775 6.02378C15.4226 4.96889 13.9918 4.37626 12.5 4.37626C11.0081 4.37626 9.5774 4.96889 8.52251 6.02378C7.46762 7.07867 6.87499 8.50942 6.87499 10.0013C6.87499 10.167 6.80914 10.326 6.69193 10.4432C6.57472 10.5604 6.41575 10.6263 6.24999 10.6263C6.08423 10.6263 5.92526 10.5604 5.80805 10.4432C5.69084 10.326 5.62499 10.167 5.62499 10.0013C5.62468 9.37054 5.71117 8.74277 5.88202 8.13563C5.79686 8.12626 5.71093 8.12626 5.62499 8.12626C4.63043 8.12626 3.6766 8.52135 2.97334 9.22461C2.27008 9.92787 1.87499 10.8817 1.87499 11.8763C1.87499 12.8708 2.27008 13.8246 2.97334 14.5279C3.6766 15.2312 4.63043 15.6263 5.62499 15.6263H7.49999C7.66575 15.6263 7.82472 15.6921 7.94193 15.8093C8.05914 15.9265 8.12499 16.0855 8.12499 16.2513C8.12499 16.417 8.05914 16.576 7.94193 16.6932C7.82472 16.8104 7.66575 16.8763 7.49999 16.8763H5.62499C4.93763 16.8764 4.25761 16.7348 3.62742 16.4604C2.99723 16.1859 2.43039 15.7845 1.96231 15.2811C1.49423 14.7778 1.13497 14.1833 0.906956 13.5349C0.678942 12.8864 0.587077 12.1979 0.637098 11.5124C0.687119 10.8269 0.877952 10.159 1.19768 9.55052C1.5174 8.94204 1.95915 8.40602 2.49534 7.97594C3.03153 7.54586 3.65063 7.23095 4.31399 7.05088C4.97735 6.87081 5.67071 6.82945 6.35077 6.92938C7.04327 5.54435 8.18307 4.43366 9.58555 3.77722C10.988 3.12078 12.5711 2.95704 14.0782 3.31251C15.5854 3.66799 16.9284 4.52186 17.8897 5.73583C18.851 6.94979 19.3744 8.45275 19.375 10.0013ZM12.3172 9.55907C12.2591 9.50096 12.1902 9.45486 12.1143 9.42341C12.0385 9.39196 11.9571 9.37577 11.875 9.37577C11.7929 9.37577 11.7115 9.39196 11.6357 9.42341C11.5598 9.45486 11.4908 9.50096 11.4328 9.55907L8.9328 12.0591C8.87473 12.1171 8.82867 12.1861 8.79724 12.2619C8.76582 12.3378 8.74964 12.4191 8.74964 12.5013C8.74964 12.5834 8.76582 12.6647 8.79724 12.7406C8.82867 12.8164 8.87473 12.8854 8.9328 12.9434C9.05008 13.0607 9.20914 13.1266 9.37499 13.1266C9.45711 13.1266 9.53843 13.1104 9.6143 13.079C9.69017 13.0476 9.75911 13.0015 9.81718 12.9434L11.25 11.5099V16.2513C11.25 16.417 11.3158 16.576 11.433 16.6932C11.5503 16.8104 11.7092 16.8763 11.875 16.8763C12.0407 16.8763 12.1997 16.8104 12.3169 16.6932C12.4341 16.576 12.5 16.417 12.5 16.2513V11.5099L13.9328 12.9434C13.9909 13.0015 14.0598 13.0476 14.1357 13.079C14.2115 13.1104 14.2929 13.1266 14.375 13.1266C14.4571 13.1266 14.5384 13.1104 14.6143 13.079C14.6902 13.0476 14.7591 13.0015 14.8172 12.9434C14.8752 12.8854 14.9213 12.8164 14.9527 12.7406C14.9842 12.6647 15.0003 12.5834 15.0003 12.5013C15.0003 12.4191 14.9842 12.3378 14.9527 12.2619C14.9213 12.1861 14.8752 12.1171 14.8172 12.0591L12.3172 9.55907Z"
                    fill="var(--theme-secondary)"
                  />
                </svg>
              </div>
              <span className="settings-logo-label">Entity Logo</span>
            </>
          )}
        </div>
      </section>

      <section className="settings-card settings-card--left">
        <h2 className="settings-card-title">Your Colors</h2>
        <div className="settings-color-block">
          <h3 className="settings-color-title">Primary</h3>
          <div className="settings-color-grid">
            {swatchOptions.map((option) => (
              <button
                key={`primary-${option.value}`}
                type="button"
                className={`settings-color-swatch ${primary === option.value ? 'active' : ''}`}
                style={{ backgroundColor: option.value }}
                onClick={() => (canEdit ? setPrimary(option.value) : null)}
                disabled={!canEdit}
                aria-pressed={primary === option.value}
                title={option.label}
              />
            ))}
          </div>
        </div>
        <div className="settings-color-block">
          <h3 className="settings-color-title">Secondary</h3>
          <div className="settings-color-grid">
            {swatchOptions.map((option) => (
              <button
                key={`secondary-${option.value}`}
                type="button"
                className={`settings-color-swatch ${secondary === option.value ? 'active' : ''}`}
                style={{ backgroundColor: option.value }}
                onClick={() => (canEdit ? setSecondary(option.value) : null)}
                disabled={!canEdit}
                aria-pressed={secondary === option.value}
                title={option.label}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default ThemeSettingsPage
