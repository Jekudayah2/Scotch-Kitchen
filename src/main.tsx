import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function start() {
  // Development-only UI preview backed by an in-browser Postgres (see src/dev/qa).
  // The inline env check lets production builds drop this branch entirely.
  if (import.meta.env.DEV && import.meta.env.MODE === 'qa') {
    const { installQaHarness } = await import('./dev/qa/install')
    await installQaHarness()
  }

  const { App } = await import('./app')
  const container = document.getElementById('root')
  if (!container) throw new Error('Root element #root is missing from index.html')
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
