/**
 * Montos escritos a mano en un input de texto.
 *
 * El teclado decimal del celular, con el idioma en castellano, trae coma y no
 * punto. El estado guarda el número con punto, que es lo que entiende
 * `parseFloat`, y el input lo muestra con coma, que es como se escribe acá.
 * Se aceptan los dos al tipear: un teclado de escritorio sigue mandando punto.
 */

/** Lo tipeado → texto canónico con punto decimal, listo para `parseFloat`. */
export function parseDecimalInput(raw: string, { allowNegative = false } = {}): string {
  const negative = allowNegative && raw.trim().startsWith("-")
  const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "")
  const dot = cleaned.indexOf(".")
  // Sólo el primer separador es decimal; los que siguen se descartan.
  const value = dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "")
  return negative ? `-${value}` : value
}

/** Texto canónico → lo que se muestra en el input. */
export function formatDecimalInput(value: string): string {
  return value.replace(".", ",")
}
