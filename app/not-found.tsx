import Link from "next/link"
import { FileQuestion, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-lg mb-4">
        <FileQuestion className="size-8" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Página no encontrada
      </h1>
      <p className="mt-2 text-xs text-muted-foreground max-w-sm leading-relaxed">
        La ruta a la que estás intentando acceder no existe o ha sido movida.
      </p>

      <Button
        asChild
        variant="default"
        className="mt-6 flex items-center gap-2 rounded-xl text-xs font-semibold"
      >
        <Link href="/">
          <Home className="size-4" />
          Volver al panel principal
        </Link>
      </Button>
    </div>
  )
}
