// Transforma el export de Firestore en un único archivo SQL, atómico.
//
//   FIREBASE_UID=... SUPABASE_UID=... node scripts/transform-to-sql.mjs
//
// Escribe export/import.sql con todo dentro de un BEGIN/COMMIT: o entra todo o
// no entra nada. Los datos viajan como un literal JSON por tabla y Postgres los
// tipa con jsonb_to_recordset, así que no hay escapado de strings a mano.
//
// Antes de emitir nada valida la integridad referencial y los invariantes que el
// esquema va a exigir. Si algo no cierra, aborta sin escribir el archivo: es
// preferible fallar acá que a mitad de un import.

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const FIREBASE_UID = process.env.FIREBASE_UID
const SUPABASE_UID = process.env.SUPABASE_UID
if (!FIREBASE_UID || !SUPABASE_UID) {
  console.error("Faltan FIREBASE_UID y/o SUPABASE_UID")
  process.exit(1)
}

const DIR = resolve(process.cwd(), "export")
const read = (name) => JSON.parse(readFileSync(`${DIR}/${FIREBASE_UID}.${name}.json`, "utf8"))

const problems = []
const notes = []

const iso = (value, field, id) => {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    problems.push(`${field} inválido en ${id}: ${JSON.stringify(value)}`)
    return null
  }
  return date.toISOString()
}

const num = (value) => (value === null || value === undefined || value === "" ? null : Number(value))

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

const srcAccounts = read("accounts")
const srcTransactions = read("transactions")
const srcCategories = read("categories")
const srcVehicles = read("vehicles")
const srcVehicleLogs = read("vehicleLogs")
const srcDueItems = read("dueItems")
const srcStockTx = read("stockTransactions")
const srcWatchlist = read("watchlist")
const srcTokens = read("fcmTokens")
const srcSettings = read("settings")

const accountById = new Map(srcAccounts.map((a) => [a.id, a]))
const vehicleIds = new Set(srcVehicles.map((v) => v.id))

// ---------------------------------------------------------------------------
// Transformación
// ---------------------------------------------------------------------------

const KINDS = new Set(["bank", "wallet", "cash", "crypto", "savings"])
const accounts = srcAccounts.map((a) => {
  if (!KINDS.has(a.kind)) problems.push(`cuenta ${a.id} con kind desconocido: ${a.kind}`)
  if (!["ARS", "USD"].includes(a.currency)) problems.push(`cuenta ${a.id} con moneda desconocida: ${a.currency}`)
  return {
    id: a.id,
    user_id: SUPABASE_UID,
    name: String(a.name ?? "").trim() || "Sin nombre",
    currency: a.currency,
    kind: a.kind,
    initial_balance: 0, // se calcula después del import, a partir del saldo real
  }
})

// El saldo que muestra Firestore hoy: la referencia para reconciliar
const legacyBalances = srcAccounts.map((a) => ({ id: a.id, balance: Number(a.balance ?? 0) }))

const vehicles = srcVehicles.map((v) => ({
  id: v.id,
  user_id: SUPABASE_UID,
  name: String(v.name ?? "").trim() || "Sin nombre",
  type: v.type,
  brand: v.brand ?? null,
  model: v.model ?? null,
  year: v.year ?? null,
  plate: v.plate ?? null,
  odometer: Math.max(0, Math.round(num(v.odometer) ?? 0)),
  fuel_capacity: num(v.fuelCapacity),
  created_at: iso(v.createdAt, "createdAt", v.id) ?? new Date().toISOString(),
}))

