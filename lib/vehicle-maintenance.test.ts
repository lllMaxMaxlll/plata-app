import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatVehicleDate, latestVehicleService, validateVehicleLogNumbers, vehicleDateValue } from './vehicle-maintenance.ts'
import { buildAgenda } from './agenda.ts'
import { vehicleExpenses } from './vehicle-expenses.ts'
import { NAV_GROUPS, ROUTES, activeTab, vehicleServiceHref } from './routes.ts'
import type { Account, Transaction, Vehicle, VehicleLog } from './finance-data.ts'

const vehicle: Vehicle = { id: 'moto', name: 'Moto', type: 'motorcycle', odometer: 10086, createdAt: '2026-01-01' }
const service: VehicleLog = { id: 'old', vehicleId: 'moto', type: 'service', date: '2026-07-11T00:00:00Z', odometer: 8417, amount: 0, nextServiceOdometer: 10417, nextServiceDate: '2026-09-30' }

test('calendar dates keep the written day, including UTC-midnight legacy records', () => {
  assert.equal(formatVehicleDate(service.date), '11/07/2026')
  assert.equal(formatVehicleDate(service.nextServiceDate!), '30/09/2026')
  assert.equal(vehicleDateValue('2026-02-30'), '')
  assert.equal(vehicleDateValue('garbage'), '')
})

test('one reminder combines km and date; parts do not clear it and a completed service replaces it', () => {
  const now = new Date(2026, 9, 31, 12)
  const part: VehicleLog = { ...service, id: 'purchase', date: '2026-09-23', type: 'part' }
  const original = buildAgenda({ dueItems: [], vehicles: [vehicle], vehicleLogs: [service, part], now })
  assert.equal(original.length, 1)
  assert.equal(original[0].urgency, 'overdue')
  assert.equal(original[0].daysUntil, -31)
  const done: VehicleLog = { ...service, id: 'new', date: '2026-10-31', odometer: 10086, nextServiceOdometer: undefined, nextServiceDate: undefined }
  assert.equal(latestVehicleService([service, done])?.id, 'new')
  assert.equal(buildAgenda({ dueItems: [], vehicles: [vehicle], vehicleLogs: [service, part, done], now }).length, 0)
  assert.equal(buildAgenda({ dueItems: [], vehicles: [vehicle], vehicleLogs: [{ ...done, nextServiceOdometer: 11000 }], now })[0].urgency, 'soon')
})

test('vehicle input rejects invalid odometers, negative expenses, invalid liters and past next-service km', () => {
  const input = { odometer: '10086', amount: '15,50', liters: '7,61', nextOdometer: '', type: 'fuel' }
  assert.equal(validateVehicleLogNumbers(input).amount, 15.5)
  assert.equal(validateVehicleLogNumbers(input).liters, 7.61)
  for (const odometer of ['', '-1', '1.5', 'Infinity', '2147483648']) assert.throws(() => validateVehicleLogNumbers({ ...input, odometer }))
  assert.throws(() => validateVehicleLogNumbers({ ...input, amount: '-1' }))
  assert.throws(() => validateVehicleLogNumbers({ ...input, liters: '0' }))
  assert.throws(() => validateVehicleLogNumbers({ ...input, type: 'service', nextOdometer: '10000' }))
  assert.equal(validateVehicleLogNumbers({ ...input, amount: '', type: 'service', nextOdometer: '12086' }).amount, 0)
})

test('vehicle expenses preserve USD and use the transaction currency even if its account is gone', () => {
  const logs = [{ ...service, amount: 1000, type: 'fuel' as const }, { ...service, id: 'usd', amount: 10, type: 'part' as const, transactionId: 'tx' }]
  const tx = [{ id: 'tx', currency: 'USD' }] as Transaction[]
  const totals = vehicleExpenses(logs, [] as Account[], tx, 1500)
  assert.deepEqual(totals.original, { ARS: 1000, USD: 10 })
  assert.equal(totals.totalARS, 16000)
  assert.equal(totals.byType.part, 15000)
  assert.equal(vehicleExpenses(logs, [], tx).totalARS, null)
})

test('mobile and desktop navigation expose every canonical route exactly once', () => {
  const keys = NAV_GROUPS.flatMap(g => [g.tab, ...g.children])
  assert.equal(new Set(keys).size, keys.length)
  assert.deepEqual([...keys].sort(), Object.keys(ROUTES).sort())
  for (const key of keys) assert.ok(activeTab(ROUTES[key].href))
  const url = new URL(vehicleServiceHref('moto / 2'), 'https://example.test')
  assert.equal(url.pathname, '/vehicles')
  assert.equal(url.searchParams.get('vehicle'), 'moto / 2')
  assert.equal(url.searchParams.get('action'), 'service')
})
