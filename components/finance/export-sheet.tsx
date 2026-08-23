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
  FileCheck,
} from "lucide-react"
import { useFinance } from "./finance-provider"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  getAvailableMonths,
  filterTransactionsByMonth,
  calculateMonthlySummary,
  exportToExcel,
  exportToPdf,
  exportToMarkdown,
} from "@/lib/export-utils"

export type ExportFormat = "excel" | "pdf" | "markdown"

export function ExportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { transactions, accounts, user } = useFinance()
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  // Calculate available months with data
  const availableMonths = useMemo(() => {
    return getAvailableMonths(transactions)
  }, [transactions])

  // Current selected month state
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${now.getMonth() + 1}`
  })

  // Selected month metadata
  const selectedMonthObj = useMemo(() => {
    const found = availableMonths.find((m) => `${m.year}-${m.month}` === selectedMonthKey)
    if (found) return found
    const now = new Date()
    const monthNames = [
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
    const m1 = now.getMonth() + 1
    return {
      year: now.getFullYear(),
      month: m1,
      label: `${monthNames[m1 - 1]} ${now.getFullYear()}`,
    }
  }, [availableMonths, selectedMonthKey])

  // Monthly filtered data and metrics
  const monthlyTransactions = useMemo(() => {
    return filterTransactionsByMonth(transactions, selectedMonthObj.year, selectedMonthObj.month)
  }, [transactions, selectedMonthObj])

  const summary = useMemo(() => {
    return calculateMonthlySummary(monthlyTransactions, accounts)
  }, [monthlyTransactions, accounts])

  // Shortcuts
  const handleSelectCurrentMonth = () => {
    const now = new Date()
    setSelectedMonthKey(`${now.getFullYear()}-${now.getMonth() + 1}`)
  }

  const handleSelectPreviousMonth = () => {
    const now = new Date()
    let y = now.getFullYear()
    let m = now.getMonth() // 0-indexed month before current
    if (m === 0) {
      m = 12
      y -= 1
    }
    setSelectedMonthKey(`${y}-${m}`)
  }

  // Trigger export
  const handleExport = async (formatType: ExportFormat) => {
    setExportingFormat(formatType)
    try {
      const payload = {
        monthTransactions: monthlyTransactions,
        accounts,
        year: selectedMonthObj.year,
        month: selectedMonthObj.month,
        userName: user?.name || "Usuario",
      }

      if (formatType === "excel") {
        exportToExcel(payload)
        toast.success(`Reporte Excel de ${selectedMonthObj.label} descargado correctamente`)
      } else if (formatType === "pdf") {
        exportToPdf(payload)
        toast.success(`Reporte PDF de ${selectedMonthObj.label} descargado correctamente`)
      } else if (formatType === "markdown") {
        exportToMarkdown(payload)
        toast.success(`Reporte Markdown de ${selectedMonthObj.label} descargado correctamente`)
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
    } catch (err) {
      console.error("Error al exportar:", err)
      toast.error("Ocurrió un error al generar el archivo de exportación")
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(isOpen) => !isOpen && !exportingFormat && onClose()}>
      <ResponsiveDialogContent className="w-full sm:max-w-xl max-w-[calc(100vw-2rem)] h-auto max-h-[90vh] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-y-auto overflow-x-hidden transition-all duration-200">
        <ResponsiveDialogHeader className="text-left pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Download className="size-5" />
            </span>
            <div>
              <ResponsiveDialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                Exportar Movimientos Mensuales
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="text-xs text-muted-foreground">
                Descargá tu reporte mensual de ingresos y gastos en Excel, PDF o Markdown.
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>

        <div className={cn("mt-2 flex min-w-0 flex-col gap-5 transition-all duration-200", exportingFormat !== null && "pointer-events-none opacity-50 cursor-not-allowed select-none")}>
          {/* 1. Month Selector & Quick Action Pills */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mes a Exportar
            </Label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <Select value={selectedMonthKey} onValueChange={(v) => v && setSelectedMonthKey(v)}>
                  <SelectTrigger className="w-full rounded-xl border-border bg-card/60">
                    <SelectValue>{selectedMonthObj.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectCurrentMonth}
                  className="flex-1 sm:flex-none text-xs font-semibold rounded-xl h-10 border-border/60 bg-card/60 cursor-pointer"
                >
                  Este mes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectPreviousMonth}
                  className="flex-1 sm:flex-none text-xs font-semibold rounded-xl h-10 border-border/60 bg-card/60 cursor-pointer"
                >
                  Mes pasado
                </Button>
              </div>
            </div>
          </div>

          {/* 2. Month Preview Summary Card */}
          <Card className="p-4 shadow-sm border-border/60 bg-card/60 rounded-2xl min-w-0">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex size-2 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground truncate">
                  {selectedMonthObj.label}
                </span>
              </div>
              <span className="rounded-lg bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0 border border-border/40">
                {summary.count} {summary.count === 1 ? "movimiento" : "movimientos"}
              </span>
            </div>

            {summary.count === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-2">
                No hay movimientos registrados en este mes. Se exportará la plantilla vacía.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 min-w-0">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                    Resumen ARS
                  </p>
                  <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <TrendingUp className="size-3 shrink-0" />
                    +${summary.totalIncomeARS.toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-rose-500 font-semibold flex items-center gap-1 mt-0.5">
                    <TrendingDown className="size-3 shrink-0" />
                    -${summary.totalExpenseARS.toLocaleString("es-AR")}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                    Resumen USD
                  </p>
                  <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <TrendingUp className="size-3 shrink-0" />
                    +US${summary.totalIncomeUSD.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-rose-500 font-semibold flex items-center gap-1 mt-0.5">
                    <TrendingDown className="size-3 shrink-0" />
                    -US${summary.totalExpenseUSD.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* 3. Format Download Actions */}
          <div className="min-w-0 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Formato de Descarga
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
              {/* Excel Button */}
              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleExport("excel")}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer disabled:opacity-50 min-w-0"
              >
                <FileSpreadsheet className="size-6 shrink-0" />
                <div className="text-center min-w-0">
                  <p className="text-xs font-bold">Excel (.xlsx)</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Planilla estructurada</p>
                </div>
              </button>

              {/* PDF Button */}
              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleExport("pdf")}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 transition-all cursor-pointer disabled:opacity-50 min-w-0"
              >
                <FileText className="size-6 shrink-0" />
                <div className="text-center min-w-0">
                  <p className="text-xs font-bold">PDF (.pdf)</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Documento imprimible</p>
                </div>
              </button>

              {/* Markdown Button */}
              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleExport("markdown")}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 transition-all cursor-pointer disabled:opacity-50 min-w-0"
              >
                <FileCode className="size-6 shrink-0" />
                <div className="text-center min-w-0">
                  <p className="text-xs font-bold">Markdown (.md)</p>
                  <p className="text-[10px] opacity-80 mt-0.5">Formato texto plano</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
