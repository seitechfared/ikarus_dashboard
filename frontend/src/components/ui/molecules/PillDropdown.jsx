import { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown } from '@/components/ui/atoms/ChevronDown'
import { ChevronUp } from '@/components/ui/atoms/ChevronUp'
import '@/styles/dashboard.css'

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_505_24413)">
      <path
        d="M14.8566 9.14216H1.14228C0.456563 9.14216 -0.000579834 8.68502 -0.000579834 7.9993C-0.000579834 7.31359 0.456563 6.85645 1.14228 6.85645H14.8566C15.5423 6.85645 15.9994 7.31359 15.9994 7.9993C15.9994 8.68502 15.5423 9.14216 14.8566 9.14216Z"
        fill="#99A19D"
      />
      <path
        d="M7.99939 15.9993C7.31368 15.9993 6.85654 15.5421 6.85654 14.8564V1.14212C6.85654 0.45641 7.31368 -0.000732422 7.99939 -0.000732422C8.68511 -0.000732422 9.14225 0.45641 9.14225 1.14212V14.8564C9.14225 15.5421 8.68511 15.9993 7.99939 15.9993Z"
        fill="#99A19D"
      />
    </g>
    <defs>
      <clipPath id="clip0_505_24413">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M15.996 3.66114C15.9965 3.83776 15.962 4.01271 15.8944 4.17588C15.8268 4.33905 15.7275 4.48719 15.6023 4.61174L7.12522 13.0889C6.7439 13.4691 6.22739 13.6826 5.68891 13.6826C5.15043 13.6826 4.63391 13.4691 4.2526 13.0889L0.397377 9.23361C0.271813 9.10893 0.172097 8.96069 0.103948 8.79739C0.0357991 8.63409 0.000558162 8.45894 0.00024623 8.28199C-6.57027e-05 8.10504 0.0345575 7.92977 0.10213 7.76623C0.169703 7.60269 0.268895 7.4541 0.394019 7.32897C0.519143 7.20385 0.667737 7.10466 0.831279 7.03709C0.99482 6.96952 1.17009 6.9349 1.34704 6.93522C1.52399 6.93553 1.69914 6.97078 1.86244 7.03893C2.02574 7.10708 2.17398 7.2068 2.29866 7.33236L5.68891 10.7226L13.7011 2.71046C13.8891 2.52242 14.1287 2.39437 14.3895 2.34249C14.6503 2.29061 14.9206 2.31723 15.1662 2.419C15.4119 2.52076 15.6218 2.6931 15.7696 2.9142C15.9173 3.1353 15.9961 3.39524 15.996 3.66114Z"
      fill="white"
    />
  </svg>
)

export default function PillDropdown({
  id,
  value,
  onChange,
  options,
  label,
  className = '',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  isLoading = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  const hasControlledSearch = controlledSearchTerm !== undefined
  const effectiveSearchTerm = hasControlledSearch ? controlledSearchTerm : searchTerm

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen && !hasControlledSearch) {
      setSearchTerm('')
    }
  }, [hasControlledSearch, isOpen])

  const selectedOption = options.find((opt) => opt.value === value) || options[0]
  const filteredOptions = useMemo(() => {
    if (!searchable || !effectiveSearchTerm.trim()) {
      return options
    }
    const normalized = effectiveSearchTerm.trim().toLowerCase()
    if (!normalized) {
      return options
    }
    const placeholder =
      options?.length && (options[0].value === '' || options[0].value === null)
        ? options[0]
        : null
    const searchOptions = placeholder ? options.slice(1) : options
    const matches = searchOptions.filter((option) => {
      const labelText = String(option.label ?? '').toLowerCase()
      const valueText = String(option.value ?? '').toLowerCase()
      return labelText.includes(normalized) || valueText.includes(normalized)
    })
    return placeholder ? [placeholder, ...matches] : matches
  }, [effectiveSearchTerm, options, searchable])

  const handleSelect = (optionValue) => {
    if (disabled) return
    onChange({ target: { value: optionValue } })
    setIsOpen(false)
  }

  return (
    <div className={`pill-dropdown ${className} ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="pill-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        disabled={disabled}
      >
        <span className="pill-dropdown-selected">
          {selectedOption?.label || 'Select...'}
        </span>
        <span className="pill-dropdown-arrow" aria-hidden="true">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>
      {isOpen && (
        <div className="pill-dropdown-menu" id={`${id}-menu`} role="listbox">
          {searchable ? (
            <div className="pill-dropdown-search">
              <input
                type="text"
                value={effectiveSearchTerm}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (!hasControlledSearch) {
                    setSearchTerm(nextValue)
                  }
                  onSearchTermChange?.(nextValue)
                }}
                placeholder={searchPlaceholder}
                aria-label={label ? `${label} search` : 'Search options'}
              />
            </div>
          ) : null}
          {filteredOptions.length ? (
            filteredOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`pill-dropdown-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="pill-dropdown-option-icon" aria-hidden="true">
                    {isSelected ? <CheckIcon /> : <PlusIcon />}
                  </span>
                  <span className="pill-dropdown-option-label">{option.label}</span>
                </button>
              )
            })
          ) : (
            <div className="pill-dropdown-empty">{isLoading ? 'Loading...' : 'No results found.'}</div>
          )}
        </div>
      )}
    </div>
  )
}

