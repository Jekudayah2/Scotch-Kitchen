/**
 * Pure Paystack helpers shared by the Edge Functions (Deno) and the test suite
 * (Node/Vitest). Uses only Web Crypto and fetch-free logic: no Deno APIs here.
 */
export const PAYSTACK_API = 'https://api.paystack.co'

export const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{8,100}$/
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

export async function sha256Hex(payload: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(payload)))
}

/** Constant-time comparison so signature checks don't leak timing information. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Paystack signs every webhook with HMAC-SHA512(raw body, secret key) in the
 * `x-paystack-signature` header. The RAW body must be used, byte for byte.
 */
export async function isValidPaystackSignature(secret: string, rawBody: string, signature: string | null): Promise<boolean> {
  if (!secret || !signature || !/^[0-9a-f]{128}$/i.test(signature)) return false
  const expected = await hmacSha512Hex(secret, rawBody)
  return timingSafeEqual(expected, signature.toLowerCase())
}

export interface PaystackTransaction {
  id: number | string
  status: string
  reference: string
  amount: number
  currency: string
  paid_at?: string | null
  channel?: string | null
  gateway_response?: string | null
}

export type VerificationOutcome =
  | {
      kind: 'success'
      amount: number
      currency: string
      paidAt: string | null
      channel: string | null
      gatewayResponse: string | null
      transactionId: string
    }
  | { kind: 'failed' | 'abandoned' | 'pending' | 'invalid'; reason: string }

/**
 * Turns Paystack's transaction record into a decision. Amount and currency are
 * checked against the stored payment attempt by confirm_paystack_payment() in
 * the database; here we only make sure the record is well-formed and ours.
 */
export function interpretTransaction(expectedReference: string, tx: PaystackTransaction | null | undefined): VerificationOutcome {
  if (!tx || typeof tx !== 'object') return { kind: 'invalid', reason: 'EMPTY_RESPONSE' }
  if (tx.reference !== expectedReference) return { kind: 'invalid', reason: 'REFERENCE_MISMATCH' }
  switch (tx.status) {
    case 'success':
      if (!Number.isInteger(tx.amount) || tx.amount <= 0) return { kind: 'invalid', reason: 'BAD_AMOUNT' }
      return {
        kind: 'success',
        amount: tx.amount,
        currency: String(tx.currency ?? '').toUpperCase(),
        paidAt: tx.paid_at ?? null,
        channel: tx.channel ?? null,
        gatewayResponse: tx.gateway_response ?? null,
        transactionId: String(tx.id),
      }
    case 'failed':
    case 'reversed':
      return { kind: 'failed', reason: (tx.gateway_response ?? tx.status).slice(0, 200) }
    case 'abandoned':
      return { kind: 'abandoned', reason: 'Checkout was not completed' }
    default:
      // ongoing, pending, processing, queued: not final yet
      return { kind: 'pending', reason: String(tx.status) }
  }
}

export interface InitializeInput {
  email: string
  amountPesewas: number
  reference: string
  callbackUrl: string
  orderId: string
  orderReference: string
}

/** Body for POST /transaction/initialize. Amount is in pesewas (GHS subunit). */
export function buildInitializeBody(input: InitializeInput) {
  if (!Number.isInteger(input.amountPesewas) || input.amountPesewas <= 0) throw new Error('amount must be a positive integer (pesewas)')
  return {
    email: input.email,
    amount: input.amountPesewas,
    currency: 'GHS',
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: {
      order_id: input.orderId,
      order_reference: input.orderReference,
      cancel_action: input.callbackUrl,
    },
  }
}
