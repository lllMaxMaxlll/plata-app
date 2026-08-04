"use client"

import React, { useState, useId } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Eye, EyeOff, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
  type ScenarioPoint,
  type Currency,
  type BigPurchaseGoal,
} from "@/lib/simulation-engine"
import { formatShort } from "@/lib/finance-data"

export interface ProjectionChartProps {
  timeline: ScenarioPoint[]
  displayCurrency: Currency
  bigPurchaseGoal?: BigPurchaseGoal | null
  isRealTerms?: boolean
}

export function ProjectionChart({
  timeline,
  displayCurrency,
  bigPurchaseGoal,
  isRealTerms = false,
}: ProjectionChartProps) {
  const [activeScenarios, setActiveScenarios] = useState({
    optimistic: true,
    neutral: true,
    pessimistic: true,
  })

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const chartId = useId()

  if (!timeline || timeline.length === 0) {
    return null
  }

  // Calculate SVG bounds
  const width = 800
  const height = 340
  const paddingLeft = 65
  const paddingRight = 30
  const paddingTop = 30
  const paddingBottom = 45

  const graphWidth = width - paddingLeft - paddingRight
  const graphHeight = height - paddingTop - paddingBottom

  // Find Min / Max values across active scenarios
  let maxVal = 0
  let minVal = Infinity

  timeline.forEach((pt) => {
    if (activeScenarios.optimistic) {
      maxVal = Math.max(maxVal, pt.optimistic, pt.optimisticPreGoal)
      minVal = Math.min(minVal, pt.optimistic)
    }
    if (activeScenarios.neutral) {
      maxVal = Math.max(maxVal, pt.neutral, pt.neutralPreGoal)
      minVal = Math.min(minVal, pt.neutral)
    }
    if (activeScenarios.pessimistic) {
      maxVal = Math.max(maxVal, pt.pessimistic, pt.pessimisticPreGoal)
      minVal = Math.min(minVal, pt.pessimistic)
    }
  })

  if (maxVal === 0) maxVal = 1000
  if (minVal === Infinity || minVal < 0) minVal = 0

  // Add 10% headroom at the top
  const yMax = maxVal * 1.1

  // Point mapping helpers
  const getX = (index: number) => {
    if (timeline.length === 1) return paddingLeft
    return paddingLeft + (index / (timeline.length - 1)) * graphWidth
  }

  const getY = (val: number) => {
    const ratio = Math.max(0, val / yMax)
    return paddingTop + graphHeight * (1 - ratio)
  }

  // Build SVG path strings
  const buildPath = (key: "optimistic" | "neutral" | "pessimistic") => {
    return timeline
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt[key]).toFixed(1)}`)
      .join(" ")
  }

  const buildArea = (key: "optimistic" | "neutral" | "pessimistic") => {
    const linePath = buildPath(key)
    const lastX = getX(timeline.length - 1)
    const firstX = getX(0)
    const bottomY = getY(0)
    return `${linePath} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`
  }

  // Y-axis Ticks (5 steps)
  const yTickCount = 5
  const yTicks = Array.from({ length: yTickCount }).map((_, i) => {
    const val = (yMax / (yTickCount - 1)) * i
    return {
      val,
      y: getY(val),
    }
  })

  // X-axis Ticks (Labels for months)
  const xStep = Math.max(1, Math.floor(timeline.length / 6))
  const xTicks = timeline.filter((_, idx) => idx % xStep === 0 || idx === timeline.length - 1)

  // Goal marker coordinates
  const goalPointIndex = bigPurchaseGoal
    ? timeline.findIndex((pt) => pt.month === bigPurchaseGoal.targetMonth)
    : -1

  const goalX = goalPointIndex >= 0 ? getX(goalPointIndex) : null

  // Active hover point
  const hoverPoint = hoverIndex !== null ? timeline[hoverIndex] : timeline[timeline.length - 1]
  const hoverX = hoverIndex !== null ? getX(hoverIndex) : null

  const toggleScenario = (key: "optimistic" | "neutral" | "pessimistic") => {
    setActiveScenarios((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4.5 text-primary" />
              Evolución Proyectada del Patrimonio
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isRealTerms
                ? "Valores ajustados por inflación (Poder Adquisitivo Real)"
                : "Valores Nominales Proyectados"}{" "}
              en {displayCurrency}
            </CardDescription>
          </div>

          {/* Interactive Legend / Scenario Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => toggleScenario("optimistic")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                activeScenarios.optimistic
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                  : "bg-muted/40 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              Optimista
            </button>

            <button
              onClick={() => toggleScenario("neutral")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                activeScenarios.neutral
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/40"
                  : "bg-muted/40 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <span className="size-2 rounded-full bg-cyan-500" />
              Neutro
            </button>

            <button
              onClick={() => toggleScenario("pessimistic")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                activeScenarios.pessimistic
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/40"
                  : "bg-muted/40 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <span className="size-2 rounded-full bg-rose-500" />
              Pesimista
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 px-3 sm:px-6">
        {/* SVG Container */}
        <div className="relative w-full aspect-[21/9] min-h-[260px] sm:min-h-[300px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              {/* Optimistic Gradient */}
              <linearGradient id={`grad-opt-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              {/* Neutral Gradient */}
              <linearGradient id={`grad-neu-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>

              {/* Pessimistic Gradient */}
              <linearGradient id={`grad-pes-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={width - paddingRight}
                  y2={tick.y}
                  stroke="currentColor"
                  className="text-border/30"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-medium tabular-nums"
                >
                  {formatShort(tick.val, displayCurrency)}
                </text>
              </g>
            ))}

            {/* X-axis Ticks */}
            {xTicks.map((pt) => {
              const x = getX(pt.month)
              return (
                <text
                  key={pt.month}
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  {pt.label}
                </text>
              )
            })}

            {/* Areas */}
            {activeScenarios.optimistic && (
              <path
                d={buildArea("optimistic")}
                fill={`url(#grad-opt-${chartId})`}
                className="transition-all duration-300"
              />
            )}
            {activeScenarios.neutral && (
              <path
                d={buildArea("neutral")}
                fill={`url(#grad-neu-${chartId})`}
                className="transition-all duration-300"
              />
            )}
            {activeScenarios.pessimistic && (
              <path
                d={buildArea("pessimistic")}
                fill={`url(#grad-pes-${chartId})`}
                className="transition-all duration-300"
              />
            )}

            {/* Lines */}
            {activeScenarios.optimistic && (
              <path
                d={buildPath("optimistic")}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
            )}
            {activeScenarios.neutral && (
              <path
                d={buildPath("neutral")}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
            )}
            {activeScenarios.pessimistic && (
              <path
                d={buildPath("pessimistic")}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
            )}

            {/* Big Purchase Goal Vertical Line Marker */}
            {goalX !== null && bigPurchaseGoal && (
              <g>
                <line
                  x1={goalX}
                  y1={paddingTop}
                  x2={goalX}
                  y2={height - paddingBottom}
                  stroke="#a855f7"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                />
                <circle cx={goalX} cy={paddingTop + 5} r="6" fill="#a855f7" />
                <text
                  x={goalX}
                  y={paddingTop - 8}
                  textAnchor="middle"
                  className="fill-purple-400 text-[10px] font-bold"
                >
                  🎯 {bigPurchaseGoal.name}
                </text>
              </g>
            )}

            {/* Hover Line & Marker Circles */}
            {hoverX !== null && hoverPoint && (
              <g>
                <line
                  x1={hoverX}
                  y1={paddingTop}
                  x2={hoverX}
                  y2={height - paddingBottom}
                  stroke="currentColor"
                  className="text-primary/60"
                  strokeWidth="1.5"
                />

                {activeScenarios.optimistic && (
                  <circle
                    cx={hoverX}
                    cy={getY(hoverPoint.optimistic)}
                    r="5"
                    fill="#10b981"
                    className="stroke-background stroke-2"
                  />
                )}
                {activeScenarios.neutral && (
                  <circle
                    cx={hoverX}
                    cy={getY(hoverPoint.neutral)}
                    r="5"
                    fill="#06b6d4"
                    className="stroke-background stroke-2"
                  />
                )}
                {activeScenarios.pessimistic && (
                  <circle
                    cx={hoverX}
                    cy={getY(hoverPoint.pessimistic)}
                    r="5"
                    fill="#f43f5e"
                    className="stroke-background stroke-2"
                  />
                )}
              </g>
            )}

            {/* Invisible Touch / Mouse Overlay Strips */}
            {timeline.map((pt, idx) => {
              const x = getX(idx)
              const bandWidth = graphWidth / timeline.length
              return (
                <rect
                  key={idx}
                  x={x - bandWidth / 2}
                  y={paddingTop}
                  width={bandWidth}
                  height={graphHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(idx)}
                />
              )
            })}
          </svg>
        </div>

        {/* Hover Tooltip Info Bar */}
        {hoverPoint && (
          <div className="mt-2 rounded-2xl border border-border/50 bg-muted/20 p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                {hoverPoint.month === 0 ? "Estado Actual" : `Mes ${hoverPoint.month} (${hoverPoint.label})`}
              </span>
              <span className="text-muted-foreground text-[11px]">
                TC Est: <strong className="text-foreground">${Math.round(hoverPoint.exchangeRate)} ARS/USD</strong>
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {hoverPoint.achievedGoalNames && hoverPoint.achievedGoalNames.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-300 gap-1 bg-purple-500/10">
                  <Sparkles className="size-3" /> Meta alcanzada: {hoverPoint.achievedGoalNames.join(", ")}
                </Badge>
              )}
              {activeScenarios.optimistic && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Opt:</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {formatShort(hoverPoint.optimistic, displayCurrency)}
                  </span>
                </div>
              )}

              {activeScenarios.neutral && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cyan-500" />
                  <span className="text-muted-foreground font-medium">Neu:</span>
                  <span className="font-bold text-cyan-400 tabular-nums">
                    {formatShort(hoverPoint.neutral, displayCurrency)}
                  </span>
                </div>
              )}

              {activeScenarios.pessimistic && (
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span className="text-muted-foreground">Pes:</span>
                  <span className="font-bold text-rose-400 tabular-nums">
                    {formatShort(hoverPoint.pessimistic, displayCurrency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
