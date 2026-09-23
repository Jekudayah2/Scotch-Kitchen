import { env } from '@/config/env'
import { supabase } from '@/lib/supabase'

/** Only same-origin paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = '/') {
  if (!next) return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (next.startsWith('/sign-in') || next.startsWith('/sign-up') || next.startsWith('/auth/')) return fallback
  return next
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUpWithPassword(input: { fullName: string; email: string; phone?: string; password: string; next?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(input.next))}`,
      data: { full_name: input.fullName, ...(input.phone ? { phone: input.phone } : {}) },
    },
  })
  if (error) throw error
  // With email confirmation enabled, Supabase returns no session until the link is clicked.
  return { needsEmailConfirmation: !data.session }
}

export async function signInWithGoogle(next?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl}/reset-password` })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}
