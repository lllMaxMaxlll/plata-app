/** Deterministic rules adapted from Jakeschincariol/day-trader-skill (MIT).
 * An alert is information: this module never places an order. */
export interface MarketRule {
  symbol: string
  stop: number | null
  target: number | null
  dropPercent: number
}
export interface MarketSettings {
  enabled: boolean
  telegram: boolean
  rules: MarketRule[]
  updatedAt: string
}
export interface MarketQuote { price: number; change: number; timestamp: number }
export interface MarketNews { id: number; headline: string; url: string; datetime: number; source: string }
export interface MarketEarning { date: string; hour: string; epsEstimate: number | null; epsActual: number | null }
export interface MarketStock {
  symbol: string
  quote: MarketQuote | null
  earnings: MarketEarning[]
  news: MarketNews[]
  warnings: string[]
  fundamentals?: import('./market-fundamentals.ts').MarketFundamentals | null
}
export interface MarketReport { asOf: string; stocks: MarketStock[] }

const HOLIDAYS: Record<number, string[]> = {
  2026: ['01-01','01-19','02-16','04-03','05-25','06-19','07-03','09-07','11-26','12-25'],
  2027: ['01-01','01-18','02-15','03-26','05-31','06-18','07-05','09-06','11-25','12-24'],
}
const EARLY: Record<number, string[]> = { 2026: ['11-27','12-24'], 2027: ['11-26'] }

export function marketClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now).map(p => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const year = Number(parts.year)
  const known = year in HOLIDAYS
  const tradingDay = known && !['Sat','Sun'].includes(parts.weekday) && !HOLIDAYS[year].includes(date.slice(5))
  const minute = Number(parts.hour) * 60 + Number(parts.minute)
  const close = EARLY[year]?.includes(date.slice(5)) ? 13 * 60 : 16 * 60
  return { date, known, tradingDay, minute, close,
    session: minute >= 570 && minute < close ? 'regular' : 'extended',
    // Bounded windows prevent a missed job from delivering yesterday's report.
    report: tradingDay && minute >= 480 && minute < 540 ? 'morning'
      : tradingDay && minute >= close + 5 && minute < close + 65 ? 'close' : null,
  }
}

export function validateMarketSettings(input: unknown): MarketSettings {
  if (!input || typeof input !== 'object') throw new Error('Configuración inválida.')
  const value = input as Record<string, unknown>
  if (typeof value.enabled !== 'boolean' || typeof value.telegram !== 'boolean' || !Array.isArray(value.rules) || value.rules.length > 10)
    throw new Error('Elegí hasta 10 símbolos y un canal de alertas.')
  const seen = new Set<string>()
  const rules = value.rules.map((raw: unknown): MarketRule => {
    if (!raw || typeof raw !== 'object') throw new Error('Regla inválida.')
    const rule = raw as Record<string, unknown>
    if (typeof rule.symbol !== 'string') throw new Error('Símbolo inválido.')
    const symbol = rule.symbol.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol) || seen.has(symbol)) throw new Error('Símbolo inválido o repetido.')
    seen.add(symbol)
    const level = (v: unknown) => v === null ? null : typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1e7 ? v : undefined
    const stop = level(rule.stop), target = level(rule.target)
    if (stop === undefined || target === undefined || (stop !== null && target !== null && stop >= target))
      throw new Error(`${symbol}: el stop debe ser menor al objetivo y los precios positivos.`)
    if (typeof rule.dropPercent !== 'number' || !Number.isFinite(rule.dropPercent) || rule.dropPercent < 0.1 || rule.dropPercent > 100)
      throw new Error(`${symbol}: la caída debe estar entre 0,1 y 100%.`)
    return { symbol, stop, target, dropPercent: rule.dropPercent }
  })
  if (value.enabled && rules.length === 0) throw new Error('Agregá al menos un símbolo.')
  return { enabled: value.enabled, telegram: value.telegram, rules, updatedAt: new Date().toISOString() }
}

export function priceAlerts(rule: MarketRule, quote: MarketQuote | null, now: Date) {
  // Never treat a missing, synthetic or old quote as a trade signal.
  if (!quote || !Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(quote.change) ||
    !Number.isFinite(quote.timestamp) || now.getTime() / 1000 - quote.timestamp > 900 || quote.timestamp > now.getTime() / 1000 + 60) return []
  const alerts: { key: string; text: string }[] = []
  const suffix = `USD ${quote.price.toFixed(2)} · cotización ${new Date(quote.timestamp * 1000).toISOString()}. Verificá en tu broker; no se ejecutó ninguna orden.`
  if (rule.stop !== null && quote.price <= rule.stop) alerts.push({ key: `stop:${rule.stop}`, text: `${rule.symbol} alcanzó tu stop de referencia (${rule.stop}). ${suffix}` })
  if (rule.target !== null && quote.price >= rule.target) alerts.push({ key: `target:${rule.target}`, text: `${rule.symbol} alcanzó tu objetivo (${rule.target}). ${suffix}` })
  if (quote.change <= -rule.dropPercent) alerts.push({ key: `drop:${rule.dropPercent}`, text: `${rule.symbol} cayó ${quote.change.toFixed(2)}% frente al cierre anterior. ${suffix}` })
  return alerts
}

export function safeNewsUrl(value: unknown): string | null {
  try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : null } catch { return null }
}

export function reportText(report: MarketReport, title: string) {
  return [title, `Consultado: ${report.asOf}`, 'Cotizaciones indicativas, posiblemente demoradas.', ...report.stocks.map(stock => [
    `${stock.symbol}: ${stock.quote ? `USD ${stock.quote.price.toFixed(2)} (${stock.quote.change.toFixed(2)}%) · ${new Date(stock.quote.timestamp * 1000).toISOString()}` : 'sin cotización verificable'}`,
    ...stock.earnings.slice(0, 2).map(e => `Resultados: ${e.date} (${e.hour || 'horario sin confirmar'}). EPS real/estimado: ${e.epsActual ?? 'pendiente'} / ${e.epsEstimate ?? 'sin dato'}. Fecha estimada por Finnhub; confirmar en Relaciones con Inversores.`),
    ...stock.news.slice(0, 2).map(n => `${n.headline}\n${n.url}`), ...stock.warnings,
    ...(stock.fundamentals ? [
      `SEC · último trimestre disponible: ${stock.fundamentals.revenue ? `Ingresos USD ${stock.fundamentals.revenue.value.toLocaleString('en-US')} (${stock.fundamentals.revenue.end}), variación interanual ${stock.fundamentals.revenue.yoy === null ? 'sin comparación' : stock.fundamentals.revenue.yoy.toFixed(1) + '%'}.` : 'Ingresos sin dato comparable.'} ${stock.fundamentals.eps ? `EPS diluido USD ${stock.fundamentals.eps.value} (${stock.fundamentals.eps.end}).` : ''}`,
      stock.fundamentals.warning, stock.fundamentals.filings,
    ] : []),
  ].join('\n')), 'Revisá exposición antes de resultados. Un stop puede ejecutarse por debajo del nivel ante un gap. No es una recomendación de compra o venta.'].join('\n\n')
}
