import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseExpenseMessage, MAX_AMOUNT } from "./expense-message.ts"
import { matchByRules } from "./categorize.ts"
import type { Account } from "./finance-data.ts"

const account = (id: string, name: string, kind: Account["kind"] = "bank"): Account => ({
  id,
  name,
  kind,
  currency: "ARS",
  balance: 0,
})

const accounts: Account[] = [
  account("gal", "Banco Galicia"),
  account("efe", "Efectivo", "cash"),
  account("mp", "Mercado Pago", "wallet"),
]

/** Atajo: parsea y exige que haya salido bien. */
function ok(text: string, list: Account[] = accounts) {
  const r = parseExpenseMessage(text, list)
  assert.equal(r.status, "ok", `esperaba ok y vino ${r.status}: ${JSON.stringify(r)}`)
  assert.ok(r.status === "ok")
  return r
}

describe("montos", () => {
  test("un número pelado", () => {
    assert.equal(ok("3500 galicia").amount, 3500)
  })

  test("el punto separa miles y la coma decimales", () => {
    assert.equal(ok("3.500 galicia").amount, 3500)
    assert.equal(ok("1.234.567 galicia").amount, 1234567)
    assert.equal(ok("3500,50 galicia").amount, 3500.5)
    assert.equal(ok("1.234,56 galicia").amount, 1234.56)
  })

  test("un punto con una o dos cifras finales es decimal", () => {
    assert.equal(ok("3500.50 galicia").amount, 3500.5)
    assert.equal(ok("3500.5 galicia").amount, 3500.5)
  })

  // Nadie escribe "1,500" para decir uno y medio: es un separador de miles
  // tipeado a la americana.
  test("coma con tres cifras se lee como miles", () => {
    assert.equal(ok("1,500 galicia").amount, 1500)
  })

  test("el signo pesos no molesta", () => {
    assert.equal(ok("$3.500 galicia").amount, 3500)
  })

  test("lucas, palos y k", () => {
    assert.equal(ok("30 lucas galicia").amount, 30_000)
    assert.equal(ok("30k galicia").amount, 30_000)
    assert.equal(ok("30 mil galicia").amount, 30_000)
    assert.equal(ok("1 palo galicia").amount, 1_000_000)
    assert.equal(ok("2 millones galicia").amount, 2_000_000)
  })

  test("el multiplicador se aplica sobre el decimal sin arrastrar error de coma flotante", () => {
    assert.equal(ok("1,5 palos galicia").amount, 1_500_000)
    assert.equal(ok("2,5 lucas galicia").amount, 2500)
  })

  test("dos multiplicadores seguidos no se componen", () => {
    const r = ok("1 palo lucas galicia")
    assert.equal(r.amount, 1_000_000)
    assert.equal(r.note, "lucas")
  })

  test("el monto puede venir después de la descripción", () => {
    const r = ok("carrefour galicia 3500")
    assert.equal(r.amount, 3500)
    assert.equal(r.note, "carrefour")
  })

  test("sin ningún número no hay gasto", () => {
    assert.equal(parseExpenseMessage("nafta galicia", accounts).status, "no-amount")
  })

  test("mensaje vacío", () => {
    assert.equal(parseExpenseMessage("   ", accounts).status, "empty")
  })

  test("cero y negativos no son gastos", () => {
    assert.equal(parseExpenseMessage("0 galicia", accounts).status, "invalid-amount")
    // El guión no forma parte del token numérico, así que "-5" no se lee como
    // monto: queda como texto y no hay número que registrar.
    assert.equal(parseExpenseMessage("-5 galicia", accounts).status, "no-amount")
  })

  // El tope es el de la columna numeric(14, 2): un dígito más no es un gasto
  // grande, es un error de Postgres.
  test("un monto que no entra en la columna se rechaza acá", () => {
    assert.equal(ok("999999999999 galicia").amount, 999_999_999_999)
    const pasado = `${Math.ceil(MAX_AMOUNT) + 1}`
    assert.equal(parseExpenseMessage(`${pasado} galicia`, accounts).status, "invalid-amount")
  })

  test("separadores mal puestos no pasan como monto válido", () => {
    // "3.50.000" no agrupa de a tres: preferimos rechazar antes que inventar.
    assert.equal(parseExpenseMessage("3.50.000 galicia", accounts).status, "invalid-amount")
  })

  test("un token que no pretende ser monto no se confunde con uno", () => {
    // "22" de "ruta 22" sí es un número y se toma; lo que no puede pasar es que
    // "24hs" o una coma suelta se lean como monto.
    assert.equal(parseExpenseMessage("peaje 24hs galicia", accounts).status, "no-amount")
    assert.equal(parseExpenseMessage("nafta , galicia", accounts).status, "no-amount")
  })

  test("un sufijo desconocido no es un multiplicador", () => {
    const r = ok("30 galicia xyz")
    assert.equal(r.amount, 30)
    assert.equal(r.note, "xyz")
    assert.equal(parseExpenseMessage("30xyz galicia", accounts).status, "no-amount")
  })
})

