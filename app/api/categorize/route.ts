import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/server-api"
import { classifyNote, type ModelSource } from "@/lib/categorize-model"
import { matchByRules, MIN_NOTE_LENGTH, MAX_NOTE_LENGTH } from "@/lib/categorize"

/**
 * Sugiere una categoría para un movimiento a partir de su descripción.
 *
 * Nunca falla hacia el cliente: si el modelo no responde, no está el binding o
 * devuelve algo fuera de la lista, contestamos 200 con `category: null` y el
 * formulario sigue como siempre. Es una ayuda, no un paso obligatorio.
 *
 * La llamada al modelo y su caché viven en `categorize-model`, que comparte con
 * el bot de Telegram.
 */

const MAX_CATEGORIES = 40

function suggestion(category: string | null, source: ModelSource) {
  return NextResponse.json({ category, source })
}

export async function POST(request: Request) {
  const authResult = await authorizeApiRequest(request, "categorize", 60)
  if (authResult.error) return authResult.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { note, type, categories } = (body ?? {}) as {
    note?: unknown
    type?: unknown
    categories?: unknown
  }

  if (typeof note !== "string" || note.trim().length < MIN_NOTE_LENGTH) {
    return suggestion(null, null)
  }
  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "type must be 'income' or 'expense'" }, { status: 400 })
  }

  const allowed = Array.isArray(categories)
    ? categories
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim())
        .slice(0, MAX_CATEGORIES)
    : []

  if (allowed.length === 0) {
    return NextResponse.json({ error: "categories must be a non-empty array" }, { status: 400 })
  }

  const trimmedNote = note.trim().slice(0, MAX_NOTE_LENGTH)

  // 1. Reglas locales. Instantáneas y sin costo, así que van primero.
  const byRules = matchByRules(trimmedNote, allowed)
  if (byRules) return suggestion(byRules, "rules")

  // 2. Workers AI para el resto.
  const { category, source } = await classifyNote(trimmedNote, allowed, type)
  return suggestion(category, source)
}
