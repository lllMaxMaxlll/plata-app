import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marketClock, priceAlerts, validateMarketSettings, reportText, type MarketRule } from './market-monitor.ts'
import { quarterlyMetric, readFundamentals } from './market-fundamentals.ts'

test('NYSE clock follows DST, holidays and early closes, and fails closed outside the known calendar', () => {
  assert.equal(marketClock(new Date('2026-10-30T12:00:00Z')).report, 'morning') // 08 EDT
  assert.equal(marketClock(new Date('2026-11-02T13:00:00Z')).report, 'morning') // 08 EST
  assert.equal(marketClock(new Date('2026-11-26T13:00:00Z')).tradingDay, false)
  assert.equal(marketClock(new Date('2026-10-31T12:00:00Z')).tradingDay, false)
  const early = marketClock(new Date('2026-11-27T18:05:00Z'))
  assert.equal(early.close, 780)
  assert.equal(early.report, 'close')
  assert.equal(marketClock(new Date('2026-11-27T21:05:00Z')).report, null)
  assert.equal(marketClock(new Date('2028-01-03T13:00:00Z')).known, false)
  assert.equal(marketClock(new Date('2028-01-03T13:00:00Z')).tradingDay, false)
})

test('price alerts trigger at boundaries and refuse stale, missing or future data', () => {
  const now = new Date('2026-10-30T15:00:00Z')
  const rule: MarketRule = { symbol: 'INTC', stop: 25, target: 40, dropPercent: 5 }
  const quote = { price: 25, change: -5, timestamp: now.getTime() / 1000 }
  assert.deepEqual(priceAlerts(rule, quote, now).map(a => a.key), ['stop:25', 'drop:5'])
  assert.equal(priceAlerts(rule, { ...quote, price: 40, change: 3 }, now)[0].key, 'target:40')
  assert.equal(priceAlerts(rule, { ...quote, timestamp: quote.timestamp - 901 }, now).length, 0)
  assert.equal(priceAlerts(rule, { ...quote, timestamp: quote.timestamp + 61 }, now).length, 0)
  assert.equal(priceAlerts(rule, { ...quote, price: 0 }, now).length, 0)
  assert.equal(priceAlerts(rule, null, now).length, 0)
  assert.match(priceAlerts(rule, quote, now)[0].text, /no se ejecutó ninguna orden/)
})

test('settings reject duplicate symbols, inverted levels, non-finite values and excessive lists', () => {
  const rule = { symbol: ' intc ', stop: 20, target: 40, dropPercent: 5 }
  const settings = { enabled: true, telegram: false, rules: [rule] }
  assert.equal(validateMarketSettings(settings).rules[0].symbol, 'INTC')
  assert.throws(() => validateMarketSettings({ ...settings, rules: [rule, rule] }))
  assert.throws(() => validateMarketSettings({ ...settings, rules: [{ ...rule, stop: 45 }] }))
  assert.throws(() => validateMarketSettings({ ...settings, rules: [{ ...rule, dropPercent: NaN }] }))
  assert.throws(() => validateMarketSettings({ ...settings, rules: [] }))
  assert.throws(() => validateMarketSettings({ ...settings, rules: Array.from({ length: 11 }, (_, i) => ({ ...rule, symbol: `S${i}` })) }))
})

test('SEC metrics compare seasonal quarters, keep restatements and avoid annual or zero-base EPS comparisons', () => {
  const facts = [
    { start: '2025-07-01', end: '2025-09-30', val: 100, filed: '2025-10-25', form: '10-Q' },
    { start: '2026-07-01', end: '2026-09-30', val: 130, filed: '2026-10-25', form: '10-Q' },
    { start: '2026-07-01', end: '2026-09-30', val: 120, filed: '2026-10-29', form: '10-Q/A' },
    { start: '2026-01-01', end: '2026-12-31', val: 800, filed: '2027-02-01', form: '10-K' },
  ]
  const metric = quarterlyMetric('Revenues', facts)!
  assert.equal(metric.end, '2026-09-30')
  assert.equal(metric.value, 120)
  assert.ok(Math.abs(metric.yoy! - 20) < 0.0001)
  const zero = quarterlyMetric('EPS', facts.map(f => ({ ...f, val: f.start.startsWith('2025') ? 0 : f.val })))!
  assert.equal(zero.yoy, null)
  assert.equal(quarterlyMetric('EPS', []), null)
  const data = { facts: { 'us-gaap': { Revenues: { units: { USD: facts.slice(0, 3) } } } } }
  assert.match(readFundamentals(data, '0000050863', '2026-10-30').warning!, /presentación más reciente/)
})

test('report preserves provenance and explains unavailable data instead of inventing a signal', () => {
  const text = reportText({ asOf: '2026-10-30T15:00:00Z', stocks: [{ symbol: 'INTC', quote: null, earnings: [], news: [], warnings: ['Calendario no disponible.'] }] }, 'Mercado')
  assert.match(text, /sin cotización verificable/)
  assert.match(text, /Calendario no disponible/)
  assert.match(text, /No es una recomendación/)
})
