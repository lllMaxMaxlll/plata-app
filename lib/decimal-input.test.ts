import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseDecimalInput, formatDecimalInput } from "./decimal-input.ts"

describe("parseDecimalInput", () => {
  test("la coma del teclado del celular es el decimal", () => {
    assert.equal(parseDecimalInput("1500,50"), "1500.50")
    assert.equal(parseDecimalInput("0,"), "0.")
  })

  test("el punto del teclado de escritorio también", () => {
    assert.equal(parseDecimalInput("1500.5"), "1500.5")
  })

  test("sólo cuenta el primer separador", () => {
    assert.equal(parseDecimalInput("1,5,0"), "1.50")
    assert.equal(parseDecimalInput("1.5,2"), "1.52")
  })

  test("descarta lo que no es número", () => {
    assert.equal(parseDecimalInput("$ 30a"), "30")
    assert.equal(parseDecimalInput("-40"), "40")
  })

  test("el signo menos sólo si se permite", () => {
    assert.equal(parseDecimalInput("-40,5", { allowNegative: true }), "-40.5")
    assert.equal(parseDecimalInput("4-0", { allowNegative: true }), "40")
  })
})

describe("formatDecimalInput", () => {
  test("muestra el decimal con coma", () => {
    assert.equal(formatDecimalInput("1500.50"), "1500,50")
    assert.equal(formatDecimalInput("1500"), "1500")
    assert.equal(formatDecimalInput(""), "")
  })

  test("ida y vuelta no cambia lo tipeado", () => {
    for (const typed of ["12,5", "0,", "300"]) {
      assert.equal(formatDecimalInput(parseDecimalInput(typed)), typed)
    }
  })
})
