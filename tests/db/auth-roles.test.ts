import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness.ts'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})
afterAll(async () => {
  await t.close()
})

describe('sign-up trigger', () => {
  it('creates a profile and CUSTOMER role, sanitising user-supplied metadata', async () => {
    const id = await t.createUser('ama@example.com', {
      full_name: '  Ama Mensah ',
      phone: 'not-a-phone',
      avatar_url: 'javascript:alert(1)',
    })
    const profile = await t.one<{ full_name: string; email: string; phone: string | null; avatar_url: string | null }>(
      'select full_name, email, phone, avatar_url from public.profiles where id = $1',
      [id],
    )
    expect(profile).toEqual({ full_name: 'Ama Mensah', email: 'ama@example.com', phone: null, avatar_url: null })
    const roles = await t.query<{ role: string }>('select role from public.user_roles where user_id = $1', [id])
    expect(roles.map((r) => r.role)).toEqual(['CUSTOMER'])
  })

  it('accepts Google-style metadata (name + picture)', async () => {
    const id = await t.createUser('kwame@example.com', {
      name: 'Kwame Boateng',
      picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
    })
    const profile = await t.one<{ full_name: string; avatar_url: string }>(
      'select full_name, avatar_url from public.profiles where id = $1',
      [id],
    )
    expect(profile.full_name).toBe('Kwame Boateng')
    expect(profile.avatar_url).toBe('https://lh3.googleusercontent.com/a/photo.jpg')
  })

  it('never stores passwords: profiles has no credential columns', async () => {
    const cols = await t.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'`,
    )
    expect(cols.map((c) => c.column_name).some((c) => /pass|secret|token/i.test(c))).toBe(false)
  })
})

describe('profile privacy (RLS)', () => {
  it('lets a customer read and edit only their own profile', async () => {
    const a = await t.createUser('a1@example.com', { full_name: 'A One' })
    const b = await t.createUser('b1@example.com', { full_name: 'B One' })

    const visible = await t.as('authenticated', a, () => t.query<{ id: string }>('select id from public.profiles'))
    expect(visible.map((r) => r.id)).toEqual([a])

    await t.as('authenticated', a, () =>
      t.query(`update public.profiles set full_name = 'Hacked' where id = $1`, [b]),
    )
    const bName = await t.one<{ full_name: string }>('select full_name from public.profiles where id = $1', [b])
    expect(bName.full_name).toBe('B One')

    await t.as('authenticated', a, () =>
      t.query(`update public.profiles set full_name = 'A Updated', phone = '0244000000' where id = $1`, [a]),
    )
    const aRow = await t.one<{ full_name: string; phone: string }>('select full_name, phone from public.profiles where id = $1', [a])
    expect(aRow).toEqual({ full_name: 'A Updated', phone: '0244000000' })
  })

  it('blocks writes to non-editable profile columns and invalid phones', async () => {
    const a = await t.createUser('a2@example.com')
    expect(
      await errorOf(t.as('authenticated', a, () => t.query(`update public.profiles set email = 'x@y.z' where id = $1`, [a]))),
    ).toMatch(/permission denied/)
    expect(
      await errorOf(t.as('authenticated', a, () => t.query(`update public.profiles set phone = 'call me' where id = $1`, [a]))),
    ).toMatch(/check constraint/)
  })

  it('hides every profile from anonymous visitors', async () => {
    await expect(t.as('anon', null, () => t.query('select id from public.profiles'))).rejects.toThrow(/permission denied/)
  })
})

describe('roles', () => {
  it('prevents a customer from granting themselves ADMIN', async () => {
    const a = await t.createUser('sneaky@example.com')
    const error = await errorOf(
      t.as('authenticated', a, () => t.query(`insert into public.user_roles (user_id, role) values ($1, 'ADMIN')`, [a])),
    )
    expect(error).toMatch(/permission denied/)
    const adminRpc = await errorOf(
      t.as('authenticated', a, () => t.query(`select public.admin_grant_role('sneaky@example.com', 'ADMIN')`)),
    )
    expect(adminRpc).toBe('FORBIDDEN')
  })

  it('keeps the email bootstrap out of reach of API roles', async () => {
    const a = await t.createUser('bootstrap-attempt@example.com')
    const error = await errorOf(
      t.as('authenticated', a, () =>
        t.query(`select private.bootstrap_grant_role('bootstrap-attempt@example.com', 'ADMIN')`),
      ),
    )
    expect(error).toMatch(/permission denied/)
  })

  it('bootstraps jkscotch2004@gmail.com as ADMIN + RIDER without dropping CUSTOMER', async () => {
    const id = await t.createUser('jkscotch2004@gmail.com', { full_name: 'Scotch' })
    await t.query(`select private.bootstrap_grant_role('jkscotch2004@gmail.com', 'ADMIN')`)
    await t.query(`select private.bootstrap_grant_role('JKScotch2004@gmail.com', 'RIDER')`)
    const roles = await t.query<{ role: string }>(
      'select role::text from public.user_roles where user_id = $1 order by role',
      [id],
    )
    expect(roles.map((r) => r.role).sort()).toEqual(['ADMIN', 'CUSTOMER', 'RIDER'])
    const rider = await t.one<{ availability: string }>('select availability from public.rider_profiles where user_id = $1', [id])
    expect(rider.availability).toBe('OFFLINE')
    const audit = await t.query<{ action: string }>(`select action from public.audit_logs where target_id = $1`, [id])
    expect(audit.map((a) => a.action)).toEqual(['role.granted', 'role.granted'])

    // The combined account really gets both capabilities.
    const isBoth = await t.as('authenticated', id, () =>
      t.one<{ admin: boolean; rider: boolean }>('select private.is_admin() as admin, private.is_rider() as rider'),
    )
    expect(isBoth).toEqual({ admin: true, rider: true })
  })

  it('reports a clear error when bootstrapping an email that has not signed up', async () => {
    expect(await errorOf(t.query(`select private.bootstrap_grant_role('nobody@example.com', 'ADMIN')`))).toMatch(
      /must sign up first/,
    )
  })

  it('lets admins add riders by email and protects against admin lock-out', async () => {
    const admin = await t.createUser('owner@example.com')
    await t.grantRole(admin, 'ADMIN')
    const future = await t.createUser('future.rider@example.com', { full_name: 'Future Rider' })

    const granted = await t.as('authenticated', admin, () =>
      t.one<{ r: { user_id: string } }>(`select public.admin_grant_role('FUTURE.RIDER@example.com', 'RIDER') as r`),
    )
    expect(granted.r.user_id).toBe(future)

    expect(
      await errorOf(t.as('authenticated', admin, () => t.query(`select public.admin_grant_role('ghost@example.com', 'RIDER')`))),
    ).toBe('USER_NOT_FOUND')
    expect(
      await errorOf(t.as('authenticated', admin, () => t.query(`select public.admin_revoke_role($1, 'ADMIN')`, [admin]))),
    ).toBe('CANNOT_REVOKE_OWN_ADMIN')

    await t.as('authenticated', admin, () => t.query(`select public.admin_revoke_role($1, 'RIDER')`, [future]))
    const roles = await t.query<{ role: string }>('select role::text from public.user_roles where user_id = $1', [future])
    expect(roles.map((r) => r.role)).toEqual(['CUSTOMER'])
  })
})

