import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Breadcrumbs from '@/components/navigation/Breadcrumbs'
import BackButton from '@/components/navigation/BackButton'
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal'
import { API_BASE } from '@/constants'
import { appendAuthHeader } from '@/utils/session'
import { buildMediaUrl } from '@/utils/media'
import { InlineToastRegion } from '@/components/common/ToastProvider'
import useInlineToast from '@/hooks/useInlineToast'
import { deriveRoleCapabilities } from '@/utils/adminRoles'
import '@/styles/dashboard.css'

const DEFAULT_TAB_PAGE_SIZE = 25

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return 'N/A'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return 'N/A'
  }
  const value = Number(amount)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch (error) {
    return `${value.toFixed(2)} ${currency}`
  }
}

const formatAmountWithCurrency = (amount, currency) => {
  if (amount === null || amount === undefined) {
    return '-'
  }
  const numeric = Number(amount)
  if (Number.isNaN(numeric)) {
    return '-'
  }
  const code = currency || 'USD'
  return `${numeric.toFixed(2)} ${code}`
}

const formatBillableMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) {
    return '-'
  }
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '-'
  }
  return `${numeric} min`
}

const renderBillingSummary = (totalAmount, chargingAmount, currency) => (
  <div className="billing-breakdown">
    <span className="billing-breakdown-primary">
      {formatAmountWithCurrency(totalAmount, currency)}
    </span>
    <span className="billing-breakdown-note">
      Charging: {formatAmountWithCurrency(chargingAmount, currency)}
    </span>
  </div>
)

const renderTransactionBreakdown = (tx, currency) => {
  const billing = tx?.session_billing
  if (!billing) {
    return '-'
  }
  const billingCurrency = billing.currency || currency
  return (
    <div className="billing-breakdown">
      <span className="billing-breakdown-note">
        Charging: {formatAmountWithCurrency(billing.charging_amount, billingCurrency)}
      </span>
      <span className="billing-breakdown-note">
        Idle fee: {formatAmountWithCurrency(billing.idle_fee, billingCurrency)}
      </span>
      <span className="billing-breakdown-note">
        Idle: {formatDuration(billing.idle_time_seconds ?? billing.idle_time)} / {formatBillableMinutes(billing.idle_billable_minutes)}
      </span>
    </div>
  )
}

const DEBIT_TRANSACTION_TYPES = new Set(['admin_deduction', 'session_charge'])

const getSignedTransactionAmount = (tx) => {
  if (!tx || tx.amount == null) {
    return 0
  }
  const value = Number(tx.amount)
  if (Number.isNaN(value)) {
    return 0
  }
  const normalizedType = (tx.type || '').toLowerCase()
  return DEBIT_TRANSACTION_TYPES.has(normalizedType) ? -Math.abs(value) : Math.abs(value)
}

const formatPaymentMethod = (tx) => {
  if (!tx) return 'N/A'
  const paymentDetails = tx.payment_details || {}
  const methodType = (paymentDetails.payment_method_type || '').toLowerCase()
  const methodBrand = (paymentDetails.payment_method_brand || '').toLowerCase()
  if (methodBrand === 'visa') return 'Visa'
  if (methodBrand === 'mastercard') return 'Mastercard'
  if (methodType === 'qr' || methodBrand === 'meezadigital') return 'Meeza QR'
  if (methodType === 'card') return 'Card'
  if (methodType === 'mobile_wallet') return 'Mobile Wallet'

  const rawId = tx.payment_method_id || ''
  if (rawId) {
    const parts = rawId.split(':').filter(Boolean)
    if (parts.length) {
      return parts
        .map((part) => part.replace(/_/g, ' '))
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    }
  }
  if (methodBrand) {
    return methodBrand.charAt(0).toUpperCase() + methodBrand.slice(1)
  }
  if (methodType) {
    return methodType.charAt(0).toUpperCase() + methodType.slice(1)
  }
  return 'N/A'
}

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  try {
    const date = new Date(value)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return value
  }
}

