import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/server-api"
import { getBindings, embedTexts } from "@/lib/workers-ai"
import {
  parseDateRange,
  stripTemporalPhrases,
  type DateRange,
  type SearchMatch,
} from "@/lib/semantic-search"

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
const TOP_K = 100

/**
 * Cómo se separa lo relevante del ruido.
 *
 * Un umbral absoluto de similitud no sirve acá, y vale la pena explicar por qué:
 * todos los movimientos se embeben con la misma estructura ("Gasto · Comida ·
 * nota · cuenta"), así que quedan muy agrupados entre sí. Medido contra el
 * índice real, dos movimientos sin relación entre sí ya dan 0.72, y una
 * consulta en lenguaje natural contra el movimiento MÁS parecido da apenas
 * 0.46–0.58 — la banda útil entera mide menos de 0.15.
 *
 * Entonces el corte es relativo al mejor resultado de cada consulta, no un
 * número fijo. Números medidos sobre 196 movimientos reales:
 *
 *   consulta (ya sin la parte temporal)   mejor   dentro de 0.04
 *   "cuanto gaste en el auto"             0.5713    4
 *   "salidas a comer"                     0.5830   19
 *   "compras del super"                   0.4896    4
 *   "nafta"                               0.4798    4
 *   "servicios de la casa"                0.4599    6
 *   "xyzzy qwerty asdf"                   0.3780    — (basura, se descarta)
 *
 * El piso absoluto sólo mira el mejor resultado y existe para el último caso:
 * una consulta que no se parece a nada tiene que devolver la lista vacía en vez
 * de los movimientos menos malos.
 */
const MIN_TOP_SCORE = 0.4
const RELATIVE_MARGIN = 0.04

/** Tope de resultados: con puntajes tan planos, sin esto se vuelca medio índice. */
const MAX_RESULTS = 30

/**
 * Por qué una búsqueda no devolvió resultados semánticos.
 *
 * Existe porque la primera versión colapsaba tres causas muy distintas en un
 * `available: false` sin log, y desde afuera "no está configurado" tapaba a
 * "la llamada falló". Cada caso se loguea, y la UI puede decir la verdad.
 */
type Unavailable = "no-binding" | "embedding-failed" | "index-error"

interface SearchResponse {
  matches: SearchMatch[]
  dateRange: DateRange | null
  available: boolean
  reason?: Unavailable
}

function respond(body: SearchResponse, status = 200) {
  return NextResponse.json(body, { status })
}

function unavailable(reason: Unavailable, dateRange: DateRange | null, detail?: unknown) {
  console.error(`[search] no disponible (${reason})`, detail ?? "")
  return respond({ matches: [], dateRange, available: false, reason })
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
    return unavailable("no-binding", dateRange, {
      ai: Boolean(env?.AI),
      index: Boolean(env?.TRANSACTIONS_INDEX),
    })
  }

  try {
    // Se embebe sólo el "qué": la parte temporal ya la resolvió parseDateRange
    // y dejarla en el texto sólo le quita señal al embedding.
    const [vector] = (await embedTexts([stripTemporalPhrases(query)])) ?? []
    if (!vector) return unavailable("embedding-failed", dateRange)

    const result = await env.TRANSACTIONS_INDEX.query(vector, {
      topK: TOP_K,
      // Sin este filtro un usuario vería los movimientos de otro. El userId
      // viene del JWT verificado, no del cuerpo del request.
      filter: { userId },
      // "none", no `false`: la API v2 espera este enum de strings y con el
      // booleano viejo tira error, que antes se veía como "no configurado".
      returnMetadata: "none",
    })

    // Vectorize devuelve ordenado por score descendente.
    const ranked = result?.matches ?? []
    const best = ranked[0]?.score ?? 0

    // Nada se pareció lo suficiente: mejor lista vacía que resultados al azar.
    if (best < MIN_TOP_SCORE) {
      return respond({ matches: [], dateRange, available: true })
    }

    const matches = ranked
      .filter((match) => match.score >= best - RELATIVE_MARGIN)
      .slice(0, MAX_RESULTS)
      .map((match) => ({ id: match.id, score: match.score }))

    return respond({ matches, dateRange, available: true })
  } catch (err) {
    return unavailable("index-error", dateRange, err)
  }
}
