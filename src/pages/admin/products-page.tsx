import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, PencilLine, Plus, Star, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { ConfirmDialog, Sheet } from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { adminKeys } from '@/features/admin/api'
import {
  checkImageFile,
  createVariant,
  deleteProductImage,
  makePrimaryImage,
  updateBrand,
  updateProduct,
  updateVariant,
  uploadProductImage,
  useAdminCatalog,
  type AdminCatalogBrand,
  type AdminCatalogProduct,
} from '@/features/admin/catalog-api'
import { AdminPageHeader } from '@/features/admin/ui'
import { catalogQueryKey } from '@/features/products/queries'
import { ProductImage as Photo } from '@/features/products/components'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { ProductImage, ProductVariant } from '@/types/domain'
import { cn } from '@/utils/cn'
import { friendlyError } from '@/utils/errors'
import { formatCedis, parseCedisInput, pesewasToInput } from '@/utils/money'

/** Every catalog change refreshes the admin view and the storefront catalog. */
function useCatalogMutation<T>(fn: (arg: T) => Promise<unknown>, success?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
      void queryClient.invalidateQueries({ queryKey: adminKeys.catalog })
      void queryClient.invalidateQueries({ queryKey: catalogQueryKey })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
}

function LabeledSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
      {label}
    </label>
  )
}

function PriceEditor({ variant }: { variant: ProductVariant }) {
  const [value, setValue] = useState(pesewasToInput(variant.price_pesewas))
  const save = useCatalogMutation((pesewas: number) => updateVariant(variant.id, { price_pesewas: pesewas }), `${variant.name} price saved.`)
  const pesewas = parseCedisInput(value)
  const changed = pesewas !== null && pesewas !== variant.price_pesewas
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (pesewas && pesewas > 0 && changed) save.mutate(pesewas)
      }}
    >
      <span className="text-sm font-semibold text-ink-3">GH₵</span>
      <Input aria-label={`Price of ${variant.name} in cedis`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-24" />
      {changed && (
        <Button type="submit" size="sm" loading={save.isPending} disabled={!pesewas || pesewas <= 0}>
          Save
        </Button>
      )}
    </form>
  )
}

function StockEditor({ variant }: { variant: ProductVariant }) {
  const [qty, setQty] = useState(String(variant.stock_quantity ?? 0))
  const toggle = useCatalogMutation(
    (track: boolean) => updateVariant(variant.id, { track_stock: track, stock_quantity: track ? (variant.stock_quantity ?? 0) : variant.stock_quantity }),
    'Stock tracking updated.',
  )
  const save = useCatalogMutation((n: number) => updateVariant(variant.id, { stock_quantity: n }), 'Stock saved.')
  const n = Number.parseInt(qty, 10)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Switch checked={variant.track_stock} onCheckedChange={(v) => toggle.mutate(v)} aria-label={`Track stock for ${variant.name}`} />
      {variant.track_stock ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (Number.isInteger(n) && n >= 0 && n !== variant.stock_quantity) save.mutate(n)
          }}
        >
          <Input aria-label={`Stock of ${variant.name}`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} className="h-9 w-20" />
          {Number.isInteger(n) && n !== variant.stock_quantity && (
            <Button type="submit" size="sm" variant="secondary" loading={save.isPending}>
              Save
            </Button>
          )}
        </form>
      ) : (
        <span className="text-sm text-ink-3">Not tracked</span>
      )}
    </div>
  )
}

function VariantRow({ variant }: { variant: ProductVariant }) {
  const toggle = useCatalogMutation((patch: Parameters<typeof updateVariant>[1]) => updateVariant(variant.id, patch), 'Saved.')
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-3">
        <p className="font-semibold text-ink">{variant.name}</p>
        <p className="font-mono text-xs text-ink-3">{variant.sku}</p>
      </td>
      <td className="px-3 py-3">
        <PriceEditor variant={variant} />
      </td>
      <td className="px-3 py-3">
        <StockEditor variant={variant} />
      </td>
      <td className="px-3 py-3">
        <Switch checked={variant.is_available} onCheckedChange={(v) => toggle.mutate({ is_available: v })} aria-label={`${variant.name} available to order`} />
      </td>
      <td className="px-3 py-3">
        <Switch checked={variant.is_visible} onCheckedChange={(v) => toggle.mutate({ is_visible: v })} aria-label={`${variant.name} visible on the storefront`} />
      </td>
    </tr>
  )
}

