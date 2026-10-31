"use client"

import { VehiclesView } from "@/components/finance/vehicles-view"
import { Suspense } from 'react'
import { LoadingSkeleton } from '@/components/finance/loading-skeleton'

export default function VehiclesPage() {
  return <Suspense fallback={<LoadingSkeleton />}><VehiclesView /></Suspense>
}
