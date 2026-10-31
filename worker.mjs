// OpenNext generates this module before Wrangler bundles this entrypoint.
import app from './.open-next/worker.js'
export * from './.open-next/worker.js'
import { runMarketMonitor } from './lib/market-service.ts'

const worker = {
  fetch: app.fetch,
  async scheduled(controller, env) {
    await runMarketMonitor(env, new Date(controller.scheduledTime))
  },
}
export default worker
