/**
 * Lo que se puede razonar sin red del lado de Telegram: leer un update, armar
 * los botones y escribir los mensajes.
 *
 * Está separado de la ruta para poder testearlo: el webhook queda como
 * orquestación (verificar, autenticar, escribir en la base) y todo lo que tiene
 * una respuesta correcta y verificable vive acá.
 *
 * El bot no guarda estado entre mensajes, y no es por pereza: cuando hay que
 * preguntar por la cuenta, responde *citando* el mensaje original, así el tap
 * del botón trae de vuelta ese texto en `callback_query.message.reply_to_message`.
 * Con el parser siendo puro, volver a leerlo da exactamente el mismo monto y la
 * misma nota. Sin eso haría falta un KV para guardar borradores.
 */

// Import relativo y con extensión: `formatCurrency` se usa en runtime y el
// alias `@/` sólo lo resuelve el bundler, no el `node --test` de los tests.
import { formatCurrency, type Account } from "./finance-data.ts"

/** Prefijo del `callback_data` de los botones de cuenta. */
export const ACCOUNT_CALLBACK = "acct:"

/** Telegram rechaza un `callback_data` de más de 64 bytes. */
export const MAX_CALLBACK_BYTES = 64

export interface IncomingUpdate {
  chatId: number
  /** El texto del gasto: el mensaje del usuario, o el original si vino de un botón. */
  text: string
  /** Sólo en callbacks: la cuenta que eligió con el botón. */
  chosenAccountId?: string
  /** Sólo en callbacks: hay que contestarle a Telegram que recibimos el tap. */
  callbackQueryId?: string
  /** El mensaje del usuario, para responderle citándolo. */
  replyToMessageId?: number
  /** Sólo en callbacks: el mensaje con los botones, para reemplazarlo. */
  keyboardMessageId?: number
}

export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][]
}

/** Una fila de estos por cuenta: los nombres no entran de a dos en un teléfono. */
export function accountKeyboard(accounts: Account[]): InlineKeyboard {
  return {
    inline_keyboard: accounts
      .map((account) => ({
        text: `${account.name} · ${formatCurrency(account.balance, account.currency)}`,
        callback_data: `${ACCOUNT_CALLBACK}${account.id}`,
      }))
      // Un id demasiado largo no entra en el callback: mejor no ofrecer el
      // botón que ofrecer uno que Telegram va a rechazar al mandarlo.
      .filter((button) => new TextEncoder().encode(button.callback_data).length <= MAX_CALLBACK_BYTES)
      .map((button) => [button]),
  }
}

/**
 * Normaliza los dos tipos de update que nos interesan a una sola forma.
 *
 * Devuelve `null` para todo lo demás —fotos, stickers, ediciones, entradas al
 * canal—, que el webhook ignora sin decir nada.
 */
export function readUpdate(update: unknown): IncomingUpdate | null {
  const u = update as {
    message?: { text?: unknown; message_id?: unknown; chat?: { id?: unknown } }
    callback_query?: {
      id?: unknown
      data?: unknown
      message?: {
        message_id?: unknown
        chat?: { id?: unknown }
        reply_to_message?: { text?: unknown; message_id?: unknown }
      }
    }
  } | null

  const callback = u?.callback_query
  if (callback) {
    const chatId = callback.message?.chat?.id
    const data = callback.data
    const original = callback.message?.reply_to_message
    if (typeof chatId !== "number" || typeof data !== "string") return null
    if (!data.startsWith(ACCOUNT_CALLBACK)) return null
    // Sin el mensaje citado no podemos reconstruir el monto ni la nota. Pasa si
    // el usuario toca un botón de un mensaje viejo que Telegram ya no expande.
    if (typeof original?.text !== "string") return null

    return {
      chatId,
      text: original.text,
      chosenAccountId: data.slice(ACCOUNT_CALLBACK.length),
      callbackQueryId: typeof callback.id === "string" ? callback.id : undefined,
      replyToMessageId: typeof original.message_id === "number" ? original.message_id : undefined,
      keyboardMessageId:
        typeof callback.message?.message_id === "number" ? callback.message.message_id : undefined,
    }
  }

  const message = u?.message
  const chatId = message?.chat?.id
  if (typeof chatId !== "number" || typeof message?.text !== "string") return null
  if (!message.text.trim()) return null

  return {
    chatId,
    text: message.text,
    replyToMessageId: typeof message.message_id === "number" ? message.message_id : undefined,
  }
}

/**
 * La confirmación que pidió el usuario: qué se guardó y cómo quedó la cuenta.
 *
 * Texto plano a propósito. Los modos de formato de Telegram obligan a escapar
 * una docena de caracteres, y una nota con un guión o un punto rompería el
 * mensaje entero — que es justo el aviso de que todo salió bien.
 */
export function formatRegistered(params: {
  amount: number
  account: Account
  category: string
  note: string
  balance: number
}): string {
  const { amount, account, category, note, balance } = params
  return [
    "✅ Gasto registrado",
    "",
    `${formatCurrency(amount, account.currency)} · ${category}`,
    note ? `“${note}”` : null,
    `Cuenta: ${account.name}`,
    `Saldo: ${formatCurrency(balance, account.currency)}`,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

/** Qué contestar cuando el mensaje no se entiende. */
export function formatHelp(): string {
  return [
    "Mandame un gasto en una línea: monto, dónde y con qué cuenta.",
    "",
    "Por ejemplo:",
    "• 30 lucas super carrefour galicia",
    "• 3500 nafta ypf efectivo",
    "• $12.500,50 gas camuzzi mercado pago",
    "",
    "Entiendo lucas, palos y k. Si no me decís la cuenta, te pregunto.",
  ].join("\n")
}
