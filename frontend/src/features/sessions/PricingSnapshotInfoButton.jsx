import { useState } from 'react'
import { hasUsefulPricingSnapshot } from './pricingSnapshotHelpers'
import PricingSnapshotModal from './PricingSnapshotModal'
import '@/styles/dashboard.css'

function PricingSnapshotInfoButton({ snapshot, currency }) {
  const [isOpen, setIsOpen] = useState(false)
  const isAvailable = hasUsefulPricingSnapshot(snapshot)

  const handleClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isAvailable) {
      return
    }
    setIsOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={`pricing-snapshot-info-button${isAvailable ? '' : ' is-unavailable'}`}
        onClick={handleClick}
        onMouseDown={(event) => event.stopPropagation()}
        disabled={!isAvailable}
        aria-disabled={!isAvailable}
        aria-label={
          isAvailable ? 'View energy charge breakdown' : 'Pricing breakdown unavailable'
        }
        title={isAvailable ? 'View energy charge breakdown' : 'Pricing breakdown unavailable'}
      >
        ?
      </button>
      {isOpen && isAvailable ? (
        <PricingSnapshotModal
          snapshot={snapshot}
          currency={currency}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  )
}

export default PricingSnapshotInfoButton
