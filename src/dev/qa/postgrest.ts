/**
 * DEV-ONLY. A small PostgREST emulator over PGlite so the UI can be exercised
 * locally against the REAL migrations, RLS policies and SQL functions.
 * Supports the subset of PostgREST that supabase-js uses in this app.
 * Never imported by production builds (see src/main.tsx).
 */
import type { PGlite, Transaction } from '@electric-sql/pglite'

export interface RequestAuth {
  role: 'anon' | 'authenticated' | 'service_role'
  sub: string | null
  email?: string | null
}

interface ForeignKey {
  conname: string
  table: string
  columns: string[]
  ref_table: string
  ref_columns: string[]
  one_to_one: boolean
}

interface FunctionMeta {
  name: string
  argNames: string[]
  argTypes: string[]
  returnsSet: boolean
  returnsComposite: boolean
  hasOutArgs: boolean
}

type SelectNode =
  | { kind: 'star' }
  | { kind: 'column'; name: string; alias?: string }
  | { kind: 'embed'; relation: string; alias?: string; hint?: string; inner: boolean; children: SelectNode[] }

export class HttpError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'))
    this.status = status
    this.body = body
  }
}

const IDENT = /^[a-z_][a-z0-9_]*$/

function ident(name: string) {
  if (!IDENT.test(name)) throw new HttpError(400, { code: 'PGRST100', message: `Invalid identifier: ${name}` })
  return `"${name}"`
}

