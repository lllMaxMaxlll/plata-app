// Prueba el bundle de OpenNext en workerd. No inicia sesión ni escribe datos.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const require = createRequire(import.meta.url)
const port = Number(process.env.WORKER_SMOKE_PORT ?? 8788)
const origin = `http://127.0.0.1:${port}`
await access(".open-next/worker.js")
const cli = join(dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js")
const child = spawn(process.execPath, [cli, "dev", "--local", "--test-scheduled", "--ip", "127.0.0.1", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => { logs = (logs + chunk.toString()).slice(-6000) })
}
let spawnError
child.on("error", (error) => { spawnError = error })

try {
  let response
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError
    if (child.exitCode !== null) throw new Error(`Wrangler terminó antes de servir la app.\n${logs}`)
    try {
      response = await fetch(origin, { signal: AbortSignal.timeout(3000) })
      break
    } catch {
      await delay(250)
    }
  }
  assert.ok(response, `El Worker no inició a tiempo.\n${logs}`)
  assert.equal(response.status, 200, `Inicio falló en workerd.\n${logs}`)
  assert.match(await response.text(), /EN MANO/)
  for (const path of ["/profile", "/agenda", "/manifest.webmanifest"]) {
    const result = await fetch(origin + path, { signal: AbortSignal.timeout(10000) })
    assert.equal(result.status, 200, `${path} falló en workerd.\n${logs}`)
    if (path.endsWith("webmanifest")) assert.equal((await result.json()).short_name, "EN MANO")
  }
  // GET no está implementado: debe responder 405, nunca fallar al cargar Next.
  const api = await fetch(origin + "/api/search", { signal: AbortSignal.timeout(10000) })
  assert.equal(api.status, 405, `La ruta dinámica falló en workerd.\n${logs}`)
  const market = await fetch(origin + "/api/market", { signal: AbortSignal.timeout(10000) })
  assert.equal(market.status, 401, `El radar debe rechazar lecturas sin autenticación.\n${logs}`)
  // Saturday: verify the real scheduled handler loads without fetching prices
  // or sending notifications. The rule/delivery tests exercise trading days.
  const scheduled = await fetch(origin + "/__scheduled?time=1793448000000", { signal: AbortSignal.timeout(10000) })
  assert.equal(scheduled.status, 200, `El handler programado falló en workerd.\n${logs}`)
  console.log("Cloudflare smoke: páginas, manifest, API autenticada y cron OK.")
} finally {
  child.kill("SIGTERM")
}
