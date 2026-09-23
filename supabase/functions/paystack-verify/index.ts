/**
 * POST /functions/v1/paystack-verify  { reference }
 *
 * Called when Paystack redirects the customer back. Verifies the transaction
 * directly with Paystack using the secret key, then records the result through
 * confirm_paystack_payment() / record_payment_failure(). Idempotent: the
 * webhook may already have confirmed the same payment.
 */
import { json, preflight } from '../_shared/http.ts'
import { interpretTransaction, PAYSTACK_API, REFERENCE_PATTERN, type PaystackTransaction } from '../_shared/paystack-core.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

interface PaymentRow {
  id: string
  reference: string
  status: string
  order_id: string
}

interface OrderRow {
  id: string
  order_reference: string
  customer_id: string
  order_status: string
  payment_status: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405)

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return json(req, { error: 'PAYMENTS_NOT_CONFIGURED' }, 503)

  const user = await requireUser(req)
  if (!user) return json(req, { error: 'AUTH_REQUIRED' }, 401)

  let reference: string
  try {
    const body = (await req.json()) as { reference?: unknown }
    reference = typeof body.reference === 'string' ? body.reference.trim() : ''
  } catch {
    reference = ''
  }
  if (!REFERENCE_PATTERN.test(reference)) return json(req, { error: 'INVALID_REQUEST' }, 400)

  const db = adminClient()
  const { data: payment } = await db.from('payments').select('id, reference, status, order_id').eq('reference', reference).maybeSingle<PaymentRow>()
  if (!payment) return json(req, { error: 'PAYMENT_NOT_FOUND' }, 404)

  const loadOrder = async () =>
    (await db.from('orders').select('id, order_reference, customer_id, order_status, payment_status').eq('id', payment.order_id).single<OrderRow>()).data

  const order = await loadOrder()
  if (!order) return json(req, { error: 'PAYMENT_NOT_FOUND' }, 404)
  if (order.customer_id !== user.id) {
    const { data: roles } = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'ADMIN')
    if (!roles?.length) return json(req, { error: 'PAYMENT_NOT_FOUND' }, 404)
  }

  const respond = (status: string, current: OrderRow | null) =>
    json(req, {
      status,
      order_id: current?.id ?? null,
      order_reference: current?.order_reference ?? null,
      order_status: current?.order_status,
      payment_status: current?.payment_status,
    })

  if (payment.status === 'PAID') return respond('PAID', order)

  let tx: PaystackTransaction | null = null
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const payload = (await response.json().catch(() => null)) as { status?: boolean; data?: PaystackTransaction } | null
    if (response.ok && payload?.status) tx = payload.data ?? null
  } catch (err) {
    console.error('Paystack verify unreachable', err instanceof Error ? err.message : 'unknown')
  }

  // Not found / not reachable yet: report pending, never guess.
  if (!tx) return respond('PENDING', order)

  const outcome = interpretTransaction(reference, tx)
  let status = 'PENDING'
  if (outcome.kind === 'success') {
    const { data: result, error } = await db.rpc('confirm_paystack_payment', {
      p_reference: reference,
      p_amount_pesewas: outcome.amount,
      p_currency: outcome.currency,
      p_paid_at: outcome.paidAt,
      p_channel: outcome.channel,
      p_gateway_response: outcome.gatewayResponse,
      p_transaction_id: outcome.transactionId,
      p_source: 'VERIFY',
    })
    if (error) {
      console.error('confirm_paystack_payment failed', error.code)
      return json(req, { error: 'PAYMENT_PROVIDER_ERROR' }, 500)
    }
    status = (result as { ok?: boolean })?.ok ? 'PAID' : 'MISMATCH'
  } else if (outcome.kind === 'failed' || outcome.kind === 'abandoned') {
    await db.rpc('record_payment_failure', {
      p_reference: reference,
      p_status: outcome.kind === 'failed' ? 'FAILED' : 'ABANDONED',
      p_reason: outcome.reason,
    })
    status = outcome.kind === 'failed' ? 'FAILED' : 'ABANDONED'
  } else if (outcome.kind === 'invalid') {
    console.error('Unexpected Paystack verification payload', outcome.reason)
  }

  return respond(status, await loadOrder())
})
