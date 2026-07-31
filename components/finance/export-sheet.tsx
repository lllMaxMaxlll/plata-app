"use client"

import { useMemo, useState } from "react"
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { BottomSheet } from "./bottom-sheet"
import { toast } from "sonner"
import {
  getAvailableMonths,
  filterTransactionsByMonth,
  calculateMonthlySummary,
  exportToExcel,
  exportToPdf,
  exportToMarkdown,
} from "@/lib/export-utils"

interface ExportSheetProps {
  open: boolean
  onClose: () => void
}

export function ExportSheet({ open, onClose }: ExportSheetProps) {
  const { transactions, accounts, user, vehicles } = useFinance()

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions])

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (availableMonths.length > 0) {
      return `${availableMonths[0].year}-${availableMonths[0].month}`
    }
    const now = new Date()
    return `${now.getFullYear()}-${now.getMonth() + 1}`
  })

  const [exportingFormat, setExportingFormat] = useState<"excel" | "pdf" | "markdown" | null>(null)

  const selectedMonthObj = useMemo(() => {
    const [yStr, mStr] = selectedMonthKey.split("-")
    const year = parseInt(yStr, 10)
    const month = parseInt(mStr, 10)
    const found = availableMonths.find((m) => m.year === year && m.month === month)
    return found ?? { year, month, label: `Mes ${month}/${year}` }
  }, [selectedMonthKey, availableMonths])

  const monthTransactions = useMemo(() => {
    return filterTransactionsByMonth(transactions, selectedMonthObj.year, selectedMonthObj.month)
  }, [transactions, selectedMonthObj])

  const summary = useMemo(() => {
    return calculateMonthlySummary(monthTransactions, accounts)
  }, [monthTransactions, accounts])

  // Quick month pickers
  const handleSelectCurrentMonth = () => {
    const now = new Date()
    setSelectedMonthKey(`${now.getFullYear()}-${now.getMonth() + 1}`)
  }

  const handleSelectPreviousMonth = () => {
    const now = new Date()
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    setSelectedMonthKey(`${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`)
  }

  const handleExport = (format: "excel" | "pdf" | "markdown") => {
    try {
      setExportingFormat(format)

      const payload = {
        monthTransactions,
        accounts,
        year: selectedMonthObj.year,
        month: selectedMonthObj.month,
        userName: user?.name ?? "Usuario",
        vehicles,
      }

      if (format === "excel") {
        exportToExcel(payload)
        toast.success(`Reporte Excel de ${selectedMonthObj.label} descargado correctamente`)
      } else if (format === "pdf") {
        exportToPdf(payload)
        toast.success(`Reporte PDF de ${selectedMonthObj.label} descargado correctamente`)
      } else if (format === "markdown") {
        exportToMarkdown(payload)
        toast.success(`Reporte Markdown de ${selectedMonthObj.label} descargado correctamente`)
      }
    } catch (err) {
      console.error("Error al exportar:", err)
      toast.error("Ocurrió un error al generar el archivo de exportación")
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Exportar Movimientos Mensuales"
      description="Descargá tu reporte mensual de ingresos y gastos en Excel, PDF o Markdown."
    >
      <div className="flex flex-col gap-6 py-2">
        {/* 1. Month Selector & Quick Action Pills */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Seleccionar Mes y Año
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm font-semibold outline-none focus:border-primary cursor-pointer transition-colors shadow-sm"
              >
                {availableMonths.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </option>
                ))}
              </select>
              <CalendarIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 pointer-events-none text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectCurrentMonth}
                className="flex-1 sm:flex-none rounded-xl border border-border/50 bg-muted/40 hover:bg-muted px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                Este mes
              </button>
              <button
                type="button"
                onClick={handleSelectPreviousMonth}
                className="flex-1 sm:flex-none rounded-xl border border-border/50 bg-muted/40 hover:bg-muted px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                Mes pasado
              </button>
            </div>
          </div>
        </div>

        {/* 2. Month Preview Summary Card */}
        <div className="rounded-2xl border border-border/50 bg-card/45 p-4.5 shadow-inner">
          <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                {selectedMonthObj.label}
              </span>
            </div>
            <span className="rounded-lg bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {summary.count} {summary.count === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>

          {summary.count === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-2">
              No hay movimientos registrados en este mes. Se exportará la plantilla vacía.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Resumen ARS
                </p>
                <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <TrendingUp className="size-3 shrink-0" />
                  +${summary.totalIncomeARS.toLocaleString("es-AR")}
                </p>
                <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                  <TrendingDown className="size-3 shrink-0" />
                  -${summary.totalExpenseARS.toLocaleString("es-AR")}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Resumen USD
                </p>
                <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <TrendingUp className="size-3 shrink-0" />
                  +${summary.totalIncomeUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                  <TrendingDown className="size-3 shrink-0" />
                  -${summary.totalExpenseUSD.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. Export Format Options */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Formato de Exportación
          </label>

          <div className="flex flex-col gap-3">
            {/* Excel Option */}
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("excel")}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:bg-card hover:border-emerald-500/50 hover:shadow-md group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="size-6" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Excel (.xlsx)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Planilla de cálculo con resumen ejecutivo y tabla completa de datos.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground group-hover:text-emerald-500 transition-colors shrink-0 ml-2" />
            </button>

            {/* PDF Option */}
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("pdf")}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:bg-card hover:border-primary/50 hover:shadow-md group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                  <FileText className="size-6" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">PDF (.pdf)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Documento visual para imprimir con tarjetas de balance y gráfico.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
            </button>

            {/* Markdown Option */}
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("markdown")}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:bg-card hover:border-purple-500/50 hover:shadow-md group cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 group-hover:scale-105 transition-transform">
                  <FileCode className="size-6" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Markdown (.md)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Texto formateado en GFM para Notion, Obsidian o notas personales.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground group-hover:text-purple-500 transition-colors shrink-0 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
