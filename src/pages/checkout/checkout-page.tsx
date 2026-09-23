import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleAlert, LoaderCircle, LockKeyhole, PencilLine, ShieldCheck } from 'lucide-react'
import { useReducer, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field'
import { updateMyProfile } from '@/features/account/profile-api'
import { useAuth } from '@/features/auth/auth-provider'
import { nameSchema, phoneSchema } from '@/features/auth/schemas'
import { EmptyBag } from '@/features/cart/cart-ui'
import { useCart } from '@/features/cart/cart-provider'
import { deliveryFeeFor, MobileSummary, SummaryLines } from '@/features/checkout/checkout-summary'
import { LocationPicker } from '@/features/delivery/location-picker'
import { initialPickerState, locationReducer, toOrderDelivery } from '@/features/delivery/location-state'
import { createSavedLocation, pointToSavedInput, savedLocationsKey, useSavedLocations } from '@/features/delivery/saved-locations'
import { createOrder, orderKeys } from '@/features/orders/api'
import { initializePayment, PaymentError, redirectToPaystack } from '@/features/payments/api'
import { useStoreSettings } from '@/features/products/queries'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useKeyboardOpen } from '@/hooks/use-media'
import type { CreatedOrder } from '@/types/domain'
import { cn } from '@/utils/cn'
import { errorCode, friendlyError } from '@/utils/errors'
import { formatAccuracy, formatCoordinates } from '@/utils/geo'
import { formatCedis } from '@/utils/money'
import { readStorage, removeStorage, writeStorage } from '@/utils/safe-storage'

type Step = 'details' | 'location' | 'review' | 'payment'
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'location', label: 'Delivery' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
]
const IDEMPOTENCY_KEY = 'sk-checkout-key'
const DETAILS_FORM = 'checkout-details'

const contactSchema = z.object({ name: nameSchema, phone: phoneSchema, saveToProfile: z.boolean() })
type ContactValues = z.infer<typeof contactSchema>

function checkoutKey() {
  const existing = readStorage(IDEMPOTENCY_KEY, 'session')
  if (existing) return existing
  const key = crypto.randomUUID()
  writeStorage(IDEMPOTENCY_KEY, key, 'session')
  return key
}

