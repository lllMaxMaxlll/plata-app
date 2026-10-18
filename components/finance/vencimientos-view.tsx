"use client"

import { useState, useMemo } from "react"
import { useFinance } from "./finance-provider"
import { PageHeader } from "./page-header"
import {
  formatShort,
  type DueItem,
  type Currency,
} from "@/lib/finance-data"
import { Button } from "@/components/ui/button"
import { VencimientoSheet } from "./vencimiento-sheet"
import { PayVencimientoModal } from "./pay-vencimiento-modal"
import { getApiAuthHeaders } from "@/lib/supabase/client"
import { toast } from "sonner"
import { clickableRowProps, focusRing } from "@/lib/utils"
import {
  Calendar as CalendarIcon,
  ListFilter,
  Plus,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Search,
  Receipt,
  RotateCcw,
  Check,
} from "lucide-react"
import { IconTile, Pill, dueIcon, pageClass } from "./lucas-ui"
import { Segmented } from "./segmented"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

const FREQUENCY_LABELS: Record<DueItem["frequency"], string> = {
  monthly: "mensual",
  biweekly: "quincenal",
  yearly: "anual",
  one_time: "única vez",
}

export function VencimientosView() {
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

  const statusPill = (item: (typeof itemsWithComputedStatus)[number]) => {
    if (item.status === "paid") return <Pill tone="plain">pagado</Pill>
    if (item.computedStatusTag === "overdue") return <Pill tone="coral">vencido hace {Math.abs(item.daysUntilDue)}d</Pill>
    if (item.computedStatusTag === "due_soon")
      return <Pill tone="lime">{item.daysUntilDue === 0 ? "vence hoy" : `en ${item.daysUntilDue} días`}</Pill>
    return <Pill tone="plain">en {item.daysUntilDue} días</Pill>
  }

  return (
    <div className={cn(pageClass, "space-y-6")}>
      <PageHeader
        route="dueItems"
        description="Tus cuentas periódicas, con aviso antes de que venzan."
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="size-4" />
            Vencimiento
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <section className="rounded-3xl border-2 border-foreground bg-lime p-4 text-ink shadow-md">
          <p className="text-sm font-bold">Te queda por pagar este mes</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tighter">{formatShort(totalDueThisMonth.ARS, "ARS")}</p>
          {totalDueThisMonth.USD > 0 && (
            <p className="text-lg font-extrabold">+ {formatShort(totalDueThisMonth.USD, "USD")}</p>
          )}
        </section>

        <section
          className={cn(
            "rounded-3xl border-2 border-foreground p-4",
            overdueItems.length > 0 ? "bg-coral text-ink" : "bg-card"
          )}
        >
          <p className="text-sm font-bold">{overdueItems.length > 0 ? "Vencidos" : "Nada vencido"}</p>
          {overdueItems.length > 0 ? (
            <>
              <p className="mt-1 text-3xl font-extrabold tracking-tighter">{formatShort(totalOverdueAmount.ARS, "ARS")}</p>
              <p className="mt-1 font-mono text-[11px] font-semibold">
                {overdueItems.length} {overdueItems.length === 1 ? "cuenta" : "cuentas"}
                {totalOverdueAmount.USD > 0 && ` · + ${formatShort(totalOverdueAmount.USD, "USD")}`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-3xl font-extrabold tracking-tighter">Al día 🙌</p>
          )}
        </section>

        <section className="rounded-3xl border-2 border-foreground bg-card p-4">
          <p className="text-sm font-bold">Lo próximo</p>
          {urgentUpcomingItems.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No hay nada pendiente.</p>
          ) : (
            <ul className="mt-1 divide-y-[1.5px] divide-dashed divide-foreground/15">
              {urgentUpcomingItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{item.title}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {item.daysUntilDue === 0
                        ? "vence hoy"
                        : item.daysUntilDue < 0
                          ? `venció hace ${Math.abs(item.daysUntilDue)}d`
                          : `en ${item.daysUntilDue} días`}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-semibold">{formatShort(item.amount, item.currency)}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenPayModal(item)}
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-foreground bg-lime text-ink transition-transform active:scale-95"
                    aria-label={`Pagar ${item.title}`}
                  >
                    <Check className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          ariaLabel="Vista"
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "list", label: <><ListFilter className="size-3.5" />Lista</> },
            { value: "calendar", label: <><CalendarIcon className="size-3.5" />Calendario</> },
          ]}
        />
        {activeTab === "list" && (
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              placeholder="Buscar vencimiento"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar vencimiento"
              className="h-9 w-full rounded-xl border-2 border-foreground bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-lime"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTestNotificationCheck}
          disabled={testingNotification}
          className="ml-auto"
          title="Revisa qué vencimientos entran en su ventana de aviso"
        >
          <BellRing />
          {testingNotification ? "Revisando…" : "Probar avisos"}
        </Button>
      </div>

      {activeTab === "list" && (
        <div className="no-scrollbar -mx-1 -mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Estado">
          {[
            { key: "all", label: "Todos" },
            { key: "pending", label: "Pendientes" },
            { key: "due_soon", label: "Por vencer" },
            { key: "overdue", label: "Vencidos" },
            { key: "paid", label: "Pagados" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={statusFilter === f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border-2 border-foreground px-3 py-1 text-xs font-semibold transition-colors",
                statusFilter === f.key ? "bg-lime text-ink" : "bg-card hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "list" ? (
        filteredListItems.length === 0 ? (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/40 px-6 py-10 text-center transition-colors hover:bg-lime/25"
          >
            <Receipt className="size-7" />
            <span className="font-extrabold">
              {searchQuery || statusFilter !== "all" ? "Nada con ese filtro" : "Cargá tu primer vencimiento"}
            </span>
            <span className="text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "Probá con otro filtro o búsqueda."
                : "La luz, la tarjeta, el alquiler: te aviso antes de que venza."}
            </span>
          </button>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredListItems.map((item) => {
              const isPaid = item.status === "paid"
              const isOverdue = item.computedStatusTag === "overdue"
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex flex-col rounded-2xl border-2 p-4",
                    isPaid
                      ? "border-dashed border-foreground/40 bg-transparent"
                      : isOverdue
                        ? "border-foreground bg-coral/25"
                        : "border-foreground bg-card"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <IconTile
                      Icon={dueIcon(item.category)}
                      className={isPaid ? "bg-muted text-foreground" : isOverdue || item.computedStatusTag === "due_soon" ? "bg-coral" : "bg-sky"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-extrabold", isPaid && "text-muted-foreground")}>{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    {statusPill(item)}
                  </div>

                  <p className={cn("mt-3 text-2xl font-extrabold tracking-tight", isPaid && "text-muted-foreground")}>
                    {formatShort(item.amount, item.currency)}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    vence {format(parseISO(item.dueDate), "d/M/yyyy")} · {FREQUENCY_LABELS[item.frequency]}
                  </p>

                  <div className="mt-3 flex items-center gap-2 border-t-[1.5px] border-dashed border-foreground/15 pt-3">
                    {isPaid ? (
                      <Button size="sm" variant="ghost" onClick={() => markDueItemAsPending(item.id)}>
                        <RotateCcw />
                        Desmarcar
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleOpenPayModal(item)} className="bg-lime text-ink hover:bg-lime/80">
                        <Check />
                        Pagar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(item)} className="ml-auto">
                      Editar
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold tracking-tight">{calendarMonthLabel}</h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  const prev = new Date(currentCalendarDate)
                  prev.setMonth(prev.getMonth() - 1)
                  setCurrentCalendarDate(prev)
                }}
                aria-label="Mes anterior"
              >
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentCalendarDate(new Date())}>
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  const next = new Date(currentCalendarDate)
                  next.setMonth(next.getMonth() + 1)
                  setCurrentCalendarDate(next)
                }}
                aria-label="Mes siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-foreground bg-card p-2 sm:p-3">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-semibold text-muted-foreground uppercase">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((day, idx) => {
                const isSelected = selectedCalendarDateIso === day.dateIso && day.isCurrentMonth
                const isTodayCell = day.isCurrentMonth && day.dateIso === format(nowToday, "yyyy-MM-dd")
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
                    className={cn(
                      focusRing,
                      "relative flex min-h-[64px] cursor-pointer flex-col overflow-hidden rounded-lg border-2 p-1 sm:min-h-[88px] sm:p-1.5",
                      !day.isCurrentMonth
                        ? "cursor-default border-transparent opacity-30"
                        : isSelected
                          ? "border-foreground bg-lime/40"
                          : "border-foreground/15 hover:border-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold",
                        isTodayCell && "flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background"
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {day.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "truncate rounded border-[1.5px] border-foreground px-1 text-[10px] font-semibold",
                            item.status === "paid"
                              ? "bg-card text-muted-foreground line-through"
                              : item.computedStatusTag === "overdue" || item.computedStatusTag === "due_soon"
                                ? "bg-coral text-ink"
                                : "bg-sky text-ink"
                          )}
                        >
                          {item.title}
                        </div>
                      ))}
                      {day.items.length > 2 && (
                        <p className="pl-0.5 text-[10px] font-semibold text-muted-foreground">+{day.items.length - 2}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {selectedCalendarDateIso && (
            <section className="rounded-2xl border-2 border-foreground bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-extrabold">{format(parseISO(selectedCalendarDateIso), "EEEE d 'de' MMMM", { locale: es })}</h3>
                <Button size="sm" variant="ghost" onClick={() => setSelectedCalendarDateIso(null)}>
                  Cerrar
                </Button>
              </div>
              {selectedDayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada vence ese día.</p>
              ) : (
                <ul className="divide-y-[1.5px] divide-dashed divide-foreground/15">
                  {selectedDayItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <IconTile Icon={dueIcon(item.category)} className="bg-sky" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.category} · {FREQUENCY_LABELS[item.frequency]}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold">{formatShort(item.amount, item.currency)}</span>
                      {item.status !== "paid" && (
                        <Button size="sm" onClick={() => handleOpenPayModal(item)} className="bg-lime text-ink hover:bg-lime/80">
                          Pagar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
