/**
 * The business runs on Africa/Accra time, which is GMT all year (no daylight
 * saving). Date ranges are computed in that zone, matching the SQL reports.
 */
export const BUSINESS_TIME_ZONE = 'Africa/Accra'

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const shortDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  return dateTimeFormat.format(toDate(value))
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return dateFormat.format(toDate(value))
}

export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return shortDateFormat.format(toDate(value))
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return '—'
  return timeFormat.format(toDate(value))
}

export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()) {
  if (!value) return '—'
  const seconds = Math.round((now.getTime() - toDate(value).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return formatDate(value)
}

/** Calendar parts of `date` as seen in Accra. */
function accraParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekdayIndex: weekdays.indexOf(get('weekday')),
  }
}

/** Midnight in Accra (GMT) for the given calendar day, as an absolute instant. */
function accraMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

export type RangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_30_days' | 'custom' | 'all'

export interface DateRange {
  /** inclusive */
  from: Date
  /** exclusive */
  to: Date
}

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  this_month: 'This month',
  last_30_days: 'Last 30 days',
  custom: 'Custom',
  all: 'All time',
}

/**
 * Resolves a preset to [from, to) in business time. Weeks start on Monday.
 * `custom` takes ISO dates (yyyy-mm-dd) and includes the whole end day.
 */
export function resolveRange(
  preset: RangePreset,
  now: Date = new Date(),
  custom?: { from?: string; to?: string },
): DateRange | null {
  const { year, month, day, weekdayIndex } = accraParts(now)
  const startOfToday = accraMidnight(year, month, day)
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

  switch (preset) {
    case 'all':
      return null
    case 'today':
      return { from: startOfToday, to: addDays(startOfToday, 1) }
    case 'yesterday':
      return { from: addDays(startOfToday, -1), to: startOfToday }
    case 'this_week': {
      const monday = addDays(startOfToday, -weekdayIndex)
      return { from: monday, to: addDays(startOfToday, 1) }
    }
    case 'this_month':
      return { from: accraMidnight(year, month, 1), to: addDays(startOfToday, 1) }
    case 'last_30_days':
      return { from: addDays(startOfToday, -29), to: addDays(startOfToday, 1) }
    case 'custom': {
      const parse = (value?: string) => {
        const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
        return m ? accraMidnight(Number(m[1]), Number(m[2]), Number(m[3])) : null
      }
      const from = parse(custom?.from)
      const toDay = parse(custom?.to)
      if (!from || !toDay || toDay < from) return null
      return { from, to: addDays(toDay, 1) }
    }
  }
}

/** yyyy-mm-dd for <input type="date"> in business time. */
export function toDateInputValue(date: Date) {
  const { year, month, day } = accraParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