function splitTopLevel(input: string, separator = ','): string[] {
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let current = ''
  for (const ch of input) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (!quoted && depth === 0 && ch === separator) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

export function parseSelect(input: string | null): SelectNode[] {
  if (!input || !input.trim()) return [{ kind: 'star' }]
  return splitTopLevel(input.replace(/\s+/g, '')).map((raw): SelectNode => {
    if (raw === '*') return { kind: 'star' }
    const open = raw.indexOf('(')
    if (open !== -1 && raw.endsWith(')')) {
      const head = raw.slice(0, open)
      const inner = raw.slice(open + 1, -1)
      let alias: string | undefined
      let rel = head
      const colon = head.indexOf(':')
      if (colon !== -1) {
        alias = head.slice(0, colon)
        rel = head.slice(colon + 1)
      }
      const [relation = '', ...mods] = rel.split('!')
      let hint: string | undefined
      let isInner = false
      for (const mod of mods) {
        if (mod === 'inner') isInner = true
        else if (mod !== 'left') hint = mod
      }
      return { kind: 'embed', relation, alias, hint, inner: isInner, children: parseSelect(inner) }
    }
    const withoutCast = raw.split('::')[0] ?? raw
    const colon = withoutCast.indexOf(':')
    if (colon !== -1) return { kind: 'column', alias: withoutCast.slice(0, colon), name: withoutCast.slice(colon + 1) }
    return { kind: 'column', name: withoutCast }
  })
}

function unquote(value: string) {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
}

function parseList(value: string): string[] {
  const inner = value.startsWith('(') && value.endsWith(')') ? value.slice(1, -1) : value
  return splitTopLevel(inner).map(unquote)
}

class WhereBuilder {
  params: unknown[] = []
  private add(value: unknown) {
    this.params.push(value)
    return `$${this.params.length}`
  }

  condition(column: string, expression: string): string {
    let expr = expression
    let negate = false
    if (expr.startsWith('not.')) {
      negate = true
      expr = expr.slice(4)
    }
    const dot = expr.indexOf('.')
    const op = dot === -1 ? expr : expr.slice(0, dot)
    const operand = dot === -1 ? '' : expr.slice(dot + 1)
    const col = ident(column)
    let sql: string
    switch (op) {
      case 'eq':
        sql = `${col} = ${this.add(unquote(operand))}`
        break
      case 'neq':
        sql = `${col} <> ${this.add(unquote(operand))}`
        break
      case 'gt':
        sql = `${col} > ${this.add(unquote(operand))}`
        break
      case 'gte':
        sql = `${col} >= ${this.add(unquote(operand))}`
        break
      case 'lt':
        sql = `${col} < ${this.add(unquote(operand))}`
        break
      case 'lte':
        sql = `${col} <= ${this.add(unquote(operand))}`
        break
      case 'like':
        sql = `${col}::text like ${this.add(unquote(operand).replace(/\*/g, '%'))}`
        break
      case 'ilike':
        sql = `${col}::text ilike ${this.add(unquote(operand).replace(/\*/g, '%'))}`
        break
      case 'is': {
        const v = operand.toLowerCase()
        if (!['null', 'true', 'false', 'unknown'].includes(v)) throw new HttpError(400, { code: 'PGRST100', message: 'bad is operand' })
        sql = `${col} is ${v}`
        break
      }
      case 'in':
        sql = `${col}::text = any(${this.add(parseList(operand))}::text[])`
        break
      case 'cs':
        sql = `${col} @> ${this.add(operand)}`
        break
      case 'cd':
        sql = `${col} <@ ${this.add(operand)}`
        break
      case 'ov':
        sql = `${col} && ${this.add(operand)}`
        break
      default:
        throw new HttpError(400, { code: 'PGRST100', message: `Unsupported operator ${op}` })
    }
    return negate ? `not (${sql})` : sql
  }

  logic(kind: 'or' | 'and', body: string): string {
    const inner = body.startsWith('(') && body.endsWith(')') ? body.slice(1, -1) : body
    const parts = splitTopLevel(inner).map((part) => {
      for (const nested of ['and', 'or', 'not.and', 'not.or'] as const) {
        if (part.startsWith(`${nested}(`)) {
          const clause = this.logic(nested.endsWith('or') ? 'or' : 'and', part.slice(nested.length))
          return nested.startsWith('not.') ? `not ${clause}` : clause
        }
      }
      const dot = part.indexOf('.')
      return this.condition(part.slice(0, dot), part.slice(dot + 1))
    })
    return `(${parts.join(kind === 'or' ? ' or ' : ' and ')})`
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function buildWhere(params: URLSearchParams, where: WhereBuilder): string {
  const clauses: string[] = []
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue
    if (key === 'or' || key === 'and') clauses.push(where.logic(key, value))
    else if (key.includes('.')) continue // embedded-resource filters are not needed by this app
    else clauses.push(where.condition(key, value))
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : ''
}

function buildOrder(order: string | null) {
  if (!order) return ''
  const terms = splitTopLevel(order).map((term) => {
    const [column = '', ...mods] = term.split('.')
    const dir = mods.includes('desc') ? 'desc' : 'asc'
    const nulls = mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''
    return `${ident(column)} ${dir}${nulls}`
  })
  return `order by ${terms.join(', ')}`
}

function pgErrorToHttp(error: unknown, auth: RequestAuth): HttpError {
  if (error instanceof HttpError) return error
  const e = error as { code?: string; message?: string; detail?: string; hint?: string }
  const code = e.code ?? 'XX000'
  const status =
    code === '42501' ? (auth.role === 'anon' ? 401 : 403) : code === 'P0002' ? 404 : code === '23505' || code === '23503' ? 409 : code === '42883' ? 404 : code.startsWith('22') || code === 'P0001' || code.startsWith('23') ? 400 : 500
  return new HttpError(status, { code, message: e.message ?? 'Database error', details: e.detail ?? null, hint: e.hint ?? null })
}

export class PostgrestEmulator {
  private foreignKeys: ForeignKey[] = []
  private functions = new Map<string, FunctionMeta>()
  private tables = new Set<string>()
  private db: PGlite

  constructor(db: PGlite) {
    this.db = db
  }

  async init() {
    const fks = await this.db.query<ForeignKey>(`
      select con.conname, cl.relname as table,
             array_agg(att.attname::text order by k.ord) as columns,
             fcl.relname as ref_table,
             array_agg(fatt.attname::text order by k.ord) as ref_columns,
             exists (
               select 1 from pg_constraint u
               where u.conrelid = con.conrelid and u.contype in ('p','u')
                 and (select array_agg(x order by x) from unnest(u.conkey) x) = (select array_agg(x order by x) from unnest(con.conkey) x)
             ) as one_to_one
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class fcl on fcl.oid = con.confrelid
      join pg_namespace fn on fn.oid = fcl.relnamespace
      cross join lateral unnest(con.conkey, con.confkey) with ordinality as k(attnum, fattnum, ord)
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.attnum
      join pg_attribute fatt on fatt.attrelid = con.confrelid and fatt.attnum = k.fattnum
      where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
      group by con.oid, con.conname, con.conrelid, con.conkey, cl.relname, fcl.relname`)
    this.foreignKeys = fks.rows

    const rels = await this.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v')`,
    )
    this.tables = new Set(rels.rows.map((r) => r.relname))

    const fns = await this.db.query<{
      proname: string
      arg_names: string[] | null
      arg_modes: string[] | null
      all_types: string[] | null
      in_types: string[]
      proretset: boolean
      typtype: string
    }>(`
      select p.proname, p.proargnames as arg_names, p.proargmodes::text[] as arg_modes,
             case when p.proallargtypes is null then null else array(select format_type(x, null) from unnest(p.proallargtypes) x) end as all_types,
             array(select format_type(x, null) from unnest(p.proargtypes::oid[]) x) as in_types,
             p.proretset, t.typtype
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
      where n.nspname = 'public' and p.prokind = 'f'`)
    for (const f of fns.rows) {
      const names = f.arg_names ?? []
      const modes = f.arg_modes ?? names.map(() => 'i')
      const allTypes = f.all_types ?? f.in_types
      const argNames: string[] = []
      const argTypes: string[] = []
      names.forEach((name, i) => {
        if (modes[i] === 'i' || modes[i] === 'b') {
          argNames.push(name)
          argTypes.push(allTypes[i] ?? 'text')
        }
      })
      this.functions.set(f.proname, {
        name: f.proname,
        argNames,
        argTypes,
        returnsSet: f.proretset,
        returnsComposite: f.typtype === 'c',
        hasOutArgs: modes.some((m) => m === 't' || m === 'o'),
      })
    }
  }

  private async withAuth<T>(auth: RequestAuth, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const claims = JSON.stringify({ sub: auth.sub ?? undefined, role: auth.role, email: auth.email ?? undefined })
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
      await tx.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': '127.0.0.1' })])
      await tx.exec(`set local role ${auth.role}`)
      return fn(tx)
    })
  }

  private relationFor(parent: string, relation: string, hint?: string) {
    const candidates = this.foreignKeys.filter(
      (fk) =>
        (fk.table === relation && fk.ref_table === parent) || // one-to-many (child references parent)
        (fk.table === parent && fk.ref_table === relation), // many-to-one (parent references child)
    )
    const matched = hint ? candidates.filter((c) => c.conname === hint || c.columns.includes(hint)) : candidates
    const fk = matched[0]
    if (!fk) throw new HttpError(400, { code: 'PGRST200', message: `No relationship between ${parent} and ${relation}` })
    return fk
  }

  private async embed(tx: Transaction, table: string, rows: Record<string, unknown>[], nodes: SelectNode[]) {
    for (const node of nodes) {
      if (node.kind !== 'embed' || rows.length === 0) continue
      const fk = this.relationFor(table, node.relation, node.hint)
      const key = node.alias ?? node.relation
      if (fk.table === node.relation && fk.ref_table === table) {
        // children reference the parent → array (or object when one-to-one)
        const childCol = fk.columns[0] as string
        const parentCol = fk.ref_columns[0] as string
        const ids = [...new Set(rows.map((r) => r[parentCol]).filter((v) => v !== null && v !== undefined))].map(String)
        const res = await tx.query<{ rows: Record<string, unknown>[] }>(
          `select coalesce(json_agg(t), '[]'::json) as rows from (select * from ${ident(node.relation)} where ${ident(childCol)}::text = any($1::text[])) t`,
          [ids],
        )
        const children = res.rows[0]?.rows ?? []
        await this.embed(tx, node.relation, children, node.children)
        for (const row of rows) {
          const mine = children.filter((c) => String(c[childCol]) === String(row[parentCol])).map((c) => project(c, node.children))
          row[key] = fk.one_to_one ? (mine[0] ?? null) : mine
        }
      } else {
        // the parent references the child → single object
        const parentCol = fk.columns[0] as string
        const childCol = fk.ref_columns[0] as string
        const ids = [...new Set(rows.map((r) => r[parentCol]).filter((v) => v !== null && v !== undefined))].map(String)
        const res = await tx.query<{ rows: Record<string, unknown>[] }>(
          `select coalesce(json_agg(t), '[]'::json) as rows from (select * from ${ident(node.relation)} where ${ident(childCol)}::text = any($1::text[])) t`,
          [ids],
        )
        const children = res.rows[0]?.rows ?? []
        await this.embed(tx, node.relation, children, node.children)
        for (const row of rows) {
          const match = children.find((c) => String(c[childCol]) === String(row[parentCol]))
          row[key] = match ? project(match, node.children) : null
        }
      }
    }
  }

  async handle(request: Request, auth: RequestAuth): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/rest\/v1\//, '')
    const accept = request.headers.get('accept') ?? ''
    const prefer = request.headers.get('prefer') ?? ''
    const wantsObject = accept.includes('application/vnd.pgrst.object+json')
    try {
      if (path.startsWith('rpc/')) return await this.rpc(path.slice(4), request, auth, wantsObject)
      const table = path
      if (!this.tables.has(table)) throw new HttpError(404, { code: '42P01', message: `relation "public.${table}" does not exist` })
      const params = url.searchParams
      switch (request.method) {
        case 'GET':
        case 'HEAD':
          return await this.select(table, params, request, auth, wantsObject, prefer)
        case 'POST':
          return await this.insert(table, params, request, auth, wantsObject, prefer)
        case 'PATCH':
          return await this.update(table, params, request, auth, wantsObject, prefer)
        case 'DELETE':
          return await this.remove(table, params, auth, wantsObject, prefer)
        default:
          throw new HttpError(405, { message: 'Method not allowed' })
      }
    } catch (error) {
      const http = pgErrorToHttp(error, auth)
      return json(http.body, http.status)
    }
  }

  private async select(table: string, params: URLSearchParams, request: Request, auth: RequestAuth, wantsObject: boolean, prefer: string) {
    const nodes = parseSelect(params.get('select'))
    const where = new WhereBuilder()
    const whereSql = buildWhere(params, where)
    const orderSql = buildOrder(params.get('order'))
    let limit = params.get('limit') ? Number(params.get('limit')) : null
    let offset = params.get('offset') ? Number(params.get('offset')) : 0
    const range = request.headers.get('range')
    if (range) {
      const m = /^(\d+)-(\d+)$/.exec(range)
      if (m) {
        offset = Number(m[1])
        limit = Number(m[2]) - offset + 1
      }
    }
    const limitSql = `${limit !== null ? `limit ${Math.max(0, limit)}` : ''} offset ${Math.max(0, offset)}`

    return this.withAuth(auth, async (tx) => {
      const result = await tx.query<{ rows: Record<string, unknown>[] }>(
        `select coalesce(json_agg(t), '[]'::json) as rows from (select * from ${ident(table)} ${whereSql} ${orderSql} ${limitSql}) t`,
        where.params,
      )
      const rows = result.rows[0]?.rows ?? []
      await this.embed(tx, table, rows, nodes)
      const projected = rows.map((row) => project(row, nodes))
      const headers: Record<string, string> = {}
      if (prefer.includes('count=')) {
        const count = await tx.query<{ n: number }>(`select count(*)::int as n from ${ident(table)} ${whereSql}`, where.params)
        const total = count.rows[0]?.n ?? 0
        headers['content-range'] = projected.length ? `${offset}-${offset + projected.length - 1}/${total}` : `*/${total}`
      }
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
      if (wantsObject) {
        if (projected.length !== 1) {
          return json({ code: 'PGRST116', details: `The result contains ${projected.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406)
        }
        return json(projected[0], 200, headers)
      }
      return json(projected, 200, headers)
    })
  }

  private async insert(table: string, params: URLSearchParams, request: Request, auth: RequestAuth, wantsObject: boolean, prefer: string) {
    const body = (await request.json()) as Record<string, unknown> | Record<string, unknown>[]
    const rows = Array.isArray(body) ? body : [body]
    if (rows.length === 0) return json([], 201)
    const columns = Object.keys(rows[0] as object)
    columns.forEach(ident)
    const colSql = columns.map(ident).join(', ')
    const conflict = params.get('on_conflict')
    let conflictSql = ''
    if (prefer.includes('resolution=merge-duplicates') && conflict) {
      const target = conflict.split(',').map(ident).join(', ')
      const updates = columns.filter((c) => !conflict.split(',').includes(c)).map((c) => `${ident(c)} = excluded.${ident(c)}`)
      conflictSql = updates.length ? `on conflict (${target}) do update set ${updates.join(', ')}` : `on conflict (${target}) do nothing`
    } else if (prefer.includes('resolution=ignore-duplicates')) {
      conflictSql = conflict ? `on conflict (${conflict.split(',').map(ident).join(', ')}) do nothing` : 'on conflict do nothing'
    }
    return this.withAuth(auth, async (tx) => {
      const result = await tx.query<{ rows: Record<string, unknown>[] }>(
        `with ins as (insert into ${ident(table)} (${colSql}) select ${colSql} from json_populate_recordset(null::${ident(table)}, $1::json) ${conflictSql} returning *)
         select coalesce(json_agg(ins), '[]'::json) as rows from ins`,
        [JSON.stringify(rows)],
      )
      const inserted = result.rows[0]?.rows ?? []
      if (!prefer.includes('return=representation')) return new Response(null, { status: 201 })
      const nodes = parseSelect(params.get('select'))
      await this.embed(tx, table, inserted, nodes)
      const projected = inserted.map((r) => project(r, nodes))
      return json(wantsObject ? projected[0] : projected, 201)
    })
  }

  private async update(table: string, params: URLSearchParams, request: Request, auth: RequestAuth, wantsObject: boolean, prefer: string) {
    const body = (await request.json()) as Record<string, unknown>
    const columns = Object.keys(body)
    const where = new WhereBuilder()
    where.params.push(JSON.stringify(body))
    const whereSql = buildWhere(params, where)
    const setSql = columns
      .map((c) => `${ident(c)} = (select r.${ident(c)} from json_populate_record(null::${ident(table)}, $1::json) r)`)
      .join(', ')
    return this.withAuth(auth, async (tx) => {
      const result = await tx.query<{ rows: Record<string, unknown>[] }>(
        `with upd as (update ${ident(table)} set ${setSql} ${whereSql} returning *)
         select coalesce(json_agg(upd), '[]'::json) as rows from upd`,
        where.params,
      )
      const updated = result.rows[0]?.rows ?? []
      if (!prefer.includes('return=representation')) return new Response(null, { status: 204 })
      const nodes = parseSelect(params.get('select'))
      await this.embed(tx, table, updated, nodes)
      const projected = updated.map((r) => project(r, nodes))
      return json(wantsObject ? projected[0] : projected, 200)
    })
  }

  private async remove(table: string, params: URLSearchParams, auth: RequestAuth, wantsObject: boolean, prefer: string) {
    const where = new WhereBuilder()
    const whereSql = buildWhere(params, where)
    return this.withAuth(auth, async (tx) => {
      const result = await tx.query<{ rows: Record<string, unknown>[] }>(
        `with del as (delete from ${ident(table)} ${whereSql} returning *) select coalesce(json_agg(del), '[]'::json) as rows from del`,
        where.params,
      )
      if (!prefer.includes('return=representation')) return new Response(null, { status: 204 })
      const rows = result.rows[0]?.rows ?? []
      return json(wantsObject ? rows[0] : rows, 200)
    })
  }

  private async rpc(name: string, request: Request, auth: RequestAuth, wantsObject: boolean) {
    const meta = this.functions.get(name)
    if (!meta) throw new HttpError(404, { code: 'PGRST202', message: `Could not find the function public.${name}` })
    const body = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {}
    const args: string[] = []
    const values: unknown[] = []
    meta.argNames.forEach((arg, i) => {
      if (!(arg in body)) return
      const value = body[arg]
      const type = meta.argTypes[i] ?? 'text'
      values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value)
      args.push(`${ident(arg)} => $${values.length}::${type}`)
    })
    return this.withAuth(auth, async (tx) => {
      const call = `public.${ident(name)}(${args.join(', ')})`
      const result = await tx.query<{ rows: Record<string, unknown>[] }>(
        `select coalesce(json_agg(t), '[]'::json) as rows from (select * from ${call}) t`,
        values,
      )
      const rows = result.rows[0]?.rows ?? []
      if (meta.returnsSet || meta.hasOutArgs) return json(wantsObject ? (rows[0] ?? null) : rows, 200)
      const first = rows[0] ?? null
      if (meta.returnsComposite) {
        const isNullRow = first && Object.values(first).every((v) => v === null)
        return json(isNullRow ? null : first, 200)
      }
      return json(first ? Object.values(first)[0] : null, 200)
    })
  }
}

function project(row: Record<string, unknown>, nodes: SelectNode[]): Record<string, unknown> {
  if (nodes.some((n) => n.kind === 'star') && !nodes.some((n) => n.kind === 'column' && n.alias)) {
    const out: Record<string, unknown> = { ...row }
    // Remove embed keys that weren't requested (none expected) — keep row as is.
    return out
  }
  const out: Record<string, unknown> = {}
  for (const node of nodes) {
    if (node.kind === 'star') Object.assign(out, row)
    else if (node.kind === 'column') out[node.alias ?? node.name] = row[node.name]
    else out[node.alias ?? node.relation] = row[node.alias ?? node.relation]
  }
  return out
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}
