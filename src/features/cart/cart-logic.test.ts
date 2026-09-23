import { describe, expect, it } from 'vitest'
import type { CatalogVariant } from '@/features/products/catalog'
import { addToLines, clampQuantity, isCartLineArray, mergeLines, removeLine, resolveCart, setLineQuantity } from './cart-logic'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

function variant(id: string, price: number, orderable = true): CatalogVariant {
  return { id, price_pesewas: price, orderable } as CatalogVariant
}

describe('cart quantities', () => {
  it('never produces an invalid quantity', () => {
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(-4)).toBe(1)
    expect(clampQuantity(2.7)).toBe(2)
    expect(clampQuantity(Number.NaN)).toBe(1)
    expect(clampQuantity(999, 20)).toBe(20)
  })

  it('adds, increments, sets, removes and merges lines', () => {
    let lines = addToLines([], A, 2)
    lines = addToLines(lines, A, 3)
    lines = addToLines(lines, B, 1)
    expect(lines).toEqual([
      { variantId: A, quantity: 5 },
      { variantId: B, quantity: 1 },
    ])
    expect(setLineQuantity(lines, A, 25, 20)).toEqual([
      { variantId: A, quantity: 20 },
      { variantId: B, quantity: 1 },
    ])
    expect(setLineQuantity(lines, A, 0)).toEqual([{ variantId: B, quantity: 1 }])
    expect(removeLine(lines, B)).toEqual([{ variantId: A, quantity: 5 }])
    expect(mergeLines([{ variantId: A, quantity: 19 }], [{ variantId: A, quantity: 5 }, { variantId: C, quantity: 1 }], 20)).toEqual([
      { variantId: A, quantity: 20 },
      { variantId: C, quantity: 1 },
    ])
  })

  it('rejects tampered cart data from storage', () => {
    expect(isCartLineArray([{ variantId: A, quantity: 2 }])).toBe(true)
    expect(isCartLineArray([{ variantId: 'x', quantity: 2 }])).toBe(false)
    expect(isCartLineArray([{ variantId: A, quantity: 0 }])).toBe(false)
    expect(isCartLineArray([{ variantId: A, quantity: 1.5 }])).toBe(false)
    expect(isCartLineArray({ variantId: A })).toBe(false)
  })
})

describe('cart totals', () => {
  const catalog = {
    variantById: new Map([
      [A, variant(A, 1500)],
      [B, variant(B, 800)],
      [C, variant(C, 1000, false)],
    ]),
  }

  it('prices lines from the catalog, never from the cart', () => {
    const cart = resolveCart(
      [
        { variantId: A, quantity: 2 },
        { variantId: B, quantity: 3 },
      ],
      catalog,
    )
    expect(cart.subtotal).toBe(2 * 1500 + 3 * 800)
    expect(cart.itemCount).toBe(5)
    expect(cart.orderLines).toEqual([
      { variant_id: A, quantity: 2 },
      { variant_id: B, quantity: 3 },
    ])
  })

  it('excludes sold-out or removed items from totals and the order payload', () => {
    const cart = resolveCart(
      [
        { variantId: A, quantity: 1 },
        { variantId: C, quantity: 4 },
        { variantId: '44444444-4444-4444-8444-444444444444', quantity: 1 },
      ],
      catalog,
    )
    expect(cart.subtotal).toBe(1500)
    expect(cart.itemCount).toBe(1)
    expect(cart.hasUnavailable).toBe(true)
    expect(cart.orderLines).toEqual([{ variant_id: A, quantity: 1 }])
  })

  it('handles a catalog that has not loaded yet', () => {
    const cart = resolveCart([{ variantId: A, quantity: 1 }], undefined)
    expect(cart.subtotal).toBe(0)
    expect(cart.items[0]?.available).toBe(false)
  })
})
