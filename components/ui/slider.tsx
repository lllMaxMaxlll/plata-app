"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

    return (
      <div className={cn("relative flex w-full touch-none select-none items-center py-1.5", className)}>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/80">
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          ref={ref}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className={cn(
            "absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        <div
          className="pointer-events-none absolute size-4 rounded-full border-2 border-primary bg-background shadow-md transition-all -translate-x-1/2 ring-offset-background group-hover:scale-110"
          style={{ left: `${percentage}%` }}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
