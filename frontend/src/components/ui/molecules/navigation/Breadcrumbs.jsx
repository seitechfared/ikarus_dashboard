import { useMemo } from 'react'
import { Link } from 'react-router-dom'

const ChevronRightIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function Breadcrumbs({ items, className = '' }) {
  const segments = useMemo(() => {
    const parts = []

    items.forEach((item, index) => {
      const isLast = index === items.length - 1
      const hasAction = Boolean(!isLast && (item.to || typeof item.onClick === 'function'))

      if (hasAction) {
        if (item.to && typeof item.onClick !== 'function') {
          parts.push(
            <Link key={`crumb-${index}`} to={item.to} className="breadcrumb-link">
              {item.label}
            </Link>
          )
        } else {
          parts.push(
            <button
              type="button"
              key={`crumb-${index}`}
              className="breadcrumb-link"
              onClick={() => {
                if (typeof item.onClick === 'function') {
                  item.onClick()
                }
              }}
            >
              {item.label}
            </button>
          )
        }
      } else {
        parts.push(
          <span
            key={`crumb-${index}`}
            className={`breadcrumb-label ${isLast ? 'breadcrumb-current' : ''}`.trim()}
            aria-current={isLast ? 'page' : undefined}
          >
            {item.label}
          </span>
        )
      }

      if (!isLast) {
        parts.push(
          <span key={`divider-${index}`} className="breadcrumb-divider" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        )
      }
    })

    return parts
  }, [items])

  return (
    <nav className={`breadcrumb ${className}`.trim()} aria-label="Breadcrumb">
      {segments}
    </nav>
  )
}

export default Breadcrumbs
