/**
 * Generates src/types/database.ts from the SQL migrations.
 *
 * It applies every migration to an in-memory Postgres (PGlite), introspects
 * the `public` schema, and writes types in the same shape as
 * `supabase gen types typescript`, so the file can later be regenerated with
 * the official CLI against the live project without touching app code:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
 *
 * Usage: npm run db:types
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTestDb } from '../tests/db/harness.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const outFile = join(root, 'src', 'types', 'database.ts')

interface ColumnInfo {
  table_name: string
  column_name: string
  data_type: string
  udt_name: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
  is_generated: 'ALWAYS' | 'NEVER'
  is_identity: 'YES' | 'NO'
  identity_generation: 'ALWAYS' | 'BY DEFAULT' | null
}

interface Relationship {
  conname: string
  table: string
  columns: string[]
  ref_table: string
  ref_columns: string[]
  one_to_one: boolean
}

interface FunctionInfo {
  proname: string
  proretset: boolean
  return_type: string
  return_type_oid: number
  return_typtype: string
  return_relname: string | null
  arg_names: string[] | null
  arg_modes: string[] | null
  arg_types: string[]
  all_arg_types: string[] | null
  nargdefaults: number
}

const db = await createTestDb()

const enums = await db.query<{ name: string; labels: string[] }>(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname`)
const enumNames = new Set(enums.map((e) => e.name))

const relations = await db.query<{ relname: string; relkind: string }>(`
  select c.relname, c.relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  order by c.relname`)

const columns = await db.query<ColumnInfo>(`
  select table_name, column_name, data_type, udt_name, is_nullable, column_default,
         is_generated, is_identity, identity_generation
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position`)

const relationships = await db.query<Relationship>(`
  select
    con.conname,
    cl.relname as table,
    array_agg(att.attname::text order by k.ord) as columns,
    fcl.relname as ref_table,
    array_agg(fatt.attname::text order by k.ord) as ref_columns,
    exists (
      select 1 from pg_constraint u
      where u.conrelid = con.conrelid and u.contype in ('p', 'u')
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
  group by con.oid, con.conname, con.conrelid, con.conkey, cl.relname, fcl.relname
  order by cl.relname, con.conname`)

const functions = await db.query<FunctionInfo>(`
  select
    p.proname,
    p.proretset,
    format_type(p.prorettype, null) as return_type,
    p.prorettype::int as return_type_oid,
    rt.typtype as return_typtype,
    rc.relname as return_relname,
    p.proargnames as arg_names,
    p.proargmodes::text[] as arg_modes,
    array(select format_type(x, null) from unnest(p.proargtypes::oid[]) x) as arg_types,
    case when p.proallargtypes is null then null
         else array(select format_type(x, null) from unnest(p.proallargtypes) x) end as all_arg_types,
    p.pronargdefaults as nargdefaults
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  left join pg_class rc on rc.oid = rt.typrelid and rt.typtype = 'c'
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname`)

await db.close()

// ---------------------------------------------------------------------------
const scalar = (pgType: string): string => {
  const t = pgType.replace(/^public\./, '').replace(/"/g, '')
  if (t.endsWith('[]')) return `${scalar(t.slice(0, -2))}[]`
  if (t.startsWith('_')) return `${scalar(t.slice(1))}[]`
  if (enumNames.has(t)) return `Database["public"]["Enums"]["${t}"]`
  switch (t) {
    case 'smallint':
    case 'integer':
    case 'bigint':
    case 'int2':
    case 'int4':
    case 'int8':
    case 'real':
    case 'double precision':
    case 'float4':
    case 'float8':
    case 'numeric':
      return 'number'
    case 'boolean':
    case 'bool':
      return 'boolean'
    case 'json':
    case 'jsonb':
      return 'Json'
    case 'void':
      return 'undefined'
    default:
      return 'string'
  }
}

const columnType = (c: ColumnInfo) => {
  if (c.data_type === 'ARRAY') return scalar(c.udt_name)
  if (c.data_type === 'USER-DEFINED') return scalar(c.udt_name)
  return scalar(c.data_type)
}

const byTable = new Map<string, ColumnInfo[]>()
for (const c of columns) {
  const list = byTable.get(c.table_name) ?? []
  list.push(c)
  byTable.set(c.table_name, list)
}

const indent = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n')

const quoteKey = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k))

const rowType = (table: string, nullableAll = false) =>
  `{\n${(byTable.get(table) ?? [])
    .map((c) => `  ${quoteKey(c.column_name)}: ${columnType(c)}${nullableAll || c.is_nullable === 'YES' ? ' | null' : ''}`)
    .join('\n')}\n}`

const insertType = (table: string) =>
  `{\n${(byTable.get(table) ?? [])
    .map((c) => {
      const generated = c.is_generated === 'ALWAYS' || c.identity_generation === 'ALWAYS'
      if (generated) return `  ${quoteKey(c.column_name)}?: never`
      const optional = c.is_nullable === 'YES' || c.column_default !== null || c.is_identity === 'YES'
      return `  ${quoteKey(c.column_name)}${optional ? '?' : ''}: ${columnType(c)}${c.is_nullable === 'YES' ? ' | null' : ''}`
    })
    .join('\n')}\n}`

const updateType = (table: string) =>
  `{\n${(byTable.get(table) ?? [])
    .map((c) => {
      const generated = c.is_generated === 'ALWAYS' || c.identity_generation === 'ALWAYS'
      if (generated) return `  ${quoteKey(c.column_name)}?: never`
      return `  ${quoteKey(c.column_name)}?: ${columnType(c)}${c.is_nullable === 'YES' ? ' | null' : ''}`
    })
    .join('\n')}\n}`

const relationshipsFor = (table: string) => {
  const rels = relationships.filter((r) => r.table === table)
  if (rels.length === 0) return '[]'
  return `[\n${rels
    .map(
      (r) => `  {
    foreignKeyName: "${r.conname}"
    columns: [${r.columns.map((c) => `"${c}"`).join(', ')}]
    isOneToOne: ${r.one_to_one}
    referencedRelation: "${r.ref_table}"
    referencedColumns: [${r.ref_columns.map((c) => `"${c}"`).join(', ')}]
  },`,
    )
    .join('\n')}\n]`
}

const tables = relations.filter((r) => r.relkind === 'r').map((r) => r.relname)
const views = relations.filter((r) => r.relkind === 'v').map((r) => r.relname)

const tablesBlock = tables
  .map(
    (t) => `${t}: {
  Row: ${indent(rowType(t), 2).trimStart()}
  Insert: ${indent(insertType(t), 2).trimStart()}
  Update: ${indent(updateType(t), 2).trimStart()}
  Relationships: ${indent(relationshipsFor(t), 2).trimStart()}
}`,
  )
  .join('\n')

const viewsBlock = views
  .map(
    (v) => `${v}: {
  Row: ${indent(rowType(v, true), 2).trimStart()}
  Relationships: []
}`,
  )
  .join('\n')

const functionArgs = (f: FunctionInfo) => {
  const names = f.arg_names ?? []
  const modes = f.arg_modes ?? names.map(() => 'i')
  const allTypes = f.all_arg_types ?? f.arg_types
  const inputs: Array<{ name: string; type: string }> = []
  names.forEach((name, i) => {
    if (modes[i] === 'i' || modes[i] === 'b') inputs.push({ name, type: allTypes[i] ?? 'text' })
  })
  if (inputs.length === 0) return 'never'
  return `{\n${inputs
    .map((a, i) => `  ${quoteKey(a.name)}${i >= inputs.length - f.nargdefaults ? '?' : ''}: ${scalar(a.type)}`)
    .join('\n')}\n}`
}

const functionReturns = (f: FunctionInfo) => {
  const names = f.arg_names ?? []
  const modes = f.arg_modes ?? []
  const allTypes = f.all_arg_types ?? []
  const outs = names
    .map((name, i) => ({ name, mode: modes[i], type: allTypes[i] ?? 'text' }))
    .filter((a) => a.mode === 't' || a.mode === 'o')
  if (outs.length > 0) {
    const shape = `{\n${outs.map((o) => `  ${quoteKey(o.name)}: ${scalar(o.type)}`).join('\n')}\n}`
    return f.proretset ? `${shape}[]` : shape
  }
  if (f.return_relname && tables.includes(f.return_relname)) {
    const ref = `Database["public"]["Tables"]["${f.return_relname}"]["Row"]`
    return f.proretset ? `${ref}[]` : ref
  }
  const base = scalar(f.return_type)
  return f.proretset ? `${base}[]` : base
}

const functionsBlock = functions
  .map(
    (f) => `${f.proname}: {
  Args: ${indent(functionArgs(f), 2).trimStart()}
  Returns: ${indent(functionReturns(f), 2).trimStart()}
}`,
  )
  .join('\n')

const enumsBlock = enums.map((e) => `${e.name}: ${e.labels.map((l) => `"${l}"`).join(' | ')}`).join('\n')
const constantsBlock = enums.map((e) => `${e.name}: [${e.labels.map((l) => `"${l}"`).join(', ')}],`).join('\n')

const output = `// AUTO-GENERATED by scripts/generate-db-types.ts from supabase/migrations.
// Do not edit by hand. Regenerate with \`npm run db:types\` (or the Supabase CLI).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
${indent(tablesBlock, 6)}
    }
    Views: {
${indent(viewsBlock, 6)}
    }
    Functions: {
${indent(functionsBlock, 6)}
    }
    Enums: {
${indent(enumsBlock, 6)}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export type FunctionArgs<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Args"]

export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"]

export const Constants = {
  public: {
    Enums: {
${indent(constantsBlock, 6)}
    },
  },
} as const
`

writeFileSync(outFile, output)
console.log(
  `Wrote ${outFile}: ${tables.length} tables, ${views.length} views, ${functions.length} functions, ${enums.length} enums`,
)
