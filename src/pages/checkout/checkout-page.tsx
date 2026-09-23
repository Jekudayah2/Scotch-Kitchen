import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CreditCard, LoaderCircle, LockKeyhole, MapPin, ShoppingBag, UserRound } from 'lucide-react'
import { useReducer, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/controls'
import { EmptyState, Notice, PageLoader } from '@/components/ui/feedback'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field'
import { updateMyProfile } from '@/features/account/profile-api'
import { useAuth } from '@/features/auth/auth-provider'
import { nameSchema, phoneSchema } from '@/features/auth/schemas'
import { useCart } from '@/features/cart/cart-provider'
import { deliveryFeeFor, MobileSummary, SummaryLines } from '@/features/checkout/checkout-summary'
import { LocationPicker } from '@/features/delivery/location-picker'
import { initialPickerState, locationReducer, toOrderDelivery } from '@/features/delivery/location-state'
import { createSavedLocation, pointToSavedInput, savedLocationsKey, useSavedLocations } from '@/features/delivery/saved-locations'
import { createOrder, orderKeys } from '@/features/orders/api'
import { initializePayment, PaymentError, redirectToPaystack } from '@/features/payments/api'
import { useStoreSettings } from '@/features/products/queries'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { CreatedOrder } from '@/types/domain'
import { cn } from '@/utils/cn'
import { errorCode, friendlyError } from '@/utils/errors'
import { formatAccuracy, formatCoordinates } from '@/utils/geo'
import { formatCedis } from '@/utils/money'
import { readStorage, removeStorage, writeStorage } from '@/utils/safe-storage'

type Step = 'details' | 'location' | 'review' | 'payment'
const STEPS: Array<{ id: Step; label: string; icon: typeof UserRound }> = [
  { id: 'details', label: 'Your details', icon: UserRound },
  { id: 'location', label: 'Delivery location', icon: MapPin },
  { id: 'review', label: 'Review', icon: ShoppingBag },
  { id: 'payment', label: 'Payment', icon: CreditCard },
]
const IDEMPOTENCY_KEY = 'sk-checkout-key'

const contactSchema = z.object({ name: nameSchema, phone: phoneSchema, saveToProfile: z.boolean() })
type ContactValues = z.infer<typeof contactSchema>

function checkoutKey() {
  const existing = readStorage(IDEMPOTENCY_KEY, 'session')
  if (existing) return existing
  const key = crypto.randomUUID()
  writeStorage(IDEMPOTENCY_KEY, key, 'session')
  return key
}

function Stepper({ step, onJump, reached }: { step: Step; onJump: (step: Step) => void; reached: number }) {
  const index = STEPS.findIndex((s) => s.id === step)
  return (
    <nav aria-label="Checkout progress">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < index
          const current = i === index
          const clickable = i <= reached && i !== index && step !== 'payment'
          const Icon = s.icon
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onJump(s.id)}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-colors sm:flex-row sm:items-center',
                  current ? 'border-primary bg-primary-soft' : done ? 'border-line bg-surface hover:border-line-strong' : 'border-line bg-surface opacity-70',
                  'disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                    done ? 'bg-success text-white' : current ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-3',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                </span>
                <span className={cn('hidden text-sm font-semibold sm:block', current ? 'text-primary-text' : 'text-ink-2')}>{s.label}</span>
                <span className="sr-only sm:hidden">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-sm font-semibold text-ink-3 sm:hidden">
        Step {index + 1} of 4 · {STEPS[index]?.label}
      </p>
    </nav>
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

  if (cart.isLoading || settings.isPending) return <PageLoader label="Preparing checkout" />

  if (cart.itemCount === 0 && !createdOrder) {
    return (
      <div className="container-page py-16">
        <Card className="mx-auto max-w-xl">
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add something from the menu before checking out."
            action={
              <Button asChild>
                <Link to="/order">Browse the menu</Link>
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const fee = deliveryFeeFor(settings.data)
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

  const summary = <SummaryLines items={cart.items} subtotal={cart.subtotal} settings={settings.data} />

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display-md">
          Checkout<span className="text-primary-text">.</span>
        </h1>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-3">
          <LockKeyhole className="size-4" aria-hidden="true" />
          Secure checkout with Paystack
        </p>
      </div>

      <Stepper step={step} reached={reached} onJump={goTo} />

      {closed && (
        <Notice tone="warning" className="mt-6" title="We’re not taking orders right now">
          Your cart is saved. Please check back soon.
        </Notice>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="space-y-6">
          {step !== 'payment' && <MobileSummary items={cart.items} subtotal={cart.subtotal} settings={settings.data} />}

          {step === 'details' && (
            <Card className="p-5 sm:p-7">
              <form
                noValidate
                onSubmit={contact.handleSubmit(() => goTo('location'))}
                className="space-y-5"
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">Your details</h2>
                  <p className="mt-1 text-sm text-ink-3">The rider will ask for this name and call this number on arrival.</p>
                </div>
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
                <div className="flex justify-end">
                  <Button type="submit" size="lg" trailingIcon={<ArrowRight aria-hidden="true" />}>
                    Continue to delivery
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {step === 'location' && (
            <Card className="space-y-6 p-5 sm:p-7">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Delivery location</h2>
                <p className="mt-1 text-sm text-ink-3">Pick the exact spot. GPS is optional: search or tap the map if you prefer.</p>
              </div>
              <LocationPicker state={location} dispatch={dispatch} savedLocations={saved.data ?? []} bounds={bounds} />
              <Field label="Delivery instructions" hint="Gate codes, which building, who to hand it to." optional>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={500} rows={3} />
              </Field>
              {confirmed && !confirmed.savedLocationId && (
                <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
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
                <Button size="lg" disabled={!confirmed || Boolean(location.temporary)} onClick={() => goTo('review')} trailingIcon={<ArrowRight aria-hidden="true" />}>
                  Review order
                </Button>
              </div>
              {location.temporary && <p className="text-right text-xs text-ink-3">Confirm or discard the proposed pin to continue.</p>}
            </Card>
          )}

          {step === 'review' && confirmed && (
            <Card className="space-y-6 p-5 sm:p-7">
              <h2 className="font-display text-2xl font-bold text-ink">Review your order</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line p-4">
                  <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">Contact</p>
                  <p className="mt-2 font-semibold text-ink">{contact.getValues('name')}</p>
                  <p className="text-sm text-ink-2">{contact.getValues('phone')}</p>
                  <Button variant="link" className="mt-2 text-sm" onClick={() => goTo('details')}>
                    Edit
                  </Button>
                </div>
                <div className="rounded-2xl border border-line p-4">
                  <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">Deliver to</p>
                  <p className="mt-2 font-semibold text-ink">{confirmed.address}</p>
                  {confirmed.landmark && <p className="text-sm text-ink-2">Landmark: {confirmed.landmark}</p>}
                  {instructions && <p className="text-sm text-ink-2">Note: {instructions}</p>}
                  <p className="mt-1 font-mono text-xs text-ink-3">
                    {formatCoordinates(confirmed)} · {formatAccuracy(confirmed.accuracy)}
                  </p>
                  <Button variant="link" className="mt-2 text-sm" onClick={() => goTo('location')}>
                    Change
                  </Button>
                </div>
              </div>
              <div className="lg:hidden">{summary}</div>
              <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
                <Button variant="ghost" size="lg" onClick={() => goTo('location')} leadingIcon={<ArrowLeft aria-hidden="true" />}>
                  Back
                </Button>
                <Button
                  size="xl"
                  disabled={closed || cart.itemCount === 0}
                  onClick={() => {
                    goTo('payment')
                    void placeOrderAndPay()
                  }}
                  leadingIcon={<LockKeyhole aria-hidden="true" />}
                >
                  Pay {formatCedis(cart.subtotal + fee.amount)} with Paystack
                </Button>
              </div>
            </Card>
          )}

          {step === 'payment' && (
            <Card className="p-6 sm:p-8">
              {phase === 'error' ? (
                <div className="space-y-5">
                  <Notice tone={errorCode(payError) === 'PAYMENTS_NOT_CONFIGURED' ? 'warning' : 'danger'} title="Payment didn’t start">
                    {friendlyError(payError)}
                  </Notice>
                  {createdOrder && (
                    <p className="text-sm text-ink-2">
                      Your order <strong className="font-mono text-ink">{createdOrder.order_reference}</strong> is saved. You can pay for it from
                      your order page at any time.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void placeOrderAndPay()}>Try again</Button>
                    {createdOrder ? (
                      <Button asChild variant="secondary">
                        <Link to={`/track-order/${createdOrder.order_reference}`}>View order</Link>
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => goTo('review')}>
                        Back to review
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-10 text-center" aria-live="polite">
                  <LoaderCircle className="size-9 animate-spin text-primary-text" aria-hidden="true" />
                  <p className="font-display text-xl font-bold text-ink">
                    {phase === 'redirecting' ? 'Opening Paystack’s secure checkout…' : 'Placing your order…'}
                  </p>
                  <p className="max-w-sm text-sm text-ink-3">Please don’t close this page. You’ll come back here automatically after paying.</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="hidden lg:block" aria-label="Order summary">
          <Card className="sticky top-28 space-y-5 p-6">
            <h2 className="font-display text-lg font-bold text-ink">Order summary</h2>
            {summary}
          </Card>
        </aside>
      </div>
    </div>
  )
}
