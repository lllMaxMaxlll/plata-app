import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { enforceRateLimit } from "@/lib/server-api"
import { parseExpenseMessage, type ParseResult } from "@/lib/expense-message"
import {
  readUpdate,
  accountKeyboard,
  formatRegistered,
  formatHelp,
  type IncomingUpdate,
} from "@/lib/telegram"
import { matchByRules } from "@/lib/categorize"
import { classifyNote } from "@/lib/categorize-model"
import { toAccount } from "@/lib/supabase/mappers"
import type { Database } from "@/lib/database.types"
import type { Account } from "@/lib/finance-data"

/**
 * Webhook del bot de Telegram. Registra gastos, y nada más.
 *
 * Tres cosas que explican la forma del archivo:
 *
 *  1. **Siempre contesta 200.** Telegram reintenta los updates que no reciben
 *     un 2xx, y un reintento volvería a registrar el mismo gasto. Los errores
 *     se le cuentan al usuario por mensaje, nunca por código de estado.
 *  2. **Escribe como vos, no como root.** Se autentica contra Supabase Auth con
 *     credenciales propias y llama al mismo `create_transaction` que la web, así
 *     que las RLS y el control de descubierto siguen aplicando. Con la service
 *     role key pasaría lo contrario: saltearía las RLS y `auth.uid()` quedaría
 *     en null, que es exactamente el `user_id` que el RPC necesita.
 *  3. **No guarda estado.** Cuando la cuenta es ambigua responde citando el
 *     mensaje original, y el tap del botón lo trae de vuelta (ver `telegram.ts`).
 */

/** Categoría de último recurso: `transactions.category` es NOT NULL. */
const FALLBACK_CATEGORY = "Otros"

/** Un access token de Supabase dura una hora; lo pedimos de nuevo un rato antes. */
const TOKEN_MARGIN_MS = 60_000

let cachedToken: { value: string; expiresAt: number } | null = null

function config() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowedChatId: process.env.TELEGRAM_ALLOWED_CHAT_ID,
    email: process.env.TELEGRAM_BOT_SUPABASE_EMAIL,
    password: process.env.TELEGRAM_BOT_SUPABASE_PASSWORD,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

async function callTelegram(method: string, payload: Record<string, unknown>) {
  const { botToken } = config()
  if (!botToken) return
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      console.error(`[telegram] ${method} respondió ${response.status}: ${await response.text()}`)
    }
  } catch (error) {
    // Que no podamos avisar no debería reintentar el registro del gasto.
    console.error(`[telegram] ${method} falló:`, error)
  }
}

function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return callTelegram("sendMessage", { chat_id: chatId, text, ...extra })
}

function editMessage(chatId: number, messageId: number, text: string) {
  // Sin `reply_markup` los botones desaparecen, que es la idea: una vez
  // elegida la cuenta, el teclado no debería poder volver a tocarse.
  return callTelegram("editMessageText", { chat_id: chatId, message_id: messageId, text })
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

/**
 * Cambia usuario y contraseña por un access token, y lo guarda mientras dure.
 *
 * Usamos el grant de password y no un refresh token guardado porque Supabase
 * rota los refresh tokens: el primero que usáramos invalidaría al siguiente, y
 * el bot quedaría afuera después de un mensaje.
 */
async function accessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_MARGIN_MS) {
    return cachedToken.value
  }

  const { supabaseUrl, supabaseKey, email, password } = config()
  if (!supabaseUrl || !supabaseKey || !email || !password) return null

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      console.error(`[telegram] login falló con ${response.status}`)
      return null
    }
    const data = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    return cachedToken.value
  } catch (error) {
    console.error("[telegram] login falló:", error)
    return null
  }
}

type Client = SupabaseClient<Database>

