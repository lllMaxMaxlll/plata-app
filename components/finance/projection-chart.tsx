"use client"

import React, { useState, useId, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Sparkles } from "lucide-react"
import { type ScenarioPoint, type Currency } from "@/lib/simulation-engine"
import { formatShort, formatCompact } from "@/lib/finance-data"

export interface ProjectionChartProps {
  timeline: ScenarioPoint[]
  displayCurrency: Currency
  isRealTerms?: boolean
}

export function ProjectionChart({
  timeline,
  displayCurrency,
  isRealTerms = false,
}: ProjectionChartProps) {
  const [activeScenarios, setActiveScenarios] = useState({
    optimistic: true,
    neutral: true,
    pessimistic: true,
  })

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const chartId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)

  // El gráfico se leía sólo con el mouse: las bandas de interacción tenían
  // onMouseEnter y nada más, así que en el teléfono —donde se usa esta PWA— el
  // tooltip no se podía abrir. Con eventos de puntero anda el hover del mouse y
  // el arrastre del dedo, y touch-action: pan-y deja que la página siga
  // scrolleando en vertical por encima del gráfico.
  const pointFromEvent = useCallback(
    (clientX: number, pointCount: number, left: number, graphW: number) => {
      const svg = svgRef.current
      if (!svg || pointCount === 0) return null
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0) return null
      // De píxeles de pantalla a unidades del viewBox.
      const viewBoxX = ((clientX - rect.left) / rect.width) * 800
      const ratio = (viewBoxX - left) / graphW
      const index = Math.round(ratio * (pointCount - 1))
      return Math.min(pointCount - 1, Math.max(0, index))
    },
    []
  )

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

  // El eje arranca siempre en cero, así que sólo hace falta el máximo.
  let maxVal = 0
  timeline.forEach((pt) => {
    if (activeScenarios.optimistic) maxVal = Math.max(maxVal, pt.optimistic, pt.optimisticPreGoal)
    if (activeScenarios.neutral) maxVal = Math.max(maxVal, pt.neutral, pt.neutralPreGoal)
    if (activeScenarios.pessimistic) maxVal = Math.max(maxVal, pt.pessimistic, pt.pessimisticPreGoal)
  })
  if (maxVal === 0) maxVal = 1000

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
  const xTicks = timeline
    .map((pt, index) => ({ pt, index }))
    .filter(({ index }) => index % xStep === 0 || index === timeline.length - 1)

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
              aria-pressed={activeScenarios.optimistic}
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
              aria-pressed={activeScenarios.neutral}
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
              aria-pressed={activeScenarios.pessimistic}
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
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            role="img"
            aria-label={`Evolución proyectada del patrimonio en ${displayCurrency}, ${
              isRealTerms ? "en términos reales" : "en valores nominales"
            }, en tres escenarios a ${timeline.length - 1} meses.`}
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
                  {formatCompact(tick.val, displayCurrency)}
                </text>
              </g>
            ))}

            {/* X-axis Ticks */}
            {xTicks.map(({ pt, index }) => {
              const x = getX(index)
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

            {/* Capa única de interacción: mouse y dedo */}
            <rect
              x={paddingLeft}
              y={paddingTop}
              width={graphWidth}
              height={graphHeight}
              fill="transparent"
              className="cursor-pointer"
              style={{ touchAction: "pan-y" }}
              onPointerDown={(e) =>
                setHoverIndex(pointFromEvent(e.clientX, timeline.length, paddingLeft, graphWidth))
              }
              onPointerMove={(e) => {
                // Con el dedo sólo seguimos si está apoyado; con el mouse, siempre.
                if (e.pointerType !== "mouse" && e.buttons === 0) return
                setHoverIndex(pointFromEvent(e.clientX, timeline.length, paddingLeft, graphWidth))
              }}
              onPointerLeave={() => setHoverIndex(null)}
              onPointerCancel={() => setHoverIndex(null)}
            />
          </svg>
        </div>

        {/* Alternativa en texto: el gráfico es un SVG con series distinguidas
            por color, que no sirve con lector de pantalla ni impreso. */}
        <details className="mt-3 group">
          <summary className="text-[11px] text-muted-foreground cursor-pointer select-none hover:text-foreground list-none flex items-center gap-1">
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            Ver los datos como tabla
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-border/50">
            <table className="w-full text-[11px] tabular-nums">
              <caption className="sr-only">
                Patrimonio proyectado por mes en los tres escenarios, en {displayCurrency}
              </caption>
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted-foreground text-left">
                  <th scope="col" className="px-2 py-1.5 font-medium">Mes</th>
                  <th scope="col" className="px-2 py-1.5 font-medium text-right">Pesimista</th>
                  <th scope="col" className="px-2 py-1.5 font-medium text-right">Neutro</th>
                  <th scope="col" className="px-2 py-1.5 font-medium text-right">Optimista</th>
                  <th scope="col" className="px-2 py-1.5 font-medium text-right">TC</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((pt) => (
                  <tr key={pt.month} className="border-t border-border/40">
                    <th scope="row" className="px-2 py-1 font-normal text-muted-foreground text-left">
                      {pt.month === 0 ? "Actual" : `M${pt.month}`}
                    </th>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.pessimistic, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.neutral, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.optimistic, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {Math.round(pt.exchangeRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

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
