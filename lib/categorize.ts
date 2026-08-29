/**
 * Categorización automática de movimientos.
 *
 * Dos capas, en este orden:
 *
 *  1. Reglas locales (`matchByRules`). Determinísticas, instantáneas y gratis.
 *     Cubren los comercios que se repiten todo el tiempo — YPF, Carrefour,
 *     Edenor — y son además el plan B cuando Workers AI no está disponible o
 *     el usuario está offline (esto es una PWA).
 *  2. Workers AI, sólo para lo que las reglas no reconocen.
 *
 * Las dos capas terminan pasando por `resolveToAllowed`: la sugerencia siempre
 * tiene que ser una categoría que el usuario realmente tenga cargada. Nunca
 * inventamos categorías nuevas ni escribimos nada en la base — esto sólo
 * precarga el formulario, y la elección del usuario siempre gana.
 */

export type SuggestionSource = "rules" | "model"

export interface CategorySuggestion {
  category: string
  source: SuggestionSource
}

/** Sin acentos, sin mayúsculas y sin espacios de más: así comparamos todo. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Palabras clave → categoría canónica. La categoría es la de la lista por
 * defecto de la app; si el usuario la renombró o la borró, `resolveToAllowed`
 * descarta la regla y el caso pasa al modelo.
 *
 * Se comparan como palabras completas, no como substrings: "super" no debería
 * activarse dentro de "supervisión". Por eso todo va normalizado — minúscula y
 * sin acentos — y las marcas de más de una palabra se escriben separadas por un
 * espacio ("via bariloche"), que `matchByRules` resuelve como n-grama.
 *
 * Criterio para agregar: la palabra tiene que ser señal, no ruido. Si aparece
 * en frases que no son del rubro ("día", "claro", "personal", "máximo") hace
 * más daño que bien y va afuera; para esos casos ya está el modelo.
 *
 * Cada categoría tiene un bloque nacional y otro del Alto Valle / Patagonia
 * norte (Neuquén y Río Negro), que es donde vive el usuario de esta instancia.
 */
const RULES: { keywords: string[]; category: string }[] = [
  {
    category: "Comida",
    keywords: [
      // Cadenas y rubros de alcance nacional
      "super", "supermercado", "carrefour", "coto", "jumbo", "disco",
      "chango", "changomas", "walmart", "makro", "verduleria", "carniceria",
      "panaderia", "almacen", "kiosco", "kiosko", "fiambreria", "pescaderia",
      "mcdonalds", "burger", "starbucks", "cafe", "bar", "resto", "restaurante",
      "parrilla", "pizzeria", "empanadas", "heladeria", "delivery", "pedidosya",
      "rappi", "helado", "vinoteca", "almuerzo", "cena", "desayuno", "merienda",
      "havanna", "grido", "mostaza", "subway",

      // --- Neuquén / Río Negro ---
      // Supermercados: La Anónima es la cadena dominante en la Patagonia y la
      // Cooperativa Obrera tiene sucursales en todo el Alto Valle.
      "anonima", "cooperativa obrera", "supermercado vea",
      // Chocolaterías y casas de té de la zona andina (Bariloche, Villa La
      // Angostura, San Martín de los Andes).
      "mamuschka", "rapa nui", "abuela goye", "del turista", "fenoglio",
      // Cervecerías patagónicas.
      "blest", "berlina", "antares", "manush",
      // Bodegas del Alto Valle rionegrino.
      "canale", "schroeder", "fin del mundo", "malma", "saurus",
      // Chacras y fruta de la zona: la venta directa es habitual acá.
      "chacra", "frutihorticola", "galpon de empaque",
    ],
  },
  {
    category: "Transporte",
    keywords: [
      // Combustible y mantenimiento, de alcance nacional
      "ypf", "shell", "axion", "puma", "gnc", "nafta", "combustible", "surtidor",
      "estacion de servicio", "peaje", "sube", "subte", "colectivo", "bondi",
      "tren", "uber", "cabify", "didi", "taxi", "remis", "estacionamiento",
      "cochera", "vtv", "patente", "gomeria", "lubricentro", "service", "taller",
      "mecanico", "neumatico", "cubierta", "aceite",

      // --- Neuquén / Río Negro ---
      // Acá la Revisión Técnica Obligatoria se llama RTO, no VTV.
      "rto",
      // Empresas de larga y media distancia con base o mucha frecuencia en la
      // región.
      "via bariloche", "andesmar", "albus", "don otto", "taqsa", "pehuenche",
      // Aéreo: los tres aeropuertos que se usan desde el Alto Valle son
      // Neuquén (NQN), Bariloche (BRC) y Chapelco (CPC).
      "aerolineas", "flybondi", "jetsmart", "aeropuerto", "chapelco",
    ],
  },
  {
    category: "Servicios",
    keywords: [
      // Prestadoras de alcance nacional o de otras provincias
      "edenor", "edesur", "edea", "epec", "metrogas", "camuzzi", "naturgy",
      "aysa", "absa", "agua", "luz", "gas", "internet", "fibertel", "flow",
      "telecentro", "movistar", "tuenti", "celular",
      "telefono", "cable", "netflix", "spotify", "disney", "hbo",
      "youtube", "icloud", "dropbox", "chatgpt",
      "suscripcion", "abono", "expensas", "monotributo", "afip", "arba", "rentas",
      "municipal", "abl", "seguro", "prepaga", "osde", "swiss medical", "galeno",

      // --- Neuquén / Río Negro ---
      // Electricidad. EPEN es la provincial de Neuquén; CALF la cooperativa de
      // la capital; EDERSA la de Río Negro; CEB la de Bariloche.
      "epen", "calf", "edersa", "ceb", "cooperativa de electricidad",
      // Agua y saneamiento: EPAS en Neuquén, ARSA (Aguas Rionegrinas) en Río Negro.
      "epas", "arsa", "aguas rionegrinas",
      // Internet y telefonía regional.
      "neunet", "cotesma", "cablevision", "supercanal", "alta fibra",
      // Impuestos provinciales y municipales.
      "ingresos brutos", "inmobiliario", "tasa municipal", "agencia de recaudacion",
    ],
  },
  {
    category: "Alquiler",
    keywords: [
      "alquiler", "renta", "inmobiliaria", "garantia", "deposito locacion",
      // La zona es de alta rotación de alquileres por el movimiento de Vaca
      // Muerta: aparecen mucho como nota suelta.
      "contrato locacion", "garante",
    ],
  },
]

