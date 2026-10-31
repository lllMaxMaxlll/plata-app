import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runMarketMonitor, deliverMarketAlert, validateSubscription, type MarketKV, type MarketEnv } from './market-service.ts'
import type { MarketSettings } from './market-monitor.ts'

function memoryKV(): MarketKV & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    async get<T>(key: string) { return values.has(key) ? JSON.parse(values.get(key)!) as T : null },
    async put(key, value) { values.set(key, value) },
    async delete(key) { values.delete(key) },
    async list({ prefix }) { return { keys: [...values.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true } },
  }
}
const settings: MarketSettings = { enabled: true, telegram: true, updatedAt: '2026-10-29T00:00:00Z', rules: [{ symbol: 'INTC', stop: 30, target: 50, dropPercent: 5 }] }

test('push subscriptions cannot turn notification delivery into an arbitrary fetch', () => {
  const keys = { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) }
  assert.equal(validateSubscription({ endpoint: 'https://web.push.apple.com/token', keys }).endpoint, 'https://web.push.apple.com/token')
  for (const endpoint of ['http://web.push.apple.com/token', 'https://127.0.0.1/token', 'https://web.push.apple.com.attacker.test/', 'https://user:pass@web.push.apple.com/', 'https://web.push.apple.com:8443/'])
    assert.throws(() => validateSubscription({ endpoint, keys }))
})

test('Telegram fallback is restricted to the bound user and the explicit preference', async t => {
  const kv = memoryKV()
  let sends = 0
  t.mock.method(globalThis, 'fetch', async () => { sends++; return Response.json({ ok: true }) })
  const env: MarketEnv = { MARKET_MONITOR: kv, MARKET_TELEGRAM_USER_ID: 'owner', TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_ALLOWED_CHAT_ID: '42' }
  assert.equal((await deliverMarketAlert(env, 'other', settings, 'test', 'private')).ok, false)
  assert.equal(sends, 0)
  assert.equal((await deliverMarketAlert(env, 'owner', { ...settings, telegram: false }, 'test', 'private')).ok, false)
  assert.equal(sends, 0)
  assert.equal((await deliverMarketAlert(env, 'owner', settings, 'test', 'private')).ok, true)
  assert.equal(sends, 1)
})

test('Apple push uses aes128gcm, expired subscriptions are removed, and Telegram takes over', async t => {
  const kv = memoryKV()
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const b64 = (v: ArrayBuffer | Uint8Array) => Buffer.from(v instanceof Uint8Array ? v : new Uint8Array(v)).toString('base64url')
  const subscription = { endpoint: 'https://web.push.apple.com/test', expirationTime: null, keys: {
    p256dh: b64(await crypto.subtle.exportKey('raw', receiver.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))),
  } }
  await kv.put('push:owner', JSON.stringify([subscription]))
  const env: MarketEnv = { MARKET_MONITOR: kv, VAPID_SUBJECT: 'mailto:test@example.com',
    VAPID_PUBLIC_KEY: b64(await crypto.subtle.exportKey('raw', vapid.publicKey)),
    VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d!,
    MARKET_TELEGRAM_USER_ID: 'owner', TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_ALLOWED_CHAT_ID: '42' }
  let telegram = 0
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith('https://web.push.apple.com/')) {
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('content-encoding'), 'aes128gcm')
      assert.match(headers.get('authorization')!, /^vapid /)
      return new Response(null, { status: 410 })
    }
    telegram++
    return Response.json({ ok: true })
  })
  assert.equal((await deliverMarketAlert(env, 'owner', settings, 'Prueba', 'Cotización indicativa')).ok, true)
  assert.equal(telegram, 1)
  assert.deepEqual(await kv.get('push:owner', 'json'), [])
})

test('scheduled monitoring runs without a browser, deduplicates delivered alerts, and retries failures', async t => {
  const kv = memoryKV()
  const now = new Date('2026-10-30T15:00:00Z')
  const env: MarketEnv = { MARKET_MONITOR: kv, FINNHUB_API_KEY: 'test', MARKET_TELEGRAM_USER_ID: 'owner', TELEGRAM_BOT_TOKEN: 'test', TELEGRAM_ALLOWED_CHAT_ID: '42' }
  await kv.put('settings:owner', JSON.stringify(settings))
  await kv.put('quote:INTC', JSON.stringify({ c: 25, dp: -10, t: now.getTime() / 1000 }))
  await kv.put('earnings:INTC:2026-10-27', JSON.stringify({ earningsCalendar: [] }))
  await kv.put('news:INTC', JSON.stringify([]))
  let sends = 0, fail = true
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    assert.match(String(url), /^https:\/\/api.telegram.org\//)
    sends++
    return Response.json({ ok: !fail }, { status: fail ? 503 : 200 })
  })
  await runMarketMonitor(env, now)
  assert.equal(sends, 2)
  assert.equal(kv.values.has('sent:owner:2026-10-30:INTC:stop:30'), false)
  fail = false
  await runMarketMonitor(env, now)
  assert.equal(sends, 4)
  assert.equal(kv.values.has('sent:owner:2026-10-30:INTC:stop:30'), true)
  await runMarketMonitor(env, now)
  assert.equal(sends, 4)
  assert.equal(kv.values.has('report:owner'), true)
  await kv.put('settings:owner', JSON.stringify({ ...settings, enabled: false }))
  await runMarketMonitor(env, now)
  assert.equal(sends, 4)
})
