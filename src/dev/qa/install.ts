/**
 * DEV-ONLY UI preview harness (`npm run dev:qa`).
 *
 * Boots PGlite in the browser, applies the REAL Supabase migrations (plus the
 * test shim that emulates Supabase roles/auth/storage), and routes supabase-js
 * traffic to local emulators. Lets the whole UI be exercised without a Supabase
 * project. QA accounts exist only in this local, in-browser database.
 *
 * This module is only reachable behind `import.meta.env.DEV && MODE === 'qa'`,
 * so it is removed from production builds.
 */
import { PGlite } from '@electric-sql/pglite'
import shimSql from '../../../tests/db/supabase-shim.sql?raw'
import { AuthEmulator } from './auth'
import { handleFunction } from './functions'
import { json, PostgrestEmulator } from './postgrest'

const migrations = import.meta.glob('/supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const DB_NAME = 'sk-qa'
const VERSION_KEY = 'sk-qa-schema-version'

export const QA_ACCOUNTS = [
  { email: 'customer@qa.local', name: 'Ama Mensah', phone: '024 387 0366', roles: [] as string[] },
  { email: 'admin@qa.local', name: 'Scotch (QA admin)', phone: '020 000 0001', roles: ['ADMIN', 'RIDER'] },
  { email: 'rider@qa.local', name: 'Kofi Asare', phone: '020 111 2222', roles: ['RIDER'] },
]
export const QA_PASSWORD = 'Kitchen2026'

function hash(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i)
  return (h >>> 0).toString(36)
}

function deleteIndexedDb(name: string) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

export async function installQaHarness() {
  const ordered = Object.keys(migrations).sort()
  const version = hash(shimSql + ordered.map((k) => migrations[k]).join('\n'))
  if (localStorage.getItem(VERSION_KEY) !== version) {
    await deleteIndexedDb(`/pglite/${DB_NAME}`)
    localStorage.removeItem('sk-auth')
    localStorage.setItem(VERSION_KEY, version)
  }

  const db = await PGlite.create(`idb://${DB_NAME}`)
  const existing = await db.query<{ t: string | null }>(`select to_regclass('public.orders')::text as t`)
  const auth = new AuthEmulator(db)

  if (!existing.rows[0]?.t) {
    await db.exec(shimSql)
    for (const key of ordered) await db.exec(migrations[key] as string)
    await auth.init()
    for (const account of QA_ACCOUNTS) {
      const id = await auth.createUser(account.email, QA_PASSWORD, { full_name: account.name, phone: account.phone })
      for (const role of account.roles) {
        await db.query('insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing', [id, role])
      }
    }
    console.info('[QA] Fresh local database created from supabase/migrations.')
  } else {
    await auth.init()
  }

  const rest = new PostgrestEmulator(db)
  await rest.init()

  const realFetch = globalThis.fetch.bind(globalThis)
  globalThis.__SK_DEV_FETCH__ = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.host !== 'qa.supabase.local') return realFetch(input, init)
    const ctx = auth.contextFrom(request)
    if (url.pathname.startsWith('/rest/v1/')) return rest.handle(request, ctx)
    if (url.pathname.startsWith('/auth/v1/')) return auth.handle(request)
    if (url.pathname.startsWith('/functions/v1/')) return handleFunction(url.pathname.replace('/functions/v1/', ''), request, ctx, db)
    return json({ message: 'Storage and other services are not emulated in QA mode.' }, 501)
  }
  ;(globalThis as unknown as { __SK_QA_DB__: PGlite }).__SK_QA_DB__ = db
  console.info(`[QA] UI preview mode. Accounts: ${QA_ACCOUNTS.map((a) => a.email).join(', ')} (password ${QA_PASSWORD}).`)
}
