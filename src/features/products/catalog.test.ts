import { describe, expect, it } from 'vitest'
import { buildCatalog, groupIngredients, type RawCatalogBrand } from './catalog'

const now = '2026-09-23T00:00:00Z'

function brand(overrides: Partial<RawCatalogBrand>): RawCatalogBrand {
  return {
    id: 'b1',
    slug: 'zobopop',
    name: 'ZOBOPOP',
    tagline: 'Premium Hibiscus Drink',
    description: null,
    theme_key: 'zobopop',
    logo_url: null,
    sort_order: 1,
    is_active: true,
    is_visible: true,
    created_at: now,
    updated_at: now,
    products: [],
    ...overrides,
  }
}

type RawProduct = RawCatalogBrand['products'][number]

function product(overrides: Partial<RawProduct>): RawProduct {
  return {
    id: 'p1',
    brand_id: 'b1',
    slug: 'zobopop-hibiscus-drink',
    name: 'ZOBOPOP',
    subtitle: 'Premium Hibiscus Drink',
    description: null,
    product_type: 'DRINK',
    storage_note: 'Keep refrigerated',
    sort_order: 1,
    is_active: true,
    is_visible: true,
    created_at: now,
    updated_at: now,
    product_variants: [],
    product_images: [],
    product_ingredients: [],
    ...overrides,
  }
}

type RawVariant = RawProduct['product_variants'][number]

function variant(overrides: Partial<RawVariant>): RawVariant {
  return {
    id: 'v1',
    product_id: 'p1',
    sku: 'ZP-330',
    name: '330ml',
    size_label: '330ml',
    volume_ml: 330,
    flavour: null,
    price_pesewas: 1000,
    currency: 'GHS',
    track_stock: false,
    stock_quantity: null,
    is_available: true,
    is_active: true,
    is_visible: true,
    sort_order: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('buildCatalog', () => {
  const raw = [
    brand({
      products: [
        product({
          product_variants: [
            variant({ id: 'v2', sku: 'ZP-500', name: '500ml', size_label: '500ml', volume_ml: 500, price_pesewas: 1500, sort_order: 2 }),
            variant({}),
            variant({ id: 'v3', sku: 'ZP-HID', name: 'Hidden', is_visible: false, sort_order: 3 }),
          ],
          product_images: [
            { id: 'i1', product_id: 'p1', variant_id: null, url: '/images/products/zobopop-500ml.webp', storage_path: null, alt_text: 'Bottle', is_primary: true, sort_order: 1, created_at: now },
            { id: 'i2', product_id: 'p1', variant_id: 'v2', url: 'https://cdn.example/500.webp', storage_path: 'x', alt_text: '500', is_primary: true, sort_order: 1, created_at: now },
          ],
          product_ingredients: [
            { id: 'g1', product_id: 'p1', name: 'Mango', ingredient_group: 'FRUIT', sort_order: 1, created_at: now },
            { id: 'g2', product_id: 'p1', name: 'Hibiscus', ingredient_group: 'BASE', sort_order: 1, created_at: now },
          ],
        }),
      ],
    }),
    brand({ id: 'b9', slug: 'hidden-brand', name: 'Hidden', is_visible: false, products: [product({ id: 'p9', brand_id: 'b9', product_variants: [variant({ id: 'v9', sku: 'H-1' })] })] }),
  ]

  it('keeps only visible, active rows and sorts variants', () => {
    const catalog = buildCatalog(raw)
    expect(catalog.brands.map((b) => b.slug)).toEqual(['zobopop'])
    expect(catalog.variants.map((v) => v.sku)).toEqual(['ZP-330', 'ZP-500'])
    expect(catalog.variantById.has('v3')).toBe(false)
    expect(catalog.variantById.has('v9')).toBe(false)
  })

  it('uses database prices and computes the lowest price', () => {
    const catalog = buildCatalog(raw)
    expect(catalog.brandBySlug.get('zobopop')?.fromPrice).toBe(1000)
    expect(catalog.variantById.get('v2')?.price_pesewas).toBe(1500)
  })

  it('prefers a variant-specific image and falls back to the product image', () => {
    const catalog = buildCatalog(raw)
    expect(catalog.variantById.get('v2')?.image?.url).toBe('https://cdn.example/500.webp')
    expect(catalog.variantById.get('v1')?.image?.url).toBe('/images/products/zobopop-500ml.webp')
    expect(catalog.variantById.get('v1')?.displayName).toBe('ZOBOPOP 330ml')
  })

  it('marks sold-out tracked stock as not orderable', () => {
    const catalog = buildCatalog([
      brand({ products: [product({ product_variants: [variant({ track_stock: true, stock_quantity: 0 })] })] }),
    ])
    expect(catalog.variants[0]?.orderable).toBe(false)
  })

  it('groups ingredients into one recipe (base, spice, fruit)', () => {
    const catalog = buildCatalog(raw)
    const groups = groupIngredients(catalog.products[0]?.ingredients ?? [])
    expect(groups.BASE?.map((i) => i.name)).toEqual(['Hibiscus'])
    expect(groups.FRUIT?.map((i) => i.name)).toEqual(['Mango'])
  })
})
