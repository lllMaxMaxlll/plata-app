"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/lib/use-is-desktop"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

/**
 * Diálogo que en mobile se muestra como bottom sheet (arrastrable, pegado al
 * borde inferior y con el pulgar cerca de los controles) y en escritorio como
 * el diálogo centrado de siempre. Los formularios de la app son largos: en un
 * teléfono un modal centrado deja el teclado y los botones peleando por el
 * mismo espacio.
 */
const MobileContext = React.createContext(false)

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  // `null` (antes de conocer el breakpoint) cae en el diálogo de escritorio;
  // el shell no monta contenido hasta resolverlo, así que no hay parpadeo.
  const isMobile = useIsDesktop() === false

  return (
    <MobileContext.Provider value={isMobile}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </MobileContext.Provider>
  )
}

function ResponsiveDialogContent({
  className,
  drawerClassName,
  children,
}: {
  /** Clases del diálogo de escritorio (ancho, padding, etc.). */
  className?: string
  drawerClassName?: string
  children: React.ReactNode
}) {
  const isMobile = React.useContext(MobileContext)

  if (isMobile) {
    return (
      <DrawerContent className={drawerClassName}>
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {/* Además del swipe y el backdrop, un cierre explícito y alcanzable. */}
          <DrawerClose
            render={<Button variant="ghost" size="icon" className="absolute top-1 right-2 size-10" />}
          >
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </DrawerClose>
          {children}
        </div>
      </DrawerContent>
    )
  }

  return <DialogContent className={className}>{children}</DialogContent>
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = React.useContext(MobileContext)
  const Header = isMobile ? DrawerHeader : DialogHeader
  return (
    <Header
      className={cn(
        // El drawer centra el encabezado por defecto; estas hojas están
        // diseñadas con ícono + título alineados a la izquierda.
        isMobile && "px-0 pt-2 pr-12 group-data-[swipe-axis=y]/drawer-popup:text-left",
        className
      )}
      {...props}
    />
  )
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = React.useContext(MobileContext)
  const Title = isMobile ? DrawerTitle : DialogTitle
  return <Title className={className} {...props} />
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = React.useContext(MobileContext)
  const Description = isMobile ? DrawerDescription : DialogDescription
  return <Description className={className} {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
}
