import type { Catalog, CatalogVariant } from '@/features/products/catalog'

/**
 * A cart stores only WHAT and HOW MANY. Prices are always looked up from the
 * live catalog for display, and create_order re-prices everything on the server.
 */
export interface CartLine {
  variantId: string
  quantity: number
}

export const DEFAULT_MAX_QUANTITY = 20

export function clampQuantity(quantity: number, max = DEFAULT_MAX_QUANTITY) {
  if (!Number.isFinite(quantity)) return 1
  return Math.min(Math.max(1, max), Math.max(1, Math.trunc(quantity)))
}

export function addToLines(lines: CartLine[], variantId: string, quantity: number, max = DEFAULT_MAX_QUANTITY): CartLine[] {
  const existing = lines.find((l) => l.variantId === variantId)
  if (existing) {
    return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQuantity(l.quantity + quantity, max) } : l))
  }
  return [...lines, { variantId, quantity: clampQuantity(quantity, max) }]
}

export function setLineQuantity(lines: CartLine[], variantId: string, quantity: number, max = DEFAULT_MAX_QUANTITY): CartLine[] {
  if (!Number.isFinite(quantity) || quantity < 1) return removeLine(lines, variantId)
  if (!lines.some((l) => l.variantId === variantId)) return addToLines(lines, variantId, quantity, max)
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQuantity(quantity, max) } : l))
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId)
}

/** Combines two carts (e.g. guest cart into account cart), summing and clamping quantities. */
export function mergeLines(a: CartLine[], b: CartLine[], max = DEFAULT_MAX_QUANTITY): CartLine[] {
  return b.reduce((acc, line) => addToLines(acc, line.variantId, line.quantity, max), a.map((l) => ({ ...l })))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validates untrusted data read back from browser storage. */
export function isCartLineArray(value: unknown): value is CartLine[] {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CartLine).variantId === 'string' &&
        UUID.test((item as CartLine).variantId) &&
        Number.isInteger((item as CartLine).quantity) &&
        (item as CartLine).quantity >= 1 &&
        (item as CartLine).quantity <= 500,
    )
  )
}

export interface ResolvedCartItem {
  line: CartLine
  variant: CatalogVariant | null
  /** Current catalog price in pesewas (display only). */
  unitPrice: number | null
  lineTotal: number
  /** False when the item was hidden, removed or sold out since it was added. */
  available: boolean
}

export interface ResolvedCart {
  items: ResolvedCartItem[]
  /** Sum over available items only, in pesewas. */
  subtotal: number
  /** Number of units across available items. */
  itemCount: number
  hasUnavailable: boolean
  /** The payload shape create_order expects. */
  orderLines: Array<{ variant_id: string; quantity: number }>
}

export function resolveCart(lines: CartLine[], catalog: Pick<Catalog, 'variantById'> | undefined): ResolvedCart {
  const items = lines.map<ResolvedCartItem>((line) => {
    const variant = catalog?.variantById.get(line.variantId) ?? null
    const available = !!variant && variant.orderable
    const unitPrice = variant ? variant.price_pesewas : null
    return { line, variant, unitPrice, lineTotal: available && unitPrice !== null ? unitPrice * line.quantity : 0, available }
  })
  const availableItems = items.filter((i) => i.available)
  return {
    items,
    subtotal: availableItems.reduce((sum, i) => sum + i.lineTotal, 0),
    itemCount: availableItems.reduce((sum, i) => sum + i.line.quantity, 0),
    hasUnavailable: items.some((i) => !i.available),
    orderLines: availableItems.map((i) => ({ variant_id: i.line.variantId, quantity: i.line.quantity })),
  }
}
