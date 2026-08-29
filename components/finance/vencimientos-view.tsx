"use client"

import { useState, useMemo } from "react"
import { useFinance } from "./finance-provider"
import {
  formatCurrency,
  formatShort,
  DUE_CATEGORIES,
  type DueItem,
  type DueItemStatus,
  type Currency,
} from "@/lib/finance-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { VencimientoSheet } from "./vencimiento-sheet"
import { PayVencimientoModal } from "./pay-vencimiento-modal"
import { getApiAuthHeaders } from "@/lib/supabase/client"
import { toast } from "sonner"
import { clickableRowProps, focusRing } from "@/lib/utils"
import {
  Calendar as CalendarIcon,
  ListFilter,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Search,
  Receipt,
  RotateCcw,
  Sparkles,
  Zap,
  MoreVertical,
  Check,
} from "lucide-react"

export function VencimientosView({ isDesktop = false }: { isDesktop?: boolean }) {
  const { dueItems, markDueItemAsPending } = useFinance()

  const [activeTab, setActiveTab] = useState<"list" | "calendar">("list")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Sheet & Modal state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DueItem | null>(null)

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payingItem, setPayingItem] = useState<DueItem | null>(null)

  const [testingNotification, setTestingNotification] = useState(false)

  // Calendar month state (0-indexed month)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date())

  // Calculate status for each item based on current date
  const nowToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const itemsWithComputedStatus = useMemo(() => {
    return dueItems.map((item) => {
      const parts = item.dueDate.split("-").map(Number)
      let daysUntilDue = 0
      let computedStatusTag: "overdue" | "due_soon" | "up_to_date" | "paid" = "up_to_date"

      if (parts.length === 3 && !parts.some(isNaN)) {
        const itemDate = new Date(parts[0], parts[1] - 1, parts[2])
        itemDate.setHours(0, 0, 0, 0)
        const diffTime = itemDate.getTime() - nowToday.getTime()
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      if (item.status === "paid") {
        computedStatusTag = "paid"
      } else if (daysUntilDue < 0) {
        computedStatusTag = "overdue"
      } else if (daysUntilDue <= (item.reminderDaysBefore || 3)) {
        computedStatusTag = "due_soon"
      } else {
        computedStatusTag = "up_to_date"
      }

      return {
        ...item,
        daysUntilDue,
        computedStatusTag,
      }
    })
  }, [dueItems, nowToday])

  // --- KPI Card Calculations ---

  // 1. Total a pagar este mes (pending items due in current month)
  const totalDueThisMonth = useMemo(() => {
    const currentYear = nowToday.getFullYear()
    const currentMonth = nowToday.getMonth() // 0-11

    const totals: Record<Currency, number> = { ARS: 0, USD: 0 }

    itemsWithComputedStatus.forEach((item) => {
      if (item.status === "paid") return
      const parts = item.dueDate.split("-").map(Number)
      if (parts.length === 3) {
        const y = parts[0]
        const m = parts[1] - 1
        if (y === currentYear && m === currentMonth) {
          totals[item.currency] = (totals[item.currency] || 0) + item.amount
        }
      }
    })

    return totals
  }, [itemsWithComputedStatus, nowToday])

  // 2. Overdue bills alert count & total
  const overdueItems = useMemo(() => {
    return itemsWithComputedStatus.filter((i) => i.computedStatusTag === "overdue")
  }, [itemsWithComputedStatus])

  const totalOverdueAmount = useMemo(() => {
    const totals: Record<Currency, number> = { ARS: 0, USD: 0 }
    overdueItems.forEach((item) => {
      totals[item.currency] = (totals[item.currency] || 0) + item.amount
    })
    return totals
  }, [overdueItems])

  // 3. Upcoming 3 most urgent pending bills
  const urgentUpcomingItems = useMemo(() => {
    return itemsWithComputedStatus
      .filter((i) => i.status !== "paid")
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 3)
  }, [itemsWithComputedStatus])

  // --- Filtering for List view ---
  const filteredListItems = useMemo(() => {
    return itemsWithComputedStatus.filter((item) => {
      // Filter by status tab
      if (statusFilter === "pending" && item.status === "paid") return false
      if (statusFilter === "due_soon" && item.computedStatusTag !== "due_soon") return false
      if (statusFilter === "overdue" && item.computedStatusTag !== "overdue") return false
      if (statusFilter === "paid" && item.status !== "paid") return false

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = item.title.toLowerCase().includes(q)
        const matchesCategory = item.category.toLowerCase().includes(q)
        if (!matchesTitle && !matchesCategory) return false
      }

      return true
    })
  }, [itemsWithComputedStatus, statusFilter, searchQuery])

  // --- Handlers ---

  function handleOpenCreate() {
    setEditingItem(null)
    setSheetOpen(true)
  }

  function handleOpenEdit(item: DueItem) {
    setEditingItem(item)
    setSheetOpen(true)
  }

  function handleOpenPayModal(item: DueItem) {
    setPayingItem(item)
    setPayModalOpen(true)
  }

  async function handleTestNotificationCheck() {
    setTestingNotification(true)
    try {
      const res = await fetch("/api/notifications/check-due-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getApiAuthHeaders()) },
        body: JSON.stringify({ dueItems }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Comprobación ejecutada. ${data.count} alertas detectadas.`)
      } else {
        toast.error("Error al ejecutar comprobación.")
      }
    } catch (e) {
      toast.error("Error de conexión al probar notificaciones.")
    } finally {
      setTestingNotification(false)
    }
  }

  // --- Calendar Grid Computations ---
  const calendarDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear()
    const month = currentCalendarDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // Monday = 0, Sunday = 6
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1
    if (startingDayOfWeek === -1) startingDayOfWeek = 6

    const totalDaysInMonth = lastDayOfMonth.getDate()

    const daysArray = []

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      daysArray.push({
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        dateIso: "",
        items: [] as typeof itemsWithComputedStatus,
      })
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0")
      const dayStr = String(d).padStart(2, "0")
      const dateIso = `${year}-${monthStr}-${dayStr}`

      const dayItems = itemsWithComputedStatus.filter((i) => i.dueDate === dateIso)

      daysArray.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateIso,
        items: dayItems,
      })
    }

    // Next month padding to fill grid to multiple of 7
    const remaining = 7 - (daysArray.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        daysArray.push({
          dayNumber: d,
          isCurrentMonth: false,
          dateIso: "",
          items: [] as typeof itemsWithComputedStatus,
        })
      }
    }

    return daysArray
  }, [currentCalendarDate, itemsWithComputedStatus])

  const calendarMonthLabel = useMemo(() => {
    const months = [
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
    return `${months[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`
  }, [currentCalendarDate])

  const [selectedCalendarDateIso, setSelectedCalendarDateIso] = useState<string | null>(null)

  const selectedDayItems = useMemo(() => {
    if (!selectedCalendarDateIso) return []
    return itemsWithComputedStatus.filter((i) => i.dueDate === selectedCalendarDateIso)
  }, [selectedCalendarDateIso, itemsWithComputedStatus])

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-20 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarIcon className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Vencimientos y Servicios
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestioná tus facturas periódicas y evitá moras con alertas automáticas PWA.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenCreate}
            className="rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="size-4 mr-1.5" />
            Nuevo Vencimiento
          </Button>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total a pagar este mes */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-5 shadow-sm group hover:border-border transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Este Mes
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Receipt className="size-4.5" />
            </span>
          </div>

          <div className="mt-3 space-y-0.5">
            <p className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight">
              {formatShort(totalDueThisMonth.ARS, "ARS")}
            </p>
            {totalDueThisMonth.USD > 0 && (
              <p className="text-xs font-semibold text-primary tabular-nums">
                + {formatShort(totalDueThisMonth.USD, "USD")}
              </p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Facturas pendientes programadas para este mes
          </p>
        </div>

        {/* Card 2: Próximos 3 más urgentes */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Próximos Vencimientos
            </span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock className="size-4.5" />
            </span>
          </div>

          {urgentUpcomingItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">No hay vencimientos pendientes cercanos</p>
          ) : (
            <div className="space-y-2">
              {urgentUpcomingItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.daysUntilDue === 0
                        ? "Vence HOY"
                        : item.daysUntilDue < 0
                          ? `Venció hace ${Math.abs(item.daysUntilDue)}d`
                          : `En ${item.daysUntilDue} días`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold tabular-nums text-foreground">
                      {formatShort(item.amount, item.currency)}
                    </span>
                    <button
                      onClick={() => handleOpenPayModal(item)}
                      className="size-9 sm:size-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center justify-center transition-colors cursor-pointer"
                      title="Marcar como pagado"
                      aria-label={`Marcar ${item.title} como pagado`}
                    >
                      <Check className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Alerta de Mora / Vencidas */}
        <div
          className={`relative overflow-hidden rounded-xl border p-5 shadow-sm backdrop-blur-xl transition-colors ${overdueItems.length > 0
              ? "border-rose-500/30 bg-rose-500/5 shadow-rose-500/5"
              : "border-border/60 bg-card/40"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Facturas Vencidas
            </span>
            <span
              className={`flex size-9 items-center justify-center rounded-xl border ${overdueItems.length > 0
                  ? "bg-rose-500/15 text-rose-500 border-rose-500/30 animate-pulse"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                }`}
            >
              {overdueItems.length > 0 ? (
                <AlertTriangle className="size-4.5" />
              ) : (
                <CheckCircle2 className="size-4.5" />
              )}
            </span>
          </div>

          <div className="mt-3">
            {overdueItems.length > 0 ? (
              <>
                <p className="text-2xl font-extrabold text-rose-500 tabular-nums tracking-tight">
                  {overdueItems.length} {overdueItems.length === 1 ? "factura" : "facturas"}
                </p>
                <p className="text-xs font-semibold text-rose-400 mt-0.5">
                  Mora total: {formatShort(totalOverdueAmount.ARS, "ARS")}
                  {totalOverdueAmount.USD > 0 && ` + ${formatShort(totalOverdueAmount.USD, "USD")}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-extrabold text-emerald-500 tracking-tight">Al Día</p>
                <p className="text-xs text-muted-foreground mt-0.5">No registrás servicios vencidos en mora.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Comprobación de vencimientos bajo demanda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <BellRing className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">Alertas de Vencimiento</h3>
            <p className="text-xs text-muted-foreground">
              Revisá qué servicios entran en ventana de aviso según los días de recordatorio de cada uno.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleTestNotificationCheck}
            variant="secondary"
            disabled={testingNotification}
            className="rounded-xl text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary"
          >
            <Zap className="size-3.5 mr-1.5" />
            {testingNotification ? "Comprobando..." : "Comprobar Ahora"}
          </Button>
        </div>
      </div>

      {/* View Switcher & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
        {/* Switcher Tab */}
        <div className="flex items-center rounded-2xl bg-muted/40 p-1 border border-border/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${activeTab === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <ListFilter className="size-4" />
            Vista Lista / Tablero
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${activeTab === "calendar"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <CalendarIcon className="size-4" />
            Vista Calendario
          </button>
        </div>

        {/* Search & Status Filter (only for list view) */}
        {activeTab === "list" && (
          <div className="flex flex-1 sm:max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vencimiento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-border bg-card/40 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { key: "all", label: "Todos" },
                { key: "pending", label: "Pendientes" },
                { key: "due_soon", label: "Por Vencer" },
                { key: "overdue", label: "Vencidos" },
                { key: "paid", label: "Pagados" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${statusFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- CONTENT AREA --- */}

      {activeTab === "list" ? (
        /* VISTA LISTA / TABLERO */
        filteredListItems.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-card/20 p-8">
            <Receipt className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No se encontraron vencimientos</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "Probá cambiando los filtros o la búsqueda."
                : "Agregá tu primer servicio recurrente para tener todo bajo control."}
            </p>
            <Button
              onClick={handleOpenCreate}
              variant="outline"
              className="mt-4 rounded-xl text-xs border-primary/30 text-primary"
            >
              <Plus className="size-3.5 mr-1.5" />
              Crear Vencimiento
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredListItems.map((item) => {
              const isOverdue = item.computedStatusTag === "overdue"
              const isDueSoon = item.computedStatusTag === "due_soon"
              const isPaid = item.status === "paid"

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border p-4.5 transition-all duration-200 backdrop-blur-xl flex flex-col justify-between ${isPaid
                      ? "border-border/40 bg-card/20 opacity-75"
                      : isOverdue
                        ? "border-rose-500/40 bg-rose-500/5 shadow-lg shadow-rose-500/5"
                        : isDueSoon
                          ? "border-amber-500/40 bg-amber-500/5 shadow-lg shadow-amber-500/5"
                          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/60"
                    }`}
                >
                  <div>
                    {/* Top Row: Category & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] font-semibold rounded-lg bg-muted/30">
                        {item.category}
                      </Badge>

                      {isPaid ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          <CheckCircle2 className="size-3" />
                          Pagado
                        </span>
                      ) : isOverdue ? (
                        <span className="flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-500 animate-pulse">
                          <AlertTriangle className="size-3" />
                          Vencido ({Math.abs(item.daysUntilDue)}d)
                        </span>
                      ) : isDueSoon ? (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          <Clock className="size-3" />
                          {item.daysUntilDue === 0 ? "Vence hoy" : `En ${item.daysUntilDue} días`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          Al día
                        </span>
                      )}
                    </div>

                    {/* Title & Amount */}
                    <div className="mt-3">
                      <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xl font-extrabold text-foreground tabular-nums tracking-tight mt-1">
                        {formatCurrency(item.amount, item.currency)}
                      </p>
                    </div>

                    {/* Frequency & Due Date metadata */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2.5">
                      <span>Vence: <strong className="text-foreground font-medium">{item.dueDate}</strong></span>
                      <span className="capitalize">{item.frequency === "one_time" ? "Único" : item.frequency}</span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 pt-2.5 flex items-center justify-between gap-2 border-t border-border/30">
                    {isPaid ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markDueItemAsPending(item.id)}
                        className="rounded-xl text-xs text-muted-foreground hover:text-foreground h-8"
                      >
                        <RotateCcw className="size-3.5 mr-1" />
                        Desmarcar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenPayModal(item)}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        <CheckCircle2 className="size-3.5 mr-1" />
                        Marcar Pagado
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(item)}
                      className="rounded-xl text-xs h-8 border-border/60 hover:bg-muted/50 cursor-pointer"
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* VISTA CALENDARIO MENSUAL */
        <div className="space-y-4">
          {/* Calendar Header Controls */}
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/40 p-4">
            <h2 className="text-base font-bold text-foreground capitalize flex items-center gap-2">
              <CalendarIcon className="size-4.5 text-primary" />
              {calendarMonthLabel}
            </h2>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const prev = new Date(currentCalendarDate)
                  prev.setMonth(prev.getMonth() - 1)
                  setCurrentCalendarDate(prev)
                }}
                className="rounded-xl size-10 sm:size-8 p-0"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentCalendarDate(new Date())}
                className="rounded-xl text-xs px-2.5 h-8 font-semibold"
              >
                Hoy
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new Date(currentCalendarDate)
                  next.setMonth(next.getMonth() + 1)
                  setCurrentCalendarDate(next)
                }}
                className="rounded-xl size-10 sm:size-8 p-0"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Monthly Days Grid */}
          <div className="rounded-xl border border-border/60 bg-card/30 p-3 overflow-hidden backdrop-blur-xl">
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* Days Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
                const isSelected = selectedCalendarDateIso === day.dateIso && day.isCurrentMonth
                const isTodayCell =
                  day.isCurrentMonth &&
                  day.dateIso === nowToday.toISOString().split("T")[0]

                return (
                  <div
                    key={idx}
                    {...(day.isCurrentMonth
                      ? clickableRowProps(
                          () => setSelectedCalendarDateIso(day.dateIso),
                          `${day.dayNumber} · ${day.items.length} ${day.items.length === 1 ? "vencimiento" : "vencimientos"}`
                        )
                      : { "aria-hidden": true })}
                    aria-pressed={day.isCurrentMonth ? isSelected : undefined}
                    aria-current={isTodayCell ? "date" : undefined}
                    className={`${focusRing} min-h-[72px] sm:min-h-[90px] rounded-2xl p-1.5 flex flex-col justify-between border transition-all cursor-pointer relative overflow-hidden ${!day.isCurrentMonth
                        ? "opacity-25 bg-muted/10 border-transparent cursor-default"
                        : isSelected
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                          : isTodayCell
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/30 bg-card/40 hover:bg-card/70"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${isTodayCell
                            ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]"
                            : "text-foreground"
                          }`}
                      >
                        {day.dayNumber}
                      </span>
                      {day.items.length > 0 && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-muted/60 text-muted-foreground">
                          {day.items.length}
                        </span>
                      )}
                    </div>

                    {/* Mini Event Dots / Pills */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {day.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={`truncate text-[10px] font-semibold px-1.5 py-0.5 rounded-lg border ${item.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : item.computedStatusTag === "overdue"
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                : item.computedStatusTag === "due_soon"
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  : "bg-primary/10 text-primary border-primary/20"
                            }`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {day.items.length > 2 && (
                        <p className="text-[9px] text-muted-foreground font-semibold pl-1">
                          +{day.items.length - 2} más
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected Day Details Box */}
          {selectedCalendarDateIso && (
            <div className="rounded-xl border border-primary/30 bg-card/60 p-5 backdrop-blur-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon className="size-4 text-primary" />
                  Vencimientos del {selectedCalendarDateIso}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedCalendarDateIso(null)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Cerrar
                </Button>
              </div>

              {selectedDayItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No hay facturas registradas para esta fecha.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.category} · {item.frequency}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-extrabold text-foreground tabular-nums">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        {item.status !== "paid" && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenPayModal(item)}
                            className="rounded-xl text-xs bg-emerald-600 text-white h-8"
                          >
                            Pagar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sheet & Modal components */}
      <VencimientoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        item={editingItem}
      />

      <PayVencimientoModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        item={payingItem}
      />
    </div>
  )
}
