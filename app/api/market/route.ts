import { getCloudflareContext } from '@opennextjs/cloudflare'
import { authorizeApiRequest } from '@/lib/server-api'
import { validateMarketSettings, type MarketSettings, type MarketReport } from '@/lib/market-monitor'
import { buildMarketReport, deliverMarketAlert, settingsKey, validateSubscription, type MarketEnv, type MarketDelivery } from '@/lib/market-service'
import type { PushSubscription } from '@block65/webcrypto-web-push'

function environment(): MarketEnv {
  let bindings: MarketEnv = {}
  try { bindings = getCloudflareContext().env as MarketEnv } catch { /* local without bindings */ }
  return { ...process.env, ...bindings }
}
const empty: MarketSettings = { enabled: false, telegram: false, rules: [], updatedAt: '' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(request: Request) {
  const auth = await authorizeApiRequest(request, 'market-read', 20)
  if (auth.error) return auth.error
  const env = environment(), kv = env.MARKET_MONITOR
  const userId = auth.userId!
  const subscriptions = await kv?.get<PushSubscription[]>(`push:${userId}`, 'json') ?? []
  return json({
    configured: Boolean(kv && env.FINNHUB_API_KEY), storage: Boolean(kv),
    publicKey: env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT ? env.VAPID_PUBLIC_KEY ?? null : null,
    telegramAvailable: Boolean(env.MARKET_TELEGRAM_USER_ID === userId && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALLOWED_CHAT_ID),
    pushDevices: subscriptions.length,
    settings: await kv?.get<MarketSettings>(settingsKey(userId), 'json') ?? empty,
    report: await kv?.get<MarketReport>(`report:${userId}`, 'json') ?? null,
    delivery: await kv?.get<MarketDelivery>(`delivery:${userId}`, 'json') ?? null,
    checkedAt: await kv?.get<string>(`checked:${userId}`, 'json') ?? null,
  })
}

export async function POST(request: Request) {
  const auth = await authorizeApiRequest(request, 'market-write', 4)
  if (auth.error) return auth.error
  const env = environment(), kv = env.MARKET_MONITOR, userId = auth.userId!
  if (!kv) return json({ error: 'Falta configurar MARKET_MONITOR en Cloudflare. Ver README.' }, 503)
  if (Number(request.headers.get('content-length')) > 16000) return json({ error: 'Solicitud demasiado grande.' }, 413)
  const raw = await request.text()
  if (raw.length > 16000) return json({ error: 'Solicitud demasiado grande.' }, 413)
  let body
  try { body = JSON.parse(raw) } catch { return json({ error: 'JSON inválido.' }, 400) }
  try {
    const settings = await kv.get<MarketSettings>(settingsKey(userId), 'json') ?? empty
    switch (body?.action) {
      case 'save': {
        const next = validateMarketSettings(body.settings)
        if (next.enabled && !env.FINNHUB_API_KEY) return json({ error: 'Falta configurar Finnhub.' }, 503)
        if (next.telegram && !(env.MARKET_TELEGRAM_USER_ID === userId && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALLOWED_CHAT_ID))
          return json({ error: 'Telegram no está vinculado a este usuario.' }, 400)
        if (next.enabled && !next.telegram && !(await kv.get<PushSubscription[]>(`push:${userId}`, 'json'))?.length)
          return json({ error: 'Activá las notificaciones o el respaldo por Telegram antes de encender la vigilancia.' }, 400)
        await kv.put(settingsKey(userId), JSON.stringify(next))
        await kv.delete(`report:${userId}`)
        return json({ settings: next, report: null })
      }
      case 'subscribe': {
        if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return json({ error: 'Faltan claves VAPID en el servidor.' }, 503)
        const subscription = validateSubscription(body.subscription)
        const previous = await kv.get<PushSubscription[]>(`push:${userId}`, 'json') ?? []
        const next = previous.filter(s => s.endpoint !== subscription.endpoint)
        if (next.length >= 5) return json({ error: 'Límite de 5 dispositivos alcanzado.' }, 400)
        await kv.put(`push:${userId}`, JSON.stringify([...next, subscription]))
        return json({ ok: true })
      }
      case 'unsubscribe': {
        const previous = await kv.get<PushSubscription[]>(`push:${userId}`, 'json') ?? []
        await kv.put(`push:${userId}`, JSON.stringify(previous.filter(s => s.endpoint !== body.endpoint)))
        return json({ ok: true })
      }
      case 'refresh': {
        if (!env.FINNHUB_API_KEY) return json({ error: 'Falta configurar Finnhub.' }, 503)
        if (!settings.rules.length) return json({ error: 'Guardá primero los símbolos a analizar.' }, 400)
        const report = await buildMarketReport(env, settings.rules.map(r => r.symbol))
        await kv.put(`report:${userId}`, JSON.stringify(report))
        return json({ report })
      }
      case 'test': {
        const result = await deliverMarketAlert(env, userId, settings, 'EN MANO · prueba de alertas', 'Las alertas de mercado abrirán tu seguimiento de acciones. Esta es una prueba, no una señal de mercado.')
        return json({ delivery: result }, result.ok ? 200 : 502)
      }
      default: return json({ error: 'Acción inválida.' }, 400)
    }
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'No se pudo completar la solicitud.' }, 400) }
}
