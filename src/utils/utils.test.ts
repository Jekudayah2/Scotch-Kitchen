import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/features/auth/api'
import { isValidPhone, signUpSchema } from '@/features/auth/schemas'
import { csvCell, toCsv } from './csv'
import { resolveRange, toDateInputValue } from './dates'
import { errorCode, friendlyError } from './errors'
import { formatCedis, parseCedisInput, pesewasToInput } from './money'

describe('money', () => {
  it('formats pesewas as cedis', () => {
    expect(formatCedis(1000)).toBe('GH₵10')
    expect(formatCedis(1550)).toBe('GH₵15.50')
    expect(formatCedis(805)).toBe('GH₵8.05')
    expect(formatCedis(125000)).toBe('GH₵1,250')
    expect(formatCedis(800, { alwaysShowPesewas: true })).toBe('GH₵8.00')
    expect(formatCedis(null)).toBe('—')
  })

  it('parses typed cedi amounts without floating-point error', () => {
    expect(parseCedisInput('12')).toBe(1200)
    expect(parseCedisInput('12.5')).toBe(1250)
    expect(parseCedisInput('0.1')).toBe(10)
    expect(parseCedisInput('19.99')).toBe(1999)
    expect(parseCedisInput('GH₵ 1,000.00')).toBe(100000)
    expect(parseCedisInput('12.345')).toBeNull()
    expect(parseCedisInput('-5')).toBeNull()
    expect(parseCedisInput('abc')).toBeNull()
    expect(pesewasToInput(1250)).toBe('12.50')
    expect(pesewasToInput(1500)).toBe('15')
  })
})

describe('business date ranges (Africa/Accra)', () => {
  const now = new Date('2026-09-23T14:30:00Z') // a Wednesday

  it('resolves presets to [from, to)', () => {
    expect(resolveRange('today', now)).toEqual({ from: new Date('2026-09-23T00:00:00Z'), to: new Date('2026-09-24T00:00:00Z') })
    expect(resolveRange('yesterday', now)).toEqual({ from: new Date('2026-09-22T00:00:00Z'), to: new Date('2026-09-23T00:00:00Z') })
    expect(resolveRange('this_week', now)?.from).toEqual(new Date('2026-09-21T00:00:00Z'))
    expect(resolveRange('this_month', now)?.from).toEqual(new Date('2026-09-01T00:00:00Z'))
    expect(resolveRange('all', now)).toBeNull()
  })

  it('includes the whole end day for custom ranges and rejects reversed ones', () => {
    expect(resolveRange('custom', now, { from: '2026-09-01', to: '2026-09-10' })).toEqual({
      from: new Date('2026-09-01T00:00:00Z'),
      to: new Date('2026-09-11T00:00:00Z'),
    })
    expect(resolveRange('custom', now, { from: '2026-09-10', to: '2026-09-01' })).toBeNull()
    expect(toDateInputValue(now)).toBe('2026-09-23')
  })
})

describe('errors', () => {
  it('maps database error codes to friendly copy', () => {
    expect(errorCode({ message: 'INVALID_TRANSITION', code: 'P0001' })).toBe('INVALID_TRANSITION')
    expect(friendlyError({ message: 'OUTSIDE_SERVICE_AREA' })).toMatch(/outside the area/)
    expect(friendlyError(new Error('Invalid login credentials'))).toMatch(/don’t match/)
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/couldn’t reach/)
    expect(friendlyError(new Error('relation "x" does not exist'))).toBe('Something went wrong. Please try again.')
  })
})

describe('csv export', () => {
  it('escapes and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-10')).toBe("'-10")
    expect(csvCell(null)).toBe('')
    expect(toCsv([{ a: 1, b: 'x' }])).toBe('a,b\r\n1,x')
  })
})

describe('auth helpers', () => {
  it('only allows same-origin post-login redirects', () => {
    expect(safeNextPath('/checkout')).toBe('/checkout')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath('/sign-in?next=/x')).toBe('/')
    expect(safeNextPath(null)).toBe('/')
  })

  it('validates Ghanaian phone numbers like the database does', () => {
    expect(isValidPhone('024 387 0366')).toBe(true)
    expect(isValidPhone('+233 24 387 0366')).toBe(true)
    expect(isValidPhone('call me')).toBe(false)
    expect(isValidPhone('12')).toBe(false)
  })

  it('requires matching, reasonably strong passwords at sign-up', () => {
    const base = { fullName: 'Ama Mensah', email: 'ama@example.com', phone: '', password: 'kitchen2026', confirmPassword: 'kitchen2026' }
    expect(signUpSchema.safeParse(base).success).toBe(true)
    expect(signUpSchema.safeParse({ ...base, confirmPassword: 'other' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, password: 'short1', confirmPassword: 'short1' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, password: 'nodigitshere', confirmPassword: 'nodigitshere' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
  })
})
