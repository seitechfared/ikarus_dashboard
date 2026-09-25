import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from '@/components/ui/atoms/ChevronDown'
import { ChevronUp } from '@/components/ui/atoms/ChevronUp'
import './CountrySelect.css'
import '@/styles/dashboard.css'

function CountrySelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select country',
  disabled = false,
  isLoading = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  )

  const handleSelect = (nextValue) => {
    if (disabled) {
      return
    }
    onChange?.({ target: { value: nextValue } })
    setIsOpen(false)
  }

  return (
    <div
      ref={dropdownRef}
      className={`pill-dropdown country-select ${className} ${disabled ? 'disabled' : ''}`.trim()}
    >
      <button
        type="button"
        className="pill-dropdown-trigger country-select-trigger"
        onClick={() => !disabled && setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        disabled={disabled}
      >
        <span className={`pill-dropdown-selected ${selectedOption ? '' : 'country-select-placeholder'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="pill-dropdown-arrow" aria-hidden="true">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>

      {isOpen ? (
        <div className="pill-dropdown-menu country-select-menu" id={`${id}-menu`} role="listbox">
          {options.length ? (
            options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`country-select-option ${isSelected ? 'selected' : ''}`.trim()}
                  onClick={() => handleSelect(option.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="country-select-option__label">{option.label}</span>
                </button>
              )
            })
          ) : (
            <div className="pill-dropdown-empty">{isLoading ? 'Loading...' : 'No countries found.'}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default CountrySelect
