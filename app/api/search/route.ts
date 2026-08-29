import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/server-api"
import { getBindings, embedTexts } from "@/lib/workers-ai"
import { parseDateRange, type DateRange, type SearchMatch } from "@/lib/semantic-search"

/**
 * Resuelve una consulta en lenguaje natural sobre el historial de movimientos.
 *
 * Devuelve ids y puntajes, no texto. Quien arma la lista y la suma es el
 * cliente, con los movimientos que ya tiene: así el número que se muestra
 * siempre sale de la base y no de un modelo.
 *
 * El rango de fechas se resuelve acá con `parseDateRange` (determinístico) y se
 * devuelve para que la UI pueda mostrar qué período se filtró.
 */

const MAX_QUERY_LENGTH = 200
const MIN_QUERY_LENGTH = 2

/** Se piden de más porque después se filtra por fecha del lado del cliente. */
const TOP_K = 50

/**
 * Piso de similitud. bge-m3 devuelve coseno en [0,1] y por debajo de esto los
 * resultados son ruido: preferimos "no encontré nada" antes que una lista de
 * movimientos que no tienen nada que ver con lo que se preguntó.
 */
const MIN_SCORE = 0.45

interface SearchResponse {
  matches: SearchMatch[]
  dateRange: DateRange | null
  available: boolean
}

function respond(body: SearchResponse, status = 200) {
  return NextResponse.json(body, { status })
}

export async function POST(request: Request) {
  const { userId, error } = await authorizeApiRequest(request, "search", 30)
  if (error) return error
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const rawQuery = (body as { query?: unknown })?.query
  if (typeof rawQuery !== "string" || rawQuery.trim().length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH)

  // El "cuándo" se resuelve siempre, haya o no índice: aunque la búsqueda
  // semántica esté apagada, el cliente puede filtrar por fecha por su cuenta.
  const dateRange = parseDateRange(query)

  const env = getBindings()
  if (!env?.AI || !env.TRANSACTIONS_INDEX) {
    return respond({ matches: [], dateRange, available: false })
  }

  try {
    const [vector] = (await embedTexts([query])) ?? []
    if (!vector) return respond({ matches: [], dateRange, available: false })

    const result = await env.TRANSACTIONS_INDEX.query(vector, {
      topK: TOP_K,
      // Sin este filtro un usuario vería los movimientos de otro. El userId
      // viene del JWT verificado, no del cuerpo del request.
      filter: { userId },
      returnMetadata: false,
    })

    const matches = (result?.matches ?? [])
      .filter((match) => match.score >= MIN_SCORE)
      .map((match) => ({ id: match.id, score: match.score }))

    return respond({ matches, dateRange, available: true })
  } catch (err) {
    console.error("[search] Vectorize falló:", err)
    return respond({ matches: [], dateRange, available: false })
  }
}
