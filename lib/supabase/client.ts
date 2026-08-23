import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  )
}

/** Cliente único para toda la app: crear uno por llamada abriría un websocket por cada uno. */
let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!browserClient) browserClient = createClient()
  return browserClient
}

/**
 * Cabecera de autorización para las rutas de /api, que verifican el JWT del lado
 * del servidor. Devuelve un objeto vacío si no hay sesión.
 */
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
