import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/ui/molecules/navigation/Breadcrumbs'
import BackButton from '@/components/ui/molecules/navigation/BackButton'
import DeleteConfirmationModal from '@/components/ui/organisms/DeleteConfirmationModal'
import { InlineToastRegion } from '@/components/ui/organisms/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import {
  deletePushNotification,
  getPushNotification,
  getPushNotificationJobStatus,
  repushPushNotification,
} from './pushNotificationsApi'
import './pushNotifications.css'
import '@/styles/dashboard.css'

const ACTIVE_JOB_STATUSES = new Set(['queued', 'preparing', 'sending'])
const TERMINAL_JOB_STATUSES = new Set(['sent', 'partial_failed', 'failed', 'cancelled'])
const POLL_INTERVAL_MS = 3000

const normalizeIdentifier = (value) => String(value ?? '').trim()

const formatDate = (value) => {
  if (!value) {
    return 'N/A'
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString()
}

const formatStatus = (value) => {
  if (!value) {
    return 'Unknown'
  }
  const normalized = String(value).trim().toLowerCase()
  const statusLabels = {
    queued: 'Queued',
    preparing: 'Preparing',
    sending: 'Sending',
    sent: 'Completed',
    partial_failed: 'Completed with failures',
    failed: 'Failed',
    no_recipients: 'No recipients',
    cancelled: 'Cancelled',
  }
  if (statusLabels[normalized]) {
    return statusLabels[normalized]
  }
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return '0%'
  }
  return `${Math.round(numeric)}%`
}

const isActiveJobStatus = (value) => ACTIVE_JOB_STATUSES.has(String(value || '').trim().toLowerCase())

const isTerminalJobStatus = (value) => TERMINAL_JOB_STATUSES.has(String(value || '').trim().toLowerCase())

function RepushConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  notificationTitle = '',
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div className="push-notification-confirm-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) {
        onClose()
      }
    }}>
      <div className="push-notification-confirm-card" role="dialog" aria-modal="true" aria-labelledby="repush-modal-title">
        <div className="push-notification-confirm-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M23.3327 15.1668C23.3327 20.3215 19.154 24.5002 13.9993 24.5002C8.84467 24.5002 4.66602 20.3215 4.66602 15.1668C4.66602 10.0122 8.84467 5.8335 13.9993 5.8335C16.5276 5.8335 18.8204 6.82626 20.4993 8.44555"
              stroke="#7BA71D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18.666 3.5H23.3327V8.16667"
              stroke="#7BA71D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.9993 10.5V15.1667L17.4993 17.5"
              stroke="#7BA71D"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="push-notification-confirm-copy">
          <h3 id="repush-modal-title">Re Push Notification</h3>
          <p>
            {notificationTitle
              ? `Send "${notificationTitle}" again to its current audience?`
              : 'Send this notification again to its current audience?'}
          </p>
        </div>
        <div className="push-notification-confirm-actions">
          <button
            type="button"
            className="customer-outline-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-save-button push-notification-confirm-primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Re Pushing...' : 'Re Push'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PushNotificationDetails() {
  const location = useLocation()
  const navigate = useNavigate()
  const { notificationId } = useParams()
  const { showToast } = useInlineToast('push-notification-details')

  const [notification, setNotification] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRepushing, setIsRepushing] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })
  const [isRepushConfirmOpen, setIsRepushConfirmOpen] = useState(false)

  const navigationJobId = normalizeIdentifier(location.state?.jobId)

  const loadNotification = useCallback(async () => {
    if (!notificationId) {
      setIsLoading(false)
      setError('Push notification not found.')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const data = await getPushNotification(notificationId)
      setNotification(data)
      if (data?.latest_job) {
        setJobStatus((current) => {
          const currentJobId = normalizeIdentifier(current?.job_id)
          const nextJobId = normalizeIdentifier(data.latest_job?.job_id)
          if (!currentJobId || currentJobId === nextJobId) {
            return data.latest_job
          }
          return current
        })
      }
    } catch (loadError) {
      console.error(loadError)
      setError('Unable to load push notification details.')
    } finally {
      setIsLoading(false)
    }
  }, [notificationId])

  useEffect(() => {
    loadNotification()
  }, [loadNotification])

  useEffect(() => {
    if (error) {
      showToast({
        title: 'Load failed',
        message: error,
        variant: 'error',
      })
    }
  }, [error, showToast])

  const latestJob = jobStatus || notification?.latest_job || null
  const latestJobId = normalizeIdentifier(latestJob?.job_id || navigationJobId)
  const isJobActive = isActiveJobStatus(latestJob?.status)
  const isRepushDisabled = isDeleting || isRepushing || isJobActive

  useEffect(() => {
    if (!latestJobId) {
      return undefined
    }

    let cancelled = false
    let timeoutId = null

    const pollJobStatus = async () => {
      try {
        const data = await getPushNotificationJobStatus(latestJobId)
        if (cancelled) {
          return
        }
        setJobStatus(data)
        setNotification((current) => (current ? { ...current, latest_job: data } : current))
        if (!isTerminalJobStatus(data?.status)) {
          timeoutId = window.setTimeout(pollJobStatus, POLL_INTERVAL_MS)
        }
      } catch (jobError) {
        if (cancelled) {
          return
        }
        console.error(jobError)
        timeoutId = window.setTimeout(pollJobStatus, POLL_INTERVAL_MS)
      }
    }

    if (!latestJob?.status || isActiveJobStatus(latestJob.status)) {
      pollJobStatus()
    }

    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [latestJob?.status, latestJobId])

  const handleDelete = useCallback(async () => {
    if (!notification?.id) {
      return
    }
    setIsDeleting(true)
    try {
      await deletePushNotification(notification.id)
      showToast({
        title: 'Notification deleted',
        message: 'Push notification has been removed.',
        variant: 'success',
      })
      navigate('/push-notifications', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: 'Unable to delete push notification.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false })
    }
  }, [navigate, notification, showToast])

  const handleRepush = useCallback(async () => {
    if (!notification?.id) {
      return
    }
    setIsRepushing(true)
    try {
      const updated = await repushPushNotification(notification.id)
      setNotification(updated)
      if (updated?.latest_job) {
        setJobStatus(updated.latest_job)
      } else if (updated?.job_id) {
        setJobStatus((current) => ({
          ...current,
          job_id: updated.job_id,
          status: updated.job_status || 'queued',
        }))
      }
      showToast({
        title: updated?.async_enabled === true ? 'Push job queued' : 'Notification re-pushed',
        message:
          updated?.async_enabled === true
            ? `Background delivery started for ${updated.title_en || 'this notification'}.`
            : `Re-push completed for ${updated.title_en || 'this notification'}.`,
        variant: 'success',
      })
      setIsRepushConfirmOpen(false)
    } catch (repushError) {
      console.error(repushError)
      showToast({
        title: 'Re-push failed',
        message: 'Unable to re-push this notification.',
        variant: 'error',
      })
    } finally {
      setIsRepushing(false)
    }
  }, [notification, showToast])

  const pageTitle = notification?.title_en || 'Push Notification'
  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'Push Notifications', to: '/push-notifications' },
    { label: pageTitle },
  ]

  const statusLabel = latestJob ? formatStatus(latestJob?.status) : formatStatus(notification?.latest_attempt?.status)
  const countryLabel = notification?.country || 'N/A'
  const governorateLabel = notification?.all_cities
    ? 'All'
    : notification?.cities?.map((city) => city.name).join(', ') || 'N/A'
  const areaLabel = notification?.all_districts
    ? 'All'
    : notification?.districts?.map((district) => district.name).join(', ') || 'N/A'
  const createdByLabel =
    notification?.created_by?.name || notification?.created_by?.email || 'N/A'

  const detailFields = useMemo(
    () => [
      {
        key: 'title-en',
        label: 'Headline English',
        value: notification?.title_en || 'N/A',
        span: 'wide',
      },
      {
        key: 'body-en',
        label: 'Description English',
        value: notification?.body_en || 'N/A',
        span: 'wide',
      },
      {
        key: 'title-ar',
        label: 'Headline Arabic',
        value: notification?.title_ar || 'N/A',
        span: 'wide',
        direction: 'rtl',
      },
      {
        key: 'body-ar',
        label: 'Description Arabic',
        value: notification?.body_ar || 'N/A',
        span: 'wide',
        direction: 'rtl',
      },
      {
        key: 'created',
        label: 'Created',
        value: formatDate(notification?.created_at),
      },
      {
        key: 'created-by',
        label: 'Created by',
        value: createdByLabel,
      },
      {
        key: 'country',
        label: 'Country',
        value: countryLabel,
      },
      {
        key: 'governorate',
        label: 'Governorate',
        value: governorateLabel,
      },
      {
        key: 'area',
        label: 'Area',
        value: areaLabel,
      },
      {
        key: 'status',
        label: 'Status',
        value: statusLabel,
        meta:
          latestJob?.queued_at || latestJob?.total_recipients
            ? `Latest job ${formatDate(latestJob?.queued_at)}${
                latestJob?.total_recipients !== undefined
                  ? ` • ${latestJob.total_recipients} recipients`
                  : ''
              }`
            : notification?.latest_attempt?.triggered_at || notification?.latest_attempt?.total_recipients
            ? `Latest push ${formatDate(notification?.latest_attempt?.triggered_at)}${
                notification?.latest_attempt?.total_recipients !== undefined
                  ? ` • ${notification.latest_attempt.total_recipients} recipients`
                  : ''
              }`
            : '',
      },
    ],
    [areaLabel, countryLabel, createdByLabel, governorateLabel, latestJob, notification, statusLabel]
  )

  const jobMetricFields = useMemo(
    () =>
      latestJob
        ? [
            { key: 'job-status', label: 'Delivery status', value: formatStatus(latestJob.status) },
            { key: 'job-progress', label: 'Progress', value: formatPercent(latestJob.progress_percent) },
            {
              key: 'job-recipients',
              label: 'Total Devices',
              value: String(latestJob.total_recipients ?? 0),
            },
            {
              key: 'job-devices',
              label: 'Active devices',
              value: `${latestJob.processed_devices ?? 0} / ${latestJob.total_devices ?? 0}`,
            },
            { key: 'job-success', label: 'Delivered', value: String(latestJob.success_count ?? 0) },
            { key: 'job-failure', label: 'Failed', value: String(latestJob.failure_count ?? 0) },
            {
              key: 'job-batches',
              label: 'Processing groups',
              value: `${latestJob.finished_batches ?? 0} / ${latestJob.total_batches ?? 0}`,
            },
            {
              key: 'job-failed-batches',
              label: 'Failed groups',
              value: String(latestJob.failed_batches ?? 0),
            },
          ]
        : [],
    [latestJob]
  )

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
        <div className="data-placeholder">Loading push notification details…</div>
      </div>
    )
  }

  if (error && !notification) {
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
        <div className="data-warning">{error}</div>
      </div>
    )
  }

  if (!notification) {
    return null
  }

  return (
    <div className="stations-page push-notifications-page">
      <header className="customer-details-header push-notification-details-header">
        <div className="customer-details-heading">
          <Breadcrumbs items={breadcrumbs} />
          <div className="customer-details-title">
            <BackButton fallbackTo="/push-notifications" ariaLabel="Back to push notifications" />
            <h1>{pageTitle}</h1>
          </div>
        </div>

        <div className="customer-details-actions connector-details-actions push-notification-details-actions">
          <button
            type="button"
            className="customer-outline-button danger"
            onClick={() => setDeleteModalState({ isOpen: true })}
            disabled={isRepushDisabled}
            title={isJobActive ? 'Push job is still running' : undefined}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            className="connector-edit-button"
            onClick={() => navigate(`/push-notifications/${notificationId}/edit`)}
            disabled={isRepushDisabled}
            title={isJobActive ? 'Push job is still running' : undefined}
          >
            Edit
          </button>
          <button
            type="button"
            className="primary-save-button push-notification-repush-button"
            onClick={() => setIsRepushConfirmOpen(true)}
            disabled={isRepushDisabled}
            title={isJobActive ? 'Push job is still running' : undefined}
          >
            {isRepushing ? 'Re Pushing...' : 'Re Push'}
          </button>
        </div>
      </header>

      <InlineToastRegion region="push-notification-details" />

      {isJobActive ? (
        <div className="data-warning">Push job is still running.</div>
      ) : null}

      <section className="customer-card push-notification-details-card">
        <div className="customer-card-header">
          <h3>Details</h3>
        </div>

        <div className="push-notification-details-grid">
          {detailFields.map((field) => {
            const className = [
              'customer-info-field',
              'push-notification-detail-field',
              field.span === 'wide' ? 'push-notification-detail-field--wide' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div className={className} key={field.key}>
                <span className="customer-info-label">{field.label}</span>
                <span
                  className="customer-info-value push-notification-detail-value"
                  dir={field.direction || undefined}
                >
                  {field.value}
                </span>
                {field.meta ? (
                  <span className="push-notification-detail-meta">{field.meta}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {latestJob ? (
        <section className="customer-card push-notification-details-card">
          <div className="customer-card-header">
            <h3>Notification Delivery</h3>
          </div>

          <div className="push-notification-job-summary">
            <div className="push-notification-job-summary__bar">
              <div
                className="push-notification-job-summary__fill"
                style={{ width: formatPercent(latestJob.progress_percent) }}
              />
            </div>
            <span className="push-notification-job-summary__label">
              {formatPercent(latestJob.progress_percent)}
            </span>
          </div>

          <div className="push-notification-details-grid push-notification-job-grid">
            {jobMetricFields.map((field) => (
              <div className="customer-info-field push-notification-detail-field" key={field.key}>
                <span className="customer-info-label">{field.label}</span>
                <span className="customer-info-value push-notification-detail-value">
                  {field.value}
                </span>
              </div>
            ))}
            {latestJob.error_message ? (
              <div className="customer-info-field push-notification-detail-field push-notification-detail-field--wide">
                <span className="customer-info-label">Error</span>
                <span className="customer-info-value push-notification-detail-value">
                  {latestJob.error_message}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Push Notification"
        confirmationMessage="Are you sure you want to delete this push notification?"
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        confirmDisabled={isDeleting}
      />

      <RepushConfirmationModal
        isOpen={isRepushConfirmOpen}
        onClose={() => setIsRepushConfirmOpen(false)}
        onConfirm={handleRepush}
        isSubmitting={isRepushing || isJobActive}
        notificationTitle={notification.title_en}
      />
    </div>
  )
}

export default PushNotificationDetails
