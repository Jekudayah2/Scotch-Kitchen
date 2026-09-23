import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function start() {
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
