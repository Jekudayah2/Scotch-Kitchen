import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Download, History, Settings2, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SegmentedControl, Switch } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/dialog'
import { ErrorState, Notice, Skeleton } from '@/components/ui/feedback'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  adminKeys,
  archiveOrders,
  fetchOrdersForExport,
  grantRole,
  revokeRole,
  updateStoreSettings,
  useAdminAudit,
  useArchivedOrders,
  useArchivePreview,
  useTeam,
  type TeamMember,
} from '@/features/admin/api'
import { AdminPageHeader, DataTable, FilterChips, SearchField, useDebouncedValue, type Column } from '@/features/admin/ui'
import { useAuth } from '@/features/auth/auth-provider'
import { storeSettingsQueryKey, useStoreSettings } from '@/features/products/queries'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { AdminAuditRow, AdminOrderRow, AppRole, StoreSettings } from '@/types/domain'
import { toCsv, downloadTextFile } from '@/utils/csv'
import { formatDateTime, formatRelative } from '@/utils/dates'
import { friendlyError } from '@/utils/errors'
import { formatCedis, parseCedisInput, pesewasToInput } from '@/utils/money'

type Tab = 'store' | 'team' | 'data' | 'audit'
const TABS: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: 'store', label: 'Store', icon: Settings2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'data', label: 'Data management', icon: Archive },
  { id: 'audit', label: 'Audit log', icon: History },
]

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
function StoreForm({ settings }: { settings: StoreSettings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    accepting_orders: settings.accepting_orders,
    storefront_notice: settings.storefront_notice ?? '',
    delivery_fee_mode: settings.delivery_fee_mode as 'FLAT' | 'QUOTE',
    flat_fee: settings.flat_delivery_fee_pesewas !== null ? pesewasToInput(settings.flat_delivery_fee_pesewas) : '',
    rider_fee_permission: settings.rider_fee_permission as 'NONE' | 'PROPOSE' | 'SET',
    max_quantity_per_item: String(settings.max_quantity_per_item),
  })
  const flatFee = parseCedisInput(form.flat_fee)
  const maxQty = Number.parseInt(form.max_quantity_per_item, 10)
  const valid = (form.delivery_fee_mode === 'QUOTE' || (flatFee !== null && flatFee >= 0)) && Number.isInteger(maxQty) && maxQty >= 1 && maxQty <= 500

  const save = useMutation({
    mutationFn: () =>
      updateStoreSettings({
        accepting_orders: form.accepting_orders,
        storefront_notice: form.storefront_notice.trim() || null,
        delivery_fee_mode: form.delivery_fee_mode,
        flat_delivery_fee_pesewas: form.delivery_fee_mode === 'FLAT' ? flatFee : flatFee ?? settings.flat_delivery_fee_pesewas,
        rider_fee_permission: form.rider_fee_permission,
        max_quantity_per_item: maxQty,
      }),
    onSuccess: () => {
      toast.success('Store settings saved.')
      void queryClient.invalidateQueries({ queryKey: storeSettingsQueryKey })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) save.mutate()
      }}
    >
      <Card title="Taking orders" description="Turn this off to pause checkout. Customers can still browse and track orders.">
        <label className="flex items-center gap-3 font-semibold text-ink">
          <Switch checked={form.accepting_orders} onCheckedChange={(v) => setForm({ ...form, accepting_orders: v })} aria-label="Accepting orders" />
          {form.accepting_orders ? 'Accepting orders' : 'Paused: not taking new orders'}
        </label>
        <Field label="Storefront notice" hint="Shown in the strip at the top of the store. Up to 200 characters." optional className="mt-5">
          <Textarea value={form.storefront_notice} onChange={(e) => setForm({ ...form, storefront_notice: e.target.value })} maxLength={200} rows={2} />
        </Field>
      </Card>

      <Card title="Delivery fees">
        <div className="space-y-4">
          <SegmentedControl
            label="How delivery is charged"
            value={form.delivery_fee_mode}
            onChange={(v) => setForm({ ...form, delivery_fee_mode: v })}
            options={[
              { value: 'QUOTE', label: 'Confirm per order' },
              { value: 'FLAT', label: 'Flat fee' },
            ]}
          />
          <p className="text-sm text-ink-3">
            {form.delivery_fee_mode === 'QUOTE'
              ? 'The kitchen confirms each order’s fee for its pin. If it’s set after payment, it becomes a delivery balance collected on delivery.'
              : 'Every order pays the same delivery fee at checkout.'}
          </p>
          {form.delivery_fee_mode === 'FLAT' && (
            <Field label="Flat delivery fee (GH₵)" required error={flatFee === null ? 'Enter an amount, e.g. 10 or 10.50' : undefined} className="max-w-xs">
              <Input inputMode="decimal" value={form.flat_fee} onChange={(e) => setForm({ ...form, flat_fee: e.target.value })} />
            </Field>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-2">What riders may do with a delivery fee</p>
            <SegmentedControl
              label="Rider fee permission"
              value={form.rider_fee_permission}
              onChange={(v) => setForm({ ...form, rider_fee_permission: v })}
              options={[
                { value: 'NONE', label: 'Nothing' },
                { value: 'PROPOSE', label: 'Propose (admin approves)' },
                { value: 'SET', label: 'Set directly' },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card title="Ordering limits">
        <Field label="Most of one item per order" hint="Between 1 and 500." className="max-w-xs">
          <Input inputMode="numeric" value={form.max_quantity_per_item} onChange={(e) => setForm({ ...form, max_quantity_per_item: e.target.value.replace(/\D/g, '') })} />
        </Field>
        {settings.service_min_latitude !== null && (
          <p className="mt-4 text-sm text-ink-3">
            Delivery area bounds: latitude {settings.service_min_latitude} to {settings.service_max_latitude}, longitude {settings.service_min_longitude} to{' '}
            {settings.service_max_longitude}. Pins outside are refused (this also catches swapped coordinates).
          </p>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>
          Save settings
        </Button>
      </div>
    </form>
  )
}

function StoreTab() {
  const settings = useStoreSettings()
  if (settings.isPending) return <Skeleton className="h-96 rounded-card" />
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  if (!settings.data) return <Notice tone="warning">Store settings are missing. Run the database migrations.</Notice>
  return <StoreForm key={settings.data.updated_at} settings={settings.data} />
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
function TeamTab() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const team = useTeam()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppRole>('RIDER')
  const [revoking, setRevoking] = useState<TeamMember | null>(null)
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminKeys.team })
    void queryClient.invalidateQueries({ queryKey: adminKeys.riders })
  }
  const grant = useMutation({
    mutationFn: () => grantRole(email, role),
    onSuccess: () => {
      toast.success(`${email.trim()} is now ${role === 'ADMIN' ? 'an admin' : 'a rider'}.`)
      setEmail('')
      refresh()
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
  const revoke = useMutation({
    mutationFn: (m: TeamMember) => revokeRole(m.user_id as string, m.role as AppRole),
    onSuccess: () => {
      toast.success('Role removed.')
      setRevoking(null)
      refresh()
    },
    onError: (error) => toast.error(friendlyError(error)),
  })

  return (
    <div className="space-y-5">
      <Card title="Add someone to the team" description="They must already have a SCOTCH’s Kitchen account. Roles are checked by the database on every action.">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (/^\S+@\S+\.\S+$/.test(email.trim())) grant.mutate()
          }}
        >
          <Field label="Email" className="flex-1">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
          </Field>
          <Field label="Role">
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
              <option value="RIDER">Rider</option>
              <option value="ADMIN">Admin</option>
            </NativeSelect>
          </Field>
          <Button type="submit" loading={grant.isPending} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} leadingIcon={<UserPlus aria-hidden="true" />}>
            Add
          </Button>
        </form>
      </Card>

      <Card title="Team" description="Admins run the kitchen; riders use the rider app.">
        {team.isPending ? (
          <Skeleton className="h-32 rounded-[0.9rem]" />
        ) : team.isError ? (
          <ErrorState error={team.error} onRetry={() => void team.refetch()} compact />
        ) : (
          <ul className="divide-y divide-line">
            {team.data.map((m) => (
              <li key={`${m.user_id}-${m.role}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {m.full_name || m.email}
                    {m.user_id === user?.id && <span className="ml-2 text-xs font-semibold text-ink-3">(you)</span>}
                  </p>
                  <p className="text-sm text-ink-3">
                    {m.email} · since {formatRelative(m.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.role === 'ADMIN' ? 'primary' : 'info'}>{m.role === 'ADMIN' ? 'Admin' : 'Rider'}</Badge>
                  <Button variant="ghost" size="sm" className="text-danger-text" onClick={() => setRevoking(m)} leadingIcon={<UserMinus aria-hidden="true" />}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Remove ${revoking?.role === 'ADMIN' ? 'admin' : 'rider'} access?`}
        description={`${revoking?.full_name || revoking?.email || 'This person'} keeps their customer account and order history.`}
        confirmLabel="Remove access"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data management
// ---------------------------------------------------------------------------
function DataTab() {
  const queryClient = useQueryClient()
  const preview = useArchivePreview()
  const archived = useArchivedOrders()
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const archive = useMutation({
    mutationFn: () => archiveOrders(confirmation, reason),
    onSuccess: (result) => {
      toast.success(`${result.order_count} orders archived. Nothing was deleted.`)
      setOpen(false)
      setConfirmation('')
      setReason('')
      void queryClient.invalidateQueries({ queryKey: adminKeys.all })
    },
    onError: (error) => toast.error(friendlyError(error)),
  })
  const p = preview.data

  const exportAll = async (includeArchived: boolean) => {
    setExporting(true)
    try {
      const rows = await fetchOrdersForExport(includeArchived)
      const csv = toCsv(
        rows.map((o) => ({
          reference: o.order_reference,
          placed_at: formatDateTime(o.created_at),
          customer: o.contact_name,
          phone: o.contact_phone,
          email: o.customer_email,
          items: o.items_summary,
          subtotal_ghs: ((o.subtotal_pesewas ?? 0) / 100).toFixed(2),
          delivery_fee_ghs: ((o.delivery_fee_pesewas ?? 0) / 100).toFixed(2),
          delivery_balance_ghs: ((o.delivery_balance_pesewas ?? 0) / 100).toFixed(2),
          paid_ghs: ((o.amount_paid_pesewas ?? 0) / 100).toFixed(2),
          payment_status: o.payment_status,
          order_status: o.order_status,
          rider: o.rider_name,
          delivery_address: o.delivery_address,
          archived_at: o.archived_at ? formatDateTime(o.archived_at) : '',
        })),
      )
      downloadTextFile(`scotchs-kitchen-orders${includeArchived ? '-with-archive' : ''}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setExporting(false)
    }
  }

  const archivedColumns: Column<AdminOrderRow>[] = [
    { id: 'ref', header: 'Order', mobile: 'primary', cell: (o) => <span className="font-mono font-bold text-ink">{o.order_reference}</span> },
    { id: 'customer', header: 'Customer', mobile: 'meta', cell: (o) => o.contact_name },
    { id: 'total', header: 'Paid', align: 'right', mobile: 'end', cell: (o) => <span className="tabular">{formatCedis(o.amount_paid_pesewas)}</span> },
    { id: 'status', header: 'Status', mobile: 'meta', cell: (o) => o.order_status?.toLowerCase().replace(/_/g, ' ') },
    { id: 'archived', header: 'Archived', mobile: 'meta', cell: (o) => (o.archived_at ? formatDateTime(o.archived_at) : '') },
  ]

  return (
    <div className="space-y-5">
      <Card title="Export orders" description="A CSV of every order for your records or accounting.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportAll(false)} loading={exporting} leadingIcon={<Download aria-hidden="true" />}>
            Current orders
          </Button>
          <Button variant="ghost" onClick={() => void exportAll(true)} disabled={exporting} leadingIcon={<Download aria-hidden="true" />}>
            Including archived
          </Button>
        </div>
      </Card>

      <Card
        title="Reset orders (archive)"
        description="Clears every current order from dashboards, deliveries and analytics, for example after testing. Nothing is deleted: orders, payments and history are kept and can still be exported."
      >
        {preview.isPending ? (
          <Skeleton className="h-24 rounded-[0.9rem]" />
        ) : preview.isError ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} compact />
        ) : p && p.total === 0 ? (
          <p className="text-sm text-ink-3">There are no current orders to archive.</p>
        ) : p ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[
                ['Current orders', p.total],
                ['In progress', p.in_progress],
                ['Awaiting payment', p.awaiting_payment],
                ['Delivered', p.delivered],
                ['Cancelled', p.cancelled],
                ['Paid', p.paid],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-[0.8rem] bg-surface-2 px-3 py-2">
                  <dt className="text-xs font-semibold text-ink-3">{label}</dt>
                  <dd className="tabular font-display text-xl font-extrabold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {p.in_progress > 0 && (
              <Notice tone="warning" title={`${p.in_progress} order(s) are still in progress`}>
                Archiving hides them from the kitchen and riders too. Finish or cancel them first unless they are test orders.
              </Notice>
            )}
            <Button variant="danger" onClick={() => setOpen(true)} leadingIcon={<Archive aria-hidden="true" />}>
              Reset orders
            </Button>
          </div>
        ) : null}
      </Card>

      <section aria-label="Archived orders" className="space-y-3">
        <h2 className="font-display text-lg font-bold text-ink">Archived orders</h2>
        <DataTable
          rows={archived.data}
          columns={archivedColumns}
          rowKey={(o) => o.id ?? ''}
          loading={archived.isPending}
          error={archived.error}
          onRetry={() => void archived.refetch()}
          empty={{ icon: Archive, title: 'Nothing archived yet' }}
        />
      </section>

      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !archive.isPending && setOpen(o)}
        title={`Archive ${p?.total ?? 0} orders?`}
        description="They leave every dashboard, map and report. Nothing is deleted, and this is recorded in the audit log."
        confirmLabel="Archive orders"
        tone="danger"
        loading={archive.isPending}
        confirmDisabled={confirmation !== 'RESET ORDERS'}
        onConfirm={() => archive.mutate()}
      >
        <div className="space-y-4">
          <Field label="Reason" optional>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Clearing test orders before launch" />
          </Field>
          <Field label="Type RESET ORDERS to confirm" required>
            <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" className="font-mono" aria-describedby="reset-hint" />
          </Field>
          <p id="reset-hint" className="text-xs text-ink-3">
            The server checks this phrase too.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
const AUDIT_TARGETS = ['ALL', 'order', 'product', 'product_variant', 'brand', 'store_settings', 'user_role', 'archive_batch']

const AUDIT_COLUMNS: Column<AdminAuditRow>[] = [
  {
    id: 'when',
    header: 'When',
    mobile: 'meta',
    cell: (a) => (
      <span className="flex flex-col">
        <span className="text-ink">{formatRelative(a.created_at)}</span>
        <span className="text-xs text-ink-3">{formatDateTime(a.created_at)}</span>
      </span>
    ),
  },
  {
    id: 'summary',
    header: 'What happened',
    mobile: 'primary',
    className: 'max-w-md',
    cell: (a) => (
      <span className="flex flex-col">
        <span className="font-semibold text-ink">{a.summary}</span>
        <span className="font-mono text-xs text-ink-3">{a.action}</span>
      </span>
    ),
  },
  {
    id: 'who',
    header: 'Who',
    mobile: 'meta',
    cell: (a) => (
      <span className="flex flex-col">
        <span>{a.actor_name || a.actor_email || 'System'}</span>
        {a.actor_role && <span className="text-xs text-ink-3">{a.actor_role.toLowerCase()}</span>}
      </span>
    ),
  },
  { id: 'target', header: 'Target', mobile: 'hidden', cell: (a) => <span className="text-xs text-ink-3">{a.target_type}</span> },
]

function AuditTab() {
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState('ALL')
  const term = useDebouncedValue(search)
  const audit = useAdminAudit({ search: term, target })
  return (
    <div className="space-y-4">
      <Notice tone="info" icon={ShieldCheck}>
        The audit log is append-only: entries can’t be edited or deleted, and secrets are never recorded.
      </Notice>
      <SearchField value={search} onChange={setSearch} label="Search the audit log" placeholder="Summary or action" className="max-w-xl" />
      <FilterChips label="Filter by target" value={target} onChange={setTarget} options={AUDIT_TARGETS.map((t) => ({ id: t, label: t === 'ALL' ? 'All' : t.replace(/_/g, ' ') }))} />
      <DataTable
        rows={audit.data}
        columns={AUDIT_COLUMNS}
        rowKey={(a) => String(a.id)}
        loading={audit.isPending}
        error={audit.error}
        onRetry={() => void audit.refetch()}
        empty={{ icon: History, title: 'No audit entries match' }}
      />
    </div>
  )
}

export default function AdminSettingsPage() {
  useDocumentTitle('Settings')
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'store') as Tab
  return (
    <>
      <AdminPageHeader title="Settings" description="How the store runs, who’s on the team, your data and the audit trail." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true, preventScrollReset: true })}>
        <TabsList aria-label="Settings sections" className="mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="store" className="max-w-3xl">
          <StoreTab />
        </TabsContent>
        <TabsContent value="team" className="max-w-3xl">
          <TeamTab />
        </TabsContent>
        <TabsContent value="data" className="max-w-4xl">
          <DataTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
