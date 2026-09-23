/**
 * Browser storage can throw (private mode, blocked site data, quota). These
 * helpers never throw, so storage is only ever a convenience.
 */
type StorageKind = 'local' | 'session'

function store(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readStorage(key: string, kind: StorageKind = 'local'): string | null {
  try {
    return store(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string, kind: StorageKind = 'local') {
  try {
    store(kind)?.setItem(key, value)
  } catch {
    /* storage unavailable — ignore */
  }
}

export function removeStorage(key: string, kind: StorageKind = 'local') {
  try {
    store(kind)?.removeItem(key)
  } catch {
    /* storage unavailable — ignore */
  }
}

export function readJson<T>(key: string, validate: (value: unknown) => value is T, kind: StorageKind = 'local'): T | null {
  const raw = readStorage(key, kind)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return validate(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: StorageKind = 'local') {
  try {
    writeStorage(key, JSON.stringify(value), kind)
  } catch {
    /* unserialisable — ignore */
  }
}
