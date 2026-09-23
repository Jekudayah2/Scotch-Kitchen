import { Leaf } from 'lucide-react'
import { groupIngredients } from '@/features/products/catalog'
import type { ProductIngredient } from '@/types/domain'
import { cn } from '@/utils/cn'

const SWATCH: Record<string, string> = {
  hibiscus: 'var(--ing-hibiscus)',
  cloves: 'var(--ing-clove)',
  ginger: 'var(--ing-ginger)',
  cinnamon: 'var(--ing-cinnamon)',
  mint: 'var(--ing-mint)',
  mango: 'var(--ing-mango)',
  lemon: 'var(--ing-lemon)',
  pineapple: 'var(--ing-pineapple)',
}

const GROUPS = [
  { key: 'SPICE', title: 'Warmed with spice', note: 'Four spices give every sip its depth.' },
  { key: 'FRUIT', title: 'Brightened with fruit', note: 'Three fruits lift the finish.' },
  { key: 'OTHER', title: 'Also in the recipe', note: '' },
] as const

function Swatch({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-3 shrink-0 rounded-full ring-2 ring-white/70"
      style={{ background: SWATCH[name.toLowerCase()] ?? 'var(--accent)' }}
    />
  )
}

/**
 * Explains that ZOBOPOP's ingredients form ONE signature recipe. They are
 * presented as a composition, never as selectable flavours.
 */
export function IngredientStory({ ingredients, compact = false }: { ingredients: ProductIngredient[]; compact?: boolean }) {
  const groups = groupIngredients(ingredients)
  const base = groups.BASE ?? []
  const total = ingredients.length
  if (total === 0) return null

  return (
    <div className={cn('space-y-4', compact ? '' : 'lg:space-y-5')}>
      {base.length > 0 && (
        <div className="relative overflow-hidden rounded-4xl bg-zp-wine p-6 text-white sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-10 size-56 rounded-full bg-[radial-gradient(circle,rgba(194,58,82,0.55),transparent_70%)]"
          />
          <p className="eyebrow relative text-[#f4c9a8]">The base</p>
          <p className="relative mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            {base.map((i) => i.name).join(' & ')}
          </p>
          <p className="relative mt-3 max-w-md text-[0.95rem] text-[#f0d9d4]">
            The deep red heart of every bottle. Everything else is built around it.
          </p>
        </div>
      )}

      <div className={cn('grid gap-4', compact ? 'sm:grid-cols-2' : 'md:grid-cols-2')}>
        {GROUPS.map(({ key, title, note }) => {
          const list = groups[key] ?? []
          if (list.length === 0) return null
          return (
            <div key={key} className="rounded-4xl border border-line bg-surface p-6 shadow-soft">
              <p className="font-display text-xl font-bold text-ink">{title}</p>
              {note && <p className="mt-1 text-sm text-ink-3">{note}</p>}
              <ul className="mt-4 flex flex-wrap gap-2">
                {list.map((ingredient) => (
                  <li
                    key={ingredient.id}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-semibold text-ink ring-1 ring-line"
                  >
                    <Swatch name={ingredient.name} />
                    {ingredient.name}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="flex items-start gap-2.5 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-text">
        <Leaf className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          These {total} ingredients make one signature drink. They aren’t separate flavours: every bottle of ZOBOPOP carries the whole blend.
        </span>
      </p>
    </div>
  )
}
