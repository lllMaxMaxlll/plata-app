"use client"
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RiMenuLine, RiCloseLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { NAV_GROUPS, ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return <header className="flex items-center justify-between gap-3 border-b border-border px-4 pt-[env(safe-area-inset-top)]">
    <Link href="/" className="py-3 font-extrabold tracking-wide" aria-label="EN MANO, inicio">EN MANO</Link>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}><RiMenuLine data-icon="inline-start" /> Secciones</SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="overflow-y-auto pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <SheetClose render={<Button variant="ghost" size="icon-sm" aria-label="Cerrar secciones" className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)]" />}><RiCloseLine /></SheetClose>
        <SheetHeader className="pr-14"><SheetTitle>Todas las secciones</SheetTitle><SheetDescription>Accedé a cualquier pantalla de EN MANO.</SheetDescription></SheetHeader>
        <nav aria-label="Todas las secciones" className="flex flex-col gap-5 px-5 pb-6">
          {NAV_GROUPS.map(group => <div key={group.tab} className="flex flex-col gap-1">
            {[group.tab, ...group.children].map((key, index) => {
              const route = ROUTES[key]
              return <Link key={key} href={route.href} onClick={() => setOpen(false)} aria-current={pathname === route.href ? 'page' : undefined}
                className={cn('flex min-h-11 items-center rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring', index === 0 ? 'font-bold' : 'pl-5', pathname === route.href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{route.label}</Link>
            })}
          </div>)}
        </nav>
      </SheetContent>
    </Sheet>
  </header>
}
