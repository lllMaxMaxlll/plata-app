import React from "react"
import { ProjectionsView } from "@/components/finance/projections-view"

export const metadata = {
  title: "Proyección Financiera & Escenarios | PLATA",
  description: "Simula la evolución de tu patrimonio neto en ARS y USD con distintos escenarios de inflación, devaluación y metas de compra.",
}

export default function ProyeccionesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <ProjectionsView />
    </div>
  )
}
