import { useNavigate } from 'react-router-dom'
import '@/styles/dashboard.css'

function BackButton({ className = '', ariaLabel = 'Go back', fallbackTo = '/overview', onClick }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (typeof onClick === 'function') {
      onClick()
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    if (fallbackTo) {
      navigate(fallbackTo)
    }
  }

  return (
    <button
      type="button"
      className={`page-back-button ${className}`.trim()}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <span className="page-back-button-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.5 6.5 8.5 12l6 5.5"
            stroke="var(--theme-secondary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}

export default BackButton
