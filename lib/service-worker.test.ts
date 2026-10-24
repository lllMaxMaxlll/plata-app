import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8")

function worker() {
  const listeners: Record<string, (event: any) => void> = {}
  const stores = new Map<string, Map<string, Response>>()
  const key = (request: string | Request) => typeof request === "string" ? request : request.url
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const entries = stores.get(name)!
    return {
      match: async (request: string | Request) => entries.get(key(request))?.clone(),
      put: async (request: string | Request, response: Response) => { entries.set(key(request), response) },
      keys: async () => [...entries.keys()],
      delete: async (request: string | Request) => entries.delete(key(request)),
    }
  }
  runInNewContext(source, {
    self: {
      location: { origin: "https://lucas.test" },
      clients: { claim: async () => {} },
      addEventListener: (name: string, listener: (event: any) => void) => { listeners[name] = listener },
    },
    caches: {
      open: async (name: string) => cache(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
    fetch: async () => { throw new TypeError("Offline") },
    URL, Response, setTimeout,
  })
  async function navigate(path: string) {
    let response!: Promise<Response>
    const pending: Promise<unknown>[] = []
    listeners.fetch({
      request: { method: "GET", url: `https://lucas.test${path}`, mode: "navigate" },
      respondWith: (value: Promise<Response>) => { response = value },
      waitUntil: (value: Promise<unknown>) => { pending.push(value) },
    })
    const result = await response
    await Promise.all(pending)
    return result
  }
  return { stores, cache, navigate, listeners }
}

test("offline navigation uses cached HTML independently of the query", async () => {
  const sw = worker()
  await sw.cache("lucas-pages-v2").put("/search", new Response("search shell"))
  assert.equal(await (await sw.navigate("/search?q=super")).text(), "search shell")
})

test("an uncached route falls back to the cached home offline", async () => {
  const sw = worker()
  await sw.cache("lucas-pages-v2").put("/", new Response("home shell"))
  assert.equal(await (await sw.navigate("/unknown")).text(), "home shell")
})

test("first launch without a cache gives an actionable offline response", async () => {
  const response = await worker().navigate("/")
  assert.equal(response.status, 503)
  assert.match(await response.text(), /una vez con internet/)
})

test("activation only removes old Lucas caches", async () => {
  const sw = worker()
  sw.cache("lucas-pages-v1")
  sw.cache("lucas-pages-v2")
  sw.cache("firebase-unrelated")
  let complete!: Promise<void>
  sw.listeners.activate({ waitUntil: (value: Promise<void>) => { complete = value } })
  await complete
  assert.equal(sw.stores.has("lucas-pages-v1"), false)
  assert.equal(sw.stores.has("lucas-pages-v2"), true)
  assert.equal(sw.stores.has("firebase-unrelated"), true)
})
