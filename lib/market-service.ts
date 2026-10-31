import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import { marketClock, priceAlerts, reportText, safeNewsUrl, type MarketReport, type MarketSettings, type MarketStock } from './market-monitor.ts'
import { readFundamentals, type MarketFundamentals } from './market-fundamentals.ts'

export interface MarketKV {
  get<T>(key: string, type: 'json'): Promise<T | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}
export interface MarketEnv {
  MARKET_MONITOR?: MarketKV
  FINNHUB_API_KEY?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_ALLOWED_CHAT_ID?: string
  /** Explicit owner binding: never deliver another user's portfolio to this chat. */
  MARKET_TELEGRAM_USER_ID?: string
  SEC_USER_AGENT?: string
}
export interface MarketDelivery { at: string; ok: boolean; detail: string }
export const settingsKey = (id: string) => `settings:${id}`

async function finnhub(env: MarketEnv, path: string, params: Record<string, string>) {
  if (!env.FINNHUB_API_KEY) throw new Error('Falta FINNHUB_API_KEY; no se generan señales con precios de ejemplo.')
  const url = new URL(`https://finnhub.io/api/v1/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, { headers: { 'X-Finnhub-Token': env.FINNHUB_API_KEY }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`Finnhub ${path}: HTTP ${response.status}. Revisá el acceso de tu plan.`)
  const body = await response.json()
  if (body?.error) throw new Error(`Finnhub ${path}: datos no disponibles para tu plan.`)
  return body
}

async function cached<T>(env: MarketEnv, key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const kv = env.MARKET_MONITOR
  const hit = await kv?.get<T>(key, 'json')
  if (hit) return hit
  const value = await fetcher()
  await kv?.put(key, JSON.stringify(value), { expirationTtl: ttl })
  return value
}

export async function buildMarketReport(env: MarketEnv, symbols: string[], now = new Date()): Promise<MarketReport> {
  const from = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10)
  const to = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const stocks: MarketStock[] = []
  // Sequential and paced: keep a personal watchlist below Finnhub's free quota.
  // Public data caches are shared across users; private reports are not.
  for (const symbol of [...new Set(symbols)].slice(0, 10)) {
    const stock: MarketStock = { symbol, quote: null, earnings: [], news: [], warnings: [] }
    try {
      const q = await cached(env, `quote:${symbol}`, 240, () => finnhub(env, 'quote', { symbol }))
      if (Number.isFinite(q.c) && q.c > 0 && Number.isFinite(q.dp) && Number.isFinite(q.t) && q.t > 0)
        stock.quote = { price: q.c, change: q.dp, timestamp: q.t }
      else stock.warnings.push('Cotización no disponible. No se evalúan alertas de precio.')
    } catch (e) { stock.warnings.push(e instanceof Error ? e.message : 'Error de cotización.') }
    await new Promise(resolve => setTimeout(resolve, 1100))
    try {
      const earnings = await cached(env, `earnings:${symbol}:${from}`, 3600, () => finnhub(env, 'calendar/earnings', { symbol, from: now.toISOString().slice(0, 10), to }))
      if (!Array.isArray(earnings.earningsCalendar)) throw new Error('Calendario sin respuesta válida.')
      stock.earnings = earnings.earningsCalendar.filter((e: { symbol?: string; date?: string }) => e.symbol === symbol && /^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')).map((e: { date: string; hour?: string; epsEstimate?: number; epsActual?: number }) => ({
        date: e.date, hour: e.hour ?? '', epsEstimate: Number.isFinite(e.epsEstimate) ? e.epsEstimate : null,
        epsActual: Number.isFinite(e.epsActual) ? e.epsActual : null,
      })).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
    } catch (e) { stock.warnings.push(e instanceof Error ? e.message : 'Calendario no disponible; no implica ausencia de resultados.') }
    await new Promise(resolve => setTimeout(resolve, 1100))
    try {
      const news = await cached(env, `news:${symbol}`, 900, () => finnhub(env, 'company-news', { symbol, from, to: now.toISOString().slice(0, 10) }))
      if (!Array.isArray(news)) throw new Error('Noticias sin respuesta válida.')
      stock.news = news.filter(n => typeof n.headline === 'string' && Number.isFinite(n.datetime) && n.datetime <= now.getTime() / 1000 && n.datetime >= now.getTime() / 1000 - 3 * 86400 && safeNewsUrl(n.url))
        .sort((a, b) => b.datetime - a.datetime).slice(0, 5)
        .map(n => ({ id: Number(n.id) || n.datetime, headline: n.headline.slice(0, 240), datetime: n.datetime, source: String(n.source ?? ''), url: safeNewsUrl(n.url)! }))
    } catch (e) { stock.warnings.push(e instanceof Error ? e.message : 'Noticias no disponibles.') }
    if (env.SEC_USER_AGENT) {
      try { stock.fundamentals = await fetchFundamentals(env, symbol) }
      catch { stock.warnings.push('No se pudo consultar SEC EDGAR. No se infieren resultados ni proyecciones a partir de titulares.') }
    } else stock.warnings.push('Análisis de estados SEC desactivado: falta SEC_USER_AGENT (nombre y correo de contacto).')
    stocks.push(stock)
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
  return { asOf: now.toISOString(), stocks }
}

async function fetchFundamentals(env: MarketEnv, symbol: string): Promise<MarketFundamentals> {
  return cached(env, `fundamentals:${symbol}`, 3600, async () => {
    const sec = async (url: string) => {
      const response = await fetch(url, { headers: { 'User-Agent': env.SEC_USER_AGENT! }, signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('SEC no disponible.')
      return response.json()
    }
    const tickers = await cached<Record<string, { cik_str: number; ticker: string }>>(env, 'sec:tickers', 86400, () => sec('https://www.sec.gov/files/company_tickers.json'))
    const entry = Object.values(tickers).find(t => t.ticker === symbol)
    if (!entry) throw new Error('Símbolo sin CIK en SEC.')
    const cik = String(entry.cik_str).padStart(10, '0')
    const facts = await sec(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`)
    const submissions = await sec(`https://data.sec.gov/submissions/CIK${cik}.json`)
    const recent = submissions?.filings?.recent
    const index = Array.isArray(recent?.form) ? recent.form.findIndex((f: string) => ['10-Q','10-K','10-Q/A','10-K/A'].includes(f)) : -1
    return readFundamentals(facts, cik, index >= 0 ? recent.filingDate[index] : null)
  })
}

