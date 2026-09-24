import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal'
import StationActionMenu from '@/components/common/StationActionMenu'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import {
  deletePushNotification,
  listPushNotifications,
  repushPushNotification,
} from './pushNotificationsApi'
import './pushNotifications.css'
import '@/styles/dashboard.css'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const TABLE_TEMPLATE =
  'minmax(40px, 0.45fr) 1.3fr 1.7fr 0.95fr 1.1fr 1.1fr 1fr 1.15fr 0.85fr 0.7fr'
const ACTIVE_JOB_STATUSES = new Set(['queued', 'preparing', 'sending'])

const PlusIcon = () => (
  <span className="primary-add-button__icon" aria-hidden="true">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
)

const formatDate = (value) => {
  if (!value) {
    return 'N/A'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }
  return parsed.toLocaleDateString()
}

const formatStatus = (value) => {
  if (!value) {
    return 'Unknown'
  }
  return String(value)
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

const ChevronLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10.5 13.5L6 9L10.5 4.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.5 13.5L12 9L7.5 4.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function PushNotifications() {
  const navigate = useNavigate()
  const { showToast } = useInlineToast('push-notifications')

  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 0,
    total_items: 0,
  })
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    notification: null,
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [repushingId, setRepushingId] = useState('')

  const loadNotifications = useCallback(async ({ nextPage = page, nextPageSize = pageSize, signal } = {}) => {
    setIsLoading(true)
    setError('')
    try {
      const data = await listPushNotifications({
        page: nextPage,
        pageSize: nextPageSize,
        signal,
      })

      const rawResults = Array.isArray(data) ? data : data?.results ?? []
      const paginationMeta = Array.isArray(data)
        ? {
            page: nextPage,
            page_size: nextPageSize,
            total_pages: rawResults.length ? 1 : 0,
            total_items: rawResults.length,
          }
        : data?.pagination ?? {
            page: nextPage,
            page_size: nextPageSize,
            total_pages: rawResults.length ? 1 : 0,
            total_items: rawResults.length,
          }

      const normalizedPagination = {
        page: Number(paginationMeta.page ?? nextPage) || nextPage,
        page_size: Number(paginationMeta.page_size ?? nextPageSize) || nextPageSize,
        total_pages: Math.max(0, Number(paginationMeta.total_pages ?? 0) || 0),
        total_items: Math.max(0, Number(paginationMeta.total_items ?? rawResults.length) || 0),
      }

      setNotifications(Array.isArray(rawResults) ? rawResults : [])
      setPagination(normalizedPagination)

      if (normalizedPagination.page !== page) {
        setPage(normalizedPagination.page || 1)
      }
      if (normalizedPagination.page_size !== pageSize) {
        setPageSize(normalizedPagination.page_size || DEFAULT_PAGE_SIZE)
      }
    } catch (loadError) {
      if (loadError?.name === 'AbortError') {
        return
      }
      console.error(loadError)
      setNotifications([])
      setPagination((current) => ({
        ...current,
        page: 1,
        total_pages: 0,
        total_items: 0,
      }))
      setError('Unable to load push notifications.')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    loadNotifications({ signal: controller.signal })
    return () => {
      controller.abort()
    }
  }, [loadNotifications, page, pageSize])

  useEffect(() => {
    if (error) {
      showToast({ title: 'Load failed', message: error, variant: 'error' })
    }
  }, [error, showToast])

  const currentPage = Math.max(1, pagination.page || page || 1)
  const currentPageSize = Math.max(1, pagination.page_size || pageSize || DEFAULT_PAGE_SIZE)
  const totalPages = Math.max(1, pagination.total_pages || 1)
  const totalItems = Math.max(0, pagination.total_items || 0)
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * currentPageSize

  const handleDelete = useCallback(async () => {
    if (!deleteModalState.notification?.id) {
      return
    }
    setIsDeleting(true)
    try {
      await deletePushNotification(deleteModalState.notification.id)
      await loadNotifications()
      showToast({
        title: 'Notification deleted',
        message: 'Push notification has been removed.',
        variant: 'success',
      })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: 'Unable to delete push notification.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteModalState({ isOpen: false, notification: null })
    }
  }, [deleteModalState.notification, loadNotifications, showToast])

  const handleRepush = useCallback(
    async (notification) => {
      if (!notification?.id) {
        return
      }
      setRepushingId(notification.id)
      try {
        const updated = await repushPushNotification(notification.id)
        await loadNotifications()
        showToast({
          title: updated?.async_enabled === true ? 'Push job queued' : 'Notification re-pushed',
          message:
            updated?.async_enabled === true
              ? `Background delivery started for ${updated.title_en || 'this notification'}.`
              : `Re-push completed for ${updated.title_en || 'this notification'}.`,
          variant: 'success',
        })
      } catch (repushError) {
        console.error(repushError)
        showToast({
          title: 'Re-push failed',
          message: 'Unable to re-push this notification.',
          variant: 'error',
        })
      } finally {
        setRepushingId('')
      }
    },
    [loadNotifications, showToast]
  )

  const rows = useMemo(
    () =>
      notifications.map((notification, index) => {
        const rowNumber = pageStart + index + 1
        const cities = notification.cities?.map((city) => city.name).join(', ') || 'All'
        const districts =
          notification.districts?.map((district) => district.name).join(', ') || 'All'
        const headlinePrimary = notification.title_en || 'N/A'
        const headlineSecondary = notification.title_ar || '—'
        const bodyPrimary = notification.body_en || 'N/A'
        const bodySecondary = notification.body_ar || '—'
        const adminLabel =
          notification.created_by?.name || notification.created_by?.email || 'N/A'
        const latestJob = notification.latest_job || null
        const latestAttempt = notification.latest_attempt || null
        const isRepushBlocked = isActiveJobStatus(latestJob?.status)
        const statusValue = latestJob?.status || latestAttempt?.status || ''
        const statusMeta = latestJob
          ? `${formatPercent(latestJob.progress_percent)} • ${latestJob.processed_recipients ?? 0}/${latestJob.total_recipients ?? 0} recipients`
          : latestAttempt?.total_recipients !== undefined
            ? `${latestAttempt.total_recipients} recipients`
            : 'No push history'
        const detailNavigationState = latestJob?.job_id ? { jobId: latestJob.job_id } : undefined

        return (
          <article
            key={notification.id}
            className="charger-row clickable"
            style={{ gridTemplateColumns: TABLE_TEMPLATE }}
            role="button"
            tabIndex={0}
            onClick={(event) => {
              if (
                event.target instanceof HTMLElement &&
                event.target.closest('.charger-actions-cell')
              ) {
                return
              }
              navigate(`/push-notifications/${notification.id}`, {
                state: detailNavigationState,
              })
            }}
            onKeyDown={(event) => {
              if (
                (event.key === 'Enter' || event.key === ' ') &&
                !(event.target instanceof HTMLElement &&
                  event.target.closest('.charger-actions-cell'))
              ) {
                event.preventDefault()
                navigate(`/push-notifications/${notification.id}`, {
                  state: detailNavigationState,
                })
              }
            }}
          >
            <div className="charger-cell order">{rowNumber}</div>
            <div className="charger-cell">
              <div className="push-notifications-stack">
                <span className="push-notifications-stack__primary">{headlinePrimary}</span>
                <span className="push-notifications-stack__secondary" dir="rtl">
                  {headlineSecondary}
                </span>
              </div>
            </div>
            <div className="charger-cell">
              <div className="push-notifications-stack">
                <span className="push-notifications-stack__primary">{bodyPrimary}</span>
                <span className="push-notifications-stack__secondary" dir="rtl">
                  {bodySecondary}
                </span>
              </div>
            </div>
            <div className="charger-cell">
              <div className="push-notifications-country">
                <span className="push-notifications-country__name">{notification.country || 'N/A'}</span>
                <span className="push-notifications-country__code">
                  {notification.country_code || '—'}
                </span>
              </div>
            </div>
            <div className="charger-cell">
              <span className="push-notifications-pill-list">{cities}</span>
            </div>
            <div className="charger-cell">
              <span className="push-notifications-pill-list">{districts}</span>
            </div>
            <div className="charger-cell">
              <span className="push-notifications-admin" title={adminLabel}>
                {adminLabel}
              </span>
            </div>
            <div className="charger-cell">
              <div className="push-notifications-stack">
                <span className="push-notifications-stack__primary">{formatStatus(statusValue)}</span>
                <span className="push-notifications-stack__secondary">
                  {latestJob ? `Job • ${statusMeta}` : `Push • ${statusMeta}`}
                </span>
              </div>
            </div>
            <div className="charger-cell">{formatDate(notification.created_at)}</div>
            <div className="charger-cell charger-actions-cell">
              <StationActionMenu
                actions={[
                  {
                    key: 'view',
                    label: 'View',
                    onClick: () =>
                      navigate(`/push-notifications/${notification.id}`, {
                        state: detailNavigationState,
                      }),
                  },
                  {
                    key: 'edit',
                    label: 'Edit',
                    onClick: () => navigate(`/push-notifications/${notification.id}/edit`),
                  },
                  {
                    key: 'repush',
                    label: isRepushBlocked
                      ? 'Push job is still running'
                      : repushingId === notification.id
                        ? 'Re Pushing...'
                        : 'Re Push',
                    onClick: () => handleRepush(notification),
                    disabled: isRepushBlocked || repushingId === notification.id,
                    title: isRepushBlocked ? 'Push job is still running' : undefined,
                  },
                  {
                    key: 'delete',
                    label: 'Delete',
                    variant: 'danger',
                    onClick: () =>
                      setDeleteModalState({
                        isOpen: true,
                        notification,
                      }),
                  },
                ]}
              />
            </div>
          </article>
        )
      }),
    [handleRepush, navigate, notifications, pageStart, repushingId]
  )

  return (
    <div className="stations-page push-notifications-page">
      <header className="stations-header">
        <div className="page-heading-left">
          <div className="page-heading-titles">
            <Breadcrumbs items={[{ label: 'Home', to: '/overview' }, { label: 'Push Notifications' }]} />
            <div className="page-heading-title-row">
              <BackButton fallbackTo="/overview" ariaLabel="Back to overview" />
              <h1>Push Notifications</h1>
            </div>
          </div>
        </div>
        <div className="stations-header-actions">
          <button
            type="button"
            className="primary-add-button push-notifications-add-button"
            onClick={() => navigate('/push-notifications/new')}
          >
            <span className="primary-add-button__label">Push New Notifications</span>
            <PlusIcon />
          </button>
        </div>
      </header>

      <InlineToastRegion region="push-notifications" />

      {error ? <div className="data-warning">{error}</div> : null}
      {isLoading ? <p className="data-placeholder">Loading push notifications…</p> : null}

      {!isLoading && !error ? (
        <div className="push-notifications-table-shell">
          <div className="chargers-table push-notifications-table" aria-busy={isLoading}>
            <div className="chargers-table-header" style={{ gridTemplateColumns: TABLE_TEMPLATE }}>
              <div className="charger-cell order">No</div>
              <div className="charger-cell">Headline</div>
              <div className="charger-cell">Description</div>
              <div className="charger-cell">Country</div>
              <div className="charger-cell">Governorate</div>
              <div className="charger-cell">Area</div>
              <div className="charger-cell">Admin</div>
              <div className="charger-cell">Status</div>
              <div className="charger-cell">Created</div>
              <div className="charger-cell charger-actions-cell">Actions</div>
            </div>
            {rows}
            {notifications.length > 0 ? (
              <footer className="push-notifications-table-footer">
                <div className="push-notifications-page-size">
                  <span className="push-notifications-page-size__label">Rows in page</span>
                  <div className="push-notifications-page-size__control">
                    <select
                      id="push-notifications-page-size"
                      value={currentPageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value) || DEFAULT_PAGE_SIZE)
                        setPage(1)
                      }}
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="push-notifications-pagination">
                  <span className="push-notifications-pagination__status">
                    {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="push-notifications-pagination__arrow"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1 || isLoading}
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    type="button"
                    className="push-notifications-pagination__arrow"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={currentPage >= totalPages || isLoading}
                    aria-label="Next page"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isLoading && !error && notifications.length === 0 ? (
        <div className="data-placeholder">No push notifications available.</div>
      ) : null}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, notification: null })}
        onConfirm={handleDelete}
        confirmDisabled={isDeleting}
        title="Delete Push Notification"
        itemName={deleteModalState.notification?.title_en || 'Notification'}
        confirmationMessage="Are you sure you want to delete this push notification?"
      />
    </div>
  )
}

export default PushNotifications
