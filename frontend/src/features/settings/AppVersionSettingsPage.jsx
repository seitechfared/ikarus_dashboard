import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { fetchAppVersions, updateAppVersion } from '@/services/appVersionApi'
import '@/styles/dashboard.css'

const PLATFORM_LABELS = {
  ios: 'iOS',
  android: 'Android',
}

const emptyForm = {
  minimum_version: '',
  latest_version: '',
  store_url: '',
  title: '',
  message: '',
  title_arabic: '',
  message_arabic: '',
}

// Numeric semver compare so "1.10.0" > "1.9.0" and blanks are treated as 0.
const parseVersion = (value) => {
  const parts = String(value || '')
    .match(/\d+/g)
    ?.map((part) => Number.parseInt(part, 10)) || []
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

const compareVersions = (a, b) => {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  for (let i = 0; i < 3; i += 1) {
    if (va[i] !== vb[i]) {
      return va[i] > vb[i] ? 1 : -1
    }
  }
  return 0
}

const isValidVersion = (value) => /^\d+(\.\d+){0,2}$/.test(String(value || '').trim())

function AppVersionSettingsPage() {
  const { capabilities } = useOutletContext() || {}
  const { pushError, pushSuccess } = useInlineToast('settings-app-version')
  const canEdit = Boolean(capabilities?.canEdit)

  const [versions, setVersions] = useState([])
  const [forms, setForms] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [savingPlatform, setSavingPlatform] = useState(null)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)
      setError('')
      try {
        const data = await fetchAppVersions({ signal: controller.signal })
        if (!isActive) {
          return
        }
        const list = Array.isArray(data) ? data : []
        setVersions(list)
        const nextForms = {}
        list.forEach((item) => {
          nextForms[item.platform] = { ...emptyForm, ...item }
        })
        setForms(nextForms)
      } catch (loadError) {
        if (!isActive || loadError?.name === 'AbortError') {
          return
        }
        setError(loadError.message || 'Unable to load app versions.')
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
  }, [])

  const updateField = (platform, field, value) => {
    setForms((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }))
  }

  const handleSave = async (platform) => {
    if (!canEdit || savingPlatform) {
      return
    }
    const form = forms[platform] || emptyForm
    const minimum = String(form.minimum_version || '').trim()
    const latest = String(form.latest_version || '').trim()

    if (!isValidVersion(minimum)) {
      pushError('Minimum version must look like 1.8.0.')
      return
    }
    if (!isValidVersion(latest)) {
      pushError('Latest version must look like 1.8.2.')
      return
    }
    if (compareVersions(minimum, latest) > 0) {
      pushError('Minimum version cannot be greater than latest version.')
      return
    }

    const payload = {
      minimum_version: minimum,
      latest_version: latest,
      store_url: String(form.store_url || '').trim(),
      title: String(form.title || '').trim(),
      message: String(form.message || '').trim(),
      title_arabic: String(form.title_arabic || '').trim(),
      message_arabic: String(form.message_arabic || '').trim(),
    }

    setSavingPlatform(platform)
    try {
      const updated = await updateAppVersion(platform, payload)
      setVersions((prev) => prev.map((item) => (item.platform === platform ? { ...item, ...updated } : item)))
      setForms((prev) => ({ ...prev, [platform]: { ...emptyForm, ...updated } }))
      pushSuccess(`${PLATFORM_LABELS[platform] || platform} version saved.`)
    } catch (saveError) {
      pushError(saveError.message || 'Unable to save app version.')
    } finally {
      setSavingPlatform(null)
    }
  }

  const orderedPlatforms = useMemo(
    () => versions.map((item) => item.platform).filter((platform) => forms[platform]),
    [versions, forms]
  )

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">App Version</h1>
          <p className="settings-description">
            Control the minimum and latest mobile app version per platform. Raise the minimum version
            only when you ship a breaking change &mdash; users below it are forced to update.
          </p>
        </div>
      </div>

      <InlineToastRegion region="settings-app-version" />

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading app versions...</p> : null}

      {!isLoading && !error && orderedPlatforms.length === 0 ? (
        <p className="data-placeholder">No app version configuration found.</p>
      ) : null}

      {orderedPlatforms.map((platform) => {
        const form = forms[platform] || emptyForm
        return (
          <section key={platform} className="settings-card settings-card--left">
            <h2 className="settings-card-title">{PLATFORM_LABELS[platform] || platform}</h2>
            <div className="settings-form-grid">
              <label className="settings-field">
                <span className="settings-field-label">Minimum Version (forces update)</span>
                <input
                  value={form.minimum_version || ''}
                  placeholder="1.8.0"
                  onChange={(event) => updateField(platform, 'minimum_version', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">Latest Version (optional update)</span>
                <input
                  value={form.latest_version || ''}
                  placeholder="1.8.2"
                  onChange={(event) => updateField(platform, 'latest_version', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field settings-field-full">
                <span className="settings-field-label">Store URL</span>
                <input
                  value={form.store_url || ''}
                  placeholder={
                    platform === 'ios'
                      ? 'https://apps.apple.com/app/id...'
                      : 'https://play.google.com/store/apps/details?id=...'
                  }
                  onChange={(event) => updateField(platform, 'store_url', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">Title (English)</span>
                <input
                  value={form.title || ''}
                  placeholder="Update required"
                  onChange={(event) => updateField(platform, 'title', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field">
                <span className="settings-field-label">Title (Arabic)</span>
                <input
                  dir="rtl"
                  value={form.title_arabic || ''}
                  placeholder="تحديث مطلوب"
                  onChange={(event) => updateField(platform, 'title_arabic', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field settings-field-full">
                <span className="settings-field-label">Message (English)</span>
                <textarea
                  rows={2}
                  value={form.message || ''}
                  placeholder="A new version of Ikarus is available. Please update to continue."
                  onChange={(event) => updateField(platform, 'message', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
              <label className="settings-field settings-field-full">
                <span className="settings-field-label">Message (Arabic)</span>
                <textarea
                  dir="rtl"
                  rows={2}
                  value={form.message_arabic || ''}
                  placeholder="يتوفر إصدار جديد من التطبيق. يرجى التحديث للمتابعة."
                  onChange={(event) => updateField(platform, 'message_arabic', event.target.value)}
                  disabled={!canEdit}
                />
              </label>
            </div>
            <div className="settings-detail-actions">
              <button
                type="button"
                className="settings-save-button"
                onClick={() => handleSave(platform)}
                disabled={!canEdit || savingPlatform === platform}
              >
                <span>{savingPlatform === platform ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default AppVersionSettingsPage