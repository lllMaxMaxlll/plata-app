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
} from "lucide-react"
import { useFinance } from "./finance-provider"
import { BottomSheet } from "./bottom-sheet"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
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
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Seleccionar Mes y Año
          </Label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="w-full appearance-none rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectCurrentMonth}
                className="flex-1 sm:flex-none text-xs font-semibold"
              >
                Este mes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectPreviousMonth}
                className="flex-1 sm:flex-none text-xs font-semibold"
              >
                Mes pasado
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Month Preview Summary Card */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
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
        </Card>

        {/* 3. Export Format Options */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Formato de Exportación
          </Label>

          <div className="flex flex-col gap-3">
            {/* Excel Option */}
            <Button
              type="button"
              variant="outline"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("excel")}
              className="flex h-auto items-center justify-between p-4 text-left font-normal border-input hover:border-emerald-500/50 hover:bg-emerald-500/5"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <FileSpreadsheet className="size-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Excel (.xlsx)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Planilla de cálculo con resumen ejecutivo y datos.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground shrink-0 ml-2" />
            </Button>

            {/* PDF Option */}
            <Button
              type="button"
              variant="outline"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("pdf")}
              className="flex h-auto items-center justify-between p-4 text-left font-normal border-input hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">PDF (.pdf)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Documento visual para imprimir con tarjetas y resumen.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground shrink-0 ml-2" />
            </Button>

            {/* Markdown Option */}
            <Button
              type="button"
              variant="outline"
              disabled={exportingFormat !== null}
              onClick={() => handleExport("markdown")}
              className="flex h-auto items-center justify-between p-4 text-left font-normal border-input hover:border-purple-500/50 hover:bg-purple-500/5"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <FileCode className="size-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Markdown (.md)</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Texto formateado en GFM para Notion, Obsidian o notas.
                  </p>
                </div>
              </div>
              <Download className="size-4 text-muted-foreground shrink-0 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
