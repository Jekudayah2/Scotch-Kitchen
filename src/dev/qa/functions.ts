/**
 * DEV-ONLY. Emulates the Paystack Edge Functions against PGlite, calling the
 * same service-role SQL functions the real functions call. "Paystack" itself is
 * replaced by a local simulator page (/dev/paystack) that records an outcome.
 */
import type { PGlite } from '@electric-sql/pglite'
import { json, type RequestAuth } from './postgrest'

export const QA_PAYSTACK_LEDGER_KEY = 'sk-qa-paystack-ledger'

export type SimulatedOutcome = 'success' | 'failed' | 'abandoned'

function readLedger(): Record<string, SimulatedOutcome> {
  try {
    return JSON.parse(localStorage.getItem(QA_PAYSTACK_LEDGER_KEY) ?? '{}') as Record<string, SimulatedOutcome>
  } catch {
    return {}
  }
}

async function asService<T>(db: PGlite, sql: string, params: unknown[]): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`)
    await tx.exec('set local role service_role')
    const res = await tx.query<{ r: T }>(sql, params)
    return res.rows[0]?.r as T
  })
}

export async function handleFunction(name: string, request: Request, auth: RequestAuth, db: PGlite): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (auth.role !== 'authenticated' || !auth.sub) return json({ error: 'AUTH_REQUIRED' }, 401)
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (name === 'paystack-initialize') {
    const attempt = await asService<Record<string, unknown>>(db, 'select public.begin_payment_attempt($1, $2) as r', [body.order_id, auth.sub])
    if (!attempt?.ok) return json({ error: attempt?.error ?? 'PAYMENT_PROVIDER_ERROR' }, 400)
    const url = new URL('/dev/paystack', window.location.origin)
    url.searchParams.set('reference', String(attempt.reference))
    url.searchParams.set('amount', String(attempt.amount_pesewas))
    url.searchParams.set('email', String(attempt.email))
    url.searchParams.set('order', String(attempt.order_reference))
    if (!attempt.reused) {
      await asService(db, 'select public.attach_payment_authorization($1, $2, $3) as r', [attempt.payment_id, 'qa_access_code', url.toString()])
    }
    return json({ authorization_url: url.toString(), reference: attempt.reference, access_code: 'qa_access_code', reused: Boolean(attempt.reused) })
  }

  if (name === 'paystack-verify') {
    const reference = String(body.reference ?? '')
    const owner = await asService<{ customer_id: string; amount: number; status: string } | null>(
      db,
      `select json_build_object('customer_id', o.customer_id, 'amount', p.amount_pesewas, 'status', p.status) as r
       from public.payments p join public.orders o on o.id = p.order_id where p.reference = $1`,
      [reference],
    )
    if (!owner || owner.customer_id !== auth.sub) return json({ error: 'PAYMENT_NOT_FOUND' }, 404)

    const outcome = readLedger()[reference]
    let result: Record<string, unknown> | null = null
    if (outcome === 'success') {
      result = await asService(db, `select public.confirm_paystack_payment($1, $2, 'GHS', now(), 'qa_simulator', 'Approved (QA simulator)', $3, 'VERIFY') as r`, [
        reference,
        owner.amount,
        `QA-${reference}`,
      ])
    } else if (outcome === 'failed') {
      await asService(db, `select public.record_payment_failure($1, 'FAILED', 'Declined (QA simulator)') as r`, [reference])
    } else if (outcome === 'abandoned') {
      await asService(db, `select public.record_payment_failure($1, 'ABANDONED', 'Abandoned (QA simulator)') as r`, [reference])
    }

    const state = await asService<Record<string, unknown>>(
      db,
      `select json_build_object('order_id', o.id, 'order_reference', o.order_reference, 'order_status', o.order_status,
                                'payment_status', o.payment_status, 'attempt_status', p.status) as r
       from public.payments p join public.orders o on o.id = p.order_id where p.reference = $1`,
      [reference],
    )
    const attempt = String(state.attempt_status)
    const status =
      result && result.ok === false ? 'MISMATCH' : attempt === 'PAID' ? 'PAID' : attempt === 'FAILED' ? 'FAILED' : attempt === 'ABANDONED' ? 'ABANDONED' : 'PENDING'
    return json({
      status,
      order_id: state.order_id,
      order_reference: state.order_reference,
      order_status: state.order_status,
      payment_status: state.payment_status,
    })
  }

  return json({ error: 'NOT_FOUND', message: `Function ${name} is not emulated in QA mode` }, 404)
}
