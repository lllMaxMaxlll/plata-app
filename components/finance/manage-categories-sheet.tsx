"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BottomSheet } from "./bottom-sheet"
import { useFinance } from "./finance-provider"
import { DEFAULT_COLORS, type Category } from "@/lib/finance-data"
import { toast } from "sonner"

export function ManageCategoriesSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { categories, addCategory, updateCategory, deleteCategory } = useFinance()
  const [tab, setTab] = useState<"expense" | "income">("expense")
  
  // Form states
  const [name, setName] = useState("")
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0])
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Sync color with selection if editing
  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name)
      setSelectedColor(editingCategory.color)
    } else {
      setName("")
      setSelectedColor(DEFAULT_COLORS[0])
    }
  }, [editingCategory])

  // Filter categories by type
  const list = categories.filter((c) => c.type === tab)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, name.trim(), selectedColor)
        toast.success(`Categoría "${name.trim()}" modificada con éxito.`)
        setEditingCategory(null)
      } else {
        await addCategory(name.trim(), tab, selectedColor)
        toast.success(`Categoría "${name.trim()}" creada con éxito.`)
      }
      setName("")
      setSelectedColor(DEFAULT_COLORS[0])
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar la categoría.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(cat: Category) {
    const confirmed = window.confirm(
      `¿Estás seguro de que querés eliminar la categoría "${cat.name}"?\n(Los movimientos registrados seguirán mostrando este nombre de categoría)`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      await deleteCategory(cat.id)
      toast.success(`Categoría "${cat.name}" eliminada.`)
      if (editingCategory?.id === cat.id) {
        setEditingCategory(null)
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al eliminar la categoría.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Categorías"
      description="Gestioná tus categorías de ingresos y gastos."
    >
      <div className="mt-3 flex flex-col gap-5">
        {/* Type Tabs */}
        <Tabs value={tab} onValueChange={(val) => {
          setTab(val as "expense" | "income")
          setEditingCategory(null)
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expense" disabled={submitting}>Gastos</TabsTrigger>
            <TabsTrigger value="income" disabled={submitting}>Ingresos</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Categories List */}
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto no-scrollbar">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Categorías registradas
          </Label>
          {list.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No hay categorías de {tab === "expense" ? "gastos" : "ingresos"} creadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {list.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="size-3.5 rounded-full shrink-0"
                      style={{ background: cat.color }}
                    />
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={submitting}
                      onClick={() => setEditingCategory(cat)}
                      title="Editar"
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={submitting}
                      onClick={() => handleDelete(cat)}
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Creator / Editor Form */}
        <div className="border-t border-border pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {editingCategory ? "Editar categoría" : "Nueva categoría"}
            </Label>
            {editingCategory && (
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nombre</Label>
              <Input
                value={name}
                disabled={submitting}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Gimnasio, Freelance"
                maxLength={25}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Color de categoría</Label>
              <div className="flex flex-wrap gap-2.5 px-1 py-1">
                {DEFAULT_COLORS.map((c) => {
                  const active = selectedColor === c
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedColor(c)}
                      className={`size-6 rounded-full border border-black/25 relative transition-all active:scale-90 cursor-pointer ${
                        active
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                          : "hover:scale-105"
                      }`}
                      style={{ background: c }}
                    />
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !name.trim()}
              className="h-11 w-full text-sm font-semibold mt-1"
            >
              {submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : editingCategory ? (
                "Guardar cambios"
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Agregar categoría
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </BottomSheet>
  )
}
