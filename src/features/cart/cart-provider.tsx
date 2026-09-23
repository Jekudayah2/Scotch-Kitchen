import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/auth-provider'
import { useCatalog, useStoreSettings } from '@/features/products/queries'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/utils/errors'
import { readJson, removeStorage, writeJson } from '@/utils/safe-storage'
import {
  addToLines,
  DEFAULT_MAX_QUANTITY,
  isCartLineArray,
  mergeLines,
  removeLine,
  resolveCart,
  setLineQuantity,
  type CartLine,
  type ResolvedCart,
} from './cart-logic'

const GUEST_CART_KEY = 'sk-cart-v1'

interface CartContextValue extends ResolvedCart {
  lines: CartLine[]
  maxQuantity: number
  isLoading: boolean
  add: (variantId: string, quantity?: number) => void
  setQuantity: (variantId: string, quantity: number) => void
  remove: (variantId: string) => void
  clear: () => Promise<void>
  quantityOf: (variantId: string) => number
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextValue | null>(null)

const cartQueryKey = (userId: string | null) => ['cart', userId] as const

async function fetchServerCart(userId: string): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select('variant_id, quantity, created_at')
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error
  return data.map((row) => ({ variantId: row.variant_id, quantity: row.quantity }))
}

async function writeServerLine(userId: string, variantId: string, quantity: number) {
  if (quantity < 1) {
    const { error } = await supabase.from('cart_items').delete().eq('user_id', userId).eq('variant_id', variantId)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('cart_items')
    .upsert({ user_id: userId, variant_id: variantId, quantity }, { onConflict: 'user_id,variant_id' })
  if (error) throw error
}

/**
 * Persistent cart: guests keep it in local storage; signed-in customers keep it
 * in Supabase (cart_items, RLS-protected) so it follows them across devices.
 * A guest cart is merged into the account cart on sign-in.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user, status } = useAuth()
  const userId = status === 'signed_in' ? (user?.id ?? null) : null
  const catalog = useCatalog()
  const settings = useStoreSettings()
  const maxQuantity = settings.data?.max_quantity_per_item ?? DEFAULT_MAX_QUANTITY

  const [guestLines, setGuestLines] = useState<CartLine[]>(() => readJson(GUEST_CART_KEY, isCartLineArray) ?? [])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const serverCart = useQuery({
    queryKey: cartQueryKey(userId),
    queryFn: () => fetchServerCart(userId as string),
    enabled: userId !== null,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (guestLines.length) writeJson(GUEST_CART_KEY, guestLines)
    else removeStorage(GUEST_CART_KEY)
  }, [guestLines])

  // Move a guest cart into the account once the customer signs in.
  const merging = useRef(false)
  useEffect(() => {
    if (!userId || !serverCart.isSuccess || guestLines.length === 0 || merging.current) return
    merging.current = true
    const merged = mergeLines(serverCart.data, guestLines, maxQuantity)
    Promise.all(merged.map((line) => writeServerLine(userId, line.variantId, line.quantity)))
      .then(() => {
        queryClient.setQueryData(cartQueryKey(userId), merged)
        setGuestLines([])
      })
      .catch((error: unknown) => toast.error(friendlyError(error, 'We couldn’t move your cart into your account.')))
      .finally(() => {
        merging.current = false
      })
  }, [userId, serverCart.isSuccess, serverCart.data, guestLines, maxQuantity, queryClient])

  const lines = useMemo(() => (userId ? (serverCart.data ?? []) : guestLines), [userId, serverCart.data, guestLines])

  const update = useCallback(
    (variantId: string, compute: (current: CartLine[]) => CartLine[]) => {
      if (!userId) {
        setGuestLines((current) => compute(current))
        return
      }
      const key = cartQueryKey(userId)
      const previous = queryClient.getQueryData<CartLine[]>(key) ?? []
      const next = compute(previous)
      queryClient.setQueryData(key, next)
      const quantity = next.find((l) => l.variantId === variantId)?.quantity ?? 0
      writeServerLine(userId, variantId, quantity).catch((error: unknown) => {
        queryClient.setQueryData(key, previous)
        toast.error(friendlyError(error, 'We couldn’t update your cart. Please try again.'))
      })
    },
    [userId, queryClient],
  )

  const add = useCallback(
    (variantId: string, quantity = 1) => update(variantId, (current) => addToLines(current, variantId, quantity, maxQuantity)),
    [update, maxQuantity],
  )
  const setQuantity = useCallback(
    (variantId: string, quantity: number) => update(variantId, (current) => setLineQuantity(current, variantId, quantity, maxQuantity)),
    [update, maxQuantity],
  )
  const remove = useCallback((variantId: string) => update(variantId, (current) => removeLine(current, variantId)), [update])

  const clear = useCallback(async () => {
    if (!userId) {
      setGuestLines([])
      return
    }
    queryClient.setQueryData(cartQueryKey(userId), [])
    const { error } = await supabase.from('cart_items').delete().eq('user_id', userId)
    if (error) void queryClient.invalidateQueries({ queryKey: cartQueryKey(userId) })
  }, [userId, queryClient])

  const resolved = useMemo(() => resolveCart(lines, catalog.data), [lines, catalog.data])

  const value = useMemo<CartContextValue>(
    () => ({
      ...resolved,
      lines,
      maxQuantity,
      isLoading: catalog.isPending || (userId !== null && serverCart.isPending),
      add,
      setQuantity,
      remove,
      clear,
      quantityOf: (variantId) => lines.find((l) => l.variantId === variantId)?.quantity ?? 0,
      drawerOpen,
      setDrawerOpen,
    }),
    [resolved, lines, maxQuantity, catalog.isPending, userId, serverCart.isPending, add, setQuantity, remove, clear, drawerOpen],
  )

  return <CartContext value={value}>{children}</CartContext>
}

export function useCart() {
  const context = use(CartContext)
  if (!context) throw new Error('useCart must be used inside <CartProvider>')
  return context
}
