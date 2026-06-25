"use client"

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background text-foreground w-full">
      {/* 1. Desktop Loading Layout (Visible on md and above) */}
      <div className="hidden md:flex min-h-screen w-full animate-pulse">
        {/* Sidebar Skeleton */}
        <aside className="w-72 shrink-0 border-r border-border/40 bg-card/25 p-6 flex flex-col justify-between">
          <div className="flex flex-col gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3 px-2">
              <div className="size-10 rounded-2xl bg-muted" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-2 w-28 rounded bg-muted" />
              </div>
            </div>

            {/* Button */}
            <div className="h-12 w-full rounded-2xl bg-muted" />

            {/* Nav items */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="h-10 w-full rounded-xl bg-muted" />
              <div className="h-10 w-full rounded-xl bg-muted/70" />
              <div className="h-10 w-full rounded-xl bg-muted/70" />
              <div className="h-10 w-full rounded-xl bg-muted/70" />
            </div>
          </div>

          {/* User profile card */}
          <div className="flex flex-col gap-4 border-t border-border/40 pt-6">
            <div className="flex items-center gap-3.5 px-2">
              <div className="size-11 rounded-2xl bg-muted" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2 w-28 rounded bg-muted" />
              </div>
            </div>
            <div className="h-8 w-24 rounded-lg bg-muted" />
          </div>
        </aside>

        {/* Content Skeleton */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="border-b border-border/30 bg-card/10 px-8 py-5 flex items-center justify-between shrink-0">
            <div className="flex flex-col gap-2">
              <div className="h-5 w-36 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
            {/* Balance cards skeleton */}
            <div className="h-14 w-64 rounded-2xl bg-muted" />
          </header>

          {/* Body */}
          <div className="flex-1 p-8 grid grid-cols-3 gap-8">
            <div className="col-span-2 flex flex-col gap-8">
              {/* Accounts */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 w-28 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-36 rounded-2xl bg-muted" />
                  <div className="h-36 rounded-2xl bg-muted/75" />
                  <div className="h-36 rounded-2xl bg-muted/50" />
                </div>
              </div>

              {/* Chart */}
              <div className="rounded-3xl border border-border/40 bg-card/45 p-6 h-64 flex flex-col justify-between">
                <div>
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted mt-2" />
                  <div className="h-6 w-32 rounded bg-muted mt-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-8 rounded-lg bg-muted" />
                  <div className="h-8 rounded-lg bg-muted" />
                  <div className="h-8 rounded-lg bg-muted" />
                  <div className="h-8 rounded-lg bg-muted" />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-3xl border border-border/40 bg-card/45 p-6 h-full flex flex-col gap-4">
              <div className="h-4 w-32 rounded bg-muted border-b border-border/20 pb-4" />
              <div className="flex flex-col gap-4 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-muted shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-2.5 w-16 rounded bg-muted" />
                    </div>
                    <div className="h-3.5 w-12 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 2. Mobile Loading Layout (Visible on screens below md) */}
      <div className="md:hidden mx-auto min-h-screen w-full max-w-md bg-background px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-28 animate-pulse flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-10 rounded bg-muted" />
            <div className="h-4.5 w-24 rounded bg-muted" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-9 rounded-full bg-muted" />
            <div className="size-9 rounded-full bg-muted" />
          </div>
        </div>

        {/* Consolidated Balance Card */}
        <div className="h-32 rounded-3xl bg-muted" />

        {/* Accounts Title */}
        <div className="flex justify-between items-center mt-2">
          <div className="h-3.5 w-20 rounded bg-muted" />
          <div className="h-3 w-12 rounded bg-muted" />
        </div>

        {/* Account Cards Carousel skeleton */}
        <div className="flex gap-3 overflow-hidden">
          <div className="h-32 w-44 rounded-2xl bg-muted shrink-0" />
          <div className="h-32 w-44 rounded-2xl bg-muted/80 shrink-0" />
          <div className="h-32 w-28 rounded-2xl bg-muted/50 shrink-0" />
        </div>

        {/* Category Chart Card */}
        <div className="h-44 rounded-3xl bg-muted mt-2" />

        {/* Recent Transactions */}
        <div className="flex flex-col gap-3.5 mt-2">
          <div className="h-3.5 w-32 rounded bg-muted" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3.5 w-24 rounded bg-muted" />
                <div className="h-2.5 w-16 rounded bg-muted" />
              </div>
              <div className="h-3.5 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Bottom Nav bar shell */}
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border bg-card/90 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 h-16 flex items-center justify-around">
          <div className="size-8 rounded-lg bg-muted" />
          <div className="size-8 rounded-lg bg-muted" />
          <div className="size-14 rounded-full bg-muted -translate-y-4" />
          <div className="size-8 rounded-lg bg-muted" />
          <div className="size-8 rounded-lg bg-muted" />
        </nav>
      </div>
    </div>
  )
}