function Gallery({ product }: { product: AdminCatalogProduct }) {
  const input = useRef<HTMLInputElement>(null)
  const [removing, setRemoving] = useState<ProductImage | null>(null)
  const upload = useCatalogMutation((file: File) => uploadProductImage(product, file, ''), 'Photo added.')
  const primary = useCatalogMutation((image: ProductImage) => makePrimaryImage(image), 'Main photo updated.')
  const remove = useCatalogMutation((image: ProductImage) => deleteProductImage(image), 'Photo removed.')
  const images = product.product_images

  return (
    <div className="space-y-2">
      <Photo image={images[0] ?? null} brandName={product.name} className="aspect-[4/3] rounded-[1rem] ring-1 ring-line" />
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="group relative">
            <Photo image={img} className={cn('size-14 rounded-[0.7rem] ring-2', img.is_primary ? 'ring-primary' : 'ring-line')} />
            <div className="mt-1 flex justify-center gap-0.5">
              {!img.is_primary && (
                <Button variant="ghost" size="icon-sm" className="size-7" aria-label="Make main photo" onClick={() => primary.mutate(img)}>
                  <Star aria-hidden="true" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" className="size-7 text-danger-text" aria-label="Remove photo" onClick={() => setRemoving(img)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
          className="grid size-14 place-items-center rounded-[0.7rem] border-2 border-dashed border-line-strong text-ink-3 hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          aria-label={`Add a photo of ${product.name}`}
        >
          <ImagePlus className="size-5" aria-hidden="true" />
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            const problem = checkImageFile(file)
            if (problem) toast.error(problem)
            else upload.mutate(file)
          }}
        />
      </div>
      <p className="text-xs text-ink-3">Official photos only. JPEG, PNG, WebP or AVIF, up to 5 MB.</p>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this photo?"
        description="It disappears from the storefront. Past orders keep the photo they were placed with."
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing, { onSuccess: () => setRemoving(null) })}
      />
    </div>
  )
}

function ProductSheet({ product, onClose }: { product: AdminCatalogProduct | null; onClose: () => void }) {
  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    subtitle: product?.subtitle ?? '',
    description: product?.description ?? '',
    storage_note: product?.storage_note ?? '',
  }))
  const save = useCatalogMutation(
    () =>
      updateProduct(product?.id as string, {
        name: form.name.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        storage_note: form.storage_note.trim() || null,
      }),
    'Product saved.',
  )
  return (
    <Sheet
      open={product !== null}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      width="md"
      title={`Edit ${product?.name ?? 'product'}`}
      description="Shown on the product page and order screens."
      footer={
        <div className="flex gap-3 pb-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" loading={save.isPending} disabled={form.name.trim().length < 2} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Subtitle" optional>
          <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Description" optional>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} maxLength={1000} />
        </Field>
        <Field label="Storage note" hint="For example Keep refrigerated." optional>
          <Input value={form.storage_note} onChange={(e) => setForm({ ...form, storage_note: e.target.value })} maxLength={80} />
        </Field>
      </div>
    </Sheet>
  )
}