/** Índice invertido: palabra normalizada → categoría. Se arma una sola vez. */
const KEYWORD_INDEX: Map<string, string> = (() => {
  const index = new Map<string, string>()
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      // La primera regla que reclama una palabra se la queda: evita que un
      // duplicado accidental más abajo cambie el resultado en silencio.
      if (!index.has(keyword)) index.set(keyword, rule.category)
    }
  }
  return index
})()

/** Longitud en palabras de la clave más larga, para saber cuántos n-gramas mirar. */
const MAX_KEYWORD_WORDS = Math.max(...[...KEYWORD_INDEX.keys()].map((k) => k.split(" ").length))

/**
 * Devuelve la categoría de la primera palabra (o par de palabras) reconocida.
 * Recorre de n-gramas largos a cortos para que "estacion de servicio" gane
 * sobre "servicio" suelto.
 */
export function matchByRules(note: string, allowed: string[]): string | null {
  const words = normalizeText(note).split(" ").filter(Boolean)
  if (words.length === 0) return null

  for (let size = Math.min(MAX_KEYWORD_WORDS, words.length); size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      const candidate = KEYWORD_INDEX.get(words.slice(start, start + size).join(" "))
      if (!candidate) continue
      const resolved = resolveToAllowed(candidate, allowed)
      if (resolved) return resolved
    }
  }
  return null
}

/**
 * Baja una categoría propuesta a una que el usuario tenga cargada. Acepta
 * diferencias de mayúsculas y acentos, y tolera que el modelo devuelva algo
 * como `"Categoría: Comida"` o `Comida.`; si no hay match, devuelve null y no
 * sugerimos nada. Preferimos no sugerir antes que sugerir cualquier cosa.
 */
export function resolveToAllowed(raw: string, allowed: string[]): string | null {
  const cleaned = normalizeText(raw).replace(/^["'`\s]+|["'`.\s]+$/g, "")
  if (!cleaned) return null

  const exact = allowed.find((c) => normalizeText(c) === cleaned)
  if (exact) return exact

  // El modelo a veces adorna la respuesta. Nos quedamos con la categoría
  // permitida más larga que aparezca dentro del texto devuelto.
  const contained = allowed
    .filter((c) => cleaned.includes(normalizeText(c)))
    .sort((a, b) => b.length - a.length)[0]

  return contained ?? null
}

/** Tope de caracteres que le mandamos al modelo: una nota es una línea corta. */
export const MAX_NOTE_LENGTH = 140

/** Debajo de esto no hay señal suficiente ni para las reglas ni para el modelo. */
export const MIN_NOTE_LENGTH = 3

export function buildPrompt(
  note: string,
  allowed: string[],
  type: "income" | "expense"
): string {
  const kind = type === "income" ? "un ingreso" : "un gasto"
  return [
    `Clasificá ${kind} de finanzas personales de un usuario argentino.`,
    "",
    `Descripción: "${note.slice(0, MAX_NOTE_LENGTH)}"`,
    "",
    "Categorías disponibles:",
    ...allowed.map((c) => `- ${c}`),
    "",
    "Respondé únicamente con el nombre exacto de una categoría de la lista.",
    "Sin explicaciones, sin comillas, sin puntuación final.",
    "Si ninguna encaja con claridad, respondé exactamente: NINGUNA",
  ].join("\n")
}
