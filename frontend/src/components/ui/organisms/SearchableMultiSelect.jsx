import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from '@/components/ui/atoms/ChevronDown'
import { ChevronUp } from '@/components/ui/atoms/ChevronUp'
import './SearchableMultiSelect.css'
import '@/styles/dashboard.css'

const normalizeValue = (value) => String(value ?? '').trim()
const dedupeNormalizedValues = (values = []) =>
  Array.from(new Set(values.map(normalizeValue).filter(Boolean)))

function SearchableMultiSelect({
  id,
  options = [],
  groups = [],
  selectedValues = [],
  allSelected = false,
  onApply,
  placeholder = 'Select options',
  searchPlaceholder = 'Search...',
  allLabel = 'All',
  resetLabel = 'Reset',
  showReset = true,
  disabled = false,
  isLoading = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  const normalizedOptions = useMemo(
    () =>
      options.map((option) => ({
        ...option,
        value: normalizeValue(option.value),
      })),
    [options]
  )

  const normalizedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        options: (group.options || []).map((option) => ({
          ...option,
          value: normalizeValue(option.value),
        })),
      })),
    [groups]
  )

  const committedSelectedValues = useMemo(
    () => (allSelected ? [] : dedupeNormalizedValues(selectedValues)),
    [allSelected, selectedValues]
  )
  const committedAllSelected = Boolean(allSelected && committedSelectedValues.length === 0)

  const [draftValues, setDraftValues] = useState(() => new Set(committedSelectedValues))
  const [draftAllSelected, setDraftAllSelected] = useState(committedAllSelected)

  useEffect(() => {
    if (!isOpen) {
      setDraftValues(new Set(committedSelectedValues))
      setDraftAllSelected(committedAllSelected)
      setSearchTerm('')
    }
  }, [committedAllSelected, committedSelectedValues, isOpen])

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

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return normalizedOptions
    }
    const normalizedTerm = searchTerm.trim().toLowerCase()
    return normalizedOptions.filter((option) => {
      const label = String(option.label ?? '').toLowerCase()
      const value = normalizeValue(option.value).toLowerCase()
      return label.includes(normalizedTerm) || value.includes(normalizedTerm)
    })
  }, [normalizedOptions, searchTerm])

  const filteredGroups = useMemo(() => {
    if (!normalizedGroups.length) {
      return []
    }
    const normalizedTerm = searchTerm.trim().toLowerCase()
    return normalizedGroups
      .map((group) => {
        const nextOptions = !normalizedTerm
          ? group.options
          : group.options.filter((option) => {
              const label = String(option.label ?? '').toLowerCase()
              const value = normalizeValue(option.value).toLowerCase()
              return label.includes(normalizedTerm) || value.includes(normalizedTerm)
            })
        return {
          ...group,
          options: nextOptions,
        }
      })
      .filter((group) => group.options.length > 0 || !normalizedTerm)
  }, [normalizedGroups, searchTerm])

  const allDisplayOptions = useMemo(() => {
    if (normalizedGroups.length) {
      return normalizedGroups.flatMap((group) => group.options)
    }
    return normalizedOptions
  }, [normalizedGroups, normalizedOptions])

  const allOptionValues = useMemo(
    () => allDisplayOptions.map((option) => normalizeValue(option.value)).filter(Boolean),
    [allDisplayOptions]
  )

  const effectiveAllSelected = isOpen ? draftAllSelected : committedAllSelected
  const effectiveSelectedValues = useMemo(
    () => (isOpen ? Array.from(draftValues) : committedSelectedValues),
    [committedSelectedValues, draftValues, isOpen]
  )

  const displayValue = useMemo(() => {
    if (effectiveAllSelected) {
      return allLabel
    }
    const selectedValueSet = new Set(effectiveSelectedValues)
    const labels = allDisplayOptions
      .filter((option) => selectedValueSet.has(normalizeValue(option.value)))
      .map((option) => option.label)
    if (!labels.length) {
      return placeholder
    }
    if (labels.length <= 2) {
      return labels.join(', ')
    }
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }, [allDisplayOptions, allLabel, effectiveAllSelected, effectiveSelectedValues, placeholder])

  const toggleValue = (nextValue) => {
    const normalizedNextValue = normalizeValue(nextValue)
    if (!normalizedNextValue) {
      return
    }
    if (draftAllSelected) {
      const next = new Set(allOptionValues)
      next.delete(normalizedNextValue)
      setDraftAllSelected(false)
      setDraftValues(next)
      return
    }
    setDraftAllSelected(false)
    setDraftValues((current) => {
      const next = new Set(current)
      if (next.has(normalizedNextValue)) {
        next.delete(normalizedNextValue)
      } else {
        next.add(normalizedNextValue)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (draftAllSelected) {
      setDraftAllSelected(false)
      setDraftValues(new Set())
      return
    }
    setDraftAllSelected(true)
    setDraftValues(new Set())
  }

  const isOptionChecked = (normalizedOptionValue) => {
    if (!normalizedOptionValue) {
      return false
    }
    if (draftAllSelected) {
      return allOptionValues.includes(normalizedOptionValue)
    }
    return draftValues.has(normalizedOptionValue)
  }

  const handleReset = () => {
    setDraftAllSelected(true)
    setDraftValues(new Set())
  }

  const handleApply = () => {
    onApply?.({
      values: draftAllSelected ? [] : Array.from(draftValues),
      allSelected: draftAllSelected,
    })
    setIsOpen(false)
  }

  return (
    <div
      className={`pill-dropdown searchable-multiselect ${className} ${disabled ? 'disabled' : ''}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        className="pill-dropdown-trigger searchable-multiselect-trigger"
        onClick={() => !disabled && setIsOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={`${id}-menu`}
        disabled={disabled}
      >
        <span
          className={`pill-dropdown-selected ${effectiveAllSelected || effectiveSelectedValues.length ? '' : 'searchable-multiselect-placeholder'}`}
        >
          {displayValue}
        </span>
        <span className="pill-dropdown-arrow" aria-hidden="true">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>
      {isOpen ? (
        <div className="searchable-multiselect-menu" id={`${id}-menu`} role="dialog">
          <div className="searchable-multiselect-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>

          <button
            type="button"
            className={`searchable-multiselect-option searchable-multiselect-option--global ${draftAllSelected ? 'selected' : ''}`}
            role="checkbox"
            aria-checked={draftAllSelected}
            onClick={toggleAll}
          >
            <span className="searchable-multiselect-checkbox" aria-hidden="true" />
            <span className="searchable-multiselect-option__label">{allLabel}</span>
          </button>

          <div className="searchable-multiselect-options">
            {normalizedGroups.length ? (
              filteredGroups.length ? (
                filteredGroups.map((group) => {
                  return (
                    <div className="searchable-multiselect-group" key={group.id || group.label}>
                      <div className="searchable-multiselect-group__title">{group.label}</div>
                      {group.options.map((option) => {
                        const normalizedOptionValue = normalizeValue(option.value)
                        const isChecked = isOptionChecked(normalizedOptionValue)
                        return (
                          <button
                            type="button"
                            key={normalizedOptionValue}
                            className={`searchable-multiselect-option ${isChecked ? 'selected' : ''}`}
                            role="checkbox"
                            aria-checked={isChecked}
                            onClick={() => toggleValue(normalizedOptionValue)}
                          >
                            <span className="searchable-multiselect-checkbox" aria-hidden="true" />
                            <span className="searchable-multiselect-option__label">{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                <div className="searchable-multiselect-empty">
                  {isLoading ? 'Loading...' : 'No results found.'}
                </div>
              )
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => {
                const normalizedOptionValue = normalizeValue(option.value)
                const isChecked = isOptionChecked(normalizedOptionValue)
                return (
                  <button
                    type="button"
                    key={normalizedOptionValue}
                    className={`searchable-multiselect-option ${isChecked ? 'selected' : ''}`}
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggleValue(normalizedOptionValue)}
                  >
                    <span className="searchable-multiselect-checkbox" aria-hidden="true" />
                    <span className="searchable-multiselect-option__label">{option.label}</span>
                  </button>
                )
              })
            ) : (
              <div className="searchable-multiselect-empty">
                {isLoading ? 'Loading...' : 'No results found.'}
              </div>
            )}
          </div>

          <div className="searchable-multiselect-actions">
            <button
              type="button"
              className="searchable-multiselect-primary"
              onClick={handleApply}
            >
              Apply
            </button>
            {showReset ? (
              <button
                type="button"
                className="searchable-multiselect-secondary"
                onClick={handleReset}
              >
                {resetLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default SearchableMultiSelect