describe("cuentas", () => {
  test("por nombre completo", () => {
    assert.equal(ok("3500 banco galicia").account.id, "gal")
    assert.equal(ok("3500 mercado pago").account.id, "mp")
  })

  test("por una palabra del nombre", () => {
    assert.equal(ok("3500 galicia").account.id, "gal")
  })

  test("por sinónimo del tipo de cuenta", () => {
    assert.equal(ok("3500 efectivo").account.id, "efe")
    assert.equal(ok("3500 billetera").account.id, "mp")
  })

  // Sin esto, tener una cuenta llamada "Efectivo" haría que cualquier mención
  // de "banco" empatara con ella por el alias de kind.
  test("el nombre le gana al sinónimo de tipo", () => {
    const r = ok("3500 banco galicia")
    assert.equal(r.account.id, "gal")
  })

  test("una palabra parcial no alcanza", () => {
    assert.equal(parseExpenseMessage("3500 gal", accounts).status, "no-account")
  })

  test("sin mención de cuenta lo dice, y conserva monto y nota", () => {
    const r = parseExpenseMessage("3500 nafta ypf", accounts)
    assert.equal(r.status, "no-account")
    assert.ok(r.status === "no-account")
    assert.equal(r.amount, 3500)
    assert.equal(r.note, "nafta ypf")
  })

  test("si encaja con varias, pregunta en vez de adivinar", () => {
    const dobles = [account("ars", "Galicia ARS"), account("usd", "Galicia USD")]
    const r = parseExpenseMessage("3500 galicia", dobles)
    assert.equal(r.status, "ambiguous-account")
    assert.ok(r.status === "ambiguous-account")
    assert.deepEqual(
      r.candidates.map((c) => c.id),
      ["ars", "usd"]
    )
    assert.equal(r.amount, 3500)
  })

  test("un nombre exacto desempata contra el parcial", () => {
    const dobles = [account("ars", "Galicia"), account("usd", "Galicia USD")]
    assert.equal(ok("3500 galicia", dobles).account.id, "ars")
  })

  test("varias cuentas del mismo tipo son ambiguas por alias", () => {
    const dos = [account("a", "Caja chica", "cash"), account("b", "Billetera", "cash")]
    assert.equal(parseExpenseMessage("3500 efectivo", dos).status, "ambiguous-account")
  })

  test("sin cuentas cargadas no explota", () => {
    assert.equal(parseExpenseMessage("3500 lo que sea", []).status, "no-account")
  })
})

describe("nota", () => {
  test("es lo que queda después de sacar monto y cuenta", () => {
    assert.equal(ok("30 lucas super carrefour galicia").note, "super carrefour")
  })

  test("conserva acentos y mayúsculas del original", () => {
    assert.equal(ok("3500 Almacén Doña Rosa efectivo").note, "Almacén Doña Rosa")
  })

  test("puede quedar vacía", () => {
    assert.equal(ok("3500 galicia").note, "")
  })

  test("el multiplicador suelto no queda pegado en la nota", () => {
    assert.equal(ok("30 lucas galicia").note, "")
  })

  test("se recorta a lo que acepta la categorización", () => {
    const largo = "x".repeat(300)
    assert.ok(ok(`3500 ${largo} galicia`).note.length <= 140)
  })

  // La nota es lo que alimenta a matchByRules: si la cuenta se la come, se
  // pierde la señal del comercio.
  test("la nota conserva el comercio aunque comparta palabra con la cuenta", () => {
    const r = ok("3500 nafta ypf efectivo")
    assert.equal(r.note, "nafta ypf")
    assert.equal(r.account.id, "efe")
  })
})

describe("costura con la categorización", () => {
  const categorias = ["Comida", "Transporte", "Servicios", "Otros"]

  test("la nota que sale del parser alcanza para que las reglas categoricen", () => {
    assert.equal(matchByRules(ok("30 lucas super carrefour galicia").note, categorias), "Comida")
    assert.equal(matchByRules(ok("3500 nafta ypf efectivo").note, categorias), "Transporte")
    assert.equal(matchByRules(ok("12 lucas edersa mercado pago").note, categorias), "Servicios")
  })

  test("sin nota no hay nada que categorizar, y eso no es un error", () => {
    assert.equal(matchByRules(ok("3500 galicia").note, categorias), null)
  })
})
