import { useContext } from 'react'
import { DashboardLiveUpdatesContext } from '@/components/ui/organisms/DashboardLiveUpdatesProvider'

export default function useDashboardLiveUpdates() {
  const context = useContext(DashboardLiveUpdatesContext)
  if (!context) {
    throw new Error('useDashboardLiveUpdates must be used within a DashboardLiveUpdatesProvider')
  }
  return context
}
