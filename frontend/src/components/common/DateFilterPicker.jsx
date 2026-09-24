import { useEffect, useMemo, useRef, useState } from 'react'

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

const buildMonthCells = (monthDate) => {
  const firstOfMonth = startOfMonth(monthDate)
  const startDay = firstOfMonth.getDay()
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const prevMonthDays = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0).getDate()

  const cells = []
  for (let i = 0; i < 42; i += 1) {
    let date
    let currentMonth = false
    if (i < startDay) {
      const day = prevMonthDays - startDay + i + 1
      date = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, day)
    } else if (i >= startDay + totalDays) {
      const day = i - (startDay + totalDays) + 1
      date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, day)
    } else {
      const day = i - startDay + 1
      date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
      currentMonth = true
    }
    cells.push({ date, currentMonth })
  }
  return cells
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseLocalDate = (value) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const text = String(value)
  if (DATE_ONLY_PATTERN.test(text)) {
    const [year, month, day] = text.split('-').map((part) => Number(part))
    if (!year || !month || !day) {
      return null
    }
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

const formatLocalDate = (date) => {
  if (!date) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const formatDisplayDate = (value) => {
  if (!value) {
    return ''
  }
  const parsed = parseLocalDate(value)
  if (!parsed) {
    return String(value)
  }
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function DateFilterPicker({
  id,
  label,
  placeholder = 'Select date',
  value = '',
  onChange = () => {},
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initialDate = parseLocalDate(value) || new Date()
    return startOfMonth(initialDate)
  })
  const pickerRef = useRef(null)

  useEffect(() => {
    const parsed = parseLocalDate(value)
    if (parsed) {
      setCurrentMonth(startOfMonth(parsed))
    }
  }, [value])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const cells = useMemo(() => buildMonthCells(currentMonth), [currentMonth])

  const handleMonthStep = (direction) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + direction)
      return startOfMonth(next)
    })
  }

  const handleDateSelect = (date, isCurrentMonth) => {
    if (!isCurrentMonth) {
      return
    }
    const isoDate = formatLocalDate(date)
    if (isoDate === value) {
      onChange('')
    } else {
      onChange(isoDate)
    }
    setIsOpen(false)
  }

  const displayValue = value ? formatDisplayDate(value) : placeholder

  return (
    <div className={`filter-field ${className ?? ''}`}>
      {label ? (
        <label htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="date-picker-field filter-date-picker" ref={pickerRef}>
        <button
          type="button"
          id={id}
          className={`filter-date-trigger ${value ? 'has-value' : ''}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <span className="filter-date-value">{displayValue}</span>
          <span className="filter-date-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#calendar-clip)">
                <path
                  d="M1.5 2.8125H16.5C16.5 2.8125 17.625 2.8125 17.625 3.9375V16.3125C17.625 16.3125 17.625 17.4375 16.5 17.4375H1.5C1.5 17.4375 0.375 17.4375 0.375 16.3125V3.9375C0.375 3.9375 0.375 2.8125 1.5 2.8125Z"
                  stroke="#67716B"
                  strokeWidth="1.125"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M0.375 7.3125H17.625" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.875 4.5V0.5625" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.75 4.5V0.5625" stroke="#67716B" strokeWidth="1.125" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="calendar-clip">
                  <rect width="18" height="18" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </span>
        </button>
        {isOpen ? (
          <div className="date-picker-dialog" role="dialog" aria-label={label || placeholder}>
            <div className="date-picker-header">
              <button
                type="button"
                className="date-picker-nav-button"
                onClick={() => handleMonthStep(-1)}
                aria-label="Previous month"
              >
                {'<'}
              </button>
              <span className="date-picker-month">
                {currentMonth.toLocaleString('default', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                className="date-picker-nav-button"
                onClick={() => handleMonthStep(1)}
                aria-label="Next month"
              >
                {'>'}
              </button>
            </div>
            <div className="date-picker-calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day} className="date-picker-day-name">
                  {day}
                </span>
              ))}
              {cells.map(({ date, currentMonth: isCurrentMonth }) => {
                const selectedDate = parseLocalDate(value)
                const selected = selectedDate && isSameDay(date, selectedDate)
                return (
                  <button
                    key={formatLocalDate(date)}
                    type="button"
                    className={`date-picker-day ${!isCurrentMonth ? 'muted' : ''} ${selected ? 'selected' : ''}`}
                    onClick={() => handleDateSelect(date, isCurrentMonth)}
                    disabled={!isCurrentMonth}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="filter-date-reset-row">
              <button
                type="button"
                className="filter-date-reset"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                disabled={!value}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DateFilterPicker
