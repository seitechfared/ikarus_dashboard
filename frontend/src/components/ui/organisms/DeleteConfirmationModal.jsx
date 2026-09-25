// IkarusDashboard/frontend/src/components/common/DeleteConfirmationModal.jsx

import { useEffect } from 'react'
import './DeleteConfirmationModal.css'

/**
 * Delete Confirmation Modal Component
 * 
 * Replaces window.confirm() with a styled modal dialog
 * 
 * Props:
 * - isOpen: boolean - controls modal visibility
 * - onClose: function() - called when modal should close (cancel or X button)
 * - onConfirm: function() - called when user confirms deletion
 * - title: string - the title text (e.g., "Delete Site Owner")
 * - itemName: string - the name of the item being deleted (optional)
 * - confirmationMessage: string - custom confirmation message (optional)
 * - warningMessage: string - custom warning message (optional, defaults to "Once deleted, this cannot be recovered")
 * - confirmLabel: string - label for the confirm button (optional, defaults to "Delete")
 * - confirmDisabled: boolean - disable confirm button (optional, defaults to false)
 */
function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete',
  itemName,
  confirmationMessage,
  warningMessage = 'Once deleted, this cannot be recovered',
  confirmLabel = 'Delete',
  confirmDisabled = false,
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) {
      return
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

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleConfirm = () => {
    if (confirmDisabled) {
      return
    }
    onConfirm()
    onClose()
  }

  const displayTitle = itemName ? `${title} ${itemName}` : title
  const displayConfirmation = confirmationMessage || 
    (itemName ? `Are you sure you want to delete ${itemName}?` : 'Are you sure you want to delete this item?')

  return (
    <div className={`delete-modal-backdrop${className ? ` ${className}` : ''}`} onClick={handleBackdropClick}>
      <div className="delete-alert-card">
        <div className="delete-modal-header">
          <div className="delete-modal-header-container">
            <div className="delete-modal-title-container">
              <span className="delete-modal-value">{displayTitle}</span>
            </div>
            <button
              type="button"
              className="delete-modal-close-button"
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="23.5" stroke="#CFD8DC" />
              </svg>
              <svg
                className="delete-modal-close-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M13.4037 11.9947L17.6984 7.71002C18.09 7.31838 18.09 6.68341 17.6984 6.29178C17.3068 5.90014 16.6718 5.90014 16.2802 6.29178L11.9955 10.5865L7.71075 6.29178C7.31911 5.90014 6.68414 5.90014 6.2925 6.29178C5.90087 6.68341 5.90087 7.31838 6.2925 7.71002L10.5872 11.9947L6.2925 16.2794C6.10342 16.467 5.99707 16.7222 5.99707 16.9885C5.99707 17.2549 6.10342 17.5101 6.2925 17.6977C6.48004 17.8868 6.73532 17.9931 7.00163 17.9931C7.26793 17.9931 7.52321 17.8868 7.71075 17.6977L11.9955 13.403L16.2802 17.6977C16.4677 17.8868 16.723 17.9931 16.9893 17.9931C17.2556 17.9931 17.5109 17.8868 17.6984 17.6977C17.8875 17.5101 17.9938 17.2549 17.9938 16.9885C17.9938 16.7222 17.8875 16.467 17.6984 16.2794L13.4037 11.9947Z"
                  fill="#407295"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="delete-modal-warning-icon-container">
          <div className="delete-modal-frame">
            <svg
              className="delete-modal-warning-vector"
              width="10"
              height="48"
              viewBox="0 0 10 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1.39368 26.6734L0.396183 11.7634C0.201183 8.76341 -0.822566 3.91466 1.46868 1.47716C3.21243 -0.397839 7.34118 -0.720338 8.59368 1.87841C9.65873 4.93216 9.89424 8.21387 9.27618 11.3884L7.94118 26.7372C7.8838 28.1818 7.56753 29.6043 7.00743 30.9372C6.78696 31.3684 6.45271 31.7312 6.04086 31.9862C5.62902 32.2411 5.15527 32.3785 4.67092 32.3836C4.18658 32.3886 3.71009 32.261 3.29304 32.0146C2.876 31.7683 2.5343 31.4125 2.30493 30.9859C1.77717 29.605 1.46967 28.1498 1.39368 26.6734ZM4.84743 47.1597C3.66489 47.153 2.5293 46.6961 1.67174 45.8818C0.814172 45.0675 0.299059 43.9571 0.231213 42.7765C0.163367 41.5959 0.547887 40.4338 1.30653 39.5266C2.06517 38.6195 3.14094 38.0355 4.31493 37.8934C4.94565 37.8171 5.58531 37.8708 6.19445 38.0513C6.80359 38.2318 7.3693 38.5351 7.85665 38.9427C8.344 39.3503 8.74266 39.8534 9.02804 40.421C9.31341 40.9886 9.47945 41.6087 9.5159 42.243C9.55235 42.8772 9.45843 43.5122 9.23996 44.1088C9.02149 44.7054 8.68308 45.2508 8.24563 45.7116C7.80817 46.1723 7.28095 46.5385 6.6965 46.7875C6.11204 47.0366 5.48273 47.1632 4.84743 47.1597Z"
                fill="#DC5353"
              />
            </svg>
            <svg
              className="delete-modal-warning-vector-01"
              width="107"
              height="90"
              viewBox="0 0 107 90"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M95.1241 89.6888H11.1766C9.20426 89.6585 7.27387 89.1147 5.57572 88.111C3.87756 87.1074 2.47026 85.6785 1.49252 83.9653C0.51479 82.2521 0.00038106 80.3137 2.11628e-07 78.3411C-0.000380637 76.3685 0.51328 74.4299 1.49035 72.7163L43.5129 5.35507C44.5337 3.71412 45.9566 2.36099 47.6468 1.42386C49.337 0.486728 51.2384 -0.00336258 53.171 1.73647e-05C55.1036 0.00339731 57.0033 0.500135 58.6902 1.44317C60.377 2.38621 61.7952 3.74431 62.8104 5.38882L104.765 72.6376C105.759 74.3502 106.287 76.2927 106.298 78.2726C106.309 80.2524 105.802 82.2007 104.828 83.9241C103.853 85.6476 102.445 87.0863 100.743 88.0975C99.0407 89.1087 97.1037 89.6573 95.1241 89.6888ZM49.9216 9.24757L7.90285 76.6088C7.59299 77.1809 7.43603 77.8232 7.44714 78.4737C7.45825 79.1242 7.63706 79.7608 7.96628 80.322C8.2955 80.8831 8.76397 81.3498 9.32637 81.6768C9.88878 82.0039 10.5261 82.1802 11.1766 82.1888H95.1241C95.7817 82.1788 96.4254 81.9976 96.9916 81.663C97.5578 81.3283 98.0271 80.8519 98.353 80.2807C98.679 79.7094 98.8504 79.063 98.8503 78.4053C98.8503 77.7476 98.6788 77.1013 98.3529 76.5301C98.3529 76.5301 56.3979 9.27007 56.3791 9.24757C56.0338 8.70393 55.5568 8.25629 54.9924 7.94614C54.428 7.63599 53.7944 7.47337 53.1503 7.47337C52.5063 7.47337 51.8727 7.63599 51.3083 7.94614C50.7439 8.25629 50.2669 8.70393 49.9216 9.24757Z"
                fill="#DC5353"
              />
            </svg>
          </div>
          <div className="delete-modal-message-container">
            <span className="delete-modal-confirmation-message">{displayConfirmation}</span>
            <span className="delete-modal-warning-message">{warningMessage}</span>
          </div>
        </div>

        <div className="delete-modal-action-buttons-container">
          <div className="delete-modal-action-buttons">
            <button
              type="button"
              className="delete-modal-button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
            >
              <span className="delete-modal-label">{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmationModal

