import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { isQuestion, extractRelativeDay, extractCurrency, dateForDaysAgo } from "./anotar.ts"

describe("isQuestion", () => {
  test("las palabras interrogativas abren una búsqueda", () => {
    assert.equal(isQuestion("cuánto gasté en el auto el verano pasado"), true)
    assert.equal(isQuestion("Cuanto en nafta este mes"), true)
    assert.equal(isQuestion("qué pagué de luz"), true)
    assert.equal(isQuestion("en qué se me fue la plata"), true)
    assert.equal(isQuestion("mostrame el super de marzo"), true)
  })

  test("los signos de pregunta alcanzan", () => {
    assert.equal(isQuestion("¿nafta de enero"), true)
    assert.equal(isQuestion("nafta de enero?"), true)
  })

  test("un gasto no es una pregunta", () => {
    assert.equal(isQuestion("30 lucas super carrefour galicia"), false)
    assert.equal(isQuestion("nafta 52k mp"), false)
    // "queso" empieza como "que" pero no es la palabra.
    assert.equal(isQuestion("queso 3000 coto"), false)
    assert.equal(isQuestion("   "), false)
  })
})

describe("extractRelativeDay", () => {
  test("saca ayer del texto y no lo deja en la nota", () => {
    assert.deepEqual(extractRelativeDay("nafta 52k mp ayer"), {
      text: "nafta 52k mp",
      daysAgo: 1,
      explicit: true,
    })
  })

  test("entiende anteayer en sus variantes", () => {
    assert.equal(extractRelativeDay("anteayer café 4500").daysAgo, 2)
    assert.equal(extractRelativeDay("café 4500 antes de ayer").daysAgo, 2)
    assert.equal(extractRelativeDay("café 4500 antes de ayer").text, "café 4500")
  })

  test("acepta mayúsculas y conserva el resto como vino", () => {
    assert.deepEqual(extractRelativeDay("AYER Súper 30k"), { text: "Súper 30k", daysAgo: 1, explicit: true })
  })

  test("sin palabra de día es hoy, implícito", () => {
    assert.deepEqual(extractRelativeDay("30 lucas super"), { text: "30 lucas super", daysAgo: 0, explicit: false })
  })

  test("no confunde palabras que contienen el día", () => {
    assert.equal(extractRelativeDay("hoyo 3000").daysAgo, 0)
  })
})

describe("dateForDaysAgo", () => {
  const now = new Date(2026, 9, 18, 10, 41)

  test("hoy es el momento actual", () => {
    assert.equal(dateForDaysAgo(0, now).getTime(), now.getTime())
  })

  test("ayer es el mediodía del día anterior", () => {
    const date = dateForDaysAgo(1, now)
    assert.equal(date.getDate(), 17)
    assert.equal(date.getHours(), 12)
  })

  test("cruza el cambio de mes", () => {
    const date = dateForDaysAgo(2, new Date(2026, 10, 1, 9, 0))
    assert.equal(date.getMonth(), 9)
    assert.equal(date.getDate(), 30)
  })
})

describe("extractCurrency", () => {
  test("saca la palabra de dólares y avisa la moneda", () => {
    assert.deepEqual(extractCurrency("50 usd netflix"), { text: "50 netflix", currency: "USD" })
    assert.deepEqual(extractCurrency("hotel 200 Dólares"), { text: "hotel 200", currency: "USD" })
    assert.equal(extractCurrency("u$s 30 spotify").currency, "USD")
  })

  test("sin palabra de moneda no dice nada", () => {
    assert.deepEqual(extractCurrency("30 lucas super"), { text: "30 lucas super", currency: null })
    // "dolarizar" no es la palabra.
    assert.equal(extractCurrency("dolarizar 100").currency, null)
  })
})