const resolveVerificationFlag = (customer, key) => {
  if (typeof customer?.[key] === 'boolean') {
    return customer[key]
  }
  if (typeof customer?.user?.[key] === 'boolean') {
    return customer.user[key]
  }
  return null
}

const renderSessionStatusBadge = (status) => {
  const cancelledStyle = { backgroundColor: 'rgba(62, 79, 68, 0.12)', color: '#3E4F44' }
  const palette = {
    charging: { backgroundColor: 'rgba(0, 108, 156, 0.12)', color: '#006C9C' },
    completed: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561' },
    finished: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561' },
    blocked: { backgroundColor: 'rgba(237, 74, 74, 0.12)', color: '#ED4A4A' },
    finishing: cancelledStyle,
    cancelled: cancelledStyle,
    canceled: cancelledStyle,
  }
  const normalized = (status || '').toLowerCase()
  const styles = palette[normalized] || {
    backgroundColor: 'rgba(156, 163, 175, 0.12)',
    color: '#6B7280',
  }
  const label = normalized
    ? normalized === 'completed' || normalized === 'finished'
      ? 'Finished'
      : normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Unknown'
  return (
    <span className="status-badge charger-status-badge" style={styles}>
      {label}
    </span>
  )
}

const renderTransactionStatusBadge = (status) => {
  const palette = {
    completed: { backgroundColor: 'rgba(46, 165, 97, 0.12)', color: '#2EA561' },
    pending: { backgroundColor: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' },
    failed: { backgroundColor: 'rgba(237, 74, 74, 0.12)', color: '#ED4A4A' },
    cancelled: { backgroundColor: 'rgba(156, 163, 175, 0.12)', color: '#9CA3AF' },
  }
  const normalized = (status || '').toLowerCase()
  const styles = palette[normalized] || {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: '#6366F1',
  }
  const label = normalized
    ? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Unknown'
  return (
    <span className="status-badge charger-status-badge" style={styles}>
      {label}
    </span>
  )
}

function CustomerDetails() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const outletContext = useOutletContext()
  const { showToast } = useInlineToast('customers')
  const canAccessBilling =
    outletContext?.capabilities?.canAccessBilling ?? deriveRoleCapabilities().canAccessBilling
  const canViewCustomerBalance =
    outletContext?.capabilities?.canViewCustomerBalance ??
    deriveRoleCapabilities().canViewCustomerBalance

  const [customer, setCustomer] = useState(null)
  const [sessions, setSessions] = useState({ rows: [], pagination: null })
  const [transactions, setTransactions] = useState({ rows: [], pagination: null })
  const [sessionsPage, setSessionsPage] = useState(1)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('info')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBlocking, setIsBlocking] = useState(false)
  const [isSendingInvitation, setIsSendingInvitation] = useState(false)
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false })
  const [blockModalState, setBlockModalState] = useState({ isOpen: false, mode: null })

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId) {
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/`, {
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        throw new Error(`Failed to load customer (${response.status})`)
      }
      const data = await response.json()
      setCustomer(data)
    } catch (loadError) {
      console.error(loadError)
      setError('Unable to load customer details.')
      showToast({
        title: 'Load failed',
        message: 'Unable to load customer details.',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }, [customerId, showToast])

  useEffect(() => {
    fetchCustomerDetails()
  }, [fetchCustomerDetails])

  useEffect(() => {
    setSessionsPage(1)
    setTransactionsPage(1)
  }, [customerId])

  useEffect(() => {
    if (!customerId) {
      return
    }
    let cancelled = false
    const controller = new AbortController()

    const loadExtras = async () => {
      try {
        const sessionsResponse = await fetch(
          `${API_BASE}/sessions/?customer_id=${customerId}&page=${sessionsPage}&page_size=${DEFAULT_TAB_PAGE_SIZE}`,
          {
          signal: controller.signal,
          credentials: 'include',
          headers: appendAuthHeader(),
          }
        )

        if (!cancelled) {
          const sessionData = await sessionsResponse.json().catch(() => ({}))
          if (sessionsResponse.ok) {
            const sessionRows = Array.isArray(sessionData) ? sessionData : sessionData.results ?? []
            setSessions({
              rows: sessionRows,
              pagination: Array.isArray(sessionData) ? null : sessionData.pagination ?? null,
            })
          } else {
            setSessions({ rows: [], pagination: null })
          }

          if (canAccessBilling) {
            const transactionsResponse = await fetch(
              `${API_BASE}/wallet/transactions/?customer_id=${customerId}&page=${transactionsPage}&page_size=${DEFAULT_TAB_PAGE_SIZE}`,
              {
                signal: controller.signal,
                credentials: 'include',
                headers: appendAuthHeader(),
              }
            )
            const transactionData = await transactionsResponse.json().catch(() => ({}))
            if (transactionsResponse.ok) {
              const transactionRows = Array.isArray(transactionData)
                ? transactionData
                : transactionData.results ?? []
              setTransactions(
                {
                  rows: transactionRows,
                  pagination: Array.isArray(transactionData)
                    ? null
                    : transactionData.pagination ?? null,
                }
              )
            } else {
              setTransactions({ rows: [], pagination: null })
            }
          } else {
            setTransactions({ rows: [], pagination: null })
          }
        }
      } catch (extrasError) {
        if (!cancelled) {
          console.error(extrasError)
        }
      }
    }

    loadExtras()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [canAccessBilling, customerId, sessionsPage, transactionsPage])

  const handleDelete = async () => {
    if (!customerId) {
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.detail || 'Failed to delete customer.')
      }
      showToast({
        title: 'Customer deleted',
        message: 'Customer has been removed successfully.',
        variant: 'success',
      })
      navigate('/customers', { replace: true })
    } catch (deleteError) {
      console.error(deleteError)
      showToast({
        title: 'Delete failed',
        message: deleteError.message || 'Unable to delete customer.',
        variant: 'error',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBlockConfirm = async () => {
    if (!customerId || !blockModalState.mode) {
      return
    }
    setIsBlocking(true)
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/block/`, {
        method: blockModalState.mode === 'block' ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || `Failed to ${blockModalState.mode} customer.`)
      }
      await fetchCustomerDetails()
      showToast({
        title: blockModalState.mode === 'block' ? 'Customer blocked' : 'Customer unblocked',
        message:
          blockModalState.mode === 'block'
            ? 'Customer blocked successfully.'
            : 'Customer unblocked successfully.',
        variant: 'success',
      })
    } catch (blockError) {
      console.error(blockError)
      showToast({
        title: blockModalState.mode === 'block' ? 'Block failed' : 'Unblock failed',
        message:
          blockError.message ||
          `Unable to ${blockModalState.mode === 'block' ? 'block' : 'unblock'} customer.`,
        variant: 'error',
      })
    } finally {
      setIsBlocking(false)
    }
  }

  const handleSendInvitation = async () => {
    if (!customerId) {
      return
    }
    setIsSendingInvitation(true)
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/invitation/send/`, {
        method: 'POST',
        credentials: 'include',
        headers: appendAuthHeader(),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to send invitation.')
      }
      showToast({
        title: 'Invitation sent',
        message: data?.detail || 'Invitation email sent successfully.',
        variant: 'success',
      })
      await fetchCustomerDetails()
    } catch (inviteError) {
      console.error(inviteError)
      showToast({
        title: 'Invitation failed',
        message: inviteError.message || 'Unable to send invitation.',
        variant: 'error',
      })
    } finally {
      setIsSendingInvitation(false)
    }
  }

  if (!customerId) {
    return null
  }

  const breadcrumbs = [
    { label: 'Home', to: '/overview' },
    { label: 'User Management' },
    { label: 'Customers', to: '/customers' },
    { label: customer?.first_name || customer?.email || 'Customer Details' },
  ]

  const fallbackBalance = canViewCustomerBalance
    ? typeof customer?.current_balance === 'number'
      ? customer.current_balance
      : canAccessBilling && typeof customer?.wallet_balance === 'number'
        ? customer.wallet_balance
        : 0
    : 0
  const currentBalance = fallbackBalance
  const totalFunds =
    typeof customer?.total_funds === 'number' ? customer.total_funds : currentBalance
  const sessionsCount =
    typeof customer?.sessions_count === 'number' ? customer.sessions_count : null
  const sessionsTotal =
    typeof customer?.sessions_total_amount === 'number'
      ? customer.sessions_total_amount
      : null
  const currency = customer?.preferred_currency || 'USD'
  const otherWallets =
    canAccessBilling && Array.isArray(customer?.other_wallets) ? customer.other_wallets : []
  const hasOtherWallets = otherWallets.length > 0
  const customerStatus = customer?.is_blocked
    ? 'Blocked'
    : customer?.is_active === false
      ? 'Inactive'
      : 'Active'
  const profileImageUrl = customer?.profile_image ? buildMediaUrl(customer.profile_image) : null
  const statusBadgeStyle = customer?.is_blocked
    ? {
        backgroundColor: 'rgba(237, 74, 74, 0.12)',
        color: '#ED4A4A',
        fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: '20px',
        textTransform: 'capitalize',
      }
    : customer?.is_active === false
      ? {
          backgroundColor: 'rgba(156, 163, 175, 0.14)',
          color: '#6B7280',
          fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          lineHeight: '20px',
          textTransform: 'capitalize',
        }
    : {
        backgroundColor: 'rgba(46, 165, 97, 0.12)',
        color: '#2EA561',
        fontFamily: 'Montserrat, "Inter", "Helvetica Neue", Arial, sans-serif',
        fontSize: '12px',
        fontWeight: 700,
        lineHeight: '20px',
        textTransform: 'capitalize',
      }
  const displayName =
    customer && (customer.first_name || customer.last_name)
      ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
      : customer?.email || 'Customer'
  const joinedDate = customer?.created_at
    ? new Date(customer.created_at).toLocaleDateString()
    : 'N/A'
  const emailVerified = resolveVerificationFlag(customer, 'email_verified')
  const mobileVerified = resolveVerificationFlag(customer, 'mobile_verified')
  const invitation = customer?.invitation || null
  const invitationStatusMap = {
    not_invited: 'Not Invited',
    pending: 'Pending',
    completed: 'Completed',
    active: 'Verified',
    expired: 'Expired',
    revoked: 'Revoked',
    blocked: 'Blocked',
    no_email: 'No Email',
    invalid_email: 'Invalid Email',
    user_missing: 'Missing User',
    already_verified: 'Verified',
    unknown: 'Unknown',
  }
  const invitationStatusKey = String(invitation?.status || 'unknown').toLowerCase()
  const invitationStatusLabel =
    invitationStatusMap[invitationStatusKey] ||
    invitationStatusKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

  useEffect(() => {
    if (activeTab === 'transactions' && !canAccessBilling) {
      setActiveTab('info')
    }
    if (activeTab === 'other-wallets' && !hasOtherWallets) {
      setActiveTab('info')
    }
  }, [activeTab, canAccessBilling, hasOtherWallets])

  const infoFields = [
    { label: 'ID Tag', value: customer?.id_tag || 'N/A' },
    { label: 'Date Joined', value: joinedDate },
    {},
    {},
    { label: 'Phone', value: customer?.phone_e164 || 'N/A' },
    { label: 'Car Model', value: customer?.car_model || 'N/A' },
    ...(canAccessBilling
      ? [
          { label: 'Plan', value: customer?.package?.name || customer?.package_name || 'N/A' },
          { label: 'Total Funds', value: formatCurrency(totalFunds, currency) },
          { label: 'Sessions Count', value: sessionsCount ?? 'N/A' },
          { label: 'Sessions Total', value: formatCurrency(sessionsTotal, currency) },
        ]
      : []),
    { label: 'District', value: customer?.district || 'N/A' },
    { label: 'Postal Code', value: customer?.postal_code || 'N/A' },
    { label: 'Country', value: customer?.country || customer?.country_code || 'N/A' },
    { label: 'City', value: customer?.city || 'N/A' },
    {
      label: 'Email Verification',
      value: emailVerified === null ? 'N/A' : emailVerified ? 'Verified' : 'Not Verified',
    },
    {
      label: 'Mobile Verification',
      value: mobileVerified === null ? 'N/A' : mobileVerified ? 'Verified' : 'Not Verified',
    },
    { label: 'Invitation Status', value: invitationStatusLabel },
    { label: 'Invitation Sent At', value: formatDateTime(invitation?.sent_at) },
    { label: 'Invitation Valid Till', value: formatDateTime(invitation?.expires_at) },
    { label: 'Invitation Completed At', value: formatDateTime(invitation?.completed_at) },
  ]

  const actionsDisabled = !customer || isLoading

  const heroActions = (
    <div className="customer-details-actions connector-details-actions">
      <button
        type="button"
        className="customer-outline-button danger"
        onClick={() => setDeleteModalState({ isOpen: true })}
        disabled={isDeleting || actionsDisabled}
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
      <button
        type="button"
        className={`customer-outline-button ${customer?.is_blocked ? '' : 'danger'}`}
        onClick={() =>
          setBlockModalState({ isOpen: true, mode: customer?.is_blocked ? 'unblock' : 'block' })
        }
        disabled={isBlocking || actionsDisabled}
      >
        {isBlocking ? 'Please wait...' : customer?.is_blocked ? 'Unblock' : 'Block'}
      </button>
      <button
        type="button"
        className="customer-outline-button"
        onClick={handleSendInvitation}
        disabled={isSendingInvitation || actionsDisabled}
      >
        {isSendingInvitation ? 'Sending...' : 'Send Invitation'}
      </button>
      <button
        type="button"
        className="connector-edit-button"
        onClick={() => navigate(`/customers/${customerId}/edit`)}
        disabled={actionsDisabled}
      >
        Edit
      </button>
    </div>
  )

  const renderSessions = () =>
    sessions.rows.length ? (
      <div className="customer-table-wrapper">
        <div
          className="chargers-table"
          style={{
            width: '100%',
            borderRadius: '16px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            className="chargers-table-header"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(30px,0.12fr) minmax(90px,0.65fr) minmax(70px,0.4fr) minmax(110px,0.6fr) minmax(90px,0.55fr) minmax(90px,0.55fr) minmax(70px,0.4fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(80px,0.45fr) minmax(80px,0.45fr) minmax(80px,0.45fr)',
              minWidth: '1140px',
            }}
          >
            <div className="charger-cell order">No</div>
            <div className="charger-cell">Charger</div>
            <div className="charger-cell">Connector</div>
            <div className="charger-cell">TID</div>
            <div className="charger-cell">Start</div>
            <div className="charger-cell">End</div>
            <div className="charger-cell">Duration</div>
            <div className="charger-cell">Energy</div>
            <div className="charger-cell">Total Amount</div>
            <div className="charger-cell">Revenue</div>
            <div className="charger-cell">Idle Fee</div>
            <div className="charger-cell">Idle Duration</div>
            <div className="charger-cell">Billable Idle</div>
            <div className="charger-cell">Status</div>
          </div>
          {sessions.rows.map((session, index) => {
            const pagination = sessions.pagination || {}
            const baseIndex =
              ((pagination.page || sessionsPage || 1) - 1) *
              (pagination.page_size || sessions.rows.length || DEFAULT_TAB_PAGE_SIZE)
            const rowNumber = baseIndex + index + 1
            return (
              <article
                key={session.id || rowNumber}
                className="charger-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(30px,0.12fr) minmax(90px,0.65fr) minmax(70px,0.4fr) minmax(110px,0.6fr) minmax(90px,0.55fr) minmax(90px,0.55fr) minmax(70px,0.4fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(60px,0.35fr) minmax(80px,0.45fr) minmax(80px,0.45fr) minmax(80px,0.45fr)',
                  minWidth: '1140px',
                }}
              >
                <div className="charger-cell order">{rowNumber}</div>
                <div className="charger-cell">{session.charger_name || '-'}</div>
                <div className="charger-cell">{session.connector_number || '-'}</div>
                <div className="charger-cell">{session.ocpp_transaction_id ?? '-'}</div>
                <div className="charger-cell">{formatDateTime(session.started_at)}</div>
                <div className="charger-cell">{formatDateTime(session.ended_at)}</div>
                <div className="charger-cell">{formatDuration(session.duration_seconds)}</div>
                <div className="charger-cell">
                  {session.energy_kwh != null ? session.energy_kwh.toFixed(2) : '-'}
                </div>
                <div className="charger-cell">
                  {renderBillingSummary(
                    session.total_amount ?? session.amount,
                    session.charging_amount,
                    session.currency || currency
                  )}
                </div>
                <div className="charger-cell">
                  {formatAmountWithCurrency(session.revenue, session.currency || currency)}
                </div>
                <div className="charger-cell">
                  {formatAmountWithCurrency(session.idle_fee, session.currency || currency)}
                </div>
                <div className="charger-cell">
                  {formatDuration(session.idle_time_seconds ?? session.idle_time)}
                </div>
                <div className="charger-cell">
                  {formatBillableMinutes(session.idle_billable_minutes)}
                </div>
                <div className="charger-cell">
                  {session.status ? renderSessionStatusBadge(session.status) : renderSessionStatusBadge('')}
                </div>
              </article>
            )
          })}
        </div>
        {sessions.pagination ? (
          <div className="sessions-pagination">
            <div className="sessions-page-size">
              <span className="rows-label">Rows in page</span>
              <div className="rows-select">
                <span className="rows-value">{sessions.pagination.page_size || DEFAULT_TAB_PAGE_SIZE}</span>
              </div>
            </div>
            <div className="sessions-page-nav">
              <span className="page-info">
                {sessions.pagination.page || 1} of {sessions.pagination.total_pages || 1}
              </span>
              <div className="page-buttons">
                <button
                  type="button"
                  className="page-button"
                  disabled={(sessions.pagination.page || 1) <= 1}
                  onClick={() => setSessionsPage((prev) => Math.max(1, prev - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="page-button"
                  disabled={
                    sessions.pagination.total_pages
                      ? (sessions.pagination.page || 1) >= sessions.pagination.total_pages
                      : false
                  }
                  onClick={() =>
                    setSessionsPage((prev) =>
                      sessions.pagination.total_pages
                        ? Math.min(sessions.pagination.total_pages, prev + 1)
                        : prev + 1
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      <div className="customer-empty-state">No sessions found.</div>
    )

  const renderTransactions = () =>
    transactions.rows.length ? (
      <div className="customer-table-wrapper">
        <div
          className="chargers-table"
          style={{
            width: '100%',
            borderRadius: '16px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            className="chargers-table-header"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(40px,0.2fr) minmax(150px,1fr) minmax(140px,1fr) minmax(120px,0.8fr) minmax(220px,1.3fr) minmax(160px,0.9fr) minmax(180px,1.2fr) minmax(120px,0.8fr)',
              minWidth: '1200px',
            }}
          >
            <div className="charger-cell order">No</div>
            <div className="charger-cell">Type</div>
            <div className="charger-cell">Date</div>
            <div className="charger-cell">Amount</div>
            <div className="charger-cell">Breakdown</div>
            <div className="charger-cell">Payment Method</div>
            <div className="charger-cell">Admin Action</div>
            <div className="charger-cell">Status</div>
          </div>
          {transactions.rows.map((tx, index) => {
            const pagination = transactions.pagination || {}
            const baseIndex =
              ((pagination.page || transactionsPage || 1) - 1) *
              (pagination.page_size || transactions.rows.length || DEFAULT_TAB_PAGE_SIZE)
            const rowNumber = baseIndex + index + 1
            return (
              <article
                key={tx.id || rowNumber}
                className="charger-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(40px,0.2fr) minmax(150px,1fr) minmax(140px,1fr) minmax(120px,0.8fr) minmax(220px,1.3fr) minmax(160px,0.9fr) minmax(180px,1.2fr) minmax(120px,0.8fr)',
                  minWidth: '1200px',
                }}
              >
                <div className="charger-cell order">{rowNumber}</div>
                <div className="charger-cell">
                  <div className="billing-breakdown">
                    <span className="billing-breakdown-primary">
                      {tx.type ? tx.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '-'}
                    </span>
                    <span className="billing-breakdown-note">
                      Receipt: {tx.receipt_number || '-'}
                    </span>
                  </div>
                </div>
                <div className="charger-cell">{formatDateTime(tx.created_at)}</div>
                <div className="charger-cell">
                  {tx.amount != null
                    ? formatCurrency(
                        getSignedTransactionAmount(tx),
                        tx.currency_code || tx.currency || currency
                      )
                    : '-'}
                </div>
                <div className="charger-cell">{renderTransactionBreakdown(tx, tx.currency_code || tx.currency || currency)}</div>
                <div className="charger-cell">
                  {formatPaymentMethod(tx)}
                </div>
                <div className="charger-cell">{tx.admin_action || '-'}</div>
                <div className="charger-cell">
                  {renderTransactionStatusBadge(tx.status)}
                </div>
              </article>
            )
          })}
        </div>
        {transactions.pagination ? (
          <div className="sessions-pagination">
            <div className="sessions-page-size">
              <span className="rows-label">Rows in page</span>
              <div className="rows-select">
                <span className="rows-value">
                  {transactions.pagination.page_size || DEFAULT_TAB_PAGE_SIZE}
                </span>
              </div>
            </div>
            <div className="sessions-page-nav">
              <span className="page-info">
                {transactions.pagination.page || 1} of {transactions.pagination.total_pages || 1}
              </span>
              <div className="page-buttons">
                <button
                  type="button"
                  className="page-button"
                  disabled={(transactions.pagination.page || 1) <= 1}
                  onClick={() => setTransactionsPage((prev) => Math.max(1, prev - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="page-button"
                  disabled={
                    transactions.pagination.total_pages
                      ? (transactions.pagination.page || 1) >= transactions.pagination.total_pages
                      : false
                  }
                  onClick={() =>
                    setTransactionsPage((prev) =>
                      transactions.pagination.total_pages
                        ? Math.min(transactions.pagination.total_pages, prev + 1)
                        : prev + 1
                    )
                  }
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      <div className="customer-empty-state">No transactions found.</div>
    )

  const renderOtherWallets = () =>
    hasOtherWallets ? (
      <div className="customer-table-wrapper">
        <div
          className="chargers-table"
          style={{
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          <div
            className="chargers-table-header"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(160px,1.1fr) minmax(110px,0.75fr) minmax(130px,0.9fr) minmax(130px,0.9fr) minmax(110px,0.7fr) minmax(140px,0.95fr)',
            }}
          >
            <div className="charger-cell">Country</div>
            <div className="charger-cell">Currency</div>
            <div className="charger-cell">Balance</div>
            <div className="charger-cell">Total Funds</div>
            <div className="charger-cell">Sessions</div>
            <div className="charger-cell">Sessions Total</div>
          </div>
          {otherWallets.map((wallet) => (
            <article
              key={wallet.country_code || wallet.country_name}
              className="charger-row"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(160px,1.1fr) minmax(110px,0.75fr) minmax(130px,0.9fr) minmax(130px,0.9fr) minmax(110px,0.7fr) minmax(140px,0.95fr)',
              }}
            >
              <div className="charger-cell">{wallet.country_name || wallet.country_code || '-'}</div>
              <div className="charger-cell">{wallet.currency_code || '-'}</div>
              <div className="charger-cell">
                {formatCurrency(wallet.balance, wallet.currency_code || 'USD')}
              </div>
              <div className="charger-cell">
                {formatCurrency(wallet.total_funds, wallet.currency_code || 'USD')}
              </div>
              <div className="charger-cell">{wallet.sessions_count ?? 0}</div>
              <div className="charger-cell">
                {formatCurrency(wallet.sessions_total_amount, wallet.currency_code || 'USD')}
              </div>
            </article>
          ))}
        </div>
      </div>
    ) : (
      <div className="customer-empty-state">No secondary wallets found.</div>
    )

  const renderContent = () => {
    if (isLoading) {
      return <div className="data-placeholder">Loading customer details...</div>
    }
    if (error && !customer) {
      return <div className="data-warning">{error}</div>
    }
    if (!customer) {
      return null
    }
    return (
      <>
        <section className="customer-hero-card">
          <div className="customer-hero-info">
            <div className="customer-hero-avatar" aria-hidden="true">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={`${displayName} profile`} />
              ) : (
                (displayName || 'C').charAt(0).toUpperCase()
              )}
            </div>
            <div className="customer-hero-meta">
              <h2>{displayName}</h2>
              <p>{customer.email || 'N/A'}</p>
              <span className="status-badge charger-status-badge" style={statusBadgeStyle}>
                {customerStatus}
              </span>
            </div>
          </div>
          
          {canViewCustomerBalance ? (
            <div className="customer-summary-card">
              <span className="customer-summary-label">Current Balance</span>
              <div className="customer-summary-value">
                {formatCurrency(currentBalance, currency)}
              </div>
            </div>
          ) : null}
            
          
        </section>

        <div className="customer-tabs">
          <button
            type="button"
            className={`customer-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Customer Info
          </button>
          <button
            type="button"
            className={`customer-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
          {canAccessBilling ? (
            <button
              type="button"
              className={`customer-tab ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </button>
          ) : null}
          {canAccessBilling && hasOtherWallets ? (
            <button
              type="button"
              className={`customer-tab ${activeTab === 'other-wallets' ? 'active' : ''}`}
              onClick={() => setActiveTab('other-wallets')}
            >
              Other Wallets
            </button>
          ) : null}
        </div>

        {activeTab === 'info' && (
          <section className="customer-card">
            <div className="customer-card-header">
              <h3>Customer Info</h3>
            </div>
            <div className="customer-info-grid">
              {infoFields.map((field, index) => (
                <div className="customer-info-field" key={`${field.label ?? 'field'}-${index}`}>
                  <span className="customer-info-label">{field.label}</span>
                  <span className="customer-info-value">{field.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'sessions' && (
          <section className="customer-card">{renderSessions()}</section>
        )}

        {canAccessBilling && activeTab === 'transactions' && (
          <section className="customer-card">{renderTransactions()}</section>
        )}

        {canAccessBilling && activeTab === 'other-wallets' && (
          <section className="customer-card">{renderOtherWallets()}</section>
        )}
      </>
    )
  }

  return (
    <div className="customer-details-page">
      <header className="customer-details-header">
        <div className="customer-details-heading">
          <Breadcrumbs items={breadcrumbs} />
          <div className="customer-details-title">
            <BackButton fallbackTo="/customers" ariaLabel="Back to customers" />
            <h1>Customer Details</h1>
          </div>
        </div>
        {heroActions}
      </header>

      <InlineToastRegion region="customers" />

      {renderContent()}

      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false })}
        onConfirm={handleDelete}
        title="Delete Customer"
        itemName={displayName}
        confirmationMessage="Are you sure you want to delete this customer?"
      />

      <DeleteConfirmationModal
        isOpen={blockModalState.isOpen}
        onClose={() => setBlockModalState({ isOpen: false, mode: null })}
        onConfirm={handleBlockConfirm}
        title={blockModalState.mode === 'block' ? 'Block Customer' : 'Unblock Customer'}
        itemName={displayName}
        confirmationMessage={
          blockModalState.mode === 'block'
            ? 'Are you sure you want to block this customer? Once blocked, this customer will remain in the system until unblocked.'
            : 'Are you sure you want to unblock this customer?'
        }
        confirmLabel={blockModalState.mode === 'block' ? 'Block' : 'Unblock'}
        warningMessage=""
      />
    </div>
  )
}

export default CustomerDetails