function clientFor(token: string): Client {
  const { supabaseUrl, supabaseKey } = config()
  return createClient<Database>(supabaseUrl!, supabaseKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    // No hay navegador ni sesión que persistir: el token lo manejamos nosotros.
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadAccounts(supabase: Client): Promise<Account[]> {
  const { data, error } = await supabase.from("account_balances").select("*").order("name")
  if (error) throw new Error(`no se pudieron leer las cuentas: ${error.message}`)
  return (data ?? []).map(toAccount)
}

async function loadExpenseCategories(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .eq("type", "expense")
    .order("name")
  if (error) throw new Error(`no se pudieron leer las categorías: ${error.message}`)
  return (data ?? []).map((row) => row.name)
}

async function readBalance(supabase: Client, accountId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("balance")
    .eq("id", accountId)
    .single()
  if (error || !data) return null
  return Number(data.balance ?? 0)
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

/** Las reglas primero, el modelo después, y "Otros" si ninguno se define. */
async function pickCategory(note: string, allowed: string[]): Promise<string> {
  if (allowed.length === 0) return FALLBACK_CATEGORY
  if (!note.trim()) return allowed.includes(FALLBACK_CATEGORY) ? FALLBACK_CATEGORY : allowed[0]

  const byRules = matchByRules(note, allowed)
  if (byRules) return byRules

  const { category } = await classifyNote(note, allowed, "expense")
  if (category) return category

  return allowed.includes(FALLBACK_CATEGORY) ? FALLBACK_CATEGORY : allowed[0]
}

async function register(
  supabase: Client,
  account: Account,
  amount: number,
  note: string
): Promise<string> {
  const category = await pickCategory(note, await loadExpenseCategories(supabase))

  const { error } = await supabase.rpc("create_transaction", {
    p_type: "expense",
    p_amount: amount,
    p_account_id: account.id,
    p_category: category,
    p_occurred_at: new Date().toISOString(),
    p_note: note || undefined,
  })

  if (error) {
    // Los mensajes del RPC ya vienen escritos en castellano y para leer
    // ("Saldo insuficiente en X: te faltan Y"), así que los pasamos tal cual.
    console.error("[telegram] create_transaction falló:", error.message)
    return `❌ No pude registrarlo.\n\n${error.message}`
  }

  const balance = await readBalance(supabase, account.id)
  return formatRegistered({
    amount,
    account,
    category,
    note,
    balance: balance ?? account.balance - amount,
  })
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

/** Monto y nota de cualquier parseo que haya llegado a leer el monto. */
function amountAndNote(parsed: ParseResult): { amount: number; note: string } | null {
  switch (parsed.status) {
    case "ok":
    case "no-account":
    case "ambiguous-account":
      return { amount: parsed.amount, note: parsed.note }
    default:
      return null
  }
}

/** El usuario tocó uno de los botones de cuenta. */
async function handleChoice(supabase: Client, incoming: IncomingUpdate, accounts: Account[]) {
  const { chatId, chosenAccountId, callbackQueryId, keyboardMessageId } = incoming

  // Primero le sacamos el reloj de arena al botón, después trabajamos.
  if (callbackQueryId) await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId })

  const account = accounts.find((a) => a.id === chosenAccountId)
  const draft = amountAndNote(parseExpenseMessage(incoming.text, accounts))

  if (!account || !draft) {
    const text = !account
      ? "❌ Esa cuenta ya no existe. Mandame el gasto de nuevo."
      : "❌ Se me perdió el monto del mensaje original. Mandámelo de nuevo."
    if (keyboardMessageId) await editMessage(chatId, keyboardMessageId, text)
    else await sendMessage(chatId, text)
    return
  }

  // Reemplazamos el teclado antes de escribir: si el registro tarda, que no
  // quede un botón tentando a un segundo tap que cargaría el gasto dos veces.
  if (keyboardMessageId) await editMessage(chatId, keyboardMessageId, "⏳ Registrando…")

  const result = await register(supabase, account, draft.amount, draft.note)
  if (keyboardMessageId) await editMessage(chatId, keyboardMessageId, result)
  else await sendMessage(chatId, result)
}

/** Llegó un mensaje de texto. */
async function handleText(supabase: Client, incoming: IncomingUpdate, accounts: Account[]) {
  const { chatId, replyToMessageId } = incoming
  const parsed = parseExpenseMessage(incoming.text, accounts)

  // Citamos el mensaje del usuario: es lo que después permite reconstruir el
  // gasto cuando toca un botón, sin guardar nada de nuestro lado.
  const quote = replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}

  switch (parsed.status) {
    case "empty":
    case "no-amount":
      await sendMessage(chatId, formatHelp(), quote)
      return

    case "invalid-amount":
      await sendMessage(chatId, `❌ No entiendo el monto “${parsed.raw}”.\n\n${formatHelp()}`, quote)
      return

    case "no-account":
      if (accounts.length === 0) {
        await sendMessage(chatId, "❌ No tenés ninguna cuenta cargada todavía.", quote)
        return
      }
      await sendMessage(chatId, "¿Con qué cuenta?", {
        ...quote,
        reply_markup: accountKeyboard(accounts),
      })
      return

    case "ambiguous-account":
      await sendMessage(chatId, "Hay más de una que encaja. ¿Cuál?", {
        ...quote,
        reply_markup: accountKeyboard(parsed.candidates),
      })
      return

    case "ok":
      await sendMessage(chatId, await register(supabase, parsed.account, parsed.amount, parsed.note), quote)
      return
  }
}

export async function POST(request: Request) {
  const { webhookSecret, allowedChatId } = config()

  // Telegram manda el secreto que le dimos en setWebhook. Sin esto la ruta es
  // un endpoint público que escribe en la base.
  if (!webhookSecret || request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return new Response("forbidden", { status: 403 })
  }

  // Tope grueso contra un bucle. Va por dirección, que acá es siempre la de
  // Telegram, así que no separa usuarios: sólo pone un techo al total.
  const limited = enforceRateLimit(request, "telegram", 60)
  if (limited) return limited

  const body = await request.json().catch(() => null)
  const incoming = readUpdate(body)
  if (!incoming) return new Response("ok")

  // El bot es de una sola persona. Cualquiera puede encontrarlo y escribirle;
  // sólo este chat puede tocar la base, y al resto no le contestamos nada.
  if (!allowedChatId || String(incoming.chatId) !== allowedChatId) {
    console.warn(`[telegram] mensaje ignorado del chat ${incoming.chatId}`)
    return new Response("ok")
  }

  try {
    const token = await accessToken()
    if (!token) {
      await sendMessage(incoming.chatId, "❌ No me puedo conectar a tu cuenta. Revisá la configuración del bot.")
      return new Response("ok")
    }

    // La primera lectura hace de prueba de vida del token: es previa a
    // cualquier escritura, así que si el cacheado quedó revocado o vencido
    // antes de tiempo podemos pedir uno nuevo sin riesgo de duplicar el gasto.
    let supabase = clientFor(token)
    let accounts: Account[]
    try {
      accounts = await loadAccounts(supabase)
    } catch (first) {
      cachedToken = null
      const fresh = await accessToken()
      if (!fresh) throw first
      supabase = clientFor(fresh)
      accounts = await loadAccounts(supabase)
    }

    if (incoming.chosenAccountId) await handleChoice(supabase, incoming, accounts)
    else await handleText(supabase, incoming, accounts)
  } catch (error) {
    console.error("[telegram] el update falló:", error)
    await sendMessage(incoming.chatId, "❌ Algo se rompió de mi lado. El gasto no quedó registrado.")
  }

  // Siempre 200: un reintento de Telegram registraría el gasto dos veces.
  return new Response("ok")
}
