import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppRole, Profile } from '@/types/domain'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: Profile | null
  roles: AppRole[]
  /** False while the profile/roles request for a signed-in user is in flight. */
  rolesLoaded: boolean
  rolesError: unknown
  isAdmin: boolean
  isRider: boolean
  displayName: string
  firstName: string
  refetchProfile: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const meQueryKey = (userId: string | null) => ['me', userId] as const

async function fetchMe(userId: string) {
  const [profile, roles] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ])
  if (profile.error) throw profile.error
  if (roles.error) throw roles.error
  return { profile: profile.data, roles: roles.data.map((r) => r.role) }
}

/**
 * Session state comes from Supabase Auth (restored from storage on load and
 * kept fresh by onAuthStateChange). Roles are read from user_roles under RLS.
 * Role checks in the UI are a convenience: the database enforces the real rules.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setInitialised(true)
      })
      .catch(() => {
        if (active) setInitialised(true)
      })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Never call other Supabase methods synchronously inside this callback.
      setSession(nextSession)
      setInitialised(true)
      if (event === 'SIGNED_OUT') {
        queueMicrotask(() => queryClient.clear())
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id ?? null
  const me = useQuery({
    queryKey: meQueryKey(userId),
    queryFn: () => fetchMe(userId as string),
    enabled: userId !== null,
    staleTime: 60_000,
  })

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !initialised ? 'loading' : session ? 'signed_in' : 'signed_out'
    const roles = me.data?.roles ?? []
    const profile = me.data?.profile ?? null
    const metaName = typeof session?.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : ''
    const displayName = profile?.full_name?.trim() || metaName.trim() || session?.user.email?.split('@')[0] || ''
    return {
      status,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      rolesLoaded: status !== 'signed_in' || me.isSuccess || me.isError,
      rolesError: me.error,
      isAdmin: roles.includes('ADMIN'),
      isRider: roles.includes('RIDER'),
      displayName,
      firstName: displayName.split(/\s+/)[0] ?? '',
      refetchProfile: () => me.refetch(),
    }
  }, [initialised, session, me])

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
