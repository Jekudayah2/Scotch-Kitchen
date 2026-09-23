import type { Brand, Product, ProductImage, ProductIngredient, ProductVariant } from '@/types/domain'

/**
 * The storefront's single source of truth for names, prices and availability.
 * Built from database rows only. Nothing here is hard-coded.
 */
export interface BrandSummary {
  id: string
  slug: string
  name: string
  themeKey: string
}

export interface CatalogVariant extends ProductVariant {
  brand: BrandSummary
  productName: string
  productSlug: string
  productType: Product['product_type']
  /** "ZOBOPOP 330ml", "Creamypop Vanilla" */
  displayName: string
  image: ProductImage | null
  /** Can be added to the cart right now. */
  orderable: boolean
}

export interface CatalogProduct extends Product {
  brand: BrandSummary
  variants: CatalogVariant[]
  images: ProductImage[]
  primaryImage: ProductImage | null
  ingredients: ProductIngredient[]
  /** Lowest price among visible variants, in pesewas. */
  fromPrice: number | null
}

export interface CatalogBrand extends Brand {
  products: CatalogProduct[]
  fromPrice: number | null
  primaryImage: ProductImage | null
}

export interface Catalog {
  brands: CatalogBrand[]
  products: CatalogProduct[]
  variants: CatalogVariant[]
  variantById: Map<string, CatalogVariant>
  brandBySlug: Map<string, CatalogBrand>
}

export type RawCatalogBrand = Brand & {
  products: Array<
    Product & {
      product_variants: ProductVariant[]
      product_images: ProductImage[]
      product_ingredients: ProductIngredient[]
    }
  >
}

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

export function isVariantOrderable(variant: Pick<ProductVariant, 'is_available' | 'track_stock' | 'stock_quantity'>) {
  return variant.is_available && (!variant.track_stock || (variant.stock_quantity ?? 0) > 0)
}

function minPrice(values: number[]) {
  return values.length ? Math.min(...values) : null
}

/**
 * Normalises nested rows into the storefront catalog. Hidden or inactive rows
 * are dropped here as well as by RLS, because admins can read hidden rows and
 * must still see the storefront exactly as customers do.
 */
export function buildCatalog(rawBrands: RawCatalogBrand[]): Catalog {
  const brands: CatalogBrand[] = []
  const products: CatalogProduct[] = []
  const variants: CatalogVariant[] = []

  for (const rawBrand of [...rawBrands].sort(bySortOrder)) {
    if (!rawBrand.is_active || !rawBrand.is_visible) continue
    const { products: rawProducts, ...brandRow } = rawBrand
    const summary: BrandSummary = { id: brandRow.id, slug: brandRow.slug, name: brandRow.name, themeKey: brandRow.theme_key }
    const visibleProducts = [...rawProducts].filter((p) => p.is_active && p.is_visible).sort(bySortOrder)
    const brandProducts: CatalogProduct[] = []

    for (const rawProduct of visibleProducts) {
      const { product_variants, product_images, product_ingredients, ...productRow } = rawProduct
      const images = [...product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      const productImages = images.filter((img) => img.variant_id === null)
      const primaryImage = productImages[0] ?? images[0] ?? null

      const productVariants: CatalogVariant[] = [...product_variants]
        .filter((v) => v.is_active && v.is_visible)
        .sort(bySortOrder)
        .map((variant) => ({
          ...variant,
          brand: summary,
          productName: productRow.name,
          productSlug: productRow.slug,
          productType: productRow.product_type,
          displayName:
            visibleProducts.length > 1 ? `${productRow.name} ${variant.name}` : `${summary.name} ${variant.name}`,
          image: images.find((img) => img.variant_id === variant.id) ?? primaryImage,
          orderable: isVariantOrderable(variant),
        }))

      const product: CatalogProduct = {
        ...productRow,
        brand: summary,
        variants: productVariants,
        images,
        primaryImage,
        ingredients: [...product_ingredients].sort(
          (a, b) => a.ingredient_group.localeCompare(b.ingredient_group) || a.sort_order - b.sort_order,
        ),
        fromPrice: minPrice(productVariants.map((v) => v.price_pesewas)),
      }
      if (product.variants.length === 0) continue
      brandProducts.push(product)
      products.push(product)
      variants.push(...productVariants)
    }

    if (brandProducts.length === 0) continue
    brands.push({
      ...brandRow,
      products: brandProducts,
      fromPrice: minPrice(brandProducts.flatMap((p) => p.variants.map((v) => v.price_pesewas))),
      primaryImage: brandProducts[0]?.primaryImage ?? null,
    })
  }

  return {
    brands,
    products,
    variants,
    variantById: new Map(variants.map((v) => [v.id, v])),
    brandBySlug: new Map(brands.map((b) => [b.slug, b])),
  }
}

export type IngredientGroup = ProductIngredient['ingredient_group']

export function groupIngredients(ingredients: ProductIngredient[]) {
  const groups: Record<string, ProductIngredient[]> = {}
  for (const ingredient of ingredients) {
    ;(groups[ingredient.ingredient_group] ??= []).push(ingredient)
  }
  for (const list of Object.values(groups)) list.sort(bySortOrder)
  return groups as Partial<Record<'BASE' | 'SPICE' | 'FRUIT' | 'OTHER', ProductIngredient[]>>
}
