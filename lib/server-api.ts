import { NextResponse } from "next/server"

/**
 * Rate limiting is per instance and in memory.
 *
 * On serverless this is a speed bump, not a quota: each instance keeps its own
 * counters and a cold start resets them. It is enough to stop a single runaway
 * client (a loop in the UI, a stuck retry) from burning the Finnhub / OpenRouter
 * quota. Enforcing a real limit needs shared storage (Upstash, Vercel KV, Redis).
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

/** Bounds memory if someone floods us with spoofed forwarding headers. */
const MAX_BUCKETS = 10_000

let lastSweepAt = 0

function sweepExpired(now: number, windowMs: number) {
  if (now - lastSweepAt < windowMs && rateLimitBuckets.size < MAX_BUCKETS) return
  lastSweepAt = now
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key)
  }
  // Still over the cap: drop everything rather than grow without bound
  if (rateLimitBuckets.size >= MAX_BUCKETS) rateLimitBuckets.clear()
}

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

function consume(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  sweepExpired(now, windowMs)

  const current = rateLimitBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (current.count >= limit) {
    return tooManyRequests(current.resetAt - now)
  }
  current.count += 1
  return null
}

/** Advisory only: a caller controls its own forwarding headers. */
function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
}

export async function requireSupabaseUser(request: Request) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!token || !url || !key) return null

  try {
    // Le preguntamos a GoTrue en vez de verificar la firma acá: no hay que
    // manejar el secreto del JWT ni rotar claves a mano, y además detecta las
    // sesiones revocadas, que una verificación local por firma no ve.
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!response.ok) return null
    const user = (await response.json()) as { id?: string }
    return user.id || null
  } catch {
    return null
  }
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000
) {
  return consume(`${scope}:ip:${clientAddress(request)}`, limit, windowMs)
}

export async function authorizeApiRequest(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000
) {
  // 1. Coarse guard on the caller address. Its only job is to keep an unauthenticated
  //    flood from turning into one token lookup per request; it is deliberately loose
  //    because the header can be forged and several users can share an address.
  const addressLimited = consume(`${scope}:ip:${clientAddress(request)}`, limit * 5, windowMs)
  if (addressLimited) return { userId: null, error: addressLimited }

  const userId = await requireSupabaseUser(request)
  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  // 2. The limit that actually matters, keyed by a uid the caller cannot forge.
  const userLimited = consume(`${scope}:user:${userId}`, limit, windowMs)
  if (userLimited) return { userId: null, error: userLimited }

  return { userId, error: null }
}
