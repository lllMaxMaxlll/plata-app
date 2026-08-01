"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground w-full">
      {/* 1. Desktop Loading Layout (Visible on md and above) */}
      <div className="hidden md:flex min-h-screen w-full">
        {/* Sidebar Skeleton */}
        <aside className="w-72 shrink-0 border-r border-border bg-card/40 p-6 flex flex-col justify-between">
          <div className="flex flex-col gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2">
              <Skeleton className="size-10 rounded-2xl" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2 w-28" />
              </div>
            </div>

            {/* Button */}
            <Skeleton className="h-12 w-full rounded-2xl" />

            {/* Nav items */}
            <div className="flex flex-col gap-3 mt-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl opacity-70" />
              <Skeleton className="h-10 w-full rounded-xl opacity-70" />
              <Skeleton className="h-10 w-full rounded-xl opacity-70" />
            </div>
          </div>

          {/* User profile card */}
          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-3.5 px-2">
              <Skeleton className="size-11 rounded-2xl" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-28" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </aside>

        {/* Content Skeleton */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b border-border bg-card/20 px-8 py-5 flex items-center justify-between shrink-0">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-14 w-64 rounded-2xl" />
          </header>

          {/* Body */}
          <div className="flex-1 p-8 grid grid-cols-3 gap-8">
            <div className="col-span-2 flex flex-col gap-8">
              {/* Accounts */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-36 rounded-2xl" />
                  <Skeleton className="h-36 rounded-2xl opacity-75" />
                  <Skeleton className="h-36 rounded-2xl opacity-50" />
                </div>
              </div>

              {/* Chart */}
              <div className="rounded-xl border border-border bg-card/45 p-6 h-64 flex flex-col justify-between">
                <div>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20 mt-2" />
                  <Skeleton className="h-6 w-32 mt-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-8 rounded-lg" />
                  <Skeleton className="h-8 rounded-lg" />
                  <Skeleton className="h-8 rounded-lg" />
                  <Skeleton className="h-8 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-border bg-card/45 p-6 h-full flex flex-col gap-4">
              <Skeleton className="h-4 w-32 border-b border-border pb-4" />
              <div className="flex flex-col gap-4 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-2xl shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-3.5 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 2. Mobile Loading Layout (Visible on screens below md) */}
      <div className="md:hidden mx-auto min-h-screen w-full max-w-md bg-background px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-28 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-4.5 w-24" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>

        {/* Consolidated Balance Card */}
        <Skeleton className="h-32 rounded-xl" />

        {/* Accounts Title */}
        <div className="flex justify-between items-center mt-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>

        {/* Account Cards Carousel skeleton */}
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-32 w-44 rounded-2xl shrink-0" />
          <Skeleton className="h-32 w-44 rounded-2xl shrink-0 opacity-80" />
          <Skeleton className="h-32 w-28 rounded-2xl shrink-0 opacity-50" />
        </div>

        {/* Category Chart Card */}
        <Skeleton className="h-44 rounded-xl mt-2" />

        {/* Recent Transactions */}
        <div className="flex flex-col gap-3.5 mt-2">
          <Skeleton className="h-3.5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </div>

        {/* Bottom Nav bar shell */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 h-16 flex items-center justify-around">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-14 rounded-full -translate-y-4" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </nav>
      </div>
    </div>
  )
}