function AddVariantSheet({ product, onClose }: { product: AdminCatalogProduct | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', sku: '', size_label: '', flavour: '', price: '' })
  const price = parseCedisInput(form.price)
  const sku = form.sku.trim().toUpperCase()
  const valid = form.name.trim().length > 0 && /^[A-Z0-9-]{2,40}$/.test(sku) && price !== null && price > 0
  const create = useCatalogMutation(
    () =>
      createVariant({
        product_id: product?.id as string,
        sku,
        name: form.name.trim(),
        size_label: form.size_label.trim() || null,
        flavour: form.flavour.trim() || null,
        price_pesewas: price as number,
        sort_order: (product?.product_variants.length ?? 0) + 1,
      }),
    'Added. It’s live once it’s visible and available.',
  )
  return (
    <Sheet
      open={product !== null}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      width="md"
      title={`Add to ${product?.name ?? 'product'}`}
      description="A new size or flavour. Prices are in cedis."
      footer={
        <div className="flex gap-3 pb-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!valid} loading={create.isPending} onClick={() => create.mutate(undefined, { onSuccess: onClose })}>
            Add
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Name" hint="Shown on cards, e.g. 1L or Chocolate." required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
        </Field>
        <Field label="SKU" hint="Capitals, numbers and dashes, e.g. ZP-1000." required>
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} maxLength={40} className="font-mono" />
        </Field>
        <Field label="Size" optional>
          <Input value={form.size_label} onChange={(e) => setForm({ ...form, size_label: e.target.value })} maxLength={40} placeholder="e.g. 500ml" />
        </Field>
        <Field label="Flavour" optional>
          <Input value={form.flavour} onChange={(e) => setForm({ ...form, flavour: e.target.value })} maxLength={60} />
        </Field>
        <Field label="Price (GH₵)" required>
          <Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
        </Field>
      </div>
    </Sheet>
  )
}

function ProductBlock({ product, onEdit, onAddVariant }: { product: AdminCatalogProduct; onEdit: () => void; onAddVariant: () => void }) {
  const toggle = useCatalogMutation((patch: Parameters<typeof updateProduct>[1]) => updateProduct(product.id, patch), 'Saved.')
  return (
    <article className="grid grid-cols-1 gap-5 rounded-card border border-line bg-surface p-4 sm:p-5 lg:grid-cols-[16rem_1fr]">
      <Gallery product={product} />
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold text-ink">{product.name}</h3>
            {product.subtitle && <p className="text-sm font-semibold text-ink-2">{product.subtitle}</p>}
            {product.storage_note && <p className="text-xs text-ink-3">{product.storage_note}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LabeledSwitch label="Visible" checked={product.is_visible} onChange={(v) => toggle.mutate({ is_visible: v })} />
            <Button variant="secondary" size="sm" onClick={onEdit} leadingIcon={<PencilLine aria-hidden="true" />}>
              Edit
            </Button>
          </div>
        </div>
        {product.description && <p className="line-clamp-3 text-sm text-ink-2">{product.description}</p>}
        <div className="overflow-x-auto rounded-[1rem] border border-line">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-2 text-left text-xs font-bold tracking-wide text-ink-3 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2.5">Size / flavour</th>
                <th scope="col" className="px-3 py-2.5">Price</th>
                <th scope="col" className="px-3 py-2.5">Stock</th>
                <th scope="col" className="px-3 py-2.5">Available</th>
                <th scope="col" className="px-3 py-2.5">Visible</th>
              </tr>
            </thead>
            <tbody>
              {product.product_variants.map((v) => (
                <VariantRow key={`${v.id}-${v.updated_at}`} variant={v} />
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" size="sm" onClick={onAddVariant} leadingIcon={<Plus aria-hidden="true" />}>
          Add a size or flavour
        </Button>
      </div>
    </article>
  )
}

function BrandSection({ brand, children }: { brand: AdminCatalogBrand; children: ReactNode }) {
  const toggle = useCatalogMutation((patch: Parameters<typeof updateBrand>[1]) => updateBrand(brand.id, patch), 'Saved.')
  const prices = brand.products.flatMap((p) => p.product_variants.filter((v) => v.is_visible).map((v) => v.price_pesewas))
  return (
    <section aria-label={brand.name} data-brand={brand.slug} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">
            {brand.name}{' '}
            {!brand.is_visible && (
              <Badge tone="neutral" size="sm" className="align-middle">
                Hidden
              </Badge>
            )}
          </h2>
          <p className="text-sm text-ink-3">
            {brand.tagline}
            {prices.length > 0 && ` · from ${formatCedis(Math.min(...prices))}`}
          </p>
        </div>
        <LabeledSwitch label="Brand visible on storefront" checked={brand.is_visible} onChange={(v) => toggle.mutate({ is_visible: v })} />
      </div>
      {children}
    </section>
  )
}

export default function AdminProductsPage() {
  useDocumentTitle('Products')
  const catalog = useAdminCatalog()
  const [editing, setEditing] = useState<AdminCatalogProduct | null>(null)
  const [adding, setAdding] = useState<AdminCatalogProduct | null>(null)

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Prices, stock, availability and photos. Changes reach the storefront immediately; items are hidden, never deleted, so past orders stay intact."
      />
      {catalog.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading products">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <div className="space-y-10">
          {catalog.data.map((brand) => (
            <BrandSection key={brand.id} brand={brand}>
              {brand.products.map((product) => (
                <ProductBlock key={product.id} product={product} onEdit={() => setEditing(product)} onAddVariant={() => setAdding(product)} />
              ))}
            </BrandSection>
          ))}
        </div>
      )}
      {editing && <ProductSheet key={editing.id} product={editing} onClose={() => setEditing(null)} />}
      {adding && <AddVariantSheet key={adding.id} product={adding} onClose={() => setAdding(null)} />}
    </>
  )
}
