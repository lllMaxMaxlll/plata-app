import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/server-api"
import { getBindings, embedTexts } from "@/lib/workers-ai"
import { BATCH_SIZE } from "@/lib/semantic-search"

/**
 * Indexa movimientos en Vectorize para que la búsqueda semántica los encuentre.
 *
 * El cliente manda los movimientos que sabe que están sin indexar (ver
 * `use-semantic-search`), porque el provider ya los tiene todos en memoria y
 * así evitamos una segunda lectura de Postgres desde el servidor.
 *
 * El aislamiento entre usuarios NO depende de lo que manda el cliente: el
 * `userId` que se guarda como metadata sale del JWT verificado, y la búsqueda
 * filtra por ese mismo campo. Aunque alguien falsee el payload, sólo puede
 * ensuciar su propio índice.
 */

/** Tope por request. Con más, el cliente hace varias tandas. */
const MAX_ITEMS = 200

/** Una nota larga no aporta señal extra y encarece el embedding. */
const MAX_TEXT_LENGTH = 512

interface SyncItem {
  id: string
  text: string
}

export async function POST(request: Request) {
  const { userId, error } = await authorizeApiRequest(request, "search-sync", 30)
  if (error) return error
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rawItems = (body as { items?: unknown })?.items
  if (!Array.isArray(rawItems)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 })
  }

  const items: SyncItem[] = rawItems
    .filter(
      (item): item is SyncItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SyncItem).id === "string" &&
        typeof (item as SyncItem).text === "string" &&
        (item as SyncItem).text.trim().length > 0
    )
    .slice(0, MAX_ITEMS)
    .map((item) => ({ id: item.id, text: item.text.trim().slice(0, MAX_TEXT_LENGTH) }))

  if (items.length === 0) {
    return NextResponse.json({ indexed: 0, available: true })
  }

  const env = getBindings()
  if (!env?.AI || !env.TRANSACTIONS_INDEX) {
    // Sin índice la app funciona igual, sólo que sin búsqueda semántica.
    console.error("[search-sync] no disponible (no-binding)", {
      ai: Boolean(env?.AI),
      index: Boolean(env?.TRANSACTIONS_INDEX),
    })
    return NextResponse.json({ indexed: 0, available: false, reason: "no-binding" })
  }

  let indexed = 0
  try {
    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const batch = items.slice(start, start + BATCH_SIZE)
      const vectors = await embedTexts(batch.map((item) => item.text))
      if (!vectors) {
        console.error("[search-sync] no disponible (embedding-failed)")
        return NextResponse.json({ indexed, available: false, reason: "embedding-failed" })
      }

      await env.TRANSACTIONS_INDEX.upsert(
        batch.map((item, position) => ({
          // El id del movimiento es el id del vector: reindexar es un upsert,
          // no un duplicado.
          id: item.id,
          values: vectors[position],
          // `userId` sale del token, nunca del payload.
          metadata: { userId },
        }))
      )
      indexed += batch.length
    }
  } catch (err) {
    console.error("[search-sync] no disponible (index-error)", err)
    return NextResponse.json({ indexed, available: false, reason: "index-error" }, { status: 200 })
  }

  return NextResponse.json({ indexed, available: true })
}
