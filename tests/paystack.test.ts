import { createHmac, createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildInitializeBody,
  interpretTransaction,
  isValidPaystackSignature,
  sha256Hex,
  timingSafeEqual,
  type PaystackTransaction,
} from '../supabase/functions/_shared/paystack-core.ts'

const SECRET = 'sk_test_example_secret_not_real'
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'SKP-7KQ4MX-ABCDEFGH', amount: 3800, currency: 'GHS' } })
const sign = (payload: string, secret = SECRET) => createHmac('sha512', secret).update(payload).digest('hex')

describe('Paystack webhook signatures', () => {
  it('accepts a genuine HMAC-SHA512 signature of the raw body', async () => {
    expect(await isValidPaystackSignature(SECRET, body, sign(body))).toBe(true)
    expect(await isValidPaystackSignature(SECRET, body, sign(body).toUpperCase())).toBe(true)
  })

  it('rejects tampered bodies, wrong secrets and malformed headers', async () => {
    const tampered = body.replace('3800', '1')
    expect(await isValidPaystackSignature(SECRET, tampered, sign(body))).toBe(false)
    expect(await isValidPaystackSignature(SECRET, body, sign(body, 'sk_test_other'))).toBe(false)
    expect(await isValidPaystackSignature(SECRET, body, null)).toBe(false)
    expect(await isValidPaystackSignature(SECRET, body, 'abc')).toBe(false)
    expect(await isValidPaystackSignature('', body, sign(body, ''))).toBe(false)
  })

  it('compares in constant time and hashes payloads for de-duplication', async () => {
    expect(timingSafeEqual('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqual('abcd', 'abce')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
    expect(await sha256Hex(body)).toBe(createHash('sha256').update(body).digest('hex'))
  })
})

describe('transaction verification', () => {
  const tx = (overrides: Partial<PaystackTransaction>): PaystackTransaction => ({
    id: 4099260516,
    status: 'success',
    reference: 'SKP-7KQ4MX-ABCDEFGH',
    amount: 3800,
    currency: 'GHS',
    paid_at: '2026-09-23T10:00:00.000Z',
    channel: 'mobile_money',
    gateway_response: 'Approved',
    ...overrides,
  })

  it('reports a successful charge with the exact amount Paystack received', () => {
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', tx({}))).toEqual({
      kind: 'success',
      amount: 3800,
      currency: 'GHS',
      paidAt: '2026-09-23T10:00:00.000Z',
      channel: 'mobile_money',
      gatewayResponse: 'Approved',
      transactionId: '4099260516',
    })
  })

  it('never treats a different reference as ours', () => {
    expect(interpretTransaction('SKP-OTHER-REF12345', tx({})).kind).toBe('invalid')
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', null).kind).toBe('invalid')
  })

  it('maps failed, abandoned and in-flight states', () => {
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', tx({ status: 'failed', gateway_response: 'Declined' }))).toEqual({ kind: 'failed', reason: 'Declined' })
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', tx({ status: 'abandoned' })).kind).toBe('abandoned')
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', tx({ status: 'ongoing' })).kind).toBe('pending')
    expect(interpretTransaction('SKP-7KQ4MX-ABCDEFGH', tx({ status: 'success', amount: 0 })).kind).toBe('invalid')
  })
})

describe('transaction initialisation', () => {
  it('sends the database amount in pesewas and GHS, with a server-side callback', () => {
    expect(
      buildInitializeBody({
        email: 'ama@example.com',
        amountPesewas: 3800,
        reference: 'SKP-7KQ4MX-ABCDEFGH',
        callbackUrl: 'https://kitchen.example/checkout/callback',
        orderId: '00000000-0000-4000-8000-000000000001',
        orderReference: 'SK-7KQ4MX',
      }),
    ).toEqual({
      email: 'ama@example.com',
      amount: 3800,
      currency: 'GHS',
      reference: 'SKP-7KQ4MX-ABCDEFGH',
      callback_url: 'https://kitchen.example/checkout/callback',
      metadata: {
        order_id: '00000000-0000-4000-8000-000000000001',
        order_reference: 'SK-7KQ4MX',
        cancel_action: 'https://kitchen.example/checkout/callback',
      },
    })
  })

  it('refuses non-integer or non-positive amounts', () => {
    const base = { email: 'a@b.c', reference: 'SKP-X-12345678', callbackUrl: 'https://x/cb', orderId: 'x', orderReference: 'SK-X' }
    expect(() => buildInitializeBody({ ...base, amountPesewas: 38.5 })).toThrow()
    expect(() => buildInitializeBody({ ...base, amountPesewas: 0 })).toThrow()
  })
})
