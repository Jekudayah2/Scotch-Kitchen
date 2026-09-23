/**
 * Maps the stable error codes raised by our Postgres functions and Edge
 * Functions to human copy. Unknown errors fall back to a generic message and
 * never leak internals to customers.
 */
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Please sign in to continue.',
  FORBIDDEN: 'You don’t have permission to do that.',
  RATE_LIMITED: 'Too many attempts in a short time. Please wait a few minutes and try again.',

  CART_EMPTY: 'Your cart is empty.',
  TOO_MANY_ITEMS: 'That’s a lot of different items. Please split it into two orders.',
  INVALID_CART_ITEM: 'Something in your cart looks wrong. Please remove it and add it again.',
  ITEM_UNAVAILABLE: 'One of your items is no longer available. Please review your cart.',
  INVALID_QUANTITY: 'One of your quantities is outside what we can take in one order.',
  INSUFFICIENT_STOCK: 'We don’t have enough of one item right now. Please lower the quantity.',
  STORE_NOT_ACCEPTING_ORDERS: 'SCOTCH’s Kitchen isn’t taking orders at the moment. Please check back soon.',
  IDEMPOTENCY_KEY_REQUIRED: 'Please refresh the page and try again.',

  INVALID_CONTACT_NAME: 'Please enter the name the rider should ask for.',
  INVALID_CONTACT_PHONE: 'Please enter a phone number the rider can call.',
  INVALID_DELIVERY_LOCATION: 'Please choose your delivery location on the map.',
  LOCATION_NOT_CONFIRMED: 'Please confirm your delivery location on the map first.',
  INVALID_COORDINATES: 'That pin’s coordinates don’t look right. Please choose the location again.',
  INVALID_LATITUDE: 'That pin’s latitude is out of range. Please choose the location again.',
  INVALID_LONGITUDE: 'That pin’s longitude is out of range. Please choose the location again.',
  INVALID_ACCURACY: 'Your location accuracy reading looks wrong. Please choose the location again.',
  INVALID_LOCATION_SOURCE: 'Please choose your delivery location again.',
  OUTSIDE_SERVICE_AREA: 'That location is outside the area we deliver to.',
  INVALID_DELIVERY_ADDRESS: 'Please add a short address or description of the location.',
  SAVED_LOCATION_LIMIT: 'You can keep up to 10 saved locations. Remove one to add another.',

  ORDER_NOT_FOUND: 'We couldn’t find that order.',
  ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled here. Please contact us.',
  ORDER_ARCHIVED: 'This order has been archived and can’t be changed.',
  ORDER_CLOSED: 'This order is already delivered or cancelled.',
  INVALID_TRANSITION: 'That step isn’t allowed from the order’s current status.',
  STATUS_SET_BY_PAYMENT: 'Payment status is set automatically once Paystack confirms a payment.',
  USE_ASSIGN_RIDER: 'Use “Assign rider” to hand an order to a rider.',
  CANCELLATION_REASON_REQUIRED: 'Please give a reason for cancelling.',
  NOT_A_RIDER: 'Only accounts with the rider role can be assigned.',
  CANNOT_ASSIGN_IN_STATUS: 'Riders can be assigned while an order is being prepared or ready.',
  CANNOT_UNASSIGN_IN_STATUS: 'The rider can’t be removed at this stage.',
  NO_RIDER_ASSIGNED: 'No rider is assigned to this order.',
  NOT_ASSIGNED_TO_YOU: 'This delivery isn’t assigned to you.',
  ORDER_NOT_READY: 'The kitchen hasn’t marked this order ready yet.',

  INVALID_AMOUNT: 'Please enter a valid amount.',
  PAID_ORDER_FEE_LOCKED: 'This order is already paid, so its charge can’t change. Add a delivery balance instead.',
  RIDER_FEE_CHANGES_DISABLED: 'Riders can’t change delivery fees. Ask the kitchen.',
  NO_BALANCE_DUE: 'There’s no delivery balance on this order.',
  PROPOSAL_NOT_FOUND: 'That fee proposal no longer exists.',
  PROPOSAL_ALREADY_REVIEWED: 'That fee proposal has already been reviewed.',
  NOTES_TOO_LONG: 'Notes can be up to 4,000 characters.',

  USER_NOT_FOUND: 'No account uses that email yet. Ask them to sign up first.',
  ROLE_NOT_GRANTABLE: 'That role can’t be changed here.',
  CANNOT_REVOKE_OWN_ADMIN: 'You can’t remove your own admin access.',
  LAST_ADMIN: 'At least one admin must remain.',
  RIDER_HAS_ACTIVE_DELIVERIES: 'This rider still has active deliveries. Reassign them first.',

  CONFIRMATION_MISMATCH: 'Type RESET ORDERS exactly to confirm.',
  INVALID_DATE_RANGE: 'Please choose a valid date range.',
  DATE_RANGE_TOO_LONG: 'Please choose a range of 400 days or less.',

  PAYMENTS_NOT_CONFIGURED: 'Online payment isn’t switched on yet. Your order is saved. Please try paying again later.',
  PAYMENT_PROVIDER_ERROR: 'Paystack couldn’t start the payment. Please try again in a moment.',
  ALREADY_PAID: 'This order is already paid.',
  ORDER_NOT_PAYABLE: 'This order can’t be paid for any more.',
  EMAIL_REQUIRED: 'Your account needs an email address before you can pay.',
  PAYMENT_NOT_FOUND: 'We couldn’t find that payment.',
  AMOUNT_MISMATCH: 'Paystack reported a different amount. The kitchen will check it and contact you.',
}

interface ErrorLike {
  message?: unknown
  code?: unknown
  error?: unknown
  context?: unknown
}

/** Returns a stable UPPER_SNAKE code if the error carries one. */
export function errorCode(error: unknown): string | null {
  if (!error) return null
  const candidates: unknown[] = []
  if (typeof error === 'string') candidates.push(error)
  if (typeof error === 'object') {
    const e = error as ErrorLike
    candidates.push(e.message, e.error, e.code)
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^[A-Z][A-Z0-9_]{2,}$/.test(candidate.trim())) return candidate.trim()
  }
  return null
}

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email and password don’t match an account.'],
  [/email not confirmed/i, 'Please confirm your email first. Check your inbox for the link.'],
  [/user already registered/i, 'An account with this email already exists. Try signing in.'],
  [/password should be at least/i, 'Please choose a longer password.'],
  [/new password should be different/i, 'Please choose a password you haven’t used here before.'],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a minute and try again.'],
  [/failed to fetch|networkerror|load failed|network request failed/i, 'We couldn’t reach the server. Check your connection and try again.'],
  [/jwt expired|invalid jwt|refresh token/i, 'Your session has expired. Please sign in again.'],
]

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const code = errorCode(error)
  if (code && MESSAGES[code]) return MESSAGES[code]
  const message =
    typeof error === 'string'
      ? error
      : typeof (error as ErrorLike | null)?.message === 'string'
        ? ((error as ErrorLike).message as string)
        : ''
  for (const [pattern, text] of AUTH_MESSAGES) {
    if (pattern.test(message)) return text
  }
  return fallback
}

export function isPermissionError(error: unknown) {
  const code = errorCode(error)
  const pgCode = typeof (error as ErrorLike | null)?.code === 'string' ? (error as ErrorLike).code : null
  return code === 'FORBIDDEN' || code === 'AUTH_REQUIRED' || pgCode === '42501' || pgCode === 'PGRST301'
}
