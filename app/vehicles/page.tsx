"use client"

import { useRouter } from "next/navigation"
import { VehiclesView } from "@/components/finance/vehicles-view"

export default function VehiclesPage() {
  const router = useRouter()

  return (
    <>
      <div className="md:hidden">
        <VehiclesView onBack={() => router.push("/more")} />
      </div>
      <div className="hidden md:block">
        <VehiclesView isDesktop />
      </div>
    </>
  )
}
