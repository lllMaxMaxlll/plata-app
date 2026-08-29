"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getApiAuthHeaders } from "@/lib/supabase/client"
import { readUserScoped, writeUserScoped } from "@/lib/user-storage"
import type { Account, Transaction, Vehicle } from "@/lib/finance-data"
import {
  buildEmbeddingText,
  contentHash,
  withinRange,
  type DateRange,
  type SearchMatch,
} from "@/lib/semantic-search"

/** Cuántos movimientos se mandan a indexar por request. */
const SYNC_CHUNK = 200

/** Clave de localStorage con el mapa `id → hash del texto ya indexado`. */
const INDEX_STATE_KEY = "search_index_state"

type IndexState = Record<string, string>

function readIndexState(uid: string | undefined): IndexState {
  const raw = readUserScoped(INDEX_STATE_KEY, uid)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as IndexState) : {}
  } catch {
    return {}
  }
}

/** Por qué no hay búsqueda semántica. Lo informa el servidor. */
export type UnavailableReason = "no-binding" | "embedding-failed" | "index-error"

export interface SearchResult {
  transactions: Transaction[]
  dateRange: DateRange | null
  /** Suma real de los resultados, por moneda. Nunca la calcula el modelo. */
  totals: Record<string, number>
}

/**
 * Búsqueda semántica sobre el historial.
 *
 * El indexado es incremental y se apoya en que el provider ya tiene todos los
 * movimientos en memoria: se compara el hash del texto de cada uno contra lo
 * que quedó registrado en localStorage y sólo se mandan los que cambiaron o
 * nunca se indexaron. Si se limpia el storage o se entra desde otro dispositivo
 * se reindexa todo, que es trabajo de más pero nunca datos corruptos — los
 * upserts usan el id del movimiento y son idempotentes.
 */
export function useSemanticSearch({
  uid,
  transactions,
  accounts,
  vehicles,
}: {
  uid: string | undefined
  transactions: Transaction[]
  accounts: Account[]
  vehicles: Vehicle[]
}) {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState(0)
  /** `false` cuando el backend avisa que la búsqueda semántica no responde. */
  const [available, setAvailable] = useState(true)
  const [reason, setReason] = useState<UnavailableReason | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const embedTextFor = useCallback(
    (tx: Transaction) =>
      buildEmbeddingText(
        tx,
        accounts.find((a) => a.id === tx.accountId)?.name,
        tx.vehicleId ? vehicles.find((v) => v.id === tx.vehicleId)?.name : undefined
      ),
    [accounts, vehicles]
  )

  /** Movimientos cuyo texto no coincide con lo último que se indexó. */
  const collectStale = useCallback(() => {
    const state = readIndexState(uid)
    const stale: { id: string; text: string; hash: string }[] = []
    for (const tx of transactions) {
      const text = embedTextFor(tx)
      const hash = contentHash(text)
      if (state[tx.id] !== hash) stale.push({ id: tx.id, text, hash })
    }
    return stale
  }, [uid, transactions, embedTextFor])

  useEffect(() => {
    if (!uid) return
    setPending(collectStale().length)
  }, [uid, collectStale])

  /** Indexa lo que falte. `full` ignora el estado guardado y reindexa todo. */
  const sync = useCallback(
    async (full = false) => {
      if (!uid || syncing) return
      if (full) writeUserScoped(INDEX_STATE_KEY, uid, null)

      const stale = collectStale()
      if (stale.length === 0) {
        setPending(0)
        return
      }

      setSyncing(true)
      try {
        const headers = { "Content-Type": "application/json", ...(await getApiAuthHeaders()) }
        // Se relee en cada tanda para no pisar lo que haya escrito otra pestaña.
        for (let start = 0; start < stale.length; start += SYNC_CHUNK) {
          const chunk = stale.slice(start, start + SYNC_CHUNK)
          const response = await fetch("/api/search/sync", {
            method: "POST",
            headers,
            body: JSON.stringify({ items: chunk.map(({ id, text }) => ({ id, text })) }),
          })
          if (!response.ok) throw new Error(`sync: HTTP ${response.status}`)

          const data = (await response.json()) as {
            indexed?: number
            available?: boolean
            reason?: UnavailableReason
          }
          if (data.available === false) {
            setAvailable(false)
            setReason(data.reason ?? "no-binding")
            return
          }

          // Sólo se marca como indexado lo que el servidor confirmó.
          const confirmed = chunk.slice(0, data.indexed ?? 0)
          const state = readIndexState(uid)
          for (const item of confirmed) state[item.id] = item.hash
          writeUserScoped(INDEX_STATE_KEY, uid, JSON.stringify(state))
          setPending((current) => Math.max(0, current - confirmed.length))
        }
        setAvailable(true)
        setReason(null)
      } catch (error) {
        console.warn("[search] no se pudo indexar:", error)
      } finally {
        setSyncing(false)
      }
    },
    [uid, syncing, collectStale]
  )

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResult(null)
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)

      try {
        const response = await fetch("/api/search", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(await getApiAuthHeaders()) },
          body: JSON.stringify({ query }),
        })
        if (!response.ok) throw new Error(`search: HTTP ${response.status}`)

        const data = (await response.json()) as {
          matches?: SearchMatch[]
          dateRange?: DateRange | null
          available?: boolean
          reason?: UnavailableReason
        }
        setAvailable(data.available !== false)
        setReason(data.available === false ? (data.reason ?? "no-binding") : null)

        // Los ids se resuelven contra los movimientos que ya tiene el cliente.
        // Un vector huérfano — de algo borrado después de indexarlo — no
        // encuentra su movimiento y desaparece solo, sin necesidad de limpiar
        // el índice.
        const byId = new Map(transactions.map((tx) => [tx.id, tx]))
        const dateRange = data.dateRange ?? null
        const found = (data.matches ?? [])
          .map((match) => byId.get(match.id))
          .filter((tx): tx is Transaction => Boolean(tx))
          .filter((tx) => withinRange(tx, dateRange))

        const totals: Record<string, number> = {}
        for (const tx of found) {
          const currency = tx.currency ?? "ARS"
          // Las transferencias no son gasto ni ingreso: mueven plata entre
          // cuentas propias y sumarlas infla el total.
          if (tx.type === "transfer") continue
          const signed = tx.type === "expense" ? -tx.amount : tx.amount
          totals[currency] = (totals[currency] ?? 0) + signed
        }

        setResult({ transactions: found, dateRange, totals })
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.warn("[search] la búsqueda falló:", error)
          setResult({ transactions: [], dateRange: null, totals: {} })
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    },
    [transactions]
  )

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setResult(null)
  }, [])

  return { result, search, clear, sync, searching, syncing, pending, available, reason }
}
