/**
 * Money is always handled as integer pesewas (GH₵1 = 100 pesewas), matching the
 * database and Paystack's GHS subunit. Never do arithmetic on floating cedis.
 */
export type Pesewas = number

function group(whole: number) {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** GH₵15, GH₵15.50, GH₵1,250. Returns an em dash for missing values. */
export function formatCedis(pesewas: Pesewas | null | undefined, options: { alwaysShowPesewas?: boolean } = {}) {
  if (pesewas === null || pesewas === undefined || !Number.isFinite(pesewas)) return '—'
  const rounded = Math.round(pesewas)
  const negative = rounded < 0
  const abs = Math.abs(rounded)
  const cedis = Math.floor(abs / 100)
  const rest = abs % 100
  const fraction = rest === 0 && !options.alwaysShowPesewas ? '' : `.${String(rest).padStart(2, '0')}`
  return `${negative ? '−' : ''}GH₵${group(cedis)}${fraction}`
}

/**
 * Parses a cedi amount typed by a person ("12", "12.5", "12.50") into pesewas
 * without floating-point error. Returns null for anything else.
 */
export function parseCedisInput(input: string): Pesewas | null {
  const value = input.trim().replace(/^GH₵\s*/i, '').replace(/,/g, '')
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  return whole * 100 + fraction
}

/** Inverse of parseCedisInput, for pre-filling inputs ("12" or "12.50"). */
export function pesewasToInput(pesewas: Pesewas) {
  const whole = Math.floor(pesewas / 100)
  const rest = pesewas % 100
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`
}

export function sumPesewas(values: Array<Pesewas | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}
