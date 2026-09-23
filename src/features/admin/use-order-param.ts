import { useSearchParams } from 'react-router'

/** The open order lives in the URL (?order=<id>) so drawers can be deep-linked and Back closes them. */
export function useOrderParam() {
  const [params, setParams] = useSearchParams()
  const orderId = params.get('order')
  const open = (id: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('order', id)
        return next
      },
      { preventScrollReset: true },
    )
  const close = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('order')
        return next
      },
      { preventScrollReset: true },
    )
  return { orderId, open, close }
}
