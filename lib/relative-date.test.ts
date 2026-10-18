import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { relativeDate } from "./relative-date.ts"

// 18 de octubre de 2026, 10:00 hora local.
const now = new Date(2026, 9, 18, 10, 0)

describe("relativeDate", () => {
  test("mismo día calendario es Hoy", () => {
    assert.equal(relativeDate("2026-10-18", now), "Hoy")
    assert.equal(relativeDate(new Date(2026, 9, 18, 0, 5).toISOString(), now), "Hoy")
  })

  test("anoche es Ayer aunque no hayan pasado 24 h", () => {
    assert.equal(relativeDate(new Date(2026, 9, 17, 23, 0).toISOString(), now), "Ayer")
  })

  test("dentro de la semana cuenta los días", () => {
    assert.equal(relativeDate("2026-10-15", now), "Hace 3 días")
  })

  test("del año en curso no muestra el año", () => {
    const label = relativeDate("2026-01-12", now)
    assert.match(label, /12/)
    assert.doesNotMatch(label, /2026/)
  })

  test("de otro año muestra el año", () => {
    assert.match(relativeDate("2025-01-12", now), /2025/)
  })

  test("una fecha futura no se presenta como Hoy", () => {
    assert.notEqual(relativeDate("2026-10-25", now), "Hoy")
  })
})
