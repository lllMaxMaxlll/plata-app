import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  readUpdate,
  accountKeyboard,
  formatRegistered,
  ACCOUNT_CALLBACK,
  MAX_CALLBACK_BYTES,
} from "./telegram.ts"
import type { Account } from "./finance-data.ts"

const account = (id: string, name: string, balance = 0): Account => ({
  id,
  name,
  balance,
  kind: "bank",
  currency: "ARS",
})

const textUpdate = (text: string, chatId = 42) => ({
  update_id: 1,
  message: { message_id: 7, chat: { id: chatId }, text },
})

const tapUpdate = (data: string, original: string | null, chatId = 42) => ({
  update_id: 2,
  callback_query: {
    id: "cb1",
    data,
    message: {
      message_id: 9,
      chat: { id: chatId },
      reply_to_message: original === null ? undefined : { message_id: 7, text: original },
    },
  },
})

describe("readUpdate", () => {
  test("un mensaje de texto", () => {
    const r = readUpdate(textUpdate("3500 nafta galicia"))
    assert.deepEqual(r, { chatId: 42, text: "3500 nafta galicia", replyToMessageId: 7 })
  })

  // Es la pieza que permite no guardar estado: el tap trae de vuelta el
  // mensaje original, y el parser puro lo relee igual que la primera vez.
  test("un tap recupera el texto original del mensaje citado", () => {
    const r = readUpdate(tapUpdate(`${ACCOUNT_CALLBACK}gal`, "3500 nafta galicia"))
    assert.equal(r?.text, "3500 nafta galicia")
    assert.equal(r?.chosenAccountId, "gal")
    assert.equal(r?.callbackQueryId, "cb1")
    assert.equal(r?.replyToMessageId, 7)
    assert.equal(r?.keyboardMessageId, 9)
  })

  test("un tap sin mensaje citado no se puede reconstruir", () => {
    assert.equal(readUpdate(tapUpdate(`${ACCOUNT_CALLBACK}gal`, null)), null)
  })

  test("un callback que no es nuestro se ignora", () => {
    assert.equal(readUpdate(tapUpdate("otracosa:1", "3500 galicia")), null)
  })

  test("lo que no es texto ni tap se ignora", () => {
    assert.equal(readUpdate({ update_id: 1, message: { chat: { id: 42 }, photo: [] } }), null)
    assert.equal(readUpdate({ update_id: 1, edited_message: { chat: { id: 42 }, text: "x" } }), null)
    assert.equal(readUpdate({}), null)
    assert.equal(readUpdate(null), null)
    assert.equal(readUpdate("no soy un update"), null)
  })

  test("un mensaje en blanco no es un gasto", () => {
    assert.equal(readUpdate(textUpdate("   ")), null)
  })

  // El chat id sale del update y el webhook lo compara contra la whitelist:
  // si se perdiera acá, cualquiera podría escribir en la base.
  test("siempre expone el chat de origen", () => {
    assert.equal(readUpdate(textUpdate("3500 galicia", 999))?.chatId, 999)
    assert.equal(readUpdate(tapUpdate(`${ACCOUNT_CALLBACK}g`, "3500", 999))?.chatId, 999)
  })
})

describe("accountKeyboard", () => {
  test("un botón por cuenta, con su saldo", () => {
    const kb = accountKeyboard([account("gal", "Banco Galicia", 1500), account("efe", "Efectivo")])
    assert.equal(kb.inline_keyboard.length, 2)
    assert.equal(kb.inline_keyboard[0][0].callback_data, `${ACCOUNT_CALLBACK}gal`)
    assert.match(kb.inline_keyboard[0][0].text, /Banco Galicia/)
    assert.match(kb.inline_keyboard[0][0].text, /1\.500/)
  })

  test("descarta la cuenta cuyo id no entra en el callback_data", () => {
    const largo = account("x".repeat(MAX_CALLBACK_BYTES), "Imposible")
    const kb = accountKeyboard([account("gal", "Galicia"), largo])
    assert.equal(kb.inline_keyboard.length, 1)
    assert.equal(kb.inline_keyboard[0][0].callback_data, `${ACCOUNT_CALLBACK}gal`)
  })

  test("un uuid normal entra sin problema", () => {
    const kb = accountKeyboard([account("6f9619ff-8b86-d011-b42d-00cf4fc964ff", "Galicia")])
    assert.equal(kb.inline_keyboard.length, 1)
  })
})

describe("formatRegistered", () => {
  const base = {
    amount: 30_000,
    account: account("gal", "Banco Galicia", 1_234_567),
    category: "Comida",
    note: "super carrefour",
    balance: 1_234_567,
  }

  test("dice qué guardó y cómo quedó la cuenta", () => {
    const msg = formatRegistered(base)
    assert.match(msg, /Gasto registrado/)
    assert.match(msg, /30\.000/)
    assert.match(msg, /Comida/)
    assert.match(msg, /super carrefour/)
    assert.match(msg, /Banco Galicia/)
    assert.match(msg, /1\.234\.567/)
  })

  test("sin nota no deja una línea vacía colgada", () => {
    const msg = formatRegistered({ ...base, note: "" })
    assert.ok(!msg.includes("\n\n\n"))
    assert.ok(!msg.includes("“”"))
  })

  // Texto plano justamente para que esto no rompa el mensaje.
  test("una nota con caracteres de markdown no se escapa ni se pierde", () => {
    const msg = formatRegistered({ ...base, note: "pago 50% *urgente* [ref-1]" })
    assert.match(msg, /pago 50% \*urgente\* \[ref-1\]/)
  })

  test("un saldo negativo se muestra como tal", () => {
    assert.match(formatRegistered({ ...base, balance: -500 }), /-ARS \$500/)
  })
})