/** Allow only known push services, never arbitrary user-controlled fetch URLs. */
export function validateSubscription(value: unknown): PushSubscription {
  const s = value as PushSubscription | null
  let url: URL
  try { url = new URL(s?.endpoint ?? '') } catch { throw new Error('Suscripción inválida.') }
  const allowed = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowed.includes(url.hostname) ||
    !s?.keys || !/^[\w-]{87}$/.test(s.keys.p256dh) || !/^[\w-]{22}$/.test(s.keys.auth) || s.endpoint.length > 2048)
    throw new Error('Suscripción push inválida o proveedor no admitido.')
  return { endpoint: url.href, expirationTime: null, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }
}

export async function deliverMarketAlert(env: MarketEnv, userId: string, settings: MarketSettings, title: string, text: string) {
  const kv = env.MARKET_MONITOR!
  let pushAccepted = false
  const errors: string[] = []
  const subscriptions = await kv.get<PushSubscription[]>(`push:${userId}`, 'json') ?? []
  const keep: PushSubscription[] = []
  for (const sub of subscriptions) {
    try {
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) throw new Error('Faltan claves VAPID.')
      const payload = await buildPushPayload({ data: JSON.stringify({ title: title.slice(0, 120), body: text.slice(0, 1000), url: '/stocks' }), options: { ttl: 900, urgency: 'high' } }, validateSubscription(sub), {
        publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT,
      })
      const response = await fetch(sub.endpoint, { ...payload, redirect: 'error', signal: AbortSignal.timeout(12000) })
      if (response.status !== 404 && response.status !== 410) keep.push(sub)
      if (response.ok) pushAccepted = true
      else errors.push(`Push HTTP ${response.status}`)
    } catch { keep.push(sub); errors.push('No se pudo enviar push.') }
  }
  if (keep.length !== subscriptions.length) await kv.put(`push:${userId}`, JSON.stringify(keep))
  let telegramAccepted = false
  // Explicit fallback preference and verified owner; no cross-account leakage.
  if (!pushAccepted && settings.telegram && env.MARKET_TELEGRAM_USER_ID === userId && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ALLOWED_CHAT_ID) {
    try {
      // Multiple messages preserve the full report (Telegram limit: 4096 chars).
      const message = `${title}\n\n${text}`
      for (let offset = 0; offset < message.length; offset += 3800) {
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: env.TELEGRAM_ALLOWED_CHAT_ID, text: message.slice(offset, offset + 3800), disable_web_page_preview: true }),
          signal: AbortSignal.timeout(12000),
        })
        if (!response.ok || !(await response.json() as { ok?: boolean }).ok) throw new Error('Telegram rechazó el envío.')
      }
      telegramAccepted = true
    } catch { errors.push('No se pudo enviar Telegram.') }
  }
  const ok = pushAccepted || telegramAccepted
  const result: MarketDelivery = { at: new Date().toISOString(), ok, detail: ok ? `Aceptado por ${pushAccepted ? 'proveedor push' : 'Telegram'}; recepción en el dispositivo sin confirmar.` : errors.join(' ') || 'No hay un canal de notificaciones disponible.' }
  await kv.put(`delivery:${userId}`, JSON.stringify(result))
  return result
}

