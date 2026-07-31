import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Transaction, Account, Vehicle } from "./finance-data"

export interface MonthOption {
  year: number
  month: number // 1-indexed (1 = Enero, 12 = Diciembre)
  label: string // e.g. "Julio 2026"
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

/**
 * Returns available months based on transactions, plus current month.
 * Sorted descending (newest first).
 */
export function getAvailableMonths(transactions: Transaction[]): MonthOption[] {
  const map = new Map<string, MonthOption>()

  // Always include current month
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed
  const currentKey = `${currentYear}-${currentMonth}`
  map.set(currentKey, {
    year: currentYear,
    month: currentMonth,
    label: `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`,
  })

  // Extract months from existing transactions
  for (const t of transactions) {
    if (!t.date) continue
    const d = new Date(t.date)
    if (isNaN(d.getTime())) continue
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${m}`
    if (!map.has(key)) {
      map.set(key, {
        year: y,
        month: m,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      })
    }
  }

  const list = Array.from(map.values())
  list.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })

  return list
}

/**
 * Filters transactions by month and year.
 * Sorted by date descending (newest first).
 */
export function filterTransactionsByMonth(
  transactions: Transaction[],
  year: number,
  month: number
): Transaction[] {
  return transactions
    .filter((t) => {
      if (!t.date) return false
      const d = new Date(t.date)
      if (isNaN(d.getTime())) return false
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export interface MonthlySummary {
  totalIncomeARS: number
  totalIncomeUSD: number
  totalExpenseARS: number
  totalExpenseUSD: number
  netARS: number
  netUSD: number
  count: number
}

/**
 * Calculates financial aggregates for a filtered list of transactions.
 */
export function calculateMonthlySummary(
  monthTransactions: Transaction[],
  accounts: Account[]
): MonthlySummary {
  const accountMap = new Map<string, Account>()
  for (const a of accounts) {
    accountMap.set(a.id, a)
  }

  let totalIncomeARS = 0
  let totalIncomeUSD = 0
  let totalExpenseARS = 0
  let totalExpenseUSD = 0

  for (const t of monthTransactions) {
    const acc = accountMap.get(t.accountId)
    const currency = acc?.currency ?? "ARS"

    if (t.type === "income") {
      if (currency === "USD") {
        totalIncomeUSD += t.amount
      } else {
        totalIncomeARS += t.amount
      }
    } else if (t.type === "expense") {
      if (currency === "USD") {
        totalExpenseUSD += t.amount
      } else {
        totalExpenseARS += t.amount
      }
    }
  }

  return {
    totalIncomeARS,
    totalIncomeUSD,
    totalExpenseARS,
    totalExpenseUSD,
    netARS: totalIncomeARS - totalExpenseARS,
    netUSD: totalIncomeUSD - totalExpenseUSD,
    count: monthTransactions.length,
  }
}

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function formatAmount(amount: number, currency: string, type: string): string {
  const sign = type === "income" ? "+" : type === "expense" ? "-" : ""
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(Math.abs(amount))
  return `${sign}$${formatted} ${currency}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * EXPORT TO EXCEL (.xlsx)
 */
export function exportToExcel({
  monthTransactions,
  accounts,
  year,
  month,
  userName = "Usuario",
  vehicles = [],
}: {
  monthTransactions: Transaction[]
  accounts: Account[]
  year: number
  month: number
  userName?: string
  vehicles?: Vehicle[]
}) {
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const summary = calculateMonthlySummary(monthTransactions, accounts)

  const accountMap = new Map<string, Account>()
  for (const a of accounts) accountMap.set(a.id, a)

  const vehicleMap = new Map<string, Vehicle>()
  for (const v of vehicles) vehicleMap.set(v.id, v)

  // Sheet 1: Detailed Transactions
  const rowsData = monthTransactions.map((t) => {
    const acc = accountMap.get(t.accountId)
    const toAcc = t.toAccountId ? accountMap.get(t.toAccountId) : undefined
    const currency = acc?.currency ?? "ARS"
    const veh = t.vehicleId ? vehicleMap.get(t.vehicleId) : undefined

    let typeLabel = "Gasto"
    if (t.type === "income") typeLabel = "Ingreso"
    if (t.type === "transfer") typeLabel = "Transferencia"

    return {
      Fecha: formatDate(t.date),
      Tipo: typeLabel,
      Categoría: t.category,
      "Cuenta Origen": acc ? `${acc.name} (${acc.currency})` : t.accountId,
      "Cuenta Destino": toAcc ? `${toAcc.name} (${toAcc.currency})` : "-",
      Monto: t.amount,
      Moneda: currency,
      "Tasa de Cambio": t.exchangeRate ? t.exchangeRate : "-",
      "Notas / Descripción": t.note || "-",
      "Vehículo Asociado": veh ? veh.name : "-",
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rowsData)

  // Adjust column widths for better readability
  worksheet["!cols"] = [
    { wch: 18 }, // Fecha
    { wch: 14 }, // Tipo
    { wch: 18 }, // Categoría
    { wch: 22 }, // Cuenta Origen
    { wch: 22 }, // Cuenta Destino
    { wch: 14 }, // Monto
    { wch: 10 }, // Moneda
    { wch: 14 }, // Tasa de Cambio
    { wch: 30 }, // Notas / Descripción
    { wch: 20 }, // Vehículo Asociado
  ]

  // Sheet 2: Summary
  const summaryData = [
    { Concepto: "Reporte Mensual", Valor: `PLATA - Movimientos ${monthLabel}` },
    { Concepto: "Usuario", Valor: userName },
    { Concepto: "Fecha de Emisión", Valor: new Date().toLocaleString("es-AR") },
    { Concepto: "Total Movimientos", Valor: summary.count },
    { Concepto: "---", Valor: "---" },
    { Concepto: "Total Ingresos ARS", Valor: summary.totalIncomeARS },
    { Concepto: "Total Gastos ARS", Valor: summary.totalExpenseARS },
    { Concepto: "Balance Neto ARS", Valor: summary.netARS },
    { Concepto: "---", Valor: "---" },
    { Concepto: "Total Ingresos USD", Valor: summary.totalIncomeUSD },
    { Concepto: "Total Gastos USD", Valor: summary.totalExpenseUSD },
    { Concepto: "Balance Neto USD", Valor: summary.netUSD },
  ]
  const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
  summaryWorksheet["!cols"] = [{ wch: 25 }, { wch: 35 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos")
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumen")

  // Generate buffer and trigger download
  const monthPadded = String(month).padStart(2, "0")
  const fileName = `plata_movimientos_${year}_${monthPadded}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * EXPORT TO PDF (.pdf)
 */
export function exportToPdf({
  monthTransactions,
  accounts,
  year,
  month,
  userName = "Usuario",
  vehicles = [],
}: {
  monthTransactions: Transaction[]
  accounts: Account[]
  year: number
  month: number
  userName?: string
  vehicles?: Vehicle[]
}) {
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const summary = calculateMonthlySummary(monthTransactions, accounts)

  const accountMap = new Map<string, Account>()
  for (const a of accounts) accountMap.set(a.id, a)

  const vehicleMap = new Map<string, Vehicle>()
  for (const v of vehicles) vehicleMap.set(v.id, v)

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  // Header Styling
  doc.setFillColor(15, 23, 42) // Dark background box for header
  doc.rect(0, 0, 210, 36, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.text("PLATA", 14, 18)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Reporte Mensual de Movimientos", 14, 25)

  doc.setFontSize(9)
  doc.setTextColor(200, 210, 225)
  doc.text(`Período: ${monthLabel}`, 196, 16, { align: "right" })
  doc.text(`Usuario: ${userName}`, 196, 22, { align: "right" })
  doc.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 196, 28, { align: "right" })

  // Financial Summary Cards Section
  let startY = 44
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Resumen Financiero del Mes", 14, startY)

  // Card 1: ARS Summary
  startY += 5
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, startY, 88, 28, 3, 3, "FD")

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(16, 185, 129) // Emerald
  doc.text("Resumen ARS", 18, startY + 7)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(71, 85, 105)
  doc.text(`Ingresos: +$${summary.totalIncomeARS.toLocaleString("es-AR")} ARS`, 18, startY + 13)
  doc.text(`Gastos: -$${summary.totalExpenseARS.toLocaleString("es-AR")} ARS`, 18, startY + 18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(summary.netARS >= 0 ? 16 : 225, summary.netARS >= 0 ? 185 : 29, summary.netARS >= 0 ? 129 : 72)
  doc.text(`Balance: $${summary.netARS.toLocaleString("es-AR")} ARS`, 18, startY + 24)

  // Card 2: USD Summary
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(108, startY, 88, 28, 3, 3, "FD")

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(59, 130, 246) // Blue
  doc.text("Resumen USD", 112, startY + 7)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(71, 85, 105)
  doc.text(`Ingresos: +$${summary.totalIncomeUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD`, 112, startY + 13)
  doc.text(`Gastos: -$${summary.totalExpenseUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD`, 112, startY + 18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(summary.netUSD >= 0 ? 59 : 225, summary.netUSD >= 0 ? 130 : 29, summary.netUSD >= 0 ? 246 : 72)
  doc.text(`Balance: $${summary.netUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD`, 112, startY + 24)

  // Movements Table
  startY += 36
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 41, 59)
  doc.text(`Detalle de Movimientos (${summary.count})`, 14, startY)

  const tableHead = [["Fecha", "Tipo", "Categoría", "Cuenta", "Monto", "Notas / Vehículo"]]

  const tableBody = monthTransactions.map((t) => {
    const acc = accountMap.get(t.accountId)
    const toAcc = t.toAccountId ? accountMap.get(t.toAccountId) : undefined
    const currency = acc?.currency ?? "ARS"
    const veh = t.vehicleId ? vehicleMap.get(t.vehicleId) : undefined

    let typeLabel = "Gasto"
    if (t.type === "income") typeLabel = "Ingreso"
    if (t.type === "transfer") typeLabel = "Transfer."

    const accountText = t.type === "transfer" && toAcc
      ? `${acc?.name ?? ""} → ${toAcc.name}`
      : acc?.name ?? t.accountId

    const amountFormatted = formatAmount(t.amount, currency, t.type)
    const noteText = [t.note, veh ? `[${veh.name}]` : null].filter(Boolean).join(" ") || "-"

    return [
      formatDate(t.date),
      typeLabel,
      t.category,
      accountText,
      amountFormatted,
      noteText,
    ]
  })

  autoTable(doc, {
    startY: startY + 4,
    head: tableHead,
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 28 }, // Fecha
      1: { cellWidth: 18 }, // Tipo
      2: { cellWidth: 28 }, // Categoría
      3: { cellWidth: 38 }, // Cuenta
      4: { cellWidth: 32, fontStyle: "bold" }, // Monto
      5: { cellWidth: 40 }, // Notas
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Highlight income/expense amounts
      if (data.section === "body" && data.column.index === 4) {
        const text = String(data.cell.raw)
        if (text.startsWith("+")) {
          data.cell.styles.textColor = [16, 185, 129] // Emerald green
        } else if (text.startsWith("-")) {
          data.cell.styles.textColor = [225, 29, 72] // Red
        }
      }
    },
  })

  const monthPadded = String(month).padStart(2, "0")
  const fileName = `plata_movimientos_${year}_${monthPadded}.pdf`
  doc.save(fileName)
}

/**
 * EXPORT TO MARKDOWN (.md)
 */
export function exportToMarkdown({
  monthTransactions,
  accounts,
  year,
  month,
  userName = "Usuario",
  vehicles = [],
}: {
  monthTransactions: Transaction[]
  accounts: Account[]
  year: number
  month: number
  userName?: string
  vehicles?: Vehicle[]
}) {
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const summary = calculateMonthlySummary(monthTransactions, accounts)

  const accountMap = new Map<string, Account>()
  for (const a of accounts) accountMap.set(a.id, a)

  const vehicleMap = new Map<string, Vehicle>()
  for (const v of vehicles) vehicleMap.set(v.id, v)

  let md = `# PLATA - Reporte Mensual de Movimientos\n\n`
  md += `- **Período:** ${monthLabel}\n`
  md += `- **Usuario:** ${userName}\n`
  md += `- **Fecha de generación:** ${new Date().toLocaleString("es-AR")}\n`
  md += `- **Total de Movimientos:** ${summary.count}\n\n`

  md += `--- \n\n`
  md += `## 📊 Resumen Financiero del Mes\n\n`
  md += `| Moneda | Total Ingresos | Total Gastos | Balance Neto |\n`
  md += `| :--- | :--- | :--- | :--- |\n`
  md += `| **ARS** | +$${summary.totalIncomeARS.toLocaleString("es-AR")} ARS | -$${summary.totalExpenseARS.toLocaleString("es-AR")} ARS | **$${summary.netARS.toLocaleString("es-AR")} ARS** |\n`
  md += `| **USD** | +$${summary.totalIncomeUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD | -$${summary.totalExpenseUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD | **$${summary.netUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })} USD** |\n\n`

  md += `--- \n\n`
  md += `## 📋 Detalle de Movimientos\n\n`
  md += `| Fecha | Tipo | Categoría | Cuenta Origen | Cuenta Destino | Monto | Notas / Vehículo |\n`
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`

  if (monthTransactions.length === 0) {
    md += `| - | - | - | - | - | - | Sin movimientos en el período |\n`
  } else {
    for (const t of monthTransactions) {
      const acc = accountMap.get(t.accountId)
      const toAcc = t.toAccountId ? accountMap.get(t.toAccountId) : undefined
      const currency = acc?.currency ?? "ARS"
      const veh = t.vehicleId ? vehicleMap.get(t.vehicleId) : undefined

      let typeLabel = "Gasto"
      if (t.type === "income") typeLabel = "Ingreso"
      if (t.type === "transfer") typeLabel = "Transferencia"

      const accountSrc = acc ? `${acc.name} (${acc.currency})` : t.accountId
      const accountDst = toAcc ? `${toAcc.name} (${toAcc.currency})` : "-"
      const amountText = formatAmount(t.amount, currency, t.type)
      const notesText = [t.note, veh ? `(Vehículo: ${veh.name})` : null].filter(Boolean).join(" ") || "-"

      md += `| ${formatDate(t.date)} | ${typeLabel} | ${t.category} | ${accountSrc} | ${accountDst} | **${amountText}** | ${notesText} |\n`
    }
  }

  md += `\n---\n*Reporte generado automáticamente por PLATA Finanzas Personales.*\n`

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
  const monthPadded = String(month).padStart(2, "0")
  const fileName = `plata_movimientos_${year}_${monthPadded}.md`
  triggerDownload(blob, fileName)
}
