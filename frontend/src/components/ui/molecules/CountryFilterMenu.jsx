import { useEffect, useMemo, useRef, useState } from 'react'

const FilterCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="18" height="18" rx="4" fill="var(--theme-primary)" />
    <path
      d="M13.7273 6L7.72727 12L5 9.27273"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function CountryFilterMenu({
  id,
  title = 'Country',
  value = '',
  options = [],
  onChange,
  defaultLabel = 'All countries',
  align = 'left',
  triggerClassName = '',
  className = '',
  showAllOption = true,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleMouseDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  const normalizedOptions = useMemo(
    () =>
      options
        .map((option) => ({
          value: option.code ?? option.value ?? '',
          label: option.name ?? option.label ?? '',
          count: Number.isFinite(option.count) ? option.count : null,
        }))
        .filter((option) => option.value && option.label),
    [options]
  )

  const selectedOption = normalizedOptions.find((option) => String(option.value) === String(value))
  const triggerLabel = selectedOption?.label || defaultLabel
  const selectedCount = selectedOption ? 1 : 0
  const menuClassName = [
    'multi-select-menu',
    'filter-menu',
    'country-filter-menu',
    align === 'right' ? 'filter-menu--align-right' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const rootClassName = ['multi-select', isOpen ? 'open' : '', className].filter(Boolean).join(' ')
  const triggerClasses = ['multi-select-trigger', 'country-filter-trigger', triggerClassName]
    .filter(Boolean)
    .join(' ')

  const items = [
    ...(showAllOption ? [{ value: '', label: defaultLabel, count: null }] : []),
    ...normalizedOptions,
  ]

  return (
    <div className="filter-field" ref={containerRef}>
      <div className={rootClassName}>
        <button
          type="button"
          className={triggerClasses}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={`${id}-menu`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {triggerLabel}
        </button>
        {isOpen ? (
          <div id={`${id}-menu`} className={menuClassName} role="dialog" aria-label={`Filter by ${title.toLowerCase()}`}>
            <div className="filter-menu__header">
              <span className="filter-menu__title">{title}</span>
              <span className="filter-menu__badge">{selectedCount}</span>
            </div>
            <div className="filter-menu__body">
              {items.map((option) => {
                const isSelected = String(option.value) === String(value)
                return (
                  <button
                    key={`${id}-${option.value || 'all'}`}
                    type="button"
                    className={`filter-menu__item${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      onChange(option.value)
                      setIsOpen(false)
                    }}
                  >
                    <span className="filter-menu__item-content">
                      <span className="filter-menu__checkbox" aria-hidden="true">
                        {isSelected ? <FilterCheckIcon /> : null}
                      </span>
                      <span className="filter-menu__name">{option.label}</span>
                    </span>
                    {option.count !== null ? (
                      <span className="filter-menu__count">{option.count.toLocaleString()}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CountryFilterMenu