let currencyResolved = 0
const transactions = srcTransactions.map((t) => {
  const account = accountById.get(t.accountId)

  // 145 de 188 movimientos no traen currency: se resuelve contra la cuenta
  // AHORA, porque después del import la FK con on delete set null podría dejar
  // el movimiento sin cuenta de la que deducirla.
  let currency = t.currency ?? account?.currency ?? null
  if (!t.currency && currency) currencyResolved++
  if (!currency) problems.push(`movimiento ${t.id}: no se puede determinar la moneda`)

  const amount = num(t.amount)
  if (!(amount > 0)) problems.push(`movimiento ${t.id}: monto no positivo (${t.amount})`)
  if (t.accountId && !account) problems.push(`movimiento ${t.id}: apunta a la cuenta inexistente ${t.accountId}`)
  if (t.toAccountId && !accountById.has(t.toAccountId)) {
    problems.push(`movimiento ${t.id}: cuenta destino inexistente ${t.toAccountId}`)
  }
  if (t.type === "transfer") {
    if (!t.toAccountId) problems.push(`transferencia ${t.id} sin cuenta destino`)
    if (t.toAccountId === t.accountId) problems.push(`transferencia ${t.id} con origen = destino`)
  }
  if (t.vehicleId && !vehicleIds.has(t.vehicleId)) {
    notes.push(`movimiento ${t.id}: vehicleId ${t.vehicleId} ya no existe, se importa sin vehículo`)
  }

  return {
    id: t.id,
    user_id: SUPABASE_UID,
    type: t.type,
    amount,
    account_id: account ? t.accountId : null,
    currency,
    to_account_id: t.toAccountId && accountById.has(t.toAccountId) ? t.toAccountId : null,
    to_amount: num(t.toAmount),
    exchange_rate: num(t.exchangeRate),
    category: t.category ?? "Otros",
    note: t.note ?? null,
    occurred_at: iso(t.date, "date", t.id) ?? new Date().toISOString(),
    receipt_name: t.receiptName ?? null,
    vehicle_id: t.vehicleId && vehicleIds.has(t.vehicleId) ? t.vehicleId : null,
  }
})

// El esquema tiene un índice único por (user_id, lower(name), type)
const seenCategory = new Set()
const categories = []
for (const c of srcCategories) {
  const key = `${String(c.name ?? "").trim().toLowerCase()}|${c.type}`
  if (seenCategory.has(key)) {
    notes.push(`categoría duplicada descartada: "${c.name}" (${c.type})`)
    continue
  }
  seenCategory.add(key)
  categories.push({
    id: c.id,
    user_id: SUPABASE_UID,
    name: String(c.name ?? "").trim(),
    type: c.type,
    color: c.color ?? "var(--chart-1)",
  })
}

const transactionIds = new Set(transactions.map((t) => t.id))
const vehicleLogs = srcVehicleLogs
  .filter((l) => {
    if (vehicleIds.has(l.vehicleId)) return true
    notes.push(`registro de vehículo ${l.id} descartado: su vehículo ${l.vehicleId} no existe`)
    return false
  })
  .map((l) => {
    if (l.transactionId && !transactionIds.has(l.transactionId)) {
      notes.push(`registro ${l.id}: transactionId colgado (${l.transactionId}), se importa desvinculado`)
    }
    return {
      id: l.id,
      user_id: SUPABASE_UID,
      vehicle_id: l.vehicleId,
      type: l.type,
      occurred_at: iso(l.date, "date", l.id) ?? new Date().toISOString(),
      odometer: Math.max(0, Math.round(num(l.odometer) ?? 0)),
      amount: Math.max(0, num(l.amount) ?? 0),
      note: l.note ?? null,
      account_id: l.accountId && accountById.has(l.accountId) ? l.accountId : null,
      transaction_id: l.transactionId && transactionIds.has(l.transactionId) ? l.transactionId : null,
      liters: num(l.liters),
      gas_station: l.gasStation ?? null,
      price_per_liter: num(l.pricePerLiter),
      is_full_tank: l.isFullTank ?? null,
      service_type: l.serviceType ?? null,
      provider: l.provider ?? null,
      next_service_odometer: l.nextServiceOdometer ?? null,
      next_service_date: l.nextServiceDate ?? null,
      item_name: l.itemName ?? null,
    }
  })

const dueItems = srcDueItems.map((d) => ({
  id: d.id,
  user_id: SUPABASE_UID,
  title: String(d.title ?? "").trim() || "Sin título",
  category: d.category ?? "Otros",
  amount: Math.max(0, num(d.amount) ?? 0),
  currency: d.currency ?? "ARS",
  due_date: d.dueDate,
  frequency: d.frequency ?? "one_time",
  reminder_days_before: Math.min(60, Math.max(0, num(d.reminderDaysBefore) ?? 3)),
  status: d.status ?? "pending",
  auto_renew: Boolean(d.autoRenew),
  account_id: d.accountId && accountById.has(d.accountId) ? d.accountId : null,
  paid_at: d.paidAt ? iso(d.paidAt, "paidAt", d.id) : null,
  created_at: iso(d.createdAt, "createdAt", d.id) ?? new Date().toISOString(),
  updated_at: d.updatedAt ? iso(d.updatedAt, "updatedAt", d.id) : null,
}))

