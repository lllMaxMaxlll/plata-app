"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const ISO_DATE = "yyyy-MM-dd"

/** Convierte el string `yyyy-MM-dd` que guardan los formularios en un Date local. */
export function parseDateValue(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, ISO_DATE, new Date())
  return isValid(parsed) ? parsed : undefined
}

/** Serializa el Date del calendario al `yyyy-MM-dd` local (sin corrimiento por UTC). */
export function formatDateValue(date?: Date): string {
  return date ? format(date, ISO_DATE) : ""
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Seleccionar fecha",
  displayFormat = "PPP",
  disabled,
  required,
  className,
  align = "start",
  captionLayout = "dropdown",
  startMonth,
  endMonth,
  disabledDates,
}: {
  value?: Date
  onChange: (date: Date | undefined) => void
  id?: string
  placeholder?: string
  displayFormat?: string
  disabled?: boolean
  required?: boolean
  className?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"]
  startMonth?: Date
  endMonth?: Date
  disabledDates?: React.ComponentProps<typeof Calendar>["disabled"]
}) {
  const [open, setOpen] = React.useState(false)
  const currentYear = new Date().getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-required={required}
            className={cn(
              "h-10 w-full justify-start rounded-xl border-border bg-card/60 px-3.5 text-left text-sm font-normal",
              !value && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">
          {value ? format(value, displayFormat, { locale: es }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto rounded-2xl border border-border bg-popover p-0 shadow-xl"
      >
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          captionLayout={captionLayout}
          startMonth={startMonth ?? new Date(currentYear - 10, 0)}
          endMonth={endMonth ?? new Date(currentYear + 10, 11)}
          disabled={disabledDates}
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Igual que `DatePicker` pero atado al string `yyyy-MM-dd` que usan los
 * formularios que antes tenían un `<input type="date">` nativo.
 */
export function DateStringPicker({
  value,
  onChange,
  ...props
}: {
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<typeof DatePicker>, "value" | "onChange">) {
  return (
    <DatePicker
      value={parseDateValue(value)}
      onChange={(date) => onChange(formatDateValue(date))}
      {...props}
    />
  )
}
