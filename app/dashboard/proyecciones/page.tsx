import React from "react"
import { ProjectionsView } from "@/components/finance/projections-view"

export const metadata = {
  title: "Metas | EN MANO",
  description: "Simulá la evolución de tu patrimonio neto en ARS y USD con distintos escenarios de inflación, devaluación y metas de compra.",
}

export default function ProyeccionesPage() {
  return <ProjectionsView />
}