/** 1 Details · 2 Delivery · 3 Review · 4 Payment. Finished steps can be revisited. */
function Stepper({ step, onJump, reached }: { step: Step; onJump: (step: Step) => void; reached: number }) {
  const index = STEPS.findIndex((s) => s.id === step)
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i < index
          const current = i === index
          const clickable = i <= reached && i !== index && step !== 'payment'
          return (
            <li key={s.id} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onJump(s.id)}
                aria-current={current ? 'step' : undefined}
                className="group flex shrink-0 items-center gap-2.5 rounded-control py-1 pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
              >
                <span
                  className={cn(
                    'tabular grid size-8 place-items-center rounded-full text-sm font-bold transition-colors duration-300',
                    done && 'bg-success text-white',
                    current && 'bg-primary text-primary-ink shadow-soft',
                    !done && !current && 'bg-surface-2 text-ink-3 ring-1 ring-line',
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    current ? 'text-ink' : done ? 'text-ink-2 group-enabled:group-hover:text-ink' : 'text-ink-3',
                    !current && 'hidden sm:inline',
                  )}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-line sm:mx-3">
                  <span className={cn('block h-full origin-left bg-success transition-transform duration-500', done ? 'scale-x-100' : 'scale-x-0')} />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-soft sm:p-7">
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** Phones: the step's main action stays within thumb reach (and steps aside for the keyboard). */
function MobileActionBar({ total, children }: { total: number; children: ReactNode }) {
  const keyboardOpen = useKeyboardOpen()
  if (keyboardOpen) return null
  return (
    <div className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 leading-tight">
          <p className="text-xs font-semibold text-ink-3">Pay now</p>
          <p className="tabular font-display text-lg font-bold text-ink">{formatCedis(total)}</p>
        </div>
        <div className="flex-1 [&>*]:w-full">{children}</div>
      </div>
    </div>
  )
}

function PaymentProgress({ phase }: { phase: 'creating' | 'redirecting' }) {
  const steps = [
    { label: 'Placing your order', state: phase === 'creating' ? 'active' : 'done' },
    { label: 'Opening Paystack’s secure page', state: phase === 'redirecting' ? 'active' : 'waiting' },
  ] as const
  return (
    <div className="space-y-6" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-control bg-primary-soft text-primary-text">
          <LockKeyhole className="size-5.5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-xl font-extrabold text-ink">Taking you to secure payment</p>
          <p className="text-sm text-ink-3">Please keep this page open.</p>
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm font-semibold">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full',
                s.state === 'done' && 'bg-success text-white',
                s.state === 'active' && 'bg-primary-soft text-primary-text',
                s.state === 'waiting' && 'bg-surface-2 text-ink-3 ring-1 ring-line',
              )}
            >
              {s.state === 'done' ? (
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              ) : s.state === 'active' ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
            </span>
            <span className={s.state === 'waiting' ? 'text-ink-3' : 'text-ink'}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-3">
        <ShieldCheck className="size-4 text-success-text" aria-hidden="true" />
        Secure payment powered by Paystack. You’ll come back here automatically.
      </p>
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-page py-8 lg:py-12" aria-busy="true" aria-label="Preparing checkout">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-8 h-9 w-full max-w-2xl" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="hidden h-80 rounded-card lg:block" />
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const cart = useCart()
  const settings = useStoreSettings()
  const saved = useSavedLocations()

  const [step, setStep] = useState<Step>('details')
  const [reached, setReached] = useState(0)
  const [location, dispatch] = useReducer(locationReducer, initialPickerState)
  const [instructions, setInstructions] = useState('')
  const [saveLocation, setSaveLocation] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Home')
  const [customLabel, setCustomLabel] = useState('')
  const [phase, setPhase] = useState<'idle' | 'creating' | 'redirecting' | 'error'>('idle')
  const [payError, setPayError] = useState<unknown>(null)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)

  const contact = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    values: {
      name: auth.profile?.full_name ?? auth.displayName ?? '',
      phone: auth.profile?.phone ?? '',
      saveToProfile: !auth.profile?.phone,
    },
    resetOptions: { keepDirtyValues: true },
  })

  const saveToProfile = useWatch({ control: contact.control, name: 'saveToProfile' })

  const goTo = (next: Step) => {
    const index = STEPS.findIndex((s) => s.id === next)
    setReached((r) => Math.max(r, index))
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (cart.isLoading || settings.isPending) return <CheckoutSkeleton />

  if (cart.itemCount === 0 && !createdOrder) {
    return (
      <div className="container-page py-12 lg:py-16">
        <div className="mx-auto max-w-xl rounded-card border border-line bg-surface">
          <EmptyBag />
        </div>
      </div>
    )
  }

  const fee = deliveryFeeFor(settings.data)
  const total = cart.subtotal + fee.amount
  const bounds =
    settings.data && settings.data.service_min_latitude !== null
      ? {
          minLatitude: settings.data.service_min_latitude,
          maxLatitude: settings.data.service_max_latitude as number,
          minLongitude: settings.data.service_min_longitude as number,
          maxLongitude: settings.data.service_max_longitude as number,
        }
      : null
  const closed = settings.data?.accepting_orders === false
  const confirmed = location.confirmed
  const canReview = Boolean(confirmed) && !location.temporary

  const placeOrderAndPay = async () => {
    if (!confirmed || !auth.user) return
    setPhase('creating')
    setPayError(null)
    const values = contact.getValues()
    try {
      let order = createdOrder
      if (!order) {
        if (values.saveToProfile) {
          await updateMyProfile(auth.user.id, { full_name: values.name.trim(), phone: values.phone.trim() })
            .then(() => auth.refetchProfile())
            .catch(() => toast.warning('We couldn’t save your details to your profile, but your order will still go through.'))
        }
        if (saveLocation) {
          const label = saveLabel === 'Other' ? customLabel.trim() || 'Saved place' : saveLabel
          await createSavedLocation(auth.user.id, pointToSavedInput({ ...confirmed, instructions }, label, (saved.data ?? []).length === 0))
            .then(() => queryClient.invalidateQueries({ queryKey: savedLocationsKey(auth.user?.id ?? null) }))
            .catch((error: unknown) => toast.warning(friendlyError(error, 'We couldn’t save this location, but your order will still go through.')))
        }
        order = await createOrder({
          items: cart.orderLines,
          contact: { name: values.name.trim(), phone: values.phone.trim() },
          delivery: toOrderDelivery({ ...confirmed, instructions }),
          idempotencyKey: checkoutKey(),
        })
        setCreatedOrder(order)
        removeStorage(IDEMPOTENCY_KEY, 'session')
        await cart.clear()
        void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      }
      setPhase('redirecting')
      const payment = await initializePayment(order.order_id)
      redirectToPaystack(payment.authorization_url)
    } catch (error) {
      if (error instanceof PaymentError && error.code === 'ALREADY_PAID' && createdOrder) {
        navigate(`/track-order/${createdOrder.order_reference}`, { replace: true })
        return
      }
      setPayError(error)
      setPhase('error')
    }
  }

  const pay = () => {
    goTo('payment')
    void placeOrderAndPay()
  }

  const payLabel = `Pay ${formatCedis(total)}`
  const summary = <SummaryLines items={cart.items} subtotal={cart.subtotal} settings={settings.data} />

  return (
    <div className="container-page pt-6 pb-32 sm:pb-16 lg:pt-10 lg:pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display-md text-ink">Checkout</h1>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-3">
          <ShieldCheck className="size-4 text-success-text" aria-hidden="true" />
          Secure payment powered by Paystack
        </p>
      </div>

      <div className="mt-6 max-w-2xl">
        <Stepper step={step} reached={reached} onJump={goTo} />
      </div>

      {closed && (
        <Notice tone="warning" className="mt-6" title="We’re not taking orders right now">
          Your bag is saved. Please check back soon.
        </Notice>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="space-y-6">
          {step !== 'payment' && <MobileSummary items={cart.items} subtotal={cart.subtotal} settings={settings.data} />}

          {step === 'details' && (
            <Panel title="Your details" description="Your rider will ask for this name and call this number on arrival.">
              <form id={DETAILS_FORM} noValidate onSubmit={contact.handleSubmit(() => goTo('location'))} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" error={contact.formState.errors.name?.message} required>
                    <Input autoComplete="name" {...contact.register('name')} />
                  </Field>
                  <Field label="Phone" error={contact.formState.errors.phone?.message} required>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" {...contact.register('phone')} />
                  </Field>
                </div>
                <Field label="Email" hint="Paystack sends your receipt here.">
                  <Input value={auth.user?.email ?? ''} readOnly className="bg-surface-2" />
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium text-ink">
                  <Checkbox
                    checked={saveToProfile}
                    onCheckedChange={(v) => contact.setValue('saveToProfile', v === true)}
                    aria-label="Save these details to my profile"
                  />
                  Save these details to my profile
                </label>
                <div className="hidden justify-end sm:flex">
                  <Button type="submit" size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
                    Continue to Delivery
                  </Button>
                </div>
              </form>
            </Panel>
          )}

          {step === 'location' && (
            <Panel title="Delivery location" description="Choose the exact spot. GPS is optional: search or tap the map if you prefer.">
              <div className="space-y-6">
                <LocationPicker state={location} dispatch={dispatch} savedLocations={saved.data ?? []} bounds={bounds} />
                <Field label="Delivery instructions" hint="Gate codes, which building, who to hand it to." optional>
                  <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={500} rows={3} />
                </Field>
                {confirmed && !confirmed.savedLocationId && (
                  <div className="space-y-3 rounded-[1rem] bg-surface-2 p-4">
                    <label className="flex items-center gap-3 text-sm font-medium text-ink">
                      <Checkbox checked={saveLocation} onCheckedChange={(v) => setSaveLocation(v === true)} aria-label="Save this location for next time" />
                      Save this location for next time
                    </label>
                    {saveLocation && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Label">
                          <NativeSelect value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)}>
                            {['Home', 'Hostel', 'Work', 'Other'].map((l) => (
                              <option key={l}>{l}</option>
                            ))}
                          </NativeSelect>
                        </Field>
                        {saveLabel === 'Other' && (
                          <Field label="Custom label">
                            <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} maxLength={40} placeholder="e.g. Library" />
                          </Field>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <Button variant="ghost" size="lg" onClick={() => goTo('details')} leadingIcon={<ArrowLeft aria-hidden="true" />}>
                    Back
                  </Button>
                  <Button size="lg" className="hidden sm:inline-flex" disabled={!canReview} onClick={() => goTo('review')} trailingIcon={<ArrowRight aria-hidden="true" />}>
                    Review Order
                  </Button>
                </div>
                {location.temporary && <p className="text-xs text-ink-3 sm:text-right">Confirm or discard the proposed pin to continue.</p>}
              </div>
            </Panel>
          )}

          {step === 'review' && confirmed && (
            <Panel title="Review your order" description="Check everything once more before paying.">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1rem] border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="eyebrow text-ink-3">Contact</p>
                      <Button variant="ghost" size="sm" onClick={() => goTo('details')} leadingIcon={<PencilLine aria-hidden="true" />}>
                        Edit
                      </Button>
                    </div>
                    <p className="mt-1 font-semibold text-ink">{contact.getValues('name')}</p>
                    <p className="text-sm text-ink-2">{contact.getValues('phone')}</p>
                  </div>
                  <div className="rounded-[1rem] border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="eyebrow text-ink-3">Deliver to</p>
                      <Button variant="ghost" size="sm" onClick={() => goTo('location')} leadingIcon={<PencilLine aria-hidden="true" />}>
                        Change
                      </Button>
                    </div>
                    <p className="mt-1 font-semibold text-ink">{confirmed.address}</p>
                    {confirmed.landmark && <p className="text-sm text-ink-2">Landmark: {confirmed.landmark}</p>}
                    {instructions && <p className="text-sm text-ink-2">Note: {instructions}</p>}
                    <p className="mt-1 font-mono text-xs text-ink-3">
                      {formatCoordinates(confirmed)} · {formatAccuracy(confirmed.accuracy)}
                    </p>
                  </div>
                </div>
                <div className="lg:hidden">{summary}</div>
                <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
                  <Button variant="ghost" size="lg" onClick={() => goTo('location')} leadingIcon={<ArrowLeft aria-hidden="true" />}>
                    Back
                  </Button>
                  <Button size="xl" className="hidden sm:inline-flex" disabled={closed || cart.itemCount === 0} onClick={pay} leadingIcon={<LockKeyhole aria-hidden="true" />}>
                    {payLabel}
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {step === 'payment' && (
            <section className="rounded-card border border-line bg-surface p-6 shadow-soft sm:p-8">
              {phase === 'error' ? (
                <div className="space-y-5" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-control bg-danger-soft text-danger-text">
                      <CircleAlert className="size-5.5" aria-hidden="true" />
                    </span>
                    <p className="font-display text-xl font-extrabold text-ink">Payment didn’t start</p>
                  </div>
                  <Notice tone={errorCode(payError) === 'PAYMENTS_NOT_CONFIGURED' ? 'warning' : 'danger'}>{friendlyError(payError)}</Notice>
                  {createdOrder && (
                    <p className="text-sm text-ink-2">
                      Your order <strong className="font-mono text-ink">{createdOrder.order_reference}</strong> is saved. Nothing has been charged, and
                      you can pay for it from your order page at any time.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void placeOrderAndPay()} leadingIcon={<LockKeyhole aria-hidden="true" />}>
                      Try Again
                    </Button>
                    {createdOrder ? (
                      <Button asChild variant="secondary">
                        <Link to={`/track-order/${createdOrder.order_reference}`}>View Order</Link>
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => goTo('review')}>
                        Back to Review
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <PaymentProgress phase={phase === 'redirecting' ? 'redirecting' : 'creating'} />
              )}
            </section>
          )}
        </div>

        <aside className="hidden lg:block" aria-label="Order summary">
          <div className="sticky top-24 space-y-5 rounded-card border border-line bg-surface p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink">Order summary</h2>
            {summary}
          </div>
        </aside>
      </div>

      {step === 'details' && (
        <MobileActionBar total={total}>
          <Button type="submit" form={DETAILS_FORM} size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
            Continue
          </Button>
        </MobileActionBar>
      )}
      {step === 'location' && (
        <MobileActionBar total={total}>
          <Button size="lg" disabled={!canReview} onClick={() => goTo('review')} trailingIcon={<ArrowRight aria-hidden="true" />}>
            Review Order
          </Button>
        </MobileActionBar>
      )}
      {step === 'review' && (
        <MobileActionBar total={total}>
          <Button size="lg" disabled={closed || cart.itemCount === 0} onClick={pay} leadingIcon={<LockKeyhole aria-hidden="true" />}>
            {payLabel}
          </Button>
        </MobileActionBar>
      )}
    </div>
  )
}
