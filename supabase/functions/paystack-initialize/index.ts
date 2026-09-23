/**
 * POST /functions/v1/paystack-initialize  { order_id }
 *
 * Starts (or reuses) a Paystack transaction for the caller's own unpaid order.
 * The amount always comes from the database, never from the browser.
 * Secrets: PAYSTACK_SECRET_KEY, SITE_URL (and optional ALLOWED_ORIGINS).
 */
import { json, preflight } from '../_shared/http.ts'
import { buildInitializeBody, PAYSTACK_API, UUID_PATTERN } from '../_shared/paystack-core.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

interface AttemptResult {
  ok: boolean
  error?: string
  reused?: boolean
  payment_id?: string
  reference?: string
  amount_pesewas?: number
  email?: string
  authorization_url?: string | null
  access_code?: string | null
  order_reference?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return json(req, { error: 'METHOD_NOT_ALLOWED' }, 405)

  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  const siteUrl = Deno.env.get('SITE_URL')
  if (!secret || !siteUrl) return json(req, { error: 'PAYMENTS_NOT_CONFIGURED' }, 503)

  const user = await requireUser(req)
  if (!user) return json(req, { error: 'AUTH_REQUIRED' }, 401)

  let orderId: string | null
  try {
    const body = (await req.json()) as { order_id?: unknown }
    orderId = typeof body.order_id === 'string' && UUID_PATTERN.test(body.order_id) ? body.order_id : null
  } catch {
    orderId = null
  }
  if (!orderId) return json(req, { error: 'INVALID_REQUEST' }, 400)

  const db = adminClient()
  const { data, error } = await db.rpc('begin_payment_attempt', { p_order_id: orderId, p_user_id: user.id })
  if (error) {
    console.error('begin_payment_attempt failed', error.code)
    return json(req, { error: 'PAYMENT_PROVIDER_ERROR' }, 500)
  }
  const attempt = data as AttemptResult
  if (!attempt?.ok) {
    return json(req, { error: attempt?.error ?? 'PAYMENT_PROVIDER_ERROR' }, attempt?.error === 'RATE_LIMITED' ? 429 : 400)
  }

  if (attempt.reused && attempt.authorization_url) {
    return json(req, { authorization_url: attempt.authorization_url, reference: attempt.reference, access_code: attempt.access_code, reused: true })
  }

  const callbackUrl = `${siteUrl.replace(/\/$/, '')}/checkout/callback`
  let payload: { status?: boolean; message?: string; data?: { authorization_url?: string; access_code?: string } } | null = null
  let ok = false
  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildInitializeBody({
          email: attempt.email as string,
          amountPesewas: attempt.amount_pesewas as number,
          reference: attempt.reference as string,
          callbackUrl,
          orderId,
          orderReference: attempt.order_reference as string,
        }),
      ),
    })
    payload = await response.json().catch(() => null)
    ok = response.ok && payload?.status === true && typeof payload.data?.authorization_url === 'string'
    if (!ok) console.error('Paystack initialize rejected', response.status, payload?.message ?? 'no message')
  } catch (err) {
    console.error('Paystack initialize unreachable', err instanceof Error ? err.message : 'unknown')
  }

  if (!ok || !payload?.data?.authorization_url) {
    await db.rpc('record_payment_failure', { p_reference: attempt.reference, p_status: 'ABANDONED', p_reason: 'Could not start Paystack checkout' })
    return json(req, { error: 'PAYMENT_PROVIDER_ERROR' }, 502)
  }

  await db.rpc('attach_payment_authorization', {
    p_payment_id: attempt.payment_id,
    p_access_code: payload.data.access_code ?? null,
    p_authorization_url: payload.data.authorization_url,
  })

  return json(req, {
    authorization_url: payload.data.authorization_url,
    reference: attempt.reference,
    access_code: payload.data.access_code,
    reused: false,
  })
})
