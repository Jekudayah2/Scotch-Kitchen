import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Paystack is only ever called from Supabase Edge Functions, which hold the
 * secret key. The browser asks the server to start a transaction and, after
 * Paystack redirects back, asks the server to verify it. The browser's own view
 * of "success" is never trusted.
 */
export interface InitializePaymentResult {
  authorization_url: string
  reference: string
  access_code?: string
  reused: boolean
}

export type VerificationStatus = 'PAID' | 'PENDING' | 'FAILED' | 'ABANDONED' | 'MISMATCH'

export interface VerifyPaymentResult {
  status: VerificationStatus
  order_id: string | null
  order_reference: string | null
  order_status?: string
  payment_status?: string
}

export class PaymentError extends Error {
  readonly code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.name = 'PaymentError'
    this.code = code
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string; message?: string } | null
      throw new PaymentError(payload?.error ?? 'PAYMENT_PROVIDER_ERROR', payload?.error ?? payload?.message)
    }
    // Relay/network errors (function not deployed, offline…)
    throw new PaymentError('PAYMENTS_NOT_CONFIGURED', error.message)
  }
  return data as T
}

export function initializePayment(orderId: string) {
  return invoke<InitializePaymentResult>('paystack-initialize', { order_id: orderId })
}

export function verifyPayment(reference: string) {
  return invoke<VerifyPaymentResult>('paystack-verify', { reference })
}

/** Sends the browser to Paystack's hosted checkout page (only https URLs from our server). */
export function redirectToPaystack(url: string) {
  const target = new URL(url, window.location.origin)
  const allowed = target.protocol === 'https:' || (import.meta.env.DEV && target.origin === window.location.origin)
  if (!allowed) throw new PaymentError('PAYMENT_PROVIDER_ERROR', 'Unexpected payment URL')
  window.location.assign(target.toString())
}
