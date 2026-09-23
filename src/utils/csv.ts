/**
 * RFC 4180 CSV with protection against spreadsheet formula injection: cells that
 * start with = + - @ (or tab / carriage return) are prefixed with an apostrophe.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns?: Array<keyof T & string>): string {
  const cols = columns ?? (rows[0] ? (Object.keys(rows[0]) as Array<keyof T & string>) : [])
  const header = cols.map(csvCell).join(',')
  const body = rows.map((row) => cols.map((c) => csvCell(row[c])).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