const stockTrades = srcStockTx.map((s) => {
  const shares = num(s.shares)
  const price = num(s.price)
  if (!(shares > 0)) problems.push(`operación ${s.id}: shares no positivo (${s.shares})`)
  if (!(price > 0)) problems.push(`operación ${s.id}: precio no positivo (${s.price})`)
  return {
    id: s.id,
    user_id: SUPABASE_UID,
    symbol: String(s.symbol ?? "").toUpperCase(),
    side: s.type,
    shares,
    price,
    occurred_at: iso(s.date, "date", s.id) ?? new Date().toISOString(),
    account_id: s.accountId && accountById.has(s.accountId) ? s.accountId : null,
  }
})

const watchlist = srcWatchlist.map((w) => ({
  user_id: SUPABASE_UID,
  symbol: String(w.symbol ?? w.id ?? "").toUpperCase(),
  name: w.name ?? w.symbol ?? "",
  added_at: iso(w.addedAt, "addedAt", w.id) ?? new Date().toISOString(),
}))

const pushTokens = srcTokens.map((t) => ({
  token: t.token ?? t.id,
  user_id: SUPABASE_UID,
  user_agent: t.userAgent ?? null,
  updated_at: iso(t.updatedAt, "updatedAt", t.id) ?? new Date().toISOString(),
}))

const macro = srcSettings.find((s) => s.id === "macro")
const userSettings = macro
  ? [{
      user_id: SUPABASE_UID,
      exchange_rate: num(macro.exchangeRate) ?? 1250,
      annual_inflation: num(macro.annualInflation) ?? 45,
      annual_devaluation: num(macro.annualDevaluation) ?? 40,
      annual_return: num(macro.annualReturn) ?? 12,
      rates: macro.rates ?? null,
      updated_at: iso(macro.lastUpdated, "lastUpdated", "macro") ?? new Date().toISOString(),
    }]
  : []

// ---------------------------------------------------------------------------
// Informe y corte
// ---------------------------------------------------------------------------

const summary = {
  accounts: accounts.length,
  transactions: transactions.length,
  categories: categories.length,
  vehicles: vehicles.length,
  vehicle_logs: vehicleLogs.length,
  due_items: dueItems.length,
  stock_trades: stockTrades.length,
  watchlist: watchlist.length,
  push_tokens: pushTokens.length,
  user_settings: userSettings.length,
}

console.log("FILAS A IMPORTAR")
for (const [table, count] of Object.entries(summary)) console.log(`  ${table.padEnd(16)} ${count}`)
console.log(`\n  moneda resuelta contra la cuenta en ${currencyResolved} movimientos`)

if (notes.length) {
  console.log("\nAVISOS (no bloquean)")
  for (const note of notes) console.log(`  · ${note}`)
}

