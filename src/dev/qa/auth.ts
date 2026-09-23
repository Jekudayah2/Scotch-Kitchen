/**
 * DEV-ONLY. Emulates the handful of Supabase Auth (GoTrue) endpoints the app
 * uses, backed by auth.users inside PGlite so the real signup trigger runs.
 */
import type { PGlite } from '@electric-sql/pglite'
import { json, type RequestAuth } from './postgrest'

interface AuthUserRow {
  id: string
  email: string
  raw_user_meta_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

const b64url = (value: string) => btoa(unescape(encodeURIComponent(value))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

function fromB64url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

function fakeJwt(user: AuthUserRow) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'qa' }))
  const payload = b64url(
    JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: `qa-${user.id}` }),
  )
  return `${header}.${payload}.qa-signature`
}

function toUser(row: AuthUserRow) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: row.created_at,
    confirmed_at: row.created_at,
    last_sign_in_at: new Date().toISOString(),
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
  }
}

function authError(status: number, errorCode: string, message: string) {
  return json({ code: status, error_code: errorCode, msg: message }, status)
}

export class AuthEmulator {
  private db: PGlite

  constructor(db: PGlite) {
    this.db = db
  }

  async init() {
    await this.db.exec(`
      create table if not exists auth.qa_credentials (
        user_id uuid primary key references auth.users (id) on delete cascade,
        password text not null
      );`)
  }

  /** Reads the caller's identity from the Authorization header. */
  contextFrom(request: Request): RequestAuth {
    const header = request.headers.get('authorization') ?? ''
    const token = header.replace(/^Bearer\s+/i, '')
    const parts = token.split('.')
    if (parts.length === 3) {
      try {
        const claims = JSON.parse(fromB64url(parts[1] ?? '')) as { sub?: string; role?: string; email?: string; exp?: number }
        if (claims.role === 'service_role') return { role: 'service_role', sub: null }
        if (claims.sub && (!claims.exp || claims.exp * 1000 > Date.now())) return { role: 'authenticated', sub: claims.sub, email: claims.email }
      } catch {
        /* not one of our tokens */
      }
    }
    return { role: 'anon', sub: null }
  }

  private async userById(id: string) {
    const res = await this.db.query<AuthUserRow>('select id, email, raw_user_meta_data, created_at::text, updated_at::text from auth.users where id = $1', [id])
    return res.rows[0] ?? null
  }

  private session(user: AuthUserRow) {
    const expiresIn = 3600
    return {
      access_token: fakeJwt(user),
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      refresh_token: `qa-refresh.${user.id}`,
      user: toUser(user),
    }
  }

  async createUser(email: string, password: string, meta: Record<string, unknown>) {
    const res = await this.db.query<{ id: string }>('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [
      email.toLowerCase(),
      JSON.stringify(meta),
    ])
    const id = res.rows[0]?.id as string
    await this.db.query('insert into auth.qa_credentials (user_id, password) values ($1, $2)', [id, password])
    return id
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/auth\/v1\//, '')
    const body = request.method === 'GET' ? {} : ((await request.json().catch(() => ({}))) as Record<string, unknown>)

    if (path === 'token') {
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        const email = String(body.email ?? '').toLowerCase()
        const res = await this.db.query<AuthUserRow & { password: string }>(
          `select u.id, u.email, u.raw_user_meta_data, u.created_at::text, u.updated_at::text, c.password
           from auth.users u join auth.qa_credentials c on c.user_id = u.id where lower(u.email) = $1`,
          [email],
        )
        const row = res.rows[0]
        if (!row || row.password !== body.password) return authError(400, 'invalid_credentials', 'Invalid login credentials')
        return json(this.session(row))
      }
      if (grant === 'refresh_token') {
        const id = String(body.refresh_token ?? '').replace(/^qa-refresh\./, '')
        const user = await this.userById(id)
        if (!user) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token')
        return json(this.session(user))
      }
      return authError(400, 'unsupported_grant_type', 'Unsupported grant type in QA mode')
    }

    if (path === 'signup') {
      const email = String(body.email ?? '').toLowerCase()
      const password = String(body.password ?? '')
      if (password.length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.')
      const exists = await this.db.query('select 1 from auth.users where lower(email) = $1', [email])
      if (exists.rows.length) return authError(422, 'user_already_exists', 'User already registered')
      const id = await this.createUser(email, password, (body.data as Record<string, unknown>) ?? {})
      const user = await this.userById(id)
      return json(this.session(user as AuthUserRow))
    }

    const ctx = this.contextFrom(request)

    if (path === 'user') {
      if (!ctx.sub) return authError(401, 'no_authorization', 'Not signed in')
      if (request.method === 'PUT') {
        if (typeof body.password === 'string') {
          await this.db.query('update auth.qa_credentials set password = $2 where user_id = $1', [ctx.sub, body.password])
        }
        if (body.data && typeof body.data === 'object') {
          await this.db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [ctx.sub, JSON.stringify(body.data)])
        }
      }
      const user = await this.userById(ctx.sub)
      return user ? json(toUser(user)) : authError(404, 'user_not_found', 'User not found')
    }

    if (path === 'logout') return new Response(null, { status: 204 })
    if (path === 'recover') return json({})
    if (path === 'authorize') return authError(400, 'provider_disabled', 'Google sign-in is not available in QA mode.')

    return authError(404, 'not_found', `QA auth endpoint not emulated: ${path}`)
  }
}
