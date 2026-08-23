// Exporta todos los datos de Firestore a JSON plano, para la migración a Supabase.
//
//   FIREBASE_SERVICE_ACCOUNT_PATH=.secrets/xxx.json node scripts/export-firestore.mjs
//
// `gcloud firestore export` escribe un formato binario propietario que no sirve
// para transformar, así que leemos con el Admin SDK. Es sólo lectura: no toca
// un solo documento.
//
// Salida en export/ (gitignoreado):
//   <uid>.<coleccion>.json   un archivo por colección
//   balances.csv             saldo actual de cada cuenta, para reconciliar
//   manifest.json            conteos por colección — la referencia para verificar
//                            que el import no perdió nada

import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const COLLECTIONS = [
  "accounts",
  "transactions",
  "categories",
  "watchlist",
  "stockTransactions",
  "stockPositions",
  "vehicles",
  "vehicleLogs",
  "dueItems",
  "fcmTokens",
  "settings",
]

const OUT_DIR = resolve(process.cwd(), "export")

function loadServiceAccount() {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (!path) {
    console.error("Falta FIREBASE_SERVICE_ACCOUNT_PATH (ruta al JSON de la service account).")
    process.exit(1)
  }
  const full = resolve(process.cwd(), path)
  if (!existsSync(full)) {
    console.error(`No encontré la service account en ${full}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(full, "utf8"))
}

/** Firestore devuelve Timestamps y refs; los normalizamos a algo serializable. */
function plain(value) {
  if (value === null || value === undefined) return null
  if (typeof value?.toDate === "function") return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]))
  }
  return value
}

const serviceAccount = loadServiceAccount()
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

mkdirSync(OUT_DIR, { recursive: true })

const manifest = { exportedAt: new Date().toISOString(), projectId: serviceAccount.project_id, users: {} }
const balanceRows = [["account_id", "user_id", "name", "currency", "balance"]]

const userRefs = await db.collection("users").listDocuments()
if (userRefs.length === 0) {
  console.warn("No hay documentos bajo /users. ¿Es el proyecto correcto?")
}

for (const userRef of userRefs) {
  const uid = userRef.id
  manifest.users[uid] = {}
  console.log(`\nusuario ${uid}`)

  for (const name of COLLECTIONS) {
    const snapshot = await userRef.collection(name).get()
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...plain(doc.data()) }))

    writeFileSync(`${OUT_DIR}/${uid}.${name}.json`, JSON.stringify(rows, null, 2))
    manifest.users[uid][name] = rows.length
    console.log(`  ${name.padEnd(20)} ${rows.length}`)

    if (name === "accounts") {
      for (const account of rows) {
        balanceRows.push([account.id, uid, account.name ?? "", account.currency ?? "", account.balance ?? 0])
      }
    }
  }
}

const csvCell = (value) => {
  const text = String(value ?? "")
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
writeFileSync(`${OUT_DIR}/balances.csv`, balanceRows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n")
writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2))

console.log(`\nListo. ${userRefs.length} usuario(s) en ${OUT_DIR}/`)
console.log("balances.csv es la referencia para reconciliar los saldos después del import.")
