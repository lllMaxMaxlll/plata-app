import { NextResponse } from "next/server"

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  if (!token || !apiKey) return null

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        cache: "no-store",
      }
    )
    if (!response.ok) return null
    const data = (await response.json()) as { users?: Array<{ localId?: string }> }
    return data.users?.[0]?.localId || null
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
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const key = `${scope}:${forwarded || "unknown"}`
  const now = Date.now()
  const current = rateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (current.count >= limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((current.resetAt - now) / 1000)) } }
    )
  }
  current.count += 1
  return null
}

export async function authorizeApiRequest(request: Request, scope: string, limit: number) {
  const limited = enforceRateLimit(request, scope, limit)
  if (limited) return { userId: null, error: limited }
  const userId = await requireFirebaseUser(request)
  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { userId, error: null }
}
