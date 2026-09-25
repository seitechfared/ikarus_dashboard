import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const EditIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M12.209 13.519 9.57 13.897l.377-2.64 6.788-6.788a1.653 1.653 0 0 1 2.341 0c.648.647.648 1.695 0 2.342L12.209 13.52Z"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.799 13.6v5.334a1.2 1.2 0 0 1-1.066 1.066H5.067A1.2 1.2 0 0 1 4 18.934V8.267A1.2 1.2 0 0 1 5.067 7.2H10.4"
      stroke="#011309"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DeleteIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4 6.286h16M13.714 4h-3.428a1.286 1.286 0 0 0-1.286 1.143V6.286h6.572V5.143A1.143 1.143 0 0 0 13.714 4Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M10.286 16V10.286M13.714 16V10.286" stroke="#ED4A4A" strokeWidth="1.5" strokeLinecap="round" />
    <path
      d="M17.23 18.952a1.2 1.2 0 0 1-1.138 1.048H7.909a1.2 1.2 0 0 1-1.138-1.048L5.714 6.286h12.571l-1.055 12.666Z"
      stroke="#ED4A4A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

function StationActionMenu({ onEdit, onDelete, actions, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const rowElement = menuRef.current?.closest('.station-row, .charger-row, .pricing-table-row')
    const containerElement = menuRef.current?.closest(
      '.stations-table, .chargers-table, .pricing-table, .connectors-table, .sessions-table, .actions-table, .logs-table, .events-table, .customer-table',
    )
    if (!rowElement) {
      if (!containerElement) {
        return
      }
    }
    if (isOpen) {
      rowElement?.classList.add('action-menu-open')
      containerElement?.classList.add('action-menu-container-open')
    } else {
      rowElement?.classList.remove('action-menu-open')
      containerElement?.classList.remove('action-menu-container-open')
    }
    return () => {
      rowElement?.classList.remove('action-menu-open')
      containerElement?.classList.remove('action-menu-container-open')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
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

  const toggleMenu = (event) => {
    event.stopPropagation()
    setIsOpen((prev) => !prev)
  }

  const menuActions =
    actions && actions.length
      ? actions
      : [
          onEdit
            ? { key: 'edit', label: 'Edit', icon: EditIcon, onClick: onEdit }
            : null,
          onDelete
            ? {
                key: 'delete',
                label: 'Delete',
                icon: DeleteIcon,
                onClick: onDelete,
                variant: 'danger',
              }
            : null,
        ].filter(Boolean)

  const updateMenuPosition = useCallback(() => {
    const menuElement = menuRef.current
    const dropdownElement = menuElement?.querySelector('.action-menu-dropdown')
    if (!menuElement || !dropdownElement) {
      return
    }

    let overflowContainer = menuElement.parentElement
    while (overflowContainer) {
      const style = window.getComputedStyle(overflowContainer)
      if (style.overflowY !== 'visible' || style.overflowX !== 'visible') {
        break
      }
      overflowContainer = overflowContainer.parentElement
    }

    const menuRect = menuElement.getBoundingClientRect()
    const dropdownHeight = dropdownElement.offsetHeight
    const spacing = 12
    const containerRect = overflowContainer?.getBoundingClientRect()
    const bottomLimit = containerRect ? containerRect.bottom : window.innerHeight
    const topLimit = containerRect ? containerRect.top : 0
    const spaceBelow = bottomLimit - menuRect.bottom
    const spaceAbove = menuRect.top - topLimit
    const shouldOpenUp = spaceBelow < dropdownHeight + spacing && spaceAbove >= spaceBelow

    setOpenUp(shouldOpenUp)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setOpenUp(false)
      return
    }
    updateMenuPosition()
  }, [isOpen, menuActions.length, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }
    const handleViewportChange = () => updateMenuPosition()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isOpen, updateMenuPosition])

  const handleItemClick = (event, handler) => {
    event.stopPropagation()
    setIsOpen(false)
    handler?.()
  }

  if (disabled) {
    return null
  }

  return (
    <div className={`action-menu ${isOpen ? 'open' : ''} ${openUp ? 'open-up' : ''}`.trim()} ref={menuRef}>
      <button type="button" className="action-menu-button" aria-label="Station actions" onClick={toggleMenu}>
        <span className="menu-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      {isOpen ? (
        <div className="action-menu-dropdown" role="menu">
          {menuActions.map((item, index) => {
            const Icon = item.icon
            const className = ['action-menu-item', item.variant === 'danger' ? 'danger' : '']
              .join(' ')
              .trim()
            return (
              <button
                type="button"
                className={className}
                key={item.key ?? index}
                onClick={(event) => handleItemClick(event, item.onClick)}
                role="menuitem"
                disabled={item.disabled}
                title={item.title || undefined}
              >
                {Icon ? <Icon /> : null}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default StationActionMenu
