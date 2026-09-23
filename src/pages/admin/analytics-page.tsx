import { Banknote, Download, PackageCheck, ReceiptText, ShoppingBasket, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useAdminAnalytics, type AnalyticsResult } from '@/features/admin/api'
import { AdminPageHeader, FilterChips, StatCard } from '@/features/admin/ui'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { toCsv, downloadTextFile } from '@/utils/csv'
import { RANGE_PRESET_LABELS, resolveRange, toDateInputValue, type RangePreset } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'
import { formatCedis } from '@/utils/money'

const PRESETS: RangePreset[] = ['today', 'yesterday', 'this_week', 'this_month', 'last_30_days', 'custom']

const dayLabel = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

/** Revenue per day as bars; every value is a verified payment, nothing is projected. */
function RevenueChart({ days }: { days: AnalyticsResult['by_day'] }) {
  const max = Math.max(...days.map((d) => d.revenue_pesewas), 1)
  const labelEvery = Math.ceil(days.length / 8)
  return (
    <figure className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold text-ink">Revenue by day</span>
        <span className="text-xs text-ink-3">Verified payments, Africa/Accra days</span>
      </figcaption>
      <div className="flex h-52 items-end gap-[3px]" role="img" aria-label={`Revenue for ${days.length} days, highest ${formatCedis(max)}`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-[4px] bg-primary/85 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max((d.revenue_pesewas / max) * 100, d.revenue_pesewas ? 2 : 0.5)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-[0.5rem] bg-ink px-2 py-1 text-xs font-semibold whitespace-nowrap text-canvas group-hover:block">
              {dayLabel(d.day)}: {formatCedis(d.revenue_pesewas)} · {d.paid_orders} paid
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-4 gap-[3px] text-[0.68rem] text-ink-3" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.day} className="relative min-w-0 flex-1">
            {i % labelEvery === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{dayLabel(d.day)}</span>}
          </span>
        ))}
      </div>
    </figure>
  )
}

function BrandSplit({ brands }: { brands: AnalyticsResult['brands'] }) {
  const total = brands.reduce((sum, b) => sum + b.revenue_pesewas, 0)
  return (
    <section aria-label="Revenue by brand" className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-4 font-display text-lg font-bold text-ink">By brand</h2>
      {brands.length === 0 ? (
        <p className="text-sm text-ink-3">No paid orders in this range.</p>
      ) : (
        <ul className="space-y-3">
          {brands.map((b) => {
            const share = total ? Math.round((b.revenue_pesewas / total) * 100) : 0
            return (
              <li key={b.brand_name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{b.brand_name}</span>
                  <span className="tabular text-ink-2">
                    {formatCedis(b.revenue_pesewas)} · {b.units} units · {share}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default function AdminAnalyticsPage() {
  useDocumentTitle('Analytics')
  const [preset, setPreset] = useState<RangePreset>('last_30_days')
  const today = toDateInputValue(new Date())
  const [custom, setCustom] = useState({ from: today, to: today })
  const range = useMemo(() => resolveRange(preset, new Date(), custom), [preset, custom])
  const analytics = useAdminAnalytics(range)
  const data = analytics.data
  const t = data?.totals

  const exportCsv = () => {
    if (!data) return
    try {
      const rows = data.product_mix.map((p) => ({
        brand: p.brand_name,
        product: p.product_name,
        variant: p.variant_name,
        units: p.units,
        revenue_ghs: (p.revenue_pesewas / 100).toFixed(2),
      }))
      if (!rows.length) {
        toast.info('No sales in this range to export.')
        return
      }
      downloadTextFile(`scotchs-kitchen-sales-${data.from.slice(0, 10)}-to-${data.to.slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
    } catch (error) {
      toast.error(friendlyError(error))
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Sales from verified Paystack payments only, excluding cancelled and archived orders. Nothing here is estimated."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!data} leadingIcon={<Download aria-hidden="true" />}>
            Export sales CSV
          </Button>
        }
      />
      <div className="mb-5 space-y-3">
        <FilterChips label="Date range" value={preset} onChange={setPreset} options={PRESETS.map((p) => ({ id: p, label: RANGE_PRESET_LABELS[p] }))} />
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From">
              <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-10" />
            </Field>
            <Field label="To">
              <Input type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-10" />
            </Field>
          </div>
        )}
      </div>

      {!range ? (
        <p className="text-sm text-ink-3">Choose a valid date range.</p>
      ) : analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Revenue" value={formatCedis(t?.revenue_pesewas ?? 0)} icon={Banknote} tone="success" loading={!t} />
            <StatCard label="Paid orders" value={t?.paid_orders} hint={t ? `${t.orders} placed` : undefined} icon={ReceiptText} tone="primary" loading={!t} />
            <StatCard label="Average order" value={t?.average_order_value_pesewas != null ? formatCedis(t.average_order_value_pesewas) : '—'} loading={!t} />
            <StatCard label="Units sold" value={t?.units_sold} icon={ShoppingBasket} tone="accent" loading={!t} />
            <StatCard label="Delivered" value={t?.completed_deliveries} icon={PackageCheck} tone="info" loading={!t} />
            <StatCard label="Cancelled" value={t?.cancelled_orders} icon={XCircle} loading={!t} />
          </div>

          {!data ? (
            <Skeleton className="h-72 rounded-card" />
          ) : (
            <>
              <RevenueChart days={data.by_day} />
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.3fr]">
                <BrandSplit brands={data.brands} />
                <section aria-label="Product mix" className="overflow-hidden rounded-card border border-line bg-surface">
                  <h2 className="px-4 pt-4 font-display text-lg font-bold text-ink sm:px-5">Product mix</h2>
                  {data.product_mix.length === 0 ? (
                    <p className="p-5 text-sm text-ink-3">No paid orders in this range.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="mt-3 w-full min-w-[28rem] text-sm">
                        <thead className="bg-surface-2 text-left text-xs font-bold tracking-wide text-ink-3 uppercase">
                          <tr>
                            <th scope="col" className="px-4 py-2.5 sm:px-5">Item</th>
                            <th scope="col" className="px-4 py-2.5 text-right">Units</th>
                            <th scope="col" className="px-4 py-2.5 text-right sm:px-5">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.product_mix.map((p) => (
                            <tr key={`${p.product_name}-${p.variant_name}`} className="border-t border-line">
                              <td className="px-4 py-2.5 sm:px-5">
                                <span className="font-semibold text-ink">{p.product_name}</span> <span className="text-ink-3">· {p.variant_name}</span>
                              </td>
                              <td className="tabular px-4 py-2.5 text-right text-ink-2">{p.units}</td>
                              <td className="tabular px-4 py-2.5 text-right font-semibold text-ink sm:px-5">{formatCedis(p.revenue_pesewas)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
              <p className="text-xs text-ink-3">
                Delivery fees collected at checkout: {formatCedis(t?.delivery_fees_pesewas ?? 0)} · Delivery balances added after payment:{' '}
                {formatCedis(t?.delivery_balances_pesewas ?? 0)}
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
