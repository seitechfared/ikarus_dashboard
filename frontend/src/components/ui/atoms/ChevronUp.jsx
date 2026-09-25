import React from 'react'

export const ChevronUp = ({ isActive = false }) => {
  return (
    <div data-svg-wrapper data-layer="Chevron up" data-property-1="Up">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8.25 13.875L12 10.125L15.75 13.875"
          stroke={isActive ? '#547445' : '#797D79'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {isActive && (
          <path
            d="M8.25 13.875L12 10.125L15.75 13.875"
            stroke="url(#paint0_linear_chevron_up)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {isActive && (
          <defs>
            <linearGradient id="paint0_linear_chevron_up" x1="8.25" y1="14.7375" x2="21.5792" y2="4.94561" gradientUnits="userSpaceOnUse">
              <stop stopColor="#547445" />
              <stop offset="1" stopColor="#9EDA82" />
            </linearGradient>
          </defs>
        )}
      </svg>
    </div>
  )
}

