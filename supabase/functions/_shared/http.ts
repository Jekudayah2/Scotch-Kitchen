/** CORS + JSON helpers for browser-facing functions. */

function allowedOrigins(): string[] {
  const list = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const site = Deno.env.get('SITE_URL')
  if (site) {
    try {
      list.push(new URL(site).origin)
    } catch {
      /* ignore malformed SITE_URL */
    }
  }
  return list
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = allowedOrigins()
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const allow = allowed.includes(origin) || (allowed.length === 0 && isLocal) ? origin : (allowed[0] ?? 'null')
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
