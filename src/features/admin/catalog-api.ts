import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Brand, Product, ProductImage, ProductVariant } from '@/types/domain'
import { adminKeys } from './api'

/*
 * Catalog management. Admin write policies allow these updates; nothing is
 * hard-deleted (orders keep snapshots, and hiding is reversible).
 */

export type AdminCatalogProduct = Product & { product_variants: ProductVariant[]; product_images: ProductImage[] }
export type AdminCatalogBrand = Brand & { products: AdminCatalogProduct[] }

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order

export function useAdminCatalog() {
  return useQuery({
    queryKey: adminKeys.catalog,
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('*, products(*, product_variants(*), product_images(*))').order('sort_order')
      if (error) throw error
      return (data as unknown as AdminCatalogBrand[]).map((b) => ({
        ...b,
        products: [...b.products].sort(bySort).map((p) => ({
          ...p,
          product_variants: [...p.product_variants].sort(bySort),
          product_images: [...p.product_images].sort((x, y) => Number(y.is_primary) - Number(x.is_primary) || x.sort_order - y.sort_order),
        })),
      }))
    },
  })
}

export type BrandPatch = Partial<Pick<Brand, 'tagline' | 'description' | 'is_active' | 'is_visible'>>
export type ProductPatch = Partial<Pick<Product, 'name' | 'subtitle' | 'description' | 'storage_note' | 'is_active' | 'is_visible'>>
export type VariantPatch = Partial<
  Pick<ProductVariant, 'name' | 'size_label' | 'flavour' | 'price_pesewas' | 'track_stock' | 'stock_quantity' | 'is_available' | 'is_active' | 'is_visible'>
>

async function check<T>(promise: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

export const updateBrand = (id: string, patch: BrandPatch) => check(supabase.from('brands').update(patch).eq('id', id).select('id'))
export const updateProduct = (id: string, patch: ProductPatch) => check(supabase.from('products').update(patch).eq('id', id).select('id'))
export const updateVariant = (id: string, patch: VariantPatch) => check(supabase.from('product_variants').update(patch).eq('id', id).select('id'))

export interface NewVariant {
  product_id: string
  sku: string
  name: string
  size_label: string | null
  flavour: string | null
  price_pesewas: number
  sort_order: number
}

export const createVariant = (input: NewVariant) => check(supabase.from('product_variants').insert(input).select('id'))

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Validates before uploading so the admin gets a clear reason (the bucket enforces the same rules). */
export function checkImageFile(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPEG, PNG, WebP or AVIF photo.'
  if (file.size > MAX_IMAGE_BYTES) return 'Photos can be up to 5 MB.'
  return null
}

export async function uploadProductImage(product: AdminCatalogProduct, file: File, altText: string) {
  const problem = checkImageFile(file)
  if (problem) throw new Error(problem)
  const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const path = `${product.id}/${crypto.randomUUID()}.${extension}`
  const upload = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
  if (upload.error) throw upload.error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  const isFirst = product.product_images.length === 0
  return check(
    supabase
      .from('product_images')
      .insert({
        product_id: product.id,
        variant_id: null,
        url: data.publicUrl,
        storage_path: path,
        alt_text: altText.trim() || `${product.name} photo`,
        is_primary: isFirst,
        sort_order: product.product_images.length + 1,
      })
      .select('id'),
  )
}

/** Only one primary image per product: clear the old one first (a unique index enforces it). */
export async function makePrimaryImage(image: ProductImage) {
  let clear = supabase.from('product_images').update({ is_primary: false }).eq('product_id', image.product_id).eq('is_primary', true)
  clear = image.variant_id ? clear.eq('variant_id', image.variant_id) : clear.is('variant_id', null)
  await check(clear.select('id'))
  return check(supabase.from('product_images').update({ is_primary: true }).eq('id', image.id).select('id'))
}

export async function deleteProductImage(image: ProductImage) {
  await check(supabase.from('product_images').delete().eq('id', image.id).select('id'))
  // Bundled photography (/images/...) has no storage object; uploads are tidied up too.
  if (image.storage_path) await supabase.storage.from('product-images').remove([image.storage_path])
}