export async function runMarketMonitor(env: MarketEnv, now = new Date()) {
  const kv = env.MARKET_MONITOR
  if (!kv) return
  const clock = marketClock(now)
  if (!clock.known) { console.error('[market] Actualizar calendario NYSE: año no soportado.'); return }
  if (!clock.tradingDay || clock.minute < 240 || clock.minute >= 1200) return
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: 'settings:', cursor })
    for (const key of page.keys) {
      const userId = key.name.slice('settings:'.length)
      try {
        const settings = await kv.get<MarketSettings>(key.name, 'json')
        if (!settings?.enabled || !settings.rules.length) continue
        const report = await buildMarketReport(env, settings.rules.map(r => r.symbol), now)
        await kv.put(`report:${userId}`, JSON.stringify(report))
        await kv.put(`checked:${userId}`, JSON.stringify(now.toISOString()))
        const sendOnce = async (id: string, title: string, text: string) => {
          const marker = `sent:${userId}:${id}`
          if (await kv.get(marker, 'json')) return
          const delivered = await deliverMarketAlert(env, userId, settings, title, text)
          if (delivered.ok) await kv.put(marker, JSON.stringify(true), { expirationTtl: 10 * 86400 })
        }
        if (clock.report) await sendOnce(`${clock.date}:${clock.report}`, clock.report === 'morning' ? 'Mercado · antes de abrir' : 'Mercado · cierre', reportText(report, 'Resumen de tu seguimiento'))
        for (const stock of report.stocks) {
          const rule = settings.rules.find(r => r.symbol === stock.symbol)!
          for (const alert of priceAlerts(rule, stock.quote, now))
            await sendOnce(`${clock.date}:${stock.symbol}:${alert.key}`, 'Alerta de mercado', alert.text)
          for (const earnings of stock.earnings) {
            const days = (Date.parse(`${earnings.date}T12:00:00Z`) - Date.parse(`${clock.date}T12:00:00Z`)) / 86400000
            if (days >= 0 && days <= 3) await sendOnce(`${clock.date}:${stock.symbol}:earnings:${earnings.date}`, 'Resultados próximos', `${stock.symbol} presenta resultados el ${earnings.date} (${earnings.hour || 'horario sin confirmar'}). Fecha estimada por Finnhub: confirmala en Relaciones con Inversores. Revisá tu exposición antes del evento. Un stop no garantiza el precio ante un gap.`)
          }
          // On first activation avoid replaying old headlines. Do not interpret a
          // headline as confirmed guidance or fabricate buy/sell predictions.
          for (const news of stock.news.filter(n => n.datetime * 1000 > Date.parse(settings.updatedAt) && now.getTime() / 1000 - n.datetime < 3600))
            await sendOnce(`${stock.symbol}:news:${news.id}`, `Noticia · ${stock.symbol}`, `${news.headline}\n${news.source} · ${new Date(news.datetime * 1000).toISOString()}\n${news.url}\nVerificá el comunicado original antes de operar.`)
        }
      } catch { console.error('[market] Falló una revisión; se reintentará en el próximo ciclo.') }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
}
