import '@/styles/dashboard.css'

function ReferenceManagerPage({
  title,
  description,
  searchValue,
  onSearchChange,
  toolbar = null,
  isLoading = false,
  error = '',
  items = [],
  columns = [],
  selectedId,
  onSelect,
  detailCard,
  emptyLabel = 'No records found.',
}) {
  const gridTemplateColumns = columns.map((column) => column.width || '1fr').join(' ')

  return (
    <div className="settings-reference-page">
      <div className="settings-header">
        <div>
          <h2 className="settings-title">{title}</h2>
          <p className="settings-description">{description}</p>
        </div>
        {toolbar}
      </div>

      <div className="settings-reference-grid">
        <section className="settings-card settings-reference-list">
          <div className="stations-filters settings-reference-filters">
            <div className="filter-field search-field">
              <div className="filter-search">
                <input
                  type="text"
                  className="filter-search__input"
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? <div className="data-warning">{error}</div> : null}
          {isLoading ? <p className="data-placeholder">Loading {title.toLowerCase()}...</p> : null}
          {!isLoading && !error && items.length === 0 ? (
            <p className="data-placeholder">{emptyLabel}</p>
          ) : null}

          {!isLoading && !error && items.length > 0 ? (
            <div className="chargers-table settings-reference-table">
              <div className="chargers-table-header" style={{ gridTemplateColumns }}>
                {columns.map((column) => (
                  <div key={column.key} className="charger-cell">
                    {column.label}
                  </div>
                ))}
              </div>
              {items.map((item) => {
                const isActive = String(item.id ?? item.code) === String(selectedId)
                return (
                  <button
                    key={item.id ?? item.code}
                    type="button"
                    className={`charger-row settings-reference-row ${isActive ? 'active' : ''}`.trim()}
                    style={{ gridTemplateColumns }}
                    onClick={() => onSelect(item)}
                  >
                    {columns.map((column) => (
                      <div key={column.key} className="charger-cell">
                        {column.render ? column.render(item) : item[column.key] || '-'}
                      </div>
                    ))}
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="settings-card settings-reference-detail">
          {detailCard}
        </section>
      </div>
    </div>
  )
}

export default ReferenceManagerPage