if (problems.length) {
  console.error(`\nPROBLEMAS (${problems.length}) — no se escribe el SQL:`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const json = (rows) => `$json$${JSON.stringify(rows)}$json$::jsonb`

const insert = (table, columns, rows) => {
  if (rows.length === 0) return `-- ${table}: sin filas\n`
  const cols = columns.map(([name]) => name).join(", ")
  const record = columns.map(([name, type]) => `${name} ${type}`).join(", ")
  return `insert into public.${table} (${cols})\nselect ${cols}\nfrom jsonb_to_recordset(${json(rows)}) as x(${record});\n\n`
}

let sql = `-- Import de Firestore a Postgres, generado por scripts/transform-to-sql.mjs
-- Firebase uid : ${FIREBASE_UID}
-- Supabase uid : ${SUPABASE_UID}
-- Generado     : ${new Date().toISOString()}
--
-- Todo en una transacción: si algo falla, no queda nada a medias.

begin;

`

sql += insert("accounts", [
  ["id", "text"], ["user_id", "uuid"], ["name", "text"],
  ["currency", "public.currency"], ["kind", "public.account_kind"],
  ["initial_balance", "numeric"],
], accounts)

sql += insert("vehicles", [
  ["id", "text"], ["user_id", "uuid"], ["name", "text"], ["type", "public.vehicle_type"],
  ["brand", "text"], ["model", "text"], ["year", "smallint"], ["plate", "text"],
  ["odometer", "integer"], ["fuel_capacity", "numeric"], ["created_at", "timestamptz"],
], vehicles)

sql += insert("transactions", [
  ["id", "text"], ["user_id", "uuid"], ["type", "public.transaction_type"], ["amount", "numeric"],
  ["account_id", "text"], ["currency", "public.currency"], ["to_account_id", "text"],
  ["to_amount", "numeric"], ["exchange_rate", "numeric"], ["category", "text"], ["note", "text"],
  ["occurred_at", "timestamptz"], ["receipt_name", "text"], ["vehicle_id", "text"],
], transactions)

sql += insert("categories", [
  ["id", "text"], ["user_id", "uuid"], ["name", "text"],
  ["type", "public.category_type"], ["color", "text"],
], categories)

sql += insert("vehicle_logs", [
  ["id", "text"], ["user_id", "uuid"], ["vehicle_id", "text"], ["type", "public.vehicle_log_type"],
  ["occurred_at", "timestamptz"], ["odometer", "integer"], ["amount", "numeric"], ["note", "text"],
  ["account_id", "text"], ["transaction_id", "text"], ["liters", "numeric"], ["gas_station", "text"],
  ["price_per_liter", "numeric"], ["is_full_tank", "boolean"], ["service_type", "text"],
  ["provider", "text"], ["next_service_odometer", "integer"], ["next_service_date", "date"],
  ["item_name", "text"],
], vehicleLogs)

sql += insert("due_items", [
  ["id", "text"], ["user_id", "uuid"], ["title", "text"], ["category", "text"], ["amount", "numeric"],
  ["currency", "public.currency"], ["due_date", "date"], ["frequency", "public.due_frequency"],
  ["reminder_days_before", "smallint"], ["status", "public.due_status"], ["auto_renew", "boolean"],
  ["account_id", "text"], ["paid_at", "timestamptz"], ["created_at", "timestamptz"],
  ["updated_at", "timestamptz"],
], dueItems)

sql += insert("stock_trades", [
  ["id", "text"], ["user_id", "uuid"], ["symbol", "text"], ["side", "public.trade_side"],
  ["shares", "numeric"], ["price", "numeric"], ["occurred_at", "timestamptz"], ["account_id", "text"],
], stockTrades)

sql += insert("watchlist", [
  ["user_id", "uuid"], ["symbol", "text"], ["name", "text"], ["added_at", "timestamptz"],
], watchlist)

sql += insert("user_settings", [
  ["user_id", "uuid"], ["exchange_rate", "numeric"], ["annual_inflation", "numeric"],
  ["annual_devaluation", "numeric"], ["annual_return", "numeric"], ["rates", "jsonb"],
  ["updated_at", "timestamptz"],
], userSettings)

sql += insert("push_tokens", [
  ["token", "text"], ["user_id", "uuid"], ["user_agent", "text"], ["updated_at", "timestamptz"],
], pushTokens)

sql += `-- ---------------------------------------------------------------------------
-- initial_balance: el saldo de arranque que hace que el saldo derivado dé
-- exactamente el mismo número que muestra Firestore hoy.
--
--   initial_balance = saldo_firestore - suma_de_los_movimientos_importados
--
-- Como las cuentas entraron con initial_balance = 0, account_balances.balance
-- es en este momento justamente esa suma.
-- ---------------------------------------------------------------------------

update public.accounts a
   set initial_balance = l.balance - b.balance
  from (values
${legacyBalances.map((l) => `    ('${l.id}', ${l.balance})`).join(",\n")}
       ) as l(id, balance)
  join public.account_balances b on b.id = l.id
 where a.id = l.id;

-- Verificación: si esto encuentra una diferencia, aborta y no commitea nada.
do $$
declare
  diferencias int;
begin
  select count(*) into diferencias
    from (values
${legacyBalances.map((l) => `      ('${l.id}', ${l.balance}::numeric)`).join(",\n")}
         ) as l(id, balance)
    join public.account_balances b on b.id = l.id
   where b.balance is distinct from l.balance;

  if diferencias > 0 then
    raise exception 'RECONCILIACIÓN FALLIDA: % cuenta(s) con saldo distinto al de Firestore', diferencias;
  end if;
  raise notice 'Reconciliación OK: los % saldos coinciden al centavo', ${legacyBalances.length};
end $$;

commit;
`

writeFileSync(`${DIR}/import.sql`, sql)
console.log(`\nSQL escrito en export/import.sql (${(sql.length / 1024).toFixed(1)} KB)`)
console.log("Incluye la reconciliación: si un saldo no coincide, la transacción aborta sola.")