describe('rider availability', () => {
  it('is set by the rider (or an admin) and audited, never by anyone else', async () => {
    const rider = await t.createUser('avail.rider@example.com')
    await t.grantRole(rider, 'RIDER')
    const customer = await t.createUser('avail.customer@example.com')

    await t.as('authenticated', rider, () => t.query(`select public.set_rider_availability('AVAILABLE')`))
    const row = await t.one<{ availability: string }>('select availability from public.rider_profiles where user_id = $1', [rider])
    expect(row.availability).toBe('AVAILABLE')

    expect(
      await errorOf(t.as('authenticated', customer, () => t.query(`select public.set_rider_availability('BUSY', $1)`, [rider]))),
    ).toBe('FORBIDDEN')
    expect(
      await errorOf(t.as('authenticated', customer, () => t.query(`select public.set_rider_availability('AVAILABLE')`))),
    ).toBe('FORBIDDEN')

    const audit = await t.query<{ action: string }>(
      `select action from public.audit_logs where target_type = 'rider' and target_id = $1`,
      [rider],
    )
    expect(audit.map((a) => a.action)).toEqual(['rider.availability_changed'])
  })
})

describe('audit log integrity', () => {
  it('is append-only and unreadable by non-admins', async () => {
    const customer = await t.createUser('audit.reader@example.com')
    const rows = await t.as('authenticated', customer, () => t.query('select id from public.audit_logs'))
    expect(rows).toEqual([])
    expect(await errorOf(t.query('delete from public.audit_logs'))).toMatch(/append-only/)
    expect(await errorOf(t.query(`update public.audit_logs set summary = 'x'`))).toMatch(/append-only/)
  })

  it('redacts credential-looking keys from metadata', async () => {
    const out = await t.one<{ r: Record<string, unknown> }>(
      `select private.redact_secrets('{"reference":"abc","nested":{"access_code":"zzz","api_key":"k"},"password":"p"}'::jsonb) as r`,
    )
    expect(out.r).toEqual({ reference: 'abc', nested: { access_code: '[REDACTED]', api_key: '[REDACTED]' }, password: '[REDACTED]' })
  })
})

describe('admin team view (RLS through security_invoker)', () => {
  it('shows admins every staff role, and anyone else only their own', async () => {
    const admin = await t.createUser(`team-admin-${Date.now()}@example.com`, { full_name: 'Team Admin' })
    await t.grantRole(admin, 'ADMIN')
    const rider = await t.createUser(`team-rider-${Date.now()}@example.com`, { full_name: 'Team Rider' })
    await t.grantRole(rider, 'RIDER')
    const customer = await t.createUser(`team-customer-${Date.now()}@example.com`, { full_name: 'Just A Customer' })

    const asAdmin = await t.as('authenticated', admin, () =>
      t.query<{ user_id: string; role: string }>('select user_id, role from public.admin_team_list'),
    )
    expect(asAdmin).toEqual(expect.arrayContaining([{ user_id: admin, role: 'ADMIN' }, { user_id: rider, role: 'RIDER' }]))
    expect(asAdmin.some((r) => r.user_id === customer)).toBe(false)

    const asRider = await t.as('authenticated', rider, () => t.query<{ user_id: string }>('select user_id from public.admin_team_list'))
    expect(asRider.map((r) => r.user_id)).toEqual([rider])

    const asCustomer = await t.as('authenticated', customer, () => t.query('select 1 from public.admin_team_list'))
    expect(asCustomer).toEqual([])

    expect(await errorOf(t.as('anon', null, () => t.query('select 1 from public.admin_team_list')))).toMatch(/permission denied/)
  })
})
