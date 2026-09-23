import { useEffect, useState, useSyncExternalStore } from 'react'

function subscribe(query: string) {
  return (callback: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const media = window.matchMedia(query)
    media.addEventListener('change', callback)
    return () => media.removeEventListener('change', callback)
  }
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    subscribe(query),
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}

/** Scroll-linked (cinematic) motion is reserved for large screens without reduced-motion. */
export function useRichMotion() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  return desktop && !reduced
}

/** True once the page has scrolled past `threshold` pixels (passive listener). */
export function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])
  return scrolled
}

/** Detects an open on-screen keyboard (visual viewport shrinks) so sticky bars can step aside. */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setOpen(window.innerHeight - viewport.height > 160)
    viewport.addEventListener('resize', update)
    return () => viewport.removeEventListener('resize', update)
  }, [])
  return open
}
