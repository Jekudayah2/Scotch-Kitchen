import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = join(here, '..', '..')
const migrationsDir = join(root, 'supabase', 'migrations')

export type Role = 'anon' | 'authenticated' | 'service_role'

export interface TestDb {
  db: PGlite
  /** Runs `fn` with the connection switched to an API role, like PostgREST does. */
  as<T>(role: Role, userId: string | null, fn: () => Promise<T>): Promise<T>
  /** Creates an auth user (the signup trigger creates the profile + CUSTOMER role). */
  createUser(email: string, meta?: Record<string, unknown>): Promise<string>
  /** Grants a role as the database owner would (bootstrap / service role). */
  grantRole(userId: string, role: 'ADMIN' | 'RIDER' | 'CUSTOMER'): Promise<void>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  one<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T>
  close(): Promise<void>
}

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite()
  await db.exec(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'))
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error })
    }
  }

  const query = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows
  const one = async <T,>(sql: string, params: unknown[] = []) => {
    const rows = await query<T>(sql, params)
    if (rows.length !== 1) throw new Error(`Expected exactly one row, got ${rows.length}`)
    return rows[0] as T
  }

  const as = async <T,>(role: Role, userId: string | null, fn: () => Promise<T>): Promise<T> => {
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role })
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
    await db.exec(`set role ${role}`)
    try {
      return await fn()
    } finally {
      await db.exec('reset role')
      await db.query(`select set_config('request.jwt.claims', '', false)`)
    }
  }

  const createUser = async (email: string, meta: Record<string, unknown> = {}) => {
    const row = await one<{ id: string }>(
      'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
      [email, JSON.stringify(meta)],
    )
    return row.id
  }

  const grantRole = async (userId: string, role: string) => {
    await db.query('insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing', [
      userId,
      role,
    ])
  }

  return { db, as, createUser, grantRole, query, one, close: () => db.close() }
}

/** Extracts the Postgres error message (our RPCs raise stable codes like 'INVALID_TRANSITION'). */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('Expected the operation to fail, but it succeeded')
}
