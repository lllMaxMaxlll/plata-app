"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Sparkles } from "lucide-react"
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
  const svgRef = useRef<SVGSVGElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  // El viewBox sigue el ancho real del contenedor: con uno fijo de 800 el SVG
  // se achicaba entero en el teléfono y las etiquetas quedaban en 4 px.
  const [boxWidth, setBoxWidth] = useState(800)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setBoxWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
      const viewBoxX = ((clientX - rect.left) / rect.width) * svg.viewBox.baseVal.width
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
  const width = boxWidth
  const height = Math.max(220, Math.min(340, Math.round(boxWidth * 0.45)))
  const paddingLeft = 58
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
  // En pantallas angostas, menos etiquetas: si no, se pisan.
  const xStep = Math.max(1, Math.floor(timeline.length / (width < 500 ? 3 : 6)))
  const xTicks = timeline
    .map((pt, index) => ({ pt, index }))
    .filter(({ index }) => index % xStep === 0 || index === timeline.length - 1)

  // Active hover point
  const hoverPoint = hoverIndex !== null ? timeline[hoverIndex] : timeline[timeline.length - 1]
  const hoverX = hoverIndex !== null ? getX(hoverIndex) : null

  const toggleScenario = (key: "optimistic" | "neutral" | "pessimistic") => {
    setActiveScenarios((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Banda entre el escenario pesimista y el optimista: el rango posible se lee
  // de un vistazo, y la línea neutra queda como la referencia.
  const bandPath = (() => {
    const top = timeline.map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.optimistic).toFixed(1)}`)
    const bottom = timeline
      .map((pt, i) => `L ${getX(i).toFixed(1)} ${getY(pt.pessimistic).toFixed(1)}`)
      .reverse()
    return `${top.join(" ")} ${bottom.join(" ")} Z`
  })()

  const goalPoints = timeline
    .map((pt, index) => ({ pt, index }))
    .filter(({ pt }) => pt.achievedGoalNames && pt.achievedGoalNames.length > 0)

  const SCENARIOS = [
    { key: "optimistic", label: "Optimista", swatch: "border-dashed border-success" },
    { key: "neutral", label: "Neutro", swatch: "border-foreground" },
    { key: "pessimistic", label: "Pesimista", swatch: "border-dashed border-destructive" },
  ] as const

  return (
    <section className="rounded-2xl border-2 border-foreground bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Cómo crece tu patrimonio</h2>
          <p className="text-xs text-muted-foreground">
            {isRealTerms ? "En poder de compra de hoy" : "En valores nominales"}, en {displayCurrency}. La banda es el rango
            entre escenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Escenarios">
          {SCENARIOS.map(({ key, label, swatch }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleScenario(key)}
              aria-pressed={activeScenarios[key]}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-semibold transition-opacity ${
                activeScenarios[key] ? "border-foreground bg-card" : "border-foreground/30 opacity-50"
              }`}
            >
              <span className={`w-4 border-t-[3px] ${swatch}`} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <div ref={boxRef} className="relative w-full" style={{ height }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={`Evolución proyectada del patrimonio en ${displayCurrency}, ${
              isRealTerms ? "en términos reales" : "en valores nominales"
            }, en tres escenarios a ${timeline.length - 1} meses.`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={tick.y}
                  x2={width - paddingRight}
                  y2={tick.y}
                  stroke="var(--foreground)"
                  strokeOpacity={i === 0 ? 1 : 0.12}
                  strokeWidth={i === 0 ? 2 : 1}
                  strokeDasharray={i === 0 ? undefined : "4 4"}
                />
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[11px] tabular-nums"
                >
                  {formatCompact(tick.val, displayCurrency)}
                </text>
              </g>
            ))}

            {xTicks.map(({ pt, index }) => (
              <text
                key={pt.month}
                x={getX(index)}
                y={height - 12}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {pt.label}
              </text>
            ))}

            {activeScenarios.optimistic && activeScenarios.pessimistic && (
              <path d={bandPath} fill="var(--grape)" fillOpacity={0.45} />
            )}

            {activeScenarios.optimistic && (
              <path d={buildPath("optimistic")} fill="none" stroke="var(--success)" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
            )}
            {activeScenarios.pessimistic && (
              <path d={buildPath("pessimistic")} fill="none" stroke="var(--destructive)" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
            )}
            {activeScenarios.neutral && (
              <path d={buildPath("neutral")} fill="none" stroke="var(--foreground)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {activeScenarios.neutral &&
              goalPoints.map(({ pt, index }) => (
                <circle
                  key={pt.month}
                  cx={getX(index)}
                  cy={getY(pt.neutral)}
                  r="7"
                  fill="var(--lime)"
                  stroke="var(--ink)"
                  strokeWidth="2.5"
                >
                  <title>Meta alcanzada: {pt.achievedGoalNames?.join(", ")}</title>
                </circle>
              ))}

            {hoverX !== null && hoverPoint && (
              <g>
                <line x1={hoverX} y1={paddingTop} x2={hoverX} y2={height - paddingBottom} stroke="var(--foreground)" strokeWidth="1.5" />
                {(["optimistic", "neutral", "pessimistic"] as const).map((key) =>
                  activeScenarios[key] ? (
                    <circle
                      key={key}
                      cx={hoverX}
                      cy={getY(hoverPoint[key])}
                      r="5"
                      fill={key === "optimistic" ? "var(--success)" : key === "neutral" ? "var(--foreground)" : "var(--destructive)"}
                      stroke="var(--card)"
                      strokeWidth="2"
                    />
                  ) : null
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

        {/* El valor del punto tocado, o del final si no se toca nada */}
        {hoverPoint && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-foreground bg-background p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-foreground px-2 py-0.5 font-bold text-background">
                {hoverPoint.month === 0 ? "Hoy" : `Mes ${hoverPoint.month} · ${hoverPoint.label}`}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                dólar est. ${Math.round(hoverPoint.exchangeRate)}
              </span>
              {hoverPoint.achievedGoalNames && hoverPoint.achievedGoalNames.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-foreground bg-lime px-2 py-0.5 font-semibold text-ink">
                  <Sparkles className="size-3" /> {hoverPoint.achievedGoalNames.join(", ")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
              {activeScenarios.pessimistic && (
                <span className="text-destructive">pes {formatShort(hoverPoint.pessimistic, displayCurrency)}</span>
              )}
              {activeScenarios.neutral && (
                <span className="font-bold">neu {formatShort(hoverPoint.neutral, displayCurrency)}</span>
              )}
              {activeScenarios.optimistic && (
                <span className="text-success">opt {formatShort(hoverPoint.optimistic, displayCurrency)}</span>
              )}
            </div>
          </div>
        )}

        {/* Alternativa en texto: el gráfico es un SVG con series distinguidas
            por color, que no sirve con lector de pantalla ni impreso. */}
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-muted-foreground select-none hover:text-foreground">
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            Ver los datos como tabla
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border-2 border-foreground/20">
            <table className="w-full font-mono text-[11px] tabular-nums">
              <caption className="sr-only">
                Patrimonio proyectado por mes en los tres escenarios, en {displayCurrency}
              </caption>
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="px-2 py-1.5 font-medium">Mes</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Pesimista</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Neutro</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Optimista</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">TC</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((pt) => (
                  <tr key={pt.month} className="border-t border-foreground/10">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-muted-foreground">
                      {pt.month === 0 ? "Actual" : `M${pt.month}`}
                    </th>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.pessimistic, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.neutral, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right">{formatCompact(pt.optimistic, displayCurrency)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{Math.round(pt.exchangeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  )
}
