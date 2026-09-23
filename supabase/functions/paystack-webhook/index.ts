/**
 * POST /functions/v1/paystack-webhook  (called by Paystack, not by browsers)
 *
 * 1. Rejects anything without a valid HMAC-SHA512 `x-paystack-signature`.
 * 2. De-duplicates deliveries by SHA-256 of the raw body.
 * 3. For charge.success, re-verifies with Paystack's API (defence in depth),
 *    then records the payment through confirm_paystack_payment(), which is
 *    itself idempotent.
 * Deploy with verify_jwt = false (see supabase/config.toml).
 */
import {
  interpretTransaction,
  isValidPaystackSignature,
  PAYSTACK_API,
  REFERENCE_PATTERN,
  sha256Hex,
  type PaystackTransaction,
} from '../_shared/paystack-core.ts'
import { adminClient } from '../_shared/supabase.ts'

const MAX_BODY_BYTES = 1_000_000

function text(body: string, status: number) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('Method not allowed', 405)
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return text('Payments not configured', 503)

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return text('Payload too large', 413)

  if (!(await isValidPaystackSignature(secret, raw, req.headers.get('x-paystack-signature')))) {
    return text('Invalid signature', 401)
  }

  let event: { event?: string; data?: PaystackTransaction }
  try {
    event = JSON.parse(raw)
  } catch {
    return text('Invalid JSON', 400)
  }

  const db = adminClient()
  const hash = await sha256Hex(raw)
  const reference = typeof event.data?.reference === 'string' ? event.data.reference : null

  const { error: insertError } = await db
    .from('payment_webhook_events')
    .insert({ event_type: String(event.event ?? 'unknown').slice(0, 80), reference, payload_sha256: hash })
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('Could not record webhook event', insertError.code)
      return text('Temporary error', 500)
    }
    const { data: existing } = await db.from('payment_webhook_events').select('processed_at').eq('payload_sha256', hash).maybeSingle()
    if (existing?.processed_at) return text('Already processed', 200)
    // Seen before but not finished (e.g. an earlier attempt crashed): process again. Every step is idempotent.
  }

  let outcome = 'ignored'
  try {
    if (event.event === 'charge.success' && reference && REFERENCE_PATTERN.test(reference)) {
      const response = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      const payload = (await response.json().catch(() => null)) as { status?: boolean; data?: PaystackTransaction } | null
      const verified = interpretTransaction(reference, response.ok && payload?.status ? payload.data : null)
      if (verified.kind === 'success') {
        const { data: result, error } = await db.rpc('confirm_paystack_payment', {
          p_reference: reference,
          p_amount_pesewas: verified.amount,
          p_currency: verified.currency,
          p_paid_at: verified.paidAt,
          p_channel: verified.channel,
          p_gateway_response: verified.gatewayResponse,
          p_transaction_id: verified.transactionId,
          p_source: 'WEBHOOK',
        })
        if (error) throw new Error(`confirm failed: ${error.code}`)
        outcome = (result as { ok?: boolean; error?: string })?.ok ? 'confirmed' : ((result as { error?: string })?.error ?? 'rejected')
      } else {
        outcome = `not_verified:${verified.kind}`
      }
    }
    await db.from('payment_webhook_events').update({ processed_at: new Date().toISOString(), outcome, error: null }).eq('payload_sha256', hash)
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown'
    await db.from('payment_webhook_events').update({ outcome: 'error', error: message }).eq('payload_sha256', hash)
    console.error('Webhook processing failed', message)
    // Non-2xx makes Paystack retry later.
    return text('Temporary error', 500)
  }

  return text('OK', 200)
})
