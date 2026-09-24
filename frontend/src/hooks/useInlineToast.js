import { useCallback, useMemo } from 'react'
import { useToast } from '@/components/common/ToastProvider'

export default function useInlineToast(region = 'inline-default') {
  const toast = useToast()

  const showInlineToast = useCallback(
    (options = {}) => {
      toast.showToast({
        placement: 'inline',
        region,
        ...options,
      })
    },
    [toast, region]
  )

  return useMemo(
    () => ({
      showToast: showInlineToast,
      pushSuccess: (message, options = {}) => showInlineToast({ message, variant: 'success', ...options }),
      pushError: (message, options = {}) => showInlineToast({ message, variant: 'error', ...options }),
      pushWarning: (message, options = {}) => showInlineToast({ message, variant: 'warning', ...options }),
      pushInfo: (message, options = {}) => showInlineToast({ message, variant: 'info', ...options }),
    }),
    [showInlineToast]
  )
}
