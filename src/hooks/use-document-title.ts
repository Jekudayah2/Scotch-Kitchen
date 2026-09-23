import { useEffect } from 'react'

const SITE = 'SCOTCH’s Kitchen'

export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · ZOBOPOP & Creamypop`
  }, [title])
}
